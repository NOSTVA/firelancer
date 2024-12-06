import { Injectable, Logger } from '@nestjs/common';
import { TransactionalConnection } from '../connection/transactional-connection';
import { Administrator } from '../entity/administrator/administrator.entity';
import { AdministratorService } from './services/administrator.service';
import { RoleService } from './services/role.service';
import { InitializerEvent } from 'src/event-bus/events/initializer-event';
import { EventBus } from 'src/event-bus/event-bus';
import { FacetService } from './services/facet.service';
import { FacetValueCategoryService } from './services/facet-value-categoery.service';
import { FacetValueService } from './services/facet-value.service';

/**
 * @description
 * Only used internally to run the various service init methods in the correct
 * sequence on bootstrap.
 */
@Injectable()
export class InitializerService {
  constructor(
    private connection: TransactionalConnection,
    private administratorService: AdministratorService,
    private roleService: RoleService,
    private facetService: FacetService,
    private facetValueCategoryService: FacetValueCategoryService,
    private facetValueService: FacetValueService,
    private eventBus: EventBus,
  ) {}

  async onModuleInit() {
    await this.awaitDbSchemaGeneration();
    // IMPORTANT - why manually invoke these init methods rather than just relying on
    // Nest's "onModuleInit" lifecycle hook within each individual service class?
    // The reason is that the order of invocation matters.
    await this.roleService.initRoles();
    await this.administratorService.initAdministrators();
    await this.facetService.initFacets();
    await this.facetValueCategoryService.initCategories();
    await this.facetValueService.initValues();
    await this.eventBus.publish(new InitializerEvent());
  }

  /**
   * On the first run of the server & worker, when dbConnectionOptions.synchronize = true, there can be
   * a race condition where the worker starts up before the server process has had a chance to generate
   * the DB schema. This results in a fatal error as the worker is not able to run its initialization
   * tasks which interact with the DB.
   *
   * This method applies retry logic to give the server time to populate the schema before the worker
   * continues with its bootstrap process.
   */
  private async awaitDbSchemaGeneration() {
    const retries = 20;
    const delayMs = 100;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.connection.rawConnection.getRepository(Administrator).find();
        return;
      } catch (e) {
        if (attempt < retries - 1) {
          Logger.warn(`Awaiting DB schema creation... (attempt ${attempt})`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          Logger.error('Timed out when awaiting the DB schema to be ready!', undefined, e instanceof Error ? e.stack : undefined);
        }
      }
    }
  }
}
