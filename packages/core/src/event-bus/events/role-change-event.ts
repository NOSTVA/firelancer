import { RequestContext } from 'src/common/request-context';
import { FirelancerEvent } from '../firelancer-event';
import { Administrator } from 'src/entity/administrator/administrator.entity';
import { ID } from 'src/common/shared-types';

/**
 * @description
 * This event is fired whenever one Role is assigned or removed from a user.
 * The property `roleIds` only contains the removed or assigned role ids.
 */
export class RoleChangeEvent extends FirelancerEvent {
  constructor(
    public ctx: RequestContext,
    public admin: Administrator,
    public roleIds: ID[],
    public type: 'assigned' | 'removed',
  ) {
    super();
  }
}
