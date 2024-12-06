import { RequestContext } from 'src/common/request-context';
import { User } from '../../entity/user/user.entity';
import { FirelancerEvent } from '../firelancer-event';

/**
 * @description
 * This event is fired when a registered user requests to update the identifier (ie email address)
 * associated with the account.
 */
export class IdentifierChangeRequestEvent extends FirelancerEvent {
  constructor(
    public ctx: RequestContext,
    public user: User,
  ) {
    super();
  }
}
