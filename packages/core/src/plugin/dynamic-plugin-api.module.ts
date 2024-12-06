import { DynamicModule, Type } from '@nestjs/common';
import { getConfig } from '../config/config-helpers';
import { getModuleMetadata, isDynamicModule, restControllersFor } from './plugin-metadata';
import { notNullOrUndefined } from 'src/common/utils';
import { RouterModule } from '@nestjs/core';

const dynamicApiModuleClassMap: { [name: string]: Type<unknown> } = {};

/**
 * This function dynamically creates a Nest module to house any REST controllers defined by
 * any configured plugins.
 */
export function createDynamicRestModulesForPlugins(apiType: 'shop' | 'admin'): DynamicModule[] {
  const config = getConfig();
  return config.plugins
    .map((plugin) => {
      const pluginModule = isDynamicModule(plugin) ? plugin.module : plugin;
      const controllers = restControllersFor(plugin, apiType) || [];

      if (controllers.length) {
        const className = dynamicClassName(pluginModule, apiType);
        dynamicApiModuleClassMap[className] = class {};
        Object.defineProperty(dynamicApiModuleClassMap[className], 'name', { value: className });
        const { imports } = getModuleMetadata(pluginModule);
        return {
          module: dynamicApiModuleClassMap[className],
          imports: [
            pluginModule,
            ...imports,
            RouterModule.register([
              {
                path: apiType === 'admin' ? config.apiOptions.adminApiPath : config.apiOptions.shopApiPath,
                module: dynamicApiModuleClassMap[className],
              },
            ]),
          ],
          controllers: [...controllers],
        };
      }
    })
    .filter(notNullOrUndefined);
}

/**
 * This function retrieves any dynamic modules which were created with createDynamicRestModulesForPlugins.
 */
export function getDynamicRestModulesForPlugins(apiType: 'shop' | 'admin'): Array<Type<unknown>> {
  return getConfig()
    .plugins.map((plugin) => {
      const pluginModule = isDynamicModule(plugin) ? plugin.module : plugin;
      restControllersFor(plugin, apiType) || [];

      const className = dynamicClassName(pluginModule, apiType);
      return dynamicApiModuleClassMap[className];
    })
    .filter(notNullOrUndefined);
}

function dynamicClassName(module: Type<unknown>, apiType: 'shop' | 'admin'): string {
  return module.name + 'Dynamic' + (apiType === 'shop' ? 'Shop' : 'Admin') + 'Module';
}
