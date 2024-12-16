import { Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectableStrategy } from '../common/injectable-strategy';
import { Injector } from '../common/injector';
import { resetConfig } from './config-helpers';
import { ConfigService } from './config.service';

@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    private configService: ConfigService,
    private moduleRef: ModuleRef,
  ) {}

  async onApplicationBootstrap() {
    await this.initInjectableStrategies();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onApplicationShutdown(signal?: string) {
    await this.destroyInjectableStrategies();
    /**
     * When the application shuts down, we reset the activeConfig to the default. Usually this is
     * redundant, as the app shutdown would normally coincide with the process ending. However, in some
     * circumstances, such as when running migrations immediately followed by app bootstrap, the activeConfig
     * will persist between these two applications and mutations e.g. to the CustomFields will result in
     * hard-to-debug errors. So resetting is a precaution against this scenario.
     */
    resetConfig();
  }

  private async initInjectableStrategies() {
    const injector = new Injector(this.moduleRef);
    for (const strategy of this.getInjectableStrategies()) {
      if (typeof strategy.init === 'function') {
        await strategy.init(injector);
      }
    }
  }

  private async destroyInjectableStrategies() {
    for (const strategy of this.getInjectableStrategies()) {
      if (typeof strategy.destroy === 'function') {
        await strategy.destroy();
      }
    }
  }

  private getInjectableStrategies(): InjectableStrategy[] {
    const { assetNamingStrategy, assetPreviewStrategy, assetStorageStrategy } = this.configService.assetOptions;
    const { jobQueueStrategy, jobBufferStorageStrategy } = this.configService.jobQueueOptions;
    const {
      adminAuthenticationStrategy,
      shopAuthenticationStrategy,
      sessionCacheStrategy,
      passwordHashingStrategy,
      passwordValidationStrategy,
    } = this.configService.authOptions;

    return [
      assetNamingStrategy,
      assetPreviewStrategy,
      assetStorageStrategy,
      ...adminAuthenticationStrategy,
      ...shopAuthenticationStrategy,
      sessionCacheStrategy,
      passwordHashingStrategy,
      passwordValidationStrategy,
      jobQueueStrategy,
      jobBufferStorageStrategy,
    ];
  }
}