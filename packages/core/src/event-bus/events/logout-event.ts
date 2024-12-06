import { RequestContext } from 'src/common/request-context';
import { FirelancerEvent } from '../firelancer-event';

/**
 * @description
 * This event is fired when a user logs out via the shop or admin API `logout` mutation.
 */
export class LogoutEvent extends FirelancerEvent {
  constructor(public ctx: RequestContext) {
    super();
  }
}
