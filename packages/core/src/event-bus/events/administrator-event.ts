import { CreateAdministratorInput, UpdateAdministratorInput } from 'src/api/schema';
import { RequestContext } from 'src/common/request-context';
import { ID } from 'src/common/shared-types';
import { Administrator } from 'src/entity/administrator/administrator.entity';
import { FirelancerEntityEvent } from '../firelancer-entity-event';

type AdministratorInputTypes = CreateAdministratorInput | UpdateAdministratorInput | ID;

/**
 * @description
 * This event is fired whenever a Administrator is added, updated or deleted.
 */
export class AdministratorEvent extends FirelancerEntityEvent<Administrator, AdministratorInputTypes> {
  constructor(ctx: RequestContext, entity: Administrator, type: 'created' | 'updated' | 'deleted', input?: AdministratorInputTypes) {
    super(entity, type, ctx, input);
  }
}
