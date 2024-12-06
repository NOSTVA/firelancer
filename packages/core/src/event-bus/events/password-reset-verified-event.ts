import { RequestContext } from 'src/common/request-context';
import { User } from '../../entity/user/user.entity';
import { FirelancerEvent } from '../firelancer-event';

/**
 * @description
 * This event is fired when a password reset is executed with a verified token.
 */
export class PasswordResetVerifiedEvent extends FirelancerEvent {
  constructor(
    public ctx: RequestContext,
    public user: User,
  ) {
    super();
  }
}
