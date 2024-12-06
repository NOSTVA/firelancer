import { Module, Provider, Type as NestType } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { PLUGIN_METADATA } from './plugin-metadata';
import { RuntimeFirelancerConfig } from 'src/config/firelancer-config';
import { pick } from 'src/common/utils/pick';

/**
 * @description
 * Defines the metadata of a Firelancer plugin. This interface is an superset of the [Nestjs ModuleMetadata](https://docs.nestjs.com/modules)
 * (which allows the definition of `imports`, `exports`, `providers` and `controllers`), which means
 * that any Nestjs Module is a valid Firelancer plugin. In addition, the FirelancerPluginMetadata allows the definition of
 * extra properties specific to Firelancer.
 */
export interface FirelancerPluginMetadata extends ModuleMetadata {
  /**
   * @description
   * A function which can modify the FirelancerConfig object before the server bootstraps.
   */
  configuration?: PluginConfigurationFn;
  /**
   * @description
   * The plugin may extend the default Firelancer REST shop api by providing extended
   * schema definitions and any required resolvers.
   */
  shopApiExtensions?: APIExtensionDefinition;
  /**
   * @description
   * The plugin may extend the default Firelancer REST admin api by providing extended
   * schema definitions and any required resolvers.
   */
  adminApiExtensions?: APIExtensionDefinition;
  /**
   * @description
   * The plugin may define custom [TypeORM database entities](https://typeorm.io/#/entities).
   */
  entities?: Array<Type<unknown>> | (() => Array<Type<unknown>>);
  /**
   * @description
   * The plugin should define a valid [semver version string](https://www.npmjs.com/package/semver) to indicate which versions of
   * firelancer core it is compatible with. Attempting to use a plugin with an incompatible
   * version of firelancer will result in an error and the server will be unable to bootstrap.
   *
   * If a plugin does not define this property, a message will be logged on bootstrap that the plugin is not
   * guaranteed to be compatible with the current version of Firelancer.
   *
   * To effectively disable this check for a plugin, you can use an overly-permissive string such as `>0.0.0`.
   *
   * @example
   * ```ts
   * compatibility: '^3.0.0'
   * ```
   */
  compatibility?: string;
}

/**
 * @description
 * An object which allows a plugin to extend the Firelancer REST API.
 * */

export interface APIExtensionDefinition {
  /**
   * @description
   * An array of controllers. Should be defined as [Nestjs REST Controller](https://docs.nestjs.com/controllers)
   * classes, i.e. using the Nest `\@Resolver()` decorator etc.
   */
  controllers?: Array<Type<unknown>> | (() => Array<Type<unknown>>);
}

/**
 * @description
 * This method is called before the app bootstraps and should be used to perform any needed modifications to the FirelancerConfig.
 */
export type PluginConfigurationFn = (config: RuntimeFirelancerConfig) => RuntimeFirelancerConfig | Promise<RuntimeFirelancerConfig>;

/**
 * @description
 * The FirelancerPlugin decorator is a means of configuring and/or extending the functionality of the Firelancer server. A Firelancer plugin is
 * a [Nestjs Module](https://docs.nestjs.com/modules), with optional additional metadata defining custom configuration or new database entities.
 *
 * @example
 * ```ts
 * import { Controller, Get } from '\@nestjs/common';
 * import { Ctx, PluginCommonModule, JobPostService, RequestContext, FirelancerPlugin } from '\@firelancer/core';
 *
 * \@Controller('job-posts')
 * export class JobPostsController {
 *     constructor(private jobPostService: JobPostService) {}
 *
 *     \@Get()
 *     findAll(\@Ctx() ctx: RequestContext) {
 *         return this.jobPostService.findAll(ctx);
 *     }
 * }
 *
 *
 * //A simple plugin which adds a REST endpoint for querying JobPosts.
 * \@FirelancerPlugin({
 *     imports: [PluginCommonModule],
 *     controllers: [JobPostsController],
 * })
 * export class RestPlugin {}
 * ```
 */
export function FirelancerPlugin(pluginMetadata: FirelancerPluginMetadata): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (target: Function) => {
    for (const metadataProperty of Object.values(PLUGIN_METADATA)) {
      const property = metadataProperty as keyof FirelancerPluginMetadata;
      if (pluginMetadata[property] != null) {
        Reflect.defineMetadata(property, pluginMetadata[property], target);
      }
    }
    const nestModuleMetadata = pick(pluginMetadata, Object.values(MODULE_METADATA) as any);
    const nestGlobalProviderTokens = [APP_INTERCEPTOR, APP_FILTER, APP_GUARD, APP_PIPE];
    const exportedProviders = (nestModuleMetadata.providers || []).filter((provider) => {
      if (isNamedProvider(provider)) {
        if (nestGlobalProviderTokens.includes(provider.provide as any)) {
          return false;
        }
      }
      return true;
    });
    nestModuleMetadata.exports = [...(nestModuleMetadata.exports || []), ...exportedProviders];
    Module(nestModuleMetadata)(target);
  };
}

function isNamedProvider(provider: Provider): provider is Exclude<Provider, NestType<unknown>> {
  return Object.prototype.hasOwnProperty.call(provider, 'provide');
}
