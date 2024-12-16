import { DynamicModule, Injectable, Logger, Type } from '@nestjs/common';
import { DataSourceOptions } from 'typeorm';
import { getConfig } from './config-helpers';
import {
  ApiOptions,
  AssetOptions,
  AuthOptions,
  CatalogOptions,
  FirelancerConfig,
  JobQueueOptions,
  RuntimeFirelancerConfig,
  SystemOptions,
} from './firelancer-config';

@Injectable()
export class ConfigService implements FirelancerConfig {
  private activeConfig: RuntimeFirelancerConfig;

  constructor() {
    this.activeConfig = getConfig();
    if (this.activeConfig.authOptions.disableAuth) {
      Logger.warn('Auth has been disabled. This should never be the case for a production system!');
    }
  }

  get apiOptions(): Required<ApiOptions> {
    return this.activeConfig.apiOptions;
  }

  get authOptions(): Required<AuthOptions> {
    return this.activeConfig.authOptions;
  }

  get dbConnectionOptions(): DataSourceOptions {
    return this.activeConfig.dbConnectionOptions;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get plugins(): Array<DynamicModule | Type<any>> {
    return this.activeConfig.plugins;
  }

  get jobQueueOptions(): Required<JobQueueOptions> {
    return this.activeConfig.jobQueueOptions;
  }

  get assetOptions(): Required<AssetOptions> {
    return this.activeConfig.assetOptions;
  }

  get catalogOptions(): Required<CatalogOptions> {
    return this.activeConfig.catalogOptions;
  }

  get systemOptions(): Required<SystemOptions> {
    return this.activeConfig.systemOptions;
  }
}