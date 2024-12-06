import { Request, Response } from 'express';
import { CurrentUser, MutationAuthenticateArgs, MutationLoginArgs } from 'src/api/schema';
import { ForbiddenError, InvalidCredentialsError } from 'src/common/error/errors';
import { extractSessionToken } from 'src/common/extract-session-token';
import { ApiType } from 'src/common/get-api-type';
import { RequestContext } from 'src/common/request-context';
import { setSessionToken } from 'src/common/set-session-token';
import { ConfigService } from 'src/config/config.service';
import { AuthOptions } from 'src/config/firelancer-config';
import { NATIVE_AUTH_STRATEGY_NAME } from 'src/config/strategies/authentication/default/native-authentication-strategy';
import { User } from 'src/entity';
import { AdministratorService } from 'src/service/services/administrator.service';
import { AuthService } from 'src/service/services/auth.service';
import { UserService } from 'src/service/services/user.service';

export class BaseAuthController {
  constructor(
    protected authService: AuthService,
    protected userService: UserService,
    protected administratorService: AdministratorService,
    protected configService: ConfigService,
  ) {}

  /**
   * Attempts a login given the username and password of a user. If successful, returns
   * the user data and returns the token either in a cookie or in the response body.
   */
  async baseLogin(args: MutationLoginArgs, ctx: RequestContext, req: Request, res: Response): Promise<CurrentUser> {
    return this.authenticateAndCreateSession(
      ctx,
      {
        input: { [NATIVE_AUTH_STRATEGY_NAME]: args },
        rememberMe: args.rememberMe,
      },
      req,
      res,
    );
  }

  async logout(ctx: RequestContext, req: Request, res: Response) {
    const authOptions = this.configService.authOptions;
    const token = extractSessionToken(req, authOptions.tokenMethod);
    if (!token) {
      return res.send({ success: false });
    }

    await this.authService.destroyAuthenticatedSession(ctx, token);
    setSessionToken({
      req,
      res,
      authOptions: authOptions as Required<AuthOptions>,
      rememberMe: false,
      sessionToken: '',
    });
    return res.send({ success: true });
  }

  /**
   * Returns information about the current authenticated user.
   */
  async me(ctx: RequestContext, apiType: ApiType): Promise<CurrentUser | null> {
    const userId = ctx.activeUserId;
    if (!userId) {
      throw new ForbiddenError();
    }
    if (apiType === 'admin') {
      const administrator = await this.administratorService.findOneByUserId(ctx, userId);
      if (!administrator) {
        throw new ForbiddenError();
      }
    }
    const user = userId && (await this.userService.getUserById(ctx, userId));
    return user ? this.publiclyAccessibleUser(user) : null;
  }

  /**
   * Creates an authenticated session and sets the session token.
   */
  protected async authenticateAndCreateSession(
    ctx: RequestContext,
    args: MutationAuthenticateArgs,
    req: Request,
    res: Response,
  ): Promise<CurrentUser> {
    const [method, data] = Object.entries(args.input)[0];
    const { apiType } = ctx;

    const session = await this.authService.authenticate(ctx, apiType, method, data);

    if (apiType === 'admin') {
      const administrator = await this.administratorService.findOneByUserId(ctx, session.user.id);
      if (!administrator) {
        throw new InvalidCredentialsError();
      }
    }

    setSessionToken({
      req,
      res,
      sessionToken: session.token,
      rememberMe: args.rememberMe || false,
      authOptions: this.configService.authOptions,
    });

    return this.publiclyAccessibleUser(session.user);
  }

  /**
   * Updates the password of an existing User.
   */
  protected async updatePassword(ctx: RequestContext, currentPassword: string, newPassword: string): Promise<void> {
    const { activeUserId } = ctx;
    if (!activeUserId) {
      throw new ForbiddenError();
    }

    await this.userService.updatePassword(ctx, activeUserId, currentPassword, newPassword);
  }

  /**
   * Exposes a subset of the User properties which we want to expose to the public API.
   */
  protected publiclyAccessibleUser(user: User): CurrentUser {
    return {
      id: user.id,
      identifier: user.identifier,
    };
  }
}
