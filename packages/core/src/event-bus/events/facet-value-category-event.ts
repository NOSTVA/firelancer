import { CreateFacetValueCategoryInput, UpdateFacetValueCategoryInput } from 'src/api';
import { ID, RequestContext } from 'src/common';
import { FacetValueCategory } from 'src/entity/facet-value-category/facet-value-category.entity';
import { FirelancerEntityEvent } from '../firelancer-entity-event';

type FacetValueCategoryInputTypes = CreateFacetValueCategoryInput | UpdateFacetValueCategoryInput | ID;

/**
 * @description
 * This event is fired whenever a FacetValueCategory is added, updated or deleted.
 */
export class FacetValueCategoryEvent extends FirelancerEntityEvent<FacetValueCategory, FacetValueCategoryInputTypes> {
  constructor(
    ctx: RequestContext,
    entity: FacetValueCategory,
    type: 'created' | 'updated' | 'deleted',
    input?: FacetValueCategoryInputTypes,
  ) {
    super(entity, type, ctx, input);
  }
}
