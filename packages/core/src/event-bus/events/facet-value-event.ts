import { CreateFacetValueInput, UpdateFacetValueInput } from 'src/api';
import { ID, RequestContext } from 'src/common';
import { FirelancerEntityEvent } from '../firelancer-entity-event';
import { FacetValue } from 'src/entity/facet-value/facet-value.entity';

type FacetValueInputTypes = CreateFacetValueInput | UpdateFacetValueInput | ID;

/**
 * @description
 * This event is fired whenever a FacetValue is added, updated or deleted.
 */
export class FacetValueEvent extends FirelancerEntityEvent<FacetValue, FacetValueInputTypes> {
  constructor(ctx: RequestContext, entity: FacetValue, type: 'created' | 'updated' | 'deleted', input?: FacetValueInputTypes) {
    super(entity, type, ctx, input);
  }
}
