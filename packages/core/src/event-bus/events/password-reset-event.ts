import { RequestContext } from 'src/common/request-context';
import { User } from '../../entity/user/user.entity';
import { FirelancerEvent } from '../firelancer-event';

/**
 * @description
 * This event is fired when a Customer requests a password reset email.
 */
export class PasswordResetEvent extends FirelancerEvent {
  constructor(
    public ctx: RequestContext,
    public user: User,
  ) {
    super();
  }
}
