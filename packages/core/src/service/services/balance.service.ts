import { Injectable } from '@nestjs/common';
import { CreateBalanceEntryInput } from 'src/api';
import { BalanceEntryStatus, RequestContext } from 'src/common';
import { TransactionalConnection } from 'src/connection';
import { Customer } from 'src/entity';
import { BalanceEntry } from 'src/entity/balance-entry/balance-entry.entity';
import { IsNull, Not } from 'typeorm';

/**
 * @description
 * Contains methods relating to Balance entities.
 */
@Injectable()
export class BalanceService {
  constructor(private connection: TransactionalConnection) {}

  async create(ctx: RequestContext, input: CreateBalanceEntryInput): Promise<BalanceEntry> {
    return this.connection.withTransaction(ctx, async (ctx) => {
      // TODO: perform some constraints checking for customer
      const entry = new BalanceEntry(input);
      entry.validate();
      await this.connection.getRepository(ctx, BalanceEntry).save(entry);
      // immediatly settle balance if entry does not require review
      return this.settle(ctx, entry.id);
    });
  }

  async settle(ctx: RequestContext, entryId: number): Promise<BalanceEntry> {
    return this.connection.withTransaction(ctx, async (ctx) => {
      const entry = await this.connection.getEntityOrThrow(ctx, BalanceEntry, entryId);
      if (entry.status === BalanceEntryStatus.SETTELABLE) {
        const latestSettledEntry = await this.getLatestSettledEntry(ctx, entry.customer);
        entry.prevSettledAt = latestSettledEntry?.settledAt ?? null;
        entry.prevBalance = latestSettledEntry?.balance ?? 0;
        entry.balance = entry.prevBalance + entry.credit - entry.debit;
        entry.settledAt = new Date();
        await this.connection.getRepository(ctx, BalanceEntry).update({ id: entry.id }, entry);
      }
      return entry;
    });
  }

  private async getLatestSettledEntry(ctx: RequestContext, customer: Customer): Promise<BalanceEntry | undefined> {
    return this.connection
      .getRepository(ctx, BalanceEntry)
      .findOne({
        where: {
          customer: customer,
          balance: Not(IsNull()),
          settledAt: Not(IsNull()),
        },
        order: {
          settledAt: 'DESC',
        },
      })
      .then((result) => result ?? undefined);
  }
}
