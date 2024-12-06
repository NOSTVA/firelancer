import { ChildEntity, DeepPartial, Index, ManyToOne } from 'typeorm';
import { Customer } from '../customer/customer.entity';
import { HistoryEntry } from './history-entry.entity';

/**
 * @description
 * Represents an event in the history of a particular Customer.
 */
@ChildEntity()
export class CustomerHistoryEntry extends HistoryEntry {
  constructor(input: DeepPartial<CustomerHistoryEntry>) {
    super(input);
  }

  @Index()
  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  customer: Customer;
}
