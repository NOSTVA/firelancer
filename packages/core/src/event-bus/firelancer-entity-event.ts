import { RequestContext } from 'src/common/request-context';
import { FirelancerEvent } from './firelancer-event';

/**
 * @description
 * The base class for all entity Firelancer used by the EventBus system.
 * * For event type `'deleted'` the input will most likely be an `id: ID`
 * */
export abstract class FirelancerEntityEvent<Entity, Input = unknown> extends FirelancerEvent {
  public readonly entity: Entity;
  public readonly type: 'created' | 'updated' | 'deleted';
  public readonly ctx: RequestContext;
  public readonly input?: Input;

  protected constructor(entity: Entity, type: 'created' | 'updated' | 'deleted', ctx: RequestContext, input?: Input) {
    super();
    this.entity = entity;
    this.type = type;
    this.ctx = ctx;
    this.input = input;
  }
}
