import { Request, Response } from 'express';
import { AuthOptions } from '../config/firelancer-config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ms = require('ms');

/**
 * Sets the authToken either as a cookie or as a response header, depending on the
 * config settings.
 */
export function setSessionToken(options: {
    sessionToken: string;
    rememberMe: boolean;
    authOptions: Required<AuthOptions>;
    req: Request;
    res: Response;
}) {
    const { sessionToken, rememberMe, authOptions, req, res } = options;
    const usingCookie =
        authOptions.tokenMethod === 'cookie' ||
        (Array.isArray(authOptions.tokenMethod) && authOptions.tokenMethod.includes('cookie'));
    const usingBearer =
        authOptions.tokenMethod === 'bearer' ||
        (Array.isArray(authOptions.tokenMethod) && authOptions.tokenMethod.includes('bearer'));

    if (usingCookie) {
        if (req.session) {
            if (rememberMe) {
                req.sessionOptions.maxAge = ms('1y');
            }
            req.session.token = sessionToken;
        }
    }
    if (usingBearer) {
        res.set(authOptions.authTokenHeaderKey, sessionToken);
    }
}
