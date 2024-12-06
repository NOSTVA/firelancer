import { FirelancerEntityEvent } from '../firelancer-entity-event';
import { Asset } from 'src/entity';
import { ID, RequestContext } from 'src/common';
import { CreateAssetInput, UpdateAssetInput } from 'src/api/schema';

type AssetInputTypes = CreateAssetInput | UpdateAssetInput | ID;

/**
 * @description
 * This event is fired whenever a Asset is added, updated or deleted.
 */
export class AssetEvent extends FirelancerEntityEvent<Asset, AssetInputTypes> {
  constructor(ctx: RequestContext, entity: Asset, type: 'created' | 'updated' | 'deleted', input?: AssetInputTypes) {
    super(entity, type, ctx, input);
  }
}
