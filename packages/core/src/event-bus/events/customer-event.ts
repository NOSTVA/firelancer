import { CreateCustomerInput, UpdateCustomerInput } from 'src/api/schema';
import { CustomerType, ID } from 'src/common/shared-types';
import { FirelancerEntityEvent } from '../firelancer-entity-event';
import { Customer } from 'src/entity/customer/customer.entity';
import { RequestContext } from 'src/common/request-context';

type CustomerInputTypes =
  | CreateCustomerInput
  | UpdateCustomerInput
  | (Partial<CreateCustomerInput> & { customerType: CustomerType; emailAddress: string })
  | ID;

/**
 * @description
 * This event is fired whenever a Customer is added, updated or deleted.
 */
export class CustomerEvent extends FirelancerEntityEvent<Customer, CustomerInputTypes> {
  constructor(ctx: RequestContext, entity: Customer, type: 'created' | 'updated' | 'deleted', input?: CustomerInputTypes) {
    super(entity, type, ctx, input);
  }
}
