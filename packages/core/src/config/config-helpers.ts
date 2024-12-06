import { merge } from 'ts-deepmerge';
import { defaultConfig } from './default-config';
import { PartialFirelancerConfig, RuntimeFirelancerConfig } from './firelancer-config';

export let activeConfig: RuntimeFirelancerConfig;

/**
 * Reset the activeConfig object back to the initial default state.
 */
export function resetConfig() {
  activeConfig = defaultConfig;
}

/**
 * Override the default config by merging in the supplied values. Should only be used prior to
 * bootstrapping the app.
 */
export async function setConfig(userConfig: PartialFirelancerConfig) {
  if (!activeConfig) {
    activeConfig = defaultConfig;
  }
  activeConfig = merge(activeConfig, userConfig) as unknown as RuntimeFirelancerConfig;
}

/**
 * Ensures that the config has been loaded. This is necessary for tests which
 * do not go through the normal bootstrap process.
 */
export async function ensureConfigLoaded() {
  if (!activeConfig) {
    activeConfig = defaultConfig;
  }
}

/**
 * Returns the app config object. In general this function should only be
 * used before bootstrapping the app. In all other contexts, the ConfigService
 * should be used to access config settings.
 */
export function getConfig(): Readonly<RuntimeFirelancerConfig> {
  if (!activeConfig) {
    try {
      activeConfig = defaultConfig;
    } catch (e: any) {
      console.log('Error loading config. If this is a test, make sure you have called ensureConfigLoaded() before using the config.');
    }
  }
  return activeConfig;
}
