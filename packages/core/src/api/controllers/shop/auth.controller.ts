import { Body, Controller, Get, Logger, Post, Request, Response } from '@nestjs/common';
import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Allow } from 'src/api/decorators/allow.decorator';
import { Ctx } from 'src/api/decorators/request-context.decorator';
import { Transaction } from 'src/api/decorators/transaction.decorator';
import {
  MutationAuthenticateArgs,
  MutationLoginArgs,
  MutationRefreshCustomerVerificationArgs,
  MutationRegisterCustomerAccountArgs,
  MutationRequestPasswordResetArgs,
  MutationRequestUpdateCustomerEmailAddressArgs,
  MutationResetPasswordArgs,
  MutationUpdateCustomerEmailAddressArgs,
  MutationUpdateCustomerPasswordArgs,
  MutationVerifyCustomerAccountArgs,
} from 'src/api/schema';
import { EmailAddressConflictError, ForbiddenError, NativeAuthStrategyError } from 'src/common/error/errors';
import { RequestContext } from 'src/common/request-context';
import { setSessionToken } from 'src/common/set-session-token';
import { HistoryEntryType, Permission } from 'src/common/shared-types';
import { ConfigService } from 'src/config/config.service';
import { NATIVE_AUTH_STRATEGY_NAME } from 'src/config/strategies/authentication/default/native-authentication-strategy';
import { AdministratorService } from 'src/service/services/administrator.service';
import { AuthService } from 'src/service/services/auth.service';
import { CustomerService } from 'src/service/services/customer.service';
import { HistoryService } from 'src/service/services/history.service';
import { UserService } from 'src/service/services/user.service';
import { BaseAuthController } from '../base/base-auth.controller';

@Controller('auth')
export class ShopAuthController extends BaseAuthController {
  constructor(
    authService: AuthService,
    userService: UserService,
    administratorService: AdministratorService,
    configService: ConfigService,
    protected customerService: CustomerService,
    protected historyService: HistoryService,
  ) {
    super(authService, userService, administratorService, configService);
  }

  @Transaction()
  @Post('login')
  @Allow(Permission.Public)
  async login(
    @Ctx() ctx: RequestContext,
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
    @Body() args: MutationLoginArgs,
  ) {
    this.requireNativeAuthStrategy();

    const result = await super.baseLogin(args, ctx, req, res);
    res.send(result);
  }

  @Transaction()
  @Post('authenticate')
  @Allow(Permission.Public)
  async authenticate(
    @Ctx() ctx: RequestContext,
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
    @Body() args: MutationAuthenticateArgs,
  ) {
    const result = await this.authenticateAndCreateSession(ctx, args, req, res);
    res.send(result);
  }

  @Transaction()
  @Post('logout')
  @Allow(Permission.Public)
  async logout(@Ctx() ctx: RequestContext, @Request() req: ExpressRequest, @Response() res: ExpressResponse) {
    return super.logout(ctx, req, res);
  }

  @Get('me')
  @Allow(Permission.Authenticated)
  me(@Ctx() ctx: RequestContext) {
    return super.me(ctx, 'shop');
  }

  @Transaction()
  @Post('register')
  @Allow(Permission.Public)
  async registerCustomerAccount(
    @Ctx() ctx: RequestContext,
    @Body() args: MutationRegisterCustomerAccountArgs,
  ): Promise<{ sucess: boolean }> {
    try {
      this.requireNativeAuthStrategy();
      await this.customerService.registerCustomerAccount(ctx, args.input);
      return { sucess: true };
    } catch (error) {
      if (error instanceof EmailAddressConflictError) {
        // We do not want to reveal the email address conflict,
        // otherwise account enumeration attacks become possible.
        return { sucess: true };
      }

      throw error;
    }
  }

  @Transaction()
  @Post('verify')
  @Allow(Permission.Public)
  async verifyCustomerAccount(
    @Ctx() ctx: RequestContext,
    @Body() args: MutationVerifyCustomerAccountArgs,
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
  ): Promise<void> {
    this.requireNativeAuthStrategy();
    const { token, password } = args;
    const customer = await this.customerService.verifyCustomerEmailAddress(ctx, token, password || undefined);
    const session = await this.authService.createAuthenticatedSessionForUser(
      ctx,
      // We know that there is a user, since the Customer
      // was found with the .getCustomerByUserId() method.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      customer.user!,
      NATIVE_AUTH_STRATEGY_NAME,
    );

    setSessionToken({
      req,
      res,
      authOptions: this.configService.authOptions,
      rememberMe: true,
      sessionToken: session.token,
    });

    res.send(this.publiclyAccessibleUser(session.user));
  }

  @Transaction()
  @Post('refresh-verification')
  @Allow(Permission.Public)
  async refreshCustomerVerification(
    @Ctx() ctx: RequestContext,
    @Body() args: MutationRefreshCustomerVerificationArgs,
  ): Promise<{ success: boolean }> {
    this.requireNativeAuthStrategy();
    await this.customerService.refreshVerificationToken(ctx, args.emailAddress);
    return { success: true };
  }

  @Transaction()
  @Post('request-reset-password')
  @Allow(Permission.Public)
  async requestPasswordReset(@Ctx() ctx: RequestContext, @Body() args: MutationRequestPasswordResetArgs): Promise<{ success: boolean }> {
    this.requireNativeAuthStrategy();
    await this.customerService.requestPasswordReset(ctx, args.emailAddress);
    return { success: true };
  }

  @Transaction()
  @Post('reset-password')
  @Allow(Permission.Public)
  async resetPassword(
    @Ctx() ctx: RequestContext,
    @Body() args: MutationResetPasswordArgs,
    @Request() req: ExpressRequest,
    @Response() res: ExpressResponse,
  ): Promise<void> {
    this.requireNativeAuthStrategy();
    const { token, password } = args;
    const user = await this.customerService.resetPassword(ctx, token, password);
    const authUser = await super.authenticateAndCreateSession(
      ctx,
      {
        input: {
          [NATIVE_AUTH_STRATEGY_NAME]: {
            username: user.identifier,
            password: args.password,
          },
        },
      },
      req,
      res,
    );

    res.send(authUser);
  }

  @Transaction()
  @Post('update-password')
  @Allow(Permission.Owner)
  async updateCustomerPassword(
    @Ctx() ctx: RequestContext,
    @Body() args: MutationUpdateCustomerPasswordArgs,
  ): Promise<{ success: boolean }> {
    this.requireNativeAuthStrategy();

    await super.updatePassword(ctx, args.currentPassword, args.newPassword);

    if (ctx.activeUserId) {
      const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
      if (customer) {
        await this.historyService.createHistoryEntryForCustomer({
          ctx,
          customerId: customer.id,
          type: HistoryEntryType.CUSTOMER_PASSWORD_UPDATED,
          data: {},
        });
      }
    }

    return { success: true };
  }

  @Transaction()
  @Post('request-update-email')
  @Allow(Permission.Owner)
  async requestUpdateCustomerEmailAddress(
    @Ctx() ctx: RequestContext,
    @Body() args: MutationRequestUpdateCustomerEmailAddressArgs,
  ): Promise<{ success: boolean }> {
    this.requireNativeAuthStrategy();
    if (!ctx.activeUserId) {
      throw new ForbiddenError();
    }
    await this.authService.verifyUserPassword(ctx, ctx.activeUserId, args.password);
    const result = await this.customerService.requestUpdateEmailAddress(ctx, ctx.activeUserId, args.newEmailAddress);
    return {
      success: result,
    };
  }

  @Transaction()
  @Post('update-email')
  @Allow(Permission.Owner)
  async updateCustomerEmailAddress(
    @Ctx() ctx: RequestContext,
    @Body() args: MutationUpdateCustomerEmailAddressArgs,
  ): Promise<{ success: boolean }> {
    this.requireNativeAuthStrategy();
    const result = await this.customerService.updateEmailAddress(ctx, args.token);
    return { success: result };
  }

  protected requireNativeAuthStrategy() {
    const { shopAuthenticationStrategy } = this.configService.authOptions;
    const nativeAuthStrategyIsConfigured = !!shopAuthenticationStrategy.find((strategy) => strategy.name === NATIVE_AUTH_STRATEGY_NAME);
    if (!nativeAuthStrategyIsConfigured) {
      const authStrategyNames = shopAuthenticationStrategy.map((s) => s.name).join(', ');
      const errorMessage =
        'This REST operation requires that the NativeAuthenticationStrategy be configured for the Shop API.\n' +
        `Currently the following AuthenticationStrategies are enabled: ${authStrategyNames}`;
      Logger.error(errorMessage);
      throw new NativeAuthStrategyError();
    }
  }
}
