import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { extractSessionToken } from 'src/common/extract-session-token';
import { parseContext } from 'src/common/parse-context';
import { internal_setRequestContext, RequestContext } from 'src/common/request-context';
import { setSessionToken } from 'src/common/set-session-token';
import { ConfigService } from 'src/config/config.service';
import { AuthOptions } from 'src/config/firelancer-config';
import { CachedSession } from 'src/config/strategies/session-cache/session-cache-strategy';
import { RequestContextService } from 'src/service/helpers/request-context/request-context.service';
import { SessionService } from 'src/service/services/session.service';
import { ForbiddenError } from '../../common/error/errors';
import { Permission } from 'src/common/shared-types';
import { PERMISSIONS_METADATA_KEY } from '../decorators/allow.decorator';

/**
 * @description
 * A guard which:
 *
 * 1. checks for the existence of a valid session token in the request and if found,
 * attaches the current User entity to the request.
 * 2. enforces any permissions required by the target handler (resolver, field resolver or route),
 * and throws a ForbiddenError if those permissions are not present.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
    private requestContextService: RequestContextService,
    private sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { req, res } = parseContext(context);
    const permissions = this.reflector.get<Permission[] | undefined>(PERMISSIONS_METADATA_KEY, context.getHandler());
    const isAuthDisabled = this.configService.authOptions.disableAuth;
    const isPublicPermissionRequired = !!permissions && permissions.includes(Permission.Public);
    const isOwnerPermissionRequired = !!permissions && permissions.includes(Permission.Owner);

    let requestContext: RequestContext;
    const session = await this.getSession(req, res, isOwnerPermissionRequired);
    requestContext = await this.requestContextService.fromRequest(req, session, permissions);
    internal_setRequestContext(req, requestContext, context);

    if (isAuthDisabled || !permissions || isPublicPermissionRequired) {
      return true;
    } else {
      const canActivate = requestContext.userHasPermissions(permissions) || requestContext.authorizedAsOwnerOnly;
      if (!canActivate) {
        throw new ForbiddenError();
      } else {
        return canActivate;
      }
    }
  }

  private async getSession(req: Request, res: Response, isOwnerPermissionRequired: boolean): Promise<CachedSession | undefined> {
    const { authOptions } = this.configService;
    const sessionToken = extractSessionToken(req, authOptions.tokenMethod);
    let serializedSession: CachedSession | undefined;
    if (sessionToken) {
      serializedSession = await this.sessionService.getSessionFromToken(sessionToken);
      if (serializedSession) {
        return serializedSession;
      }
      // if there is a token but it cannot be validated to a Session,
      // then the token is no longer valid and should be unset.
      setSessionToken({
        sessionToken: '',
        rememberMe: false,
        authOptions,
        req,
        res,
      });
    }

    // current anonymous session is only authorized to operate on entities that are owned by the current session.
    if (isOwnerPermissionRequired && !serializedSession) {
      serializedSession = await this.sessionService.createAnonymousSession();
      setSessionToken({
        sessionToken: serializedSession.token,
        rememberMe: true,
        authOptions: authOptions as Required<AuthOptions>,
        req,
        res,
      });
    }
    return serializedSession;
  }
}
