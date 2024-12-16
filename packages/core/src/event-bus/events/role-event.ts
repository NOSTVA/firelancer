import { CreateRoleInput, UpdateRoleInput } from '../../api/schema';
import { RequestContext } from '../../common/request-context';
import { ID } from '../../common/shared-types';
import { Role } from '../../entity/role/role.entity';
import { FirelancerEntityEvent } from '../firelancer-entity-event';

type RoleInputTypes = CreateRoleInput | UpdateRoleInput | ID;

/**
 * @description
 * This event is fired whenever one Role is added, updated or deleted.
 */
export class RoleEvent extends FirelancerEntityEvent<Role, RoleInputTypes> {
  constructor(ctx: RequestContext, entity: Role, type: 'created' | 'updated' | 'deleted', input?: RoleInputTypes) {
    super(entity, type, ctx, input);
  }
}
