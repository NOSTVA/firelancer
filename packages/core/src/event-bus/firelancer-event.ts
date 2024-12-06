/**
 * @description
 * The base class for all events used by the EventBus system.
 **/
export abstract class FirelancerEvent {
  public readonly createdAt: Date;
  protected constructor() {
    this.createdAt = new Date();
  }
}
