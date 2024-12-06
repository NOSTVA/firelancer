import { INestApplication, Logger, NestApplicationOptions, Type, ValidationPipe } from '@nestjs/common';
import { NestApplication, NestFactory } from '@nestjs/core';
import { satisfies } from 'semver';
import { DEFAULT_COOKIE_NAME } from './common/constants';
import { InternalServerError } from './common/error/errors';
import { getConfig, setConfig } from './config/config-helpers';
import { FirelancerConfig, RuntimeFirelancerConfig } from './config/firelancer-config';
import { coreEntitiesMap } from './entity/core-entities';
import { getCompatibility, getConfigurationFunction, getEntitiesFromPlugins } from './plugin/plugin-metadata';
import { FIRELANCER_VERSION } from './version';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
const cookieSession = require('cookie-session');

/**
 * @description
 * Additional options that can be used to configure the bootstrap process of the
 * Firelancer server.
 */
export interface BootstrapOptions {
  /**
   * @description
   * These options get passed directly to the `NestFactory.create()` method.
   */
  nestApplicationOptions: NestApplicationOptions;
}

export async function bootstrap(userConfig?: Partial<FirelancerConfig>, options?: BootstrapOptions) {
  const config = await preBootstrapConfig(userConfig);
  Logger.log(`Bootstrapping Firelancer Server (pid: ${process.pid})...`);
  checkPluginCompatibility(config);

  const { hostname, port, cors } = config.apiOptions;
  const { AppModule } = await import('./app.module.js');

  const app = await NestFactory.create(AppModule, { cors, ...options?.nestApplicationOptions });
  const { tokenMethod } = config.authOptions;
  const usingCookie = tokenMethod === 'cookie' || (Array.isArray(tokenMethod) && tokenMethod.includes('cookie'));
  if (usingCookie) {
    configureSessionCookies(app, config);
  }

  // swagger config
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Firelancer')
    .setDescription('Firelancer API')
    .setVersion(FIRELANCER_VERSION)
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, documentFactory);

  await app.listen(port, hostname);
}

/**
 * Setting the global config must be done prior to loading the AppModule.
 */
export async function preBootstrapConfig(userConfig: Partial<FirelancerConfig> = {}): Promise<Readonly<RuntimeFirelancerConfig>> {
  if (userConfig) {
    await setConfig(userConfig);
  }

  const entities = getAllEntities(userConfig);
  await setConfig({ dbConnectionOptions: { entities } });

  let config = getConfig();
  // The logger is set here so that we are able to log any messages prior to the final
  // logger (which may depend on config coming from a plugin) being set.
  config = await runPluginConfigurations(config);
  setExposedHeaders(config);
  return config;
}

/**
 * If the 'bearer' tokenMethod is being used, then we automatically expose the authTokenHeaderKey header
 * in the CORS options, making sure to preserve any user-configured exposedHeaders.
 */
function setExposedHeaders(config: Readonly<RuntimeFirelancerConfig>) {
  const { tokenMethod } = config.authOptions;
  const isUsingBearerToken = tokenMethod === 'bearer' || (Array.isArray(tokenMethod) && tokenMethod.includes('bearer'));
  if (isUsingBearerToken) {
    const authTokenHeaderKey = config.authOptions.authTokenHeaderKey;
    const corsOptions = config.apiOptions.cors;
    if (typeof corsOptions !== 'boolean') {
      const { exposedHeaders } = corsOptions;
      let exposedHeadersWithAuthKey: string[];
      if (!exposedHeaders) {
        exposedHeadersWithAuthKey = [authTokenHeaderKey];
      } else if (typeof exposedHeaders === 'string') {
        exposedHeadersWithAuthKey = exposedHeaders
          .split(',')
          .map((x) => x.trim())
          .concat(authTokenHeaderKey);
      } else {
        exposedHeadersWithAuthKey = exposedHeaders.concat(authTokenHeaderKey);
      }
      corsOptions.exposedHeaders = exposedHeadersWithAuthKey;
    }
  }
}

/**
 * Initialize any configured plugins.
 */
async function runPluginConfigurations(config: RuntimeFirelancerConfig): Promise<RuntimeFirelancerConfig> {
  for (const plugin of config.plugins) {
    const configFn = getConfigurationFunction(plugin);
    if (typeof configFn === 'function') {
      const result = await configFn(config);
      Object.assign(config, result);
    }
  }
  return config;
}

/**
 * Returns an array of core entities and any additional entities defined in plugins.
 */
function getAllEntities(userConfig: Partial<FirelancerConfig>): Array<Type<any>> {
  const coreEntities = Object.values(coreEntitiesMap) as Array<Type<any>>;
  const pluginEntities = getEntitiesFromPlugins(userConfig.plugins);

  const allEntities: Array<Type<any>> = coreEntities;

  // Check to ensure that no plugins are defining entities with names which conflict with existing entities.
  for (const pluginEntity of pluginEntities) {
    if (allEntities.find((e) => e.name === pluginEntity.name)) {
      throw new InternalServerError('error.entity-name-conflict');
    } else {
      allEntities.push(pluginEntity);
    }
  }
  return allEntities;
}

function configureSessionCookies(app: INestApplication, userConfig: Readonly<RuntimeFirelancerConfig>): void {
  const { cookieOptions } = userConfig.authOptions;

  // Globally set the cookie session middleware
  const cookieName = typeof cookieOptions?.name === 'string' ? cookieOptions.name : cookieOptions.name?.shop;
  app.use(
    cookieSession({
      ...cookieOptions,
      name: cookieName ?? DEFAULT_COOKIE_NAME,
    }),
  );
}

function checkPluginCompatibility(config: RuntimeFirelancerConfig): void {
  for (const plugin of config.plugins) {
    const compatibility = getCompatibility(plugin);
    const pluginName = (plugin as any).name as string;
    if (!compatibility) {
      Logger.log(
        `The plugin "${pluginName}" does not specify a compatibility range, so it is not guaranteed to be compatible with this version of Firelancer.`,
      );
    } else {
      if (!satisfies(FIRELANCER_VERSION, compatibility, { loose: true, includePrerelease: true })) {
        Logger.error(
          `Plugin "${pluginName}" is not compatible with this version of Firelancer. ` +
            `It specifies a semver range of "${compatibility}" but the current version is "${FIRELANCER_VERSION}".`,
        );
        throw new InternalServerError(`Plugin "${pluginName}" is not compatible with this version of Firelancer.`);
      }
    }
  }
}
