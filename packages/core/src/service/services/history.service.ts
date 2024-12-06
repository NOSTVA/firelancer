import { Injectable } from '@nestjs/common';
import { RequestContext } from 'src/common/request-context';
import { HistoryEntryType, ID } from 'src/common/shared-types';
import { TransactionalConnection } from 'src/connection/transactional-connection';
import { Administrator } from 'src/entity/administrator/administrator.entity';
import { CustomerHistoryEntry } from 'src/entity/history-entry/customer-history-entry.entity';
import { AdministratorService } from './administrator.service';
import { UpdateCustomerInput } from 'src/api/schema';
import { EventBus } from 'src/event-bus/event-bus';
import { HistoryEntryEvent } from 'src/event-bus/events/history-entry-event';

export interface CustomerHistoryEntryData {
  [HistoryEntryType.CUSTOMER_REGISTERED]: { strategy: string };
  [HistoryEntryType.CUSTOMER_VERIFIED]: { strategy: string };
  [HistoryEntryType.CUSTOMER_PASSWORD_UPDATED]: Record<string, never>;
  [HistoryEntryType.CUSTOMER_PASSWORD_RESET_REQUESTED]: Record<string, never>;
  [HistoryEntryType.CUSTOMER_PASSWORD_RESET_VERIFIED]: Record<string, never>;
  [HistoryEntryType.CUSTOMER_DETAIL_UPDATED]: {
    input: UpdateCustomerInput;
  };
  [HistoryEntryType.CUSTOMER_EMAIL_UPDATE_REQUESTED]: {
    oldEmailAddress: string;
    newEmailAddress: string;
  };
  [HistoryEntryType.CUSTOMER_EMAIL_UPDATE_VERIFIED]: {
    oldEmailAddress: string;
    newEmailAddress: string;
  };
}

export interface CreateCustomerHistoryEntryArgs<T extends keyof CustomerHistoryEntryData> {
  customerId: ID;
  ctx: RequestContext;
  type: T;
  data: CustomerHistoryEntryData[T];
}

export interface UpdateCustomerHistoryEntryArgs<T extends keyof CustomerHistoryEntryData> {
  entryId: ID;
  ctx: RequestContext;
  type: T;
  data?: CustomerHistoryEntryData[T];
}

/**
 * @description
 * Contains methods relating to HistoryEntry entities. Histories are timelines of actions
 * related to a particular Customer or Order, recording significant events such as creation, state changes,
 * notes, etc.
 */
@Injectable()
export class HistoryService {
  constructor(
    private connection: TransactionalConnection,
    private administratorService: AdministratorService,
    private eventBus: EventBus,
  ) {}

  async getHistoryForCustomer(ctx: RequestContext, customerId: ID, publicOnly: boolean): Promise<CustomerHistoryEntry[]> {
    return this.connection.getRepository(ctx, CustomerHistoryEntry).find({
      where: {
        customer: {
          id: customerId,
        },
        isPublic: publicOnly,
      },
      relations: {
        administrator: true,
      },
    });
  }

  async createHistoryEntryForCustomer<T extends keyof CustomerHistoryEntryData>(
    args: CreateCustomerHistoryEntryArgs<T>,
    isPublic = false,
  ): Promise<CustomerHistoryEntry> {
    const { ctx, data, customerId, type } = args;
    const administrator = await this.getAdministratorFromContext(ctx);
    const entry = new CustomerHistoryEntry({
      createdAt: new Date(),
      type,
      isPublic,
      data: data as unknown,
      customer: { id: customerId },
      administrator,
    });
    const history = await this.connection.getRepository(ctx, CustomerHistoryEntry).save(entry);
    await this.eventBus.publish(new HistoryEntryEvent(ctx, history, 'created', 'customer', { type, data }));
    return history;
  }

  async updateCustomerHistoryEntry<T extends keyof CustomerHistoryEntryData>(ctx: RequestContext, args: UpdateCustomerHistoryEntryArgs<T>) {
    const entry = await this.connection.getEntityOrThrow(ctx, CustomerHistoryEntry, args.entryId, {
      where: { type: args.type },
    });

    if (args.data) {
      entry.data = args.data;
    }
    const administrator = await this.getAdministratorFromContext(ctx);
    if (administrator) {
      entry.administrator = administrator;
    }
    const newEntry = await this.connection.getRepository(ctx, CustomerHistoryEntry).save(entry);
    await this.eventBus.publish(new HistoryEntryEvent(ctx, entry, 'updated', 'customer', args));
    return newEntry;
  }

  async deleteCustomerHistoryEntry(ctx: RequestContext, id: ID): Promise<void> {
    const entry = await this.connection.getEntityOrThrow(ctx, CustomerHistoryEntry, id);
    const deletedEntry = new CustomerHistoryEntry(entry);
    await this.connection.getRepository(ctx, CustomerHistoryEntry).remove(entry);
    await this.eventBus.publish(new HistoryEntryEvent(ctx, deletedEntry, 'deleted', 'customer', id));
  }

  private async getAdministratorFromContext(ctx: RequestContext): Promise<Administrator | undefined> {
    const administrator = ctx.activeUserId ? await this.administratorService.findOneByUserId(ctx, ctx.activeUserId) : undefined;
    return administrator;
  }
}
