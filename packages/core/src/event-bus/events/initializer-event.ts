import { FirelancerEvent } from '../firelancer-event';

/**
 * @description
 * This event is fired when Firelancer finished initializing its services inside the InitializerService
 */
export class InitializerEvent extends FirelancerEvent {
  constructor() {
    super();
  }
}
