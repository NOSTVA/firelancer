import { Injectable, Type } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { TransactionIsolationLevel } from 'src/api/decorators/transaction.decorator';
import { TRANSACTION_MANAGER_KEY } from 'src/common/constants';
import { EntityNotFoundError } from 'src/common/error/errors';
import { RequestContext } from 'src/common/request-context';
import { ID, SoftDeletable } from 'src/common/shared-types';
import { FirelancerEntity } from 'src/entity';
import { DataSource, EntityManager, EntitySchema, FindOneOptions, ObjectLiteral, ObjectType, Repository } from 'typeorm';
import { TransactionWrapper } from './transaction-wrapper';

/**
 * @description
 * The TransactionalConnection is a wrapper around the TypeORM `Connection` object which works in conjunction
 * with the Transaction decorator to implement per-request transactions. All services which access the
 * database should use this class rather than the raw TypeORM connection, to ensure that db changes can be
 * easily wrapped in transactions when required.
 *
 * The service layer does not need to know about the scope of a transaction, as this is covered at the
 * API by the use of the `Transaction` decorator.
 */
@Injectable()
export class TransactionalConnection {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private transactionWrapper: TransactionWrapper,
  ) {}

  /**
   * @description
   * The plain TypeORM Connection object. Should be used carefully as any operations
   * performed with this connection will not be performed within any outer
   * transactions.
   */
  get rawConnection(): DataSource {
    return this.dataSource;
  }

  /**
   * @description
   * Returns a TypeORM repository which is bound to any existing transactions. It is recommended to _always_ pass
   * the RequestContext argument when possible, otherwise the queries will be executed outside of any
   * ongoing transactions which have been started by the Transaction decorator.
   */
  getRepository<Entity extends ObjectLiteral>(
    ctx: RequestContext | undefined,
    target: ObjectType<Entity> | EntitySchema<Entity> | string,
  ): Repository<Entity>;
  getRepository<Entity extends ObjectLiteral>(
    ctxOrTarget: RequestContext | ObjectType<Entity> | EntitySchema<Entity> | string | undefined,
    maybeTarget?: ObjectType<Entity> | EntitySchema<Entity> | string,
  ): Repository<Entity> {
    if (ctxOrTarget instanceof RequestContext) {
      const transactionManager = this.getTransactionManager(ctxOrTarget);
      if (transactionManager) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return transactionManager.getRepository(maybeTarget!);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.rawConnection.getRepository(maybeTarget!);
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.rawConnection.getRepository(ctxOrTarget ?? maybeTarget!);
    }
  }

  /**
   * @description
   * Allows database operations to be wrapped in a transaction, ensuring that in the event of an error being
   * thrown at any point, the entire transaction will be rolled back and no changes will be saved.
   *
   * In the context of API requests, you should instead use the Transaction decorator on your resolver or
   * controller method.
   *
   * On the other hand, for code that does not run in the context of a GraphQL/REST request, this method
   * should be used to protect against non-atomic changes to the data which could leave your data in an
   * inconsistent state.
   *
   * Such situations include function processed by the JobQueue or stand-alone scripts which make use
   * of Firelancer internal services.
   *
   * If there is already a RequestContext object available, you should pass it in as the first
   * argument in order to create transactional context as the copy. If not, omit the first argument and an empty
   * RequestContext object will be created, which is then used to propagate the transaction to
   * all inner method calls.
   *
   * @example
   * ```ts
   * private async transferCredit(outerCtx: RequestContext, fromId: ID, toId: ID, amount: number) {
   *   await this.connection.withTransaction(outerCtx, async ctx => {
   *     // Note you must not use `outerCtx` here, instead use `ctx`. Otherwise, this query
   *     // will be executed outside of transaction
   *     await this.giftCardService.updateCustomerCredit(ctx, fromId, -amount);
   *
   *     await this.connection.getRepository(ctx, GiftCard).update(fromId, { transferred: true })
   *
   *     // If some intermediate logic here throws an Error,
   *     // then all DB transactions will be rolled back and neither Customer's
   *     // credit balance will have changed.
   *
   *     await this.giftCardService.updateCustomerCredit(ctx, toId, amount);
   *   })
   * }
   * ```
   */
  async withTransaction<T>(work: (ctx: RequestContext) => Promise<T>): Promise<T>;
  async withTransaction<T>(ctx: RequestContext, work: (ctx: RequestContext) => Promise<T>): Promise<T>;
  async withTransaction<T>(
    ctxOrWork: RequestContext | ((ctx: RequestContext) => Promise<T>),
    maybeWork?: (ctx: RequestContext) => Promise<T>,
  ): Promise<T> {
    let ctx: RequestContext;
    let work: (ctx: RequestContext) => Promise<T>;
    if (ctxOrWork instanceof RequestContext) {
      ctx = ctxOrWork;
      work = maybeWork!;
    } else {
      ctx = RequestContext.empty();
      work = ctxOrWork;
    }
    return this.transactionWrapper.executeInTransaction(ctx, work, 'auto', undefined, this.rawConnection);
  }

  /**
   * @description
   * Manually start a transaction if one is not already in progress. This method should be used in
   * conjunction with the `'manual'` mode of the Transaction decorator.
   */
  async startTransaction(ctx: RequestContext, isolationLevel?: TransactionIsolationLevel) {
    const transactionManager = this.getTransactionManager(ctx);
    if (transactionManager?.queryRunner?.isTransactionActive === false) {
      await transactionManager.queryRunner.startTransaction(isolationLevel);
    }
  }

  /**
   * @description
   * Manually commits any open transaction. Should be very rarely needed, since the Transaction decorator
   * and the internal TransactionInterceptor take care of this automatically. Use-cases include situations
   * in which the worker thread needs to access changes made in the current transaction, or when using the
   * Transaction decorator in manual mode.
   */
  async commitOpenTransaction(ctx: RequestContext) {
    const transactionManager = this.getTransactionManager(ctx);
    if (transactionManager?.queryRunner?.isTransactionActive) {
      await transactionManager.queryRunner.commitTransaction();
    }
  }

  /**
   * @description
   * Manually rolls back any open transaction. Should be very rarely needed, since the Transaction decorator
   * and the internal TransactionInterceptor take care of this automatically. Use-cases include when using the
   * Transaction decorator in manual mode.
   */
  async rollBackTransaction(ctx: RequestContext) {
    const transactionManager = this.getTransactionManager(ctx);
    if (transactionManager?.queryRunner?.isTransactionActive) {
      await transactionManager.queryRunner.rollbackTransaction();
    }
  }

  /**
   * @description
   * Finds an entity of the given type by ID, or throws an `EntityNotFoundError` if none
   * is found.
   */
  async getEntityOrThrow<T extends FirelancerEntity>(
    ctx: RequestContext,
    entityType: Type<T>,
    id: ID,
    options: GetEntityOrThrowOptions<T> = {},
  ): Promise<T> {
    const { retries, retryDelay } = options;
    if (retries == null || retries <= 0) {
      return this.getEntityOrThrowInternal(ctx, entityType, id, options);
    } else {
      let err: any;
      const retriesInt = Math.ceil(retries);
      const delay = Math.ceil(Math.max(retryDelay || 25, 1));
      for (let attempt = 0; attempt < retriesInt; attempt++) {
        try {
          const result = await this.getEntityOrThrowInternal(ctx, entityType, id, options);
          return result;
        } catch (e: any) {
          err = e;
          if (attempt < retriesInt - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
      throw err;
    }
  }

  private async getEntityOrThrowInternal<T extends FirelancerEntity>(
    ctx: RequestContext,
    entityType: Type<T>,
    id: ID,
    options: GetEntityOrThrowOptions = {},
  ): Promise<T> {
    let entity: T | undefined;
    const optionsWithId = {
      ...options,
      where: {
        ...(options.where || {}),
        id,
      },
    } as FindOneOptions<T>;

    entity = await this.getRepository(ctx, entityType)
      .findOne(optionsWithId)
      .then((result) => result ?? undefined);

    if (
      !entity ||
      (entity.hasOwnProperty('deletedAt') && (entity as T & SoftDeletable).deletedAt !== null && options.includeSoftDeleted !== true)
    ) {
      throw new EntityNotFoundError(entityType.name as any, id);
    }
    return entity;
  }

  private getTransactionManager(ctx: RequestContext): EntityManager | undefined {
    return (ctx as any)[TRANSACTION_MANAGER_KEY];
  }
}

/**
 * @description
 * Options used by the TransactionalConnection `getEntityOrThrow` method.
 */
export interface GetEntityOrThrowOptions<T = any> extends FindOneOptions<T> {
  /**
   * @description
   * If set to a positive integer, it will retry getting the entity in case it is initially not
   * found.
   *
   * @default 0
   */
  retries?: number;
  /**
   * @description
   * Specifies the delay in ms to wait between retries.
   *
   * @default 25
   */
  retryDelay?: number;
  /**
   * @description
   * If set to `true`, soft-deleted entities will be returned. Otherwise they will
   * throw as if they did not exist.
   *
   * @default false
   */
  includeSoftDeleted?: boolean;
}
