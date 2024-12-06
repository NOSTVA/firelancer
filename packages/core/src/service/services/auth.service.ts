import { Injectable } from '@nestjs/common';
import { InternalServerError, InvalidCredentialsError, NotVerifiedError } from 'src/common/error/errors';
import { ApiType } from 'src/common/get-api-type';
import { RequestContext } from 'src/common/request-context';
import { ID } from 'src/common/shared-types';
import { ConfigService } from 'src/config/config.service';
import { AuthenticationStrategy } from 'src/config/strategies/authentication/authentication-strategy';
import {
  NATIVE_AUTH_STRATEGY_NAME,
  NativeAuthenticationData,
  NativeAuthenticationStrategy,
} from 'src/config/strategies/authentication/default/native-authentication-strategy';
import { TransactionalConnection } from 'src/connection/transactional-connection';
import { AuthenticatedSession, ExternalAuthenticationMethod, User } from 'src/entity';
import { SessionService } from './session.service';
import { EventBus } from 'src/event-bus/event-bus';
import { AttemptedLoginEvent } from 'src/event-bus/events/attempted-login-event';
import { LoginEvent } from 'src/event-bus/events/login-event';
import { LogoutEvent } from 'src/event-bus/events/logout-event';

/**
 * @description
 * Contains methods relating to Session, AuthenticatedSession & AnonymousSession entities.
 */
@Injectable()
export class AuthService {
  constructor(
    private connection: TransactionalConnection,
    private configService: ConfigService,
    private sessionService: SessionService,
    private eventBus: EventBus,
  ) {}

  /**
   * @description
   * Authenticates a user's credentials and if okay, creates a new AuthenticatedSession.
   */
  async authenticate(
    ctx: RequestContext,
    apiType: ApiType,
    authenticationMethod: string,
    authenticationData: unknown,
  ): Promise<AuthenticatedSession> {
    await this.eventBus.publish(
      new AttemptedLoginEvent(
        ctx,
        authenticationMethod,
        authenticationMethod === NATIVE_AUTH_STRATEGY_NAME ? (authenticationData as NativeAuthenticationData).username : undefined,
      ),
    );
    const authenticationStrategy = this.getAuthenticationStrategy(apiType, authenticationMethod);
    const authenticateResult = await authenticationStrategy.authenticate(ctx, authenticationData);
    if (typeof authenticateResult === 'string') {
      throw new InvalidCredentialsError(authenticateResult);
    }
    if (!authenticateResult) {
      throw new InvalidCredentialsError();
    }
    const session = await this.createAuthenticatedSessionForUser(ctx, authenticateResult, authenticationStrategy.name);
    return session;
  }

  async createAuthenticatedSessionForUser(
    ctx: RequestContext,
    user: User,
    authenticationStrategyName: string,
  ): Promise<AuthenticatedSession> {
    const externalAuthenticationMethods = (user.authenticationMethods ?? []).filter((am) => am instanceof ExternalAuthenticationMethod);
    if (!externalAuthenticationMethods.length && this.configService.authOptions.requireVerification && !user.verified) {
      throw new NotVerifiedError();
    }
    if (ctx.session) {
      await this.sessionService.deleteSessionsByUser(ctx, user);
    }
    user.lastLogin = new Date();
    await this.connection.getRepository(ctx, User).save(user, { reload: false });
    const session = await this.sessionService.createNewAuthenticatedSession(ctx, user, authenticationStrategyName);
    await this.eventBus.publish(new LoginEvent(ctx, user));
    return session;
  }

  /**
   * @description
   * Verify the provided password against the one we have for the given user. Requires
   * the NativeAuthenticationStrategy to be configured.
   */
  async verifyUserPassword(ctx: RequestContext, userId: ID, password: string): Promise<void> {
    const nativeAuthenticationStrategy = this.getAuthenticationStrategy('shop', NATIVE_AUTH_STRATEGY_NAME);
    const passwordMatches = await nativeAuthenticationStrategy.verifyUserPassword(ctx, userId, password);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }
  }

  /**
   * @description
   * Deletes all sessions for the user associated with the given session token.
   */
  async destroyAuthenticatedSession(ctx: RequestContext, sessionToken: string): Promise<void> {
    const session = await this.connection.getRepository(ctx, AuthenticatedSession).findOne({
      where: { token: sessionToken },
      relations: ['user', 'user.authenticationMethods'],
    });

    if (session) {
      const authenticationStrategy = this.getAuthenticationStrategy(ctx.apiType, session.authenticationStrategy);
      if (typeof authenticationStrategy.onLogOut === 'function') {
        await authenticationStrategy.onLogOut(ctx, session.user);
      }
      await this.eventBus.publish(new LogoutEvent(ctx));
      return this.sessionService.deleteSessionsByUser(ctx, session.user);
    }
  }

  private getAuthenticationStrategy(apiType: ApiType, method: typeof NATIVE_AUTH_STRATEGY_NAME): NativeAuthenticationStrategy;
  private getAuthenticationStrategy(apiType: ApiType, method: string): AuthenticationStrategy;
  private getAuthenticationStrategy(apiType: ApiType, method: string): AuthenticationStrategy {
    const { authOptions } = this.configService;
    const strategies = apiType === 'admin' ? authOptions.adminAuthenticationStrategy : authOptions.shopAuthenticationStrategy;
    const match = strategies.find((s) => s.name === method);
    if (!match) {
      throw new InternalServerError('error.unrecognized-authentication-strategy');
    }
    return match;
  }
}
