import { RequestContext } from 'src/common/request-context';
import { FirelancerEvent } from '../firelancer-event';

/**
 * @description
 * This event is fired when an attempt is made to log in via the shop or admin API `login` mutation.
 * The `strategy` represents the name of the AuthenticationStrategy used in the login attempt.
 * If the "native" strategy is used, the additional `identifier` property will be available.
 */
export class AttemptedLoginEvent extends FirelancerEvent {
  constructor(
    public ctx: RequestContext,
    public strategy: string,
    public identifier?: string,
  ) {
    super();
  }
}
