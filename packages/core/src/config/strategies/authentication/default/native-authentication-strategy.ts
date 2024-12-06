import { Injector } from 'src/common/injector';
import { AuthenticationStrategy } from '../authentication-strategy';
import { TransactionalConnection } from 'src/connection/transactional-connection';
import { RequestContext } from 'src/common/request-context';
import { ID } from 'src/common/shared-types';
import { NativeAuthenticationMethod, User } from 'src/entity';

export interface NativeAuthenticationData {
  username: string;
  password: string;
}

export const NATIVE_AUTH_STRATEGY_NAME = 'native';

/**
 * @description
 * This strategy implements a username/password credential-based authentication, with the credentials
 * being stored in the Firelancer database. This is the default method of authentication, and it is advised
 * to keep it configured unless there is a specific reason not to.
 */
export class NativeAuthenticationStrategy implements AuthenticationStrategy<NativeAuthenticationData> {
  readonly name = NATIVE_AUTH_STRATEGY_NAME;

  private connection: TransactionalConnection;
  private passwordCipher: import('../../../../service/helpers/password-cipher/password-cipher').PasswordCipher;
  private userService: import('../../../../service/services/user.service').UserService;

  async init(injector: Injector) {
    this.connection = injector.get(TransactionalConnection);
    // These are lazily-loaded to avoid a circular dependency
    const { PasswordCipher } = await import('../../../../service/helpers/password-cipher/password-cipher.js');
    const { UserService } = await import('../../../../service/services/user.service.js');
    this.passwordCipher = injector.get(PasswordCipher);
    this.userService = injector.get(UserService);
  }

  async authenticate(ctx: RequestContext, data: NativeAuthenticationData): Promise<User | false> {
    const user = await this.userService.getUserByEmailAddress(ctx, data.username);
    if (!user) {
      return false;
    }
    const passwordMatch = await this.verifyUserPassword(ctx, user.id, data.password);
    if (!passwordMatch) {
      return false;
    }
    return user;
  }

  /**
   * Verify the provided password against the one we have for the given user.
   */
  async verifyUserPassword(ctx: RequestContext, userId: ID, password: string): Promise<boolean> {
    const user = await this.connection.getRepository(ctx, User).findOne({
      where: { id: userId },
      relations: ['authenticationMethods'],
    });
    if (!user) {
      return false;
    }
    const nativeAuthMethod = user.getNativeAuthenticationMethod(false);
    if (!nativeAuthMethod) {
      return false;
    }
    const pw =
      (
        await this.connection.getRepository(ctx, NativeAuthenticationMethod).findOne({
          where: { id: nativeAuthMethod.id },
          select: ['passwordHash'],
        })
      )?.passwordHash ?? '';
    const passwordMatches = await this.passwordCipher.check(password, pw);
    if (!passwordMatches) {
      return false;
    }
    return true;
  }
}
