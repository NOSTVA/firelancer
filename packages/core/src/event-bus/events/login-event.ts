import { RequestContext } from 'src/common/request-context';
import { User } from '../../entity/user/user.entity';
import { FirelancerEvent } from '../firelancer-event';

/**
 * @description
 * This event is fired when a user successfully logs in via the shop or admin API `login` mutation.
 */
export class LoginEvent extends FirelancerEvent {
  constructor(
    public ctx: RequestContext,
    public user: User,
  ) {
    super();
  }
}
