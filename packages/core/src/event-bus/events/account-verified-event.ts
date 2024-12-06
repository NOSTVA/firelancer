import { Customer } from '../../entity/customer/customer.entity';
import { RequestContext } from 'src/common/request-context';
import { FirelancerEvent } from '../firelancer-event';

/**
 * @description
 * This event is fired when a users email address successfully gets verified after
 * the `verifyCustomerAccount` mutation was executed.
 */
export class AccountVerifiedEvent extends FirelancerEvent {
  constructor(
    public ctx: RequestContext,
    public customer: Customer,
  ) {
    super();
  }
}
