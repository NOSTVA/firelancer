import { BalanceEntryStatus, BalanceEntryType, ID } from 'src/common';
import { Column, DeepPartial, Entity, ManyToOne, OneToMany } from 'typeorm';
import { FirelancerEntity } from '../base/base.entity';
import { Customer } from '../customer/customer.entity';
import date from 'date-fns';

/**
 * @description
 * BalanceEntry
 */
@Entity()
export class BalanceEntry extends FirelancerEntity {
  constructor(input?: DeepPartial<BalanceEntry>) {
    super(input);
  }

  @Column()
  type: BalanceEntryType;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column()
  customerId: ID;

  @ManyToOne(() => Customer)
  customer: Customer;

  @Column({ type: 'int', nullable: true })
  balance: number | null;

  @Column({ default: 0 })
  credit: number;

  @Column({ default: 0 })
  debit: number;

  @Column({ default: 0 })
  reviewDays: number;

  @Column({ type: Date, nullable: true })
  settledAt: Date | null;

  @Column({ type: 'int', nullable: true })
  prevBalance: number | null;

  @Column({ type: Date, nullable: true })
  prevSettledAt: Date | null;

  @Column({ nullable: true })
  parentId: ID | null;

  @ManyToOne(() => BalanceEntry, (entry) => entry.children, { nullable: true, onDelete: 'CASCADE' })
  parent: BalanceEntry | null;

  @OneToMany(() => BalanceEntry, (entry) => entry.parent)
  children: BalanceEntry[];

  @Column('simple-json', { nullable: true })
  metadata: any;

  get status(): BalanceEntryStatus {
    const settled = this.settledAt !== null && this.balance !== null;
    const reviewDate = date.addDays(this.createdAt, this.reviewDays);
    const settleable = this.reviewDays === 0 || date.isBefore(reviewDate, new Date());
    if (settled) {
      return BalanceEntryStatus.SETTLED;
    } else if (settleable) {
      return BalanceEntryStatus.SETTELABLE;
    } else {
      return BalanceEntryStatus.PENDING;
    }
  }

  validate() {
    if (this.debit < 0) {
      throw new Error('entry.debit cannot be negative number');
    }

    if (this.credit < 0) {
      throw new Error('entry.credit cannot be negative number');
    }

    if (!Number.isInteger(this.debit)) {
      throw new Error('entry.debit must be integer number');
    }

    if (!Number.isInteger(this.credit)) {
      throw new Error('entry.credit must be integer number');
    }
  }
}
