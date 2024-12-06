import { InjectableStrategy } from 'src/common/injectable-strategy';
import { ID, Permission } from 'src/common/shared-types';

/**
 * @description
 * A simplified representation of the User associated with the
 * current Session.
 *
 */
export type CachedSessionUser = {
  id: ID;
  identifier: string;
  verified: boolean;
  permissions: Permission[];
};

/**
 * @description
 * A simplified representation of a Session which is easy to
 * store.
 */
export type CachedSession = {
  /**
   * @description
   * The timestamp after which this cache entry is considered stale and
   * a fresh copy of the data will be set. Based on the `sessionCacheTTL` option.
   */
  id: ID;
  user?: CachedSessionUser;
  token: string;
  expires: Date;
  authenticationStrategy?: string;
  cacheExpiry: number;
};

/**
 * @description
 * This strategy defines how sessions get cached. Since most requests will need the Session
 * object for permissions data, it can become a bottleneck to go to the database and do a multi-join
 * SQL query each time. Therefore, we cache the session data only perform the SQL query once and upon
 * invalidation of the cache.
 *
 * A cache that doesn't cache. The cache lookup will miss every time
 * so the session will always be taken from the database.
 *
 * The Firelancer default is to use a the InMemorySessionCacheStrategy, which is fast and suitable for
 * single-instance deployments. However, for multi-instance deployments (horizontally scaled, serverless etc.),
 * you will need to define a custom strategy that stores the session cache in a shared data store, such as in the
 * DB or in Redis.
 *
 * :::info
 *
 * This is configured via the `authOptions.sessionCacheStrategy` property of
 * your FirelancerConfig.
 *
 * :::
 *
 * Here's an example implementation using Redis. To use this, you need to add the
 * [ioredis package](https://www.npmjs.com/package/ioredis) as a dependency.
 *
 * @example
 * ```ts
 * import { CachedSession, Logger, SessionCacheStrategy, FirelancerPlugin } from '\@Firelancer/core';
 * import { Redis, RedisOptions } from 'ioredis';
 *
 * export interface RedisSessionCachePluginOptions {
 *   namespace?: string;
 *   redisOptions?: RedisOptions;
 * }
 * const loggerCtx = 'RedisSessionCacheStrategy';
 * const DEFAULT_NAMESPACE = 'firelancer-session-cache';
 * const DEFAULT_TTL = 86400;
 *
 * export class RedisSessionCacheStrategy implements SessionCacheStrategy {
 *   private client: Redis;
 *   constructor(private options: RedisSessionCachePluginOptions) {}
 *
 *   init() {
 *     this.client = new Redis(this.options.redisOptions as RedisOptions);
 *     this.client.on('error', err => Logger.error(err.message, loggerCtx, err.stack));
 *   }
 *
 *   async destroy() {
 *     await this.client.quit();
 *   }
 *
 *   async get(sessionToken: string): Promise<CachedSession | undefined> {
 *     try {
 *       const retrieved = await this.client.get(this.namespace(sessionToken));
 *       if (retrieved) {
 *         try {
 *           return JSON.parse(retrieved);
 *         } catch (e: any) {
 *           Logger.error(`Could not parse cached session data: ${e.message}`, loggerCtx);
 *         }
 *       }
 *     } catch (e: any) {
 *       Logger.error(`Could not get cached session: ${e.message}`, loggerCtx);
 *     }
 *   }
 *
 *   async set(session: CachedSession) {
 *     try {
 *       await this.client.set(this.namespace(session.token), JSON.stringify(session), 'EX', DEFAULT_TTL);
 *     } catch (e: any) {
 *       Logger.error(`Could not set cached session: ${e.message}`, loggerCtx);
 *     }
 *   }
 *
 *   async delete(sessionToken: string) {
 *     try {
 *       await this.client.del(this.namespace(sessionToken));
 *     } catch (e: any) {
 *       Logger.error(`Could not delete cached session: ${e.message}`, loggerCtx);
 *     }
 *   }
 *
 *   clear() {
 *     // not implemented
 *   }
 *
 *   private namespace(key: string) {
 *     return `${this.options.namespace ?? DEFAULT_NAMESPACE}:${key}`;
 *   }
 * }
 *
 * \@FirelancerPlugin({
 *   configuration: config => {
 *     config.authOptions.sessionCacheStrategy = new RedisSessionCacheStrategy(
 *       RedisSessionCachePlugin.options,
 *     );
 *     return config;
 *   },
 * })
 * export class RedisSessionCachePlugin {
 *   static options: RedisSessionCachePluginOptions;
 *   static init(options: RedisSessionCachePluginOptions) {
 *     this.options = options;
 *     return this;
 *   }
 * }
 * ```
 */
export interface SessionCacheStrategy extends InjectableStrategy {
  /**
   * @description
   * Store the session in the cache. When caching a session, the data
   * should not be modified apart from performing any transforms needed to
   * get it into a state to be stored, e.g. JSON.stringify().
   */
  set(session: CachedSession): void | Promise<void>;

  /**
   * @description
   * Retrieve the session from the cache
   */
  get(sessionToken: string): CachedSession | undefined | Promise<CachedSession | undefined>;

  /**
   * @description
   * Delete a session from the cache
   */
  delete(sessionToken: string): void | Promise<void>;

  /**
   * @description
   * Clear the entire cache
   */
  clear(): void | Promise<void>;
}
