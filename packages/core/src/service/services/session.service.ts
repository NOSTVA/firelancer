import { Injectable } from '@nestjs/common';
import { RequestContext } from 'src/common/request-context';
import { ConfigService } from 'src/config/config.service';
import { CachedSession, SessionCacheStrategy } from 'src/config/strategies/session-cache/session-cache-strategy';
import { TransactionalConnection } from 'src/connection/transactional-connection';
import { AnonymousSession, AuthenticatedSession, Session, User } from 'src/entity';
import { Role } from 'src/entity/role/role.entity';
import { EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ms = require('ms');

/**
 * @description
 * Contains methods relating to Session entities.
 */
@Injectable()
export class SessionService implements EntitySubscriberInterface {
  private sessionCacheStrategy: SessionCacheStrategy;
  private readonly sessionDurationInMs: number;
  private readonly sessionCacheTimeoutMs = 50;

  constructor(
    private connection: TransactionalConnection,
    private configService: ConfigService,
  ) {
    this.sessionCacheStrategy = this.configService.authOptions.sessionCacheStrategy;

    const { sessionDuration } = this.configService.authOptions;
    this.sessionDurationInMs = typeof sessionDuration === 'string' ? ms(sessionDuration) : sessionDuration;

    this.connection.rawConnection.subscribers.push(this);
  }

  async afterInsert(event: InsertEvent<unknown>): Promise<void> {
    await this.clearSessionCacheOnDataChange(event);
  }

  async afterRemove(event: RemoveEvent<unknown>): Promise<void> {
    await this.clearSessionCacheOnDataChange(event);
  }

  async afterUpdate(event: UpdateEvent<unknown>): Promise<void> {
    await this.clearSessionCacheOnDataChange(event);
  }

  private async clearSessionCacheOnDataChange(event: InsertEvent<unknown> | RemoveEvent<unknown> | UpdateEvent<unknown>) {
    if (event.entity) {
      // If a Role changes, potentially all the cached permissions in the
      // session cache will be wrong, so we just clear the entire cache.
      if (event.entity instanceof Role) {
        await this.withTimeout(this.sessionCacheStrategy.clear());
      }
    }
  }

  /**
   * @description
   * Creates a new AuthenticatedSession. To be used after successful authentication.
   */
  async createNewAuthenticatedSession(ctx: RequestContext, user: User, authenticationStrategyName: string): Promise<AuthenticatedSession> {
    const token = await this.generateSessionToken();
    const authenticatedSession = await this.connection.getRepository(ctx, AuthenticatedSession).save(
      new AuthenticatedSession({
        token,
        user,
        authenticationStrategy: authenticationStrategyName,
        expires: this.getExpiryDate(this.sessionDurationInMs),
        invalidated: false,
      }),
    );
    await this.withTimeout(this.sessionCacheStrategy.set(this.serializeSession(authenticatedSession)));
    return authenticatedSession;
  }

  /**
   * @description
   * Create an AnonymousSession and caches it using the configured SessionCacheStrategy,
   * and returns the cached session object.
   */
  async createAnonymousSession(): Promise<CachedSession> {
    const token = await this.generateSessionToken();
    const session = new AnonymousSession({
      token,
      expires: this.getExpiryDate(this.sessionDurationInMs),
      invalidated: false,
    });
    const newSession = await this.connection.rawConnection.getRepository(AnonymousSession).save(session);
    const serializedSession = this.serializeSession(newSession);
    await this.withTimeout(this.sessionCacheStrategy.set(serializedSession));
    return serializedSession;
  }

  /**
   * @description
   * Returns the cached session object matching the given session token.
   */
  async getSessionFromToken(sessionToken: string): Promise<CachedSession | undefined> {
    let serializedSession = await this.withTimeout(this.sessionCacheStrategy.get(sessionToken));
    const stale = !!(serializedSession && serializedSession.cacheExpiry < new Date().getTime() / 1000);
    const expired = !!(serializedSession && serializedSession.expires < new Date());
    if (!serializedSession || stale || expired) {
      const session = await this.findSessionByToken(sessionToken);
      if (session) {
        serializedSession = this.serializeSession(session);
        await this.withTimeout(this.sessionCacheStrategy.set(serializedSession));
        return serializedSession;
      } else {
        return;
      }
    }
    return serializedSession;
  }

  /**
   * @description
   * Serializes a Session instance into a simplified plain object suitable for caching.
   */
  serializeSession(session: AuthenticatedSession | AnonymousSession): CachedSession {
    const expiry = Math.floor(new Date().getTime() / 1000) + this.configService.authOptions.sessionCacheTTL;
    const serializedSession: CachedSession = {
      cacheExpiry: expiry,
      id: session.id,
      token: session.token,
      expires: session.expires,
    };
    if (this.isAuthenticatedSession(session)) {
      serializedSession.authenticationStrategy = session.authenticationStrategy;
      const { user } = session;
      serializedSession.user = {
        id: user.id,
        identifier: user.identifier,
        verified: user.verified,
        permissions: user.roles.flatMap((role) => role.permissions),
      };
    }
    return serializedSession;
  }

  /**
   * If the session cache is taking longer than say 50ms then something is wrong - it is supposed to
   * be very fast after all! So we will return undefined and let the request continue without a cached session.
   */
  private withTimeout<T>(maybeSlow: Promise<T> | T): Promise<T | undefined> {
    return Promise.race([new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), this.sessionCacheTimeoutMs)), maybeSlow]);
  }

  /**
   * Looks for a valid session with the given token and returns one if found.
   */
  private async findSessionByToken(token: string): Promise<Session | undefined> {
    const session = await this.connection.rawConnection
      .getRepository(Session)
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .leftJoinAndSelect('user.roles', 'roles')
      .where('session.token = :token', { token })
      .andWhere('session.invalidated = false')
      .getOne();

    if (session && session.expires > new Date()) {
      await this.updateSessionExpiry(session);
      return session;
    }
  }

  /**
   * @description
   * Deletes all existing sessions for the given user.
   */
  async deleteSessionsByUser(ctx: RequestContext, user: User): Promise<void> {
    const userSessions = await this.connection.getRepository(ctx, AuthenticatedSession).find({ where: { user: { id: user.id } } });
    await this.connection.getRepository(ctx, AuthenticatedSession).remove(userSessions);
    for (const session of userSessions) {
      await this.withTimeout(this.sessionCacheStrategy.delete(session.token));
    }
  }

  /**
   * If we are over half way to the current session's expiry date, then we update it.
   *
   * This ensures that the session will not expire when in active use, but prevents us from
   * needing to run an update query on *every* request.
   */
  private async updateSessionExpiry(session: Session) {
    const now = new Date().getTime();
    if (session.expires.getTime() - now < this.sessionDurationInMs / 2) {
      const newExpiryDate = this.getExpiryDate(this.sessionDurationInMs);
      session.expires = newExpiryDate;
      await this.connection.rawConnection.getRepository(Session).update({ id: session.id }, { expires: newExpiryDate });
    }
  }

  /**
   * Returns a future expiry date according timeToExpireInMs in the future.
   */
  private getExpiryDate(timeToExpireInMs: number): Date {
    return new Date(Date.now() + timeToExpireInMs);
  }

  /**
   * Generates a random session token.
   */
  private generateSessionToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(32, (err, buf) => {
        if (err) {
          reject(err);
        }
        resolve(buf.toString('hex'));
      });
    });
  }

  private isAuthenticatedSession(session: Session): session is AuthenticatedSession {
    return !!(session as AuthenticatedSession).user;
  }
}
