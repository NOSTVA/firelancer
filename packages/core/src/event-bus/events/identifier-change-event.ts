import { RequestContext } from 'src/common/request-context';
import { User } from '../../entity/user/user.entity';
import { FirelancerEvent } from '../firelancer-event';

/**
 * @description
 * This event is fired when a registered user successfully changes the identifier (ie email address)
 * associated with their account.
 */
export class IdentifierChangeEvent extends FirelancerEvent {
  constructor(
    public ctx: RequestContext,
    public user: User,
    public oldIdentifier: string,
  ) {
    super();
  }
}
