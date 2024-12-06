import { randomBytes } from 'crypto';
import { DEFAULT_AUTH_TOKEN_HEADER_KEY, SUPER_ADMIN_USER_IDENTIFIER, SUPER_ADMIN_USER_PASSWORD } from 'src/common/constants';
import { RuntimeFirelancerConfig } from './firelancer-config';
import { DefaultAssetNamingStrategy } from './strategies/asset/default/default-asset-naming-strategy';
import { BcryptPasswordHashingStrategy } from './strategies/authentication/default/bcrypt-password-hashing-strategy';
import { DefaultPasswordValidationStrategy } from './strategies/authentication/default/default-password-validation-strategy';
import { NativeAuthenticationStrategy } from './strategies/authentication/default/native-authentication-strategy';
import { InMemorySessionCacheStrategy } from './strategies/session-cache/default/in-memory-session-cache-strategy';
import { NoAssetStorageStrategy } from './strategies/asset/default/no-asset-storage-strategy';
import { NoAssetPreviewStrategy } from './strategies/asset/default/no-asset-preview-strategy';

/**
 * @description
 * The default configuration settings which are used if not explicitly overridden in the bootstrap() call.
 */
export const defaultConfig: RuntimeFirelancerConfig = {
  apiOptions: {
    port: 3042,
    hostname: 'localhost',
    adminApiPath: 'admin-api',
    shopApiPath: 'shop-api',
    cors: {
      origin: true,
      credentials: true,
    },
    middlewares: [],
  },
  dbConnectionOptions: {
    type: 'postgres',
    synchronize: true,
  },
  authOptions: {
    disableAuth: false,
    tokenMethod: 'cookie',
    customPermissions: [],
    cookieOptions: {
      secret: randomBytes(16).toString('base64url'),
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    },
    authTokenHeaderKey: DEFAULT_AUTH_TOKEN_HEADER_KEY,
    sessionDuration: '1y',
    sessionCacheStrategy: new InMemorySessionCacheStrategy(),
    sessionCacheTTL: 300,
    requireVerification: true,
    verificationTokenDuration: '7d',
    superadminCredentials: {
      identifier: SUPER_ADMIN_USER_IDENTIFIER,
      password: SUPER_ADMIN_USER_PASSWORD,
    },
    shopAuthenticationStrategy: [new NativeAuthenticationStrategy()],
    adminAuthenticationStrategy: [new NativeAuthenticationStrategy()],
    passwordHashingStrategy: new BcryptPasswordHashingStrategy(),
    passwordValidationStrategy: new DefaultPasswordValidationStrategy({ minLength: 4 }),
  },
  assetOptions: {
    assetNamingStrategy: new DefaultAssetNamingStrategy(),
    assetStorageStrategy: new NoAssetStorageStrategy(),
    assetPreviewStrategy: new NoAssetPreviewStrategy(),
    permittedFileTypes: ['image/*', 'video/*', 'audio/*', '.pdf'],
    uploadMaxFileSize: 20971520,
  },
  plugins: [],
};
