import { CreateRoleInput, UpdateRoleInput } from 'src/api/schema';
import { FirelancerEntityEvent } from '../firelancer-entity-event';
import { ID } from 'src/common/shared-types';
import { RequestContext } from 'src/common/request-context';
import { Role } from 'src/entity/role/role.entity';

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
