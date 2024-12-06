import { CreateFacetInput, UpdateFacetInput } from 'src/api';
import { Facet } from 'src/entity/facet/facet.entity';
import { FirelancerEntityEvent } from '../firelancer-entity-event';
import { ID, RequestContext } from 'src/common';

type FacetInputTypes = CreateFacetInput | UpdateFacetInput | ID;

/**
 * @description
 * This event is fired whenever a Facet is added, updated or deleted.
 */
export class FacetEvent extends FirelancerEntityEvent<Facet, FacetInputTypes> {
  constructor(ctx: RequestContext, entity: Facet, type: 'created' | 'updated' | 'deleted', input?: FacetInputTypes) {
    super(entity, type, ctx, input);
  }
}
