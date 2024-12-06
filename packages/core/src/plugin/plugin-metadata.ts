import { DynamicModule, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { notNullOrUndefined } from 'src/common/utils';
import { APIExtensionDefinition, PluginConfigurationFn } from './firelancer-plugin';

export const PLUGIN_METADATA = {
  CONFIGURATION: 'configuration',
  SHOP_API_EXTENSIONS: 'shopApiExtensions',
  ADMIN_API_EXTENSIONS: 'adminApiExtensions',
  ENTITIES: 'entities',
  COMPATIBILITY: 'compatibility',
};

export function getEntitiesFromPlugins(plugins?: Array<Type<unknown> | DynamicModule>): Array<Type<unknown>> {
  if (!plugins) {
    return [];
  }
  return plugins
    .map((p) => reflectMetadata(p, PLUGIN_METADATA.ENTITIES))
    .reduce((all, entities) => {
      const resolvedEntities = typeof entities === 'function' ? entities() : (entities ?? []);
      return [...all, ...resolvedEntities];
    }, []);
}

export function getModuleMetadata(module: Type<unknown>) {
  return {
    controllers: Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) || [],
    providers: Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module) || [],
    imports: Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) || [],
    exports: Reflect.getMetadata(MODULE_METADATA.EXPORTS, module) || [],
  };
}

export function getPluginAPIExtensions(plugins: Array<Type<unknown> | DynamicModule>, apiType: 'shop' | 'admin'): APIExtensionDefinition[] {
  const extensions =
    apiType === 'shop'
      ? plugins.map((p) => reflectMetadata(p, PLUGIN_METADATA.SHOP_API_EXTENSIONS))
      : plugins.map((p) => reflectMetadata(p, PLUGIN_METADATA.ADMIN_API_EXTENSIONS));

  return extensions.filter(notNullOrUndefined);
}

export function getCompatibility(plugin: Type<unknown> | DynamicModule): string | undefined {
  return reflectMetadata(plugin, PLUGIN_METADATA.COMPATIBILITY);
}

export function getConfigurationFunction(plugin: Type<unknown> | DynamicModule): PluginConfigurationFn | undefined {
  return reflectMetadata(plugin, PLUGIN_METADATA.CONFIGURATION);
}

export function restControllersFor(plugin: Type<unknown> | DynamicModule, apiType: 'shop' | 'admin'): Array<Type<unknown>> {
  const apiExtensions: APIExtensionDefinition =
    apiType === 'shop'
      ? reflectMetadata(plugin, PLUGIN_METADATA.SHOP_API_EXTENSIONS)
      : reflectMetadata(plugin, PLUGIN_METADATA.ADMIN_API_EXTENSIONS);

  return apiExtensions
    ? typeof apiExtensions.controllers === 'function'
      ? apiExtensions.controllers()
      : (apiExtensions.controllers ?? [])
    : [];
}

function reflectMetadata(metatype: Type<unknown> | DynamicModule, metadataKey: string) {
  if (isDynamicModule(metatype)) {
    return Reflect.getMetadata(metadataKey, metatype.module);
  } else {
    return Reflect.getMetadata(metadataKey, metatype);
  }
}

export function isDynamicModule(input: Type<unknown> | DynamicModule): input is DynamicModule {
  return !!(input as DynamicModule).module;
}
