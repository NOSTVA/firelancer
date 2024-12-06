import { BadRequestException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  EntityNotFoundError,
  IdentifierChangeTokenExpiredError,
  IdentifierChangeTokenInvalidError,
  InternalServerError,
  InvalidCredentialsError,
  MissingPasswordError,
  PasswordAlreadySetError,
  PasswordResetTokenExpiredError,
  PasswordResetTokenInvalidError,
  PasswordValidationError,
  VerificationTokenExpiredError,
  VerificationTokenInvalidError,
} from 'src/common/error/errors';
import { RequestContext } from 'src/common/request-context';
import { CustomerType, ID } from 'src/common/shared-types';
import { isEmailAddressLike, normalizeEmailAddress } from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';
import { TransactionalConnection } from 'src/connection/transactional-connection';
import { NativeAuthenticationMethod, Role, User } from 'src/entity/index';
import { PasswordCipher } from '../helpers/password-cipher/password-cipher';
import { VerificationTokenGenerator } from '../helpers/verification-token-generator/verification-token-generator';
import { RoleService } from './role.service';

/**
 * @description
 * Contains methods relating to User entities.
 */
@Injectable()
export class UserService {
  constructor(
    private connection: TransactionalConnection,
    private configService: ConfigService,
    private roleService: RoleService,
    private passwordCipher: PasswordCipher,
    private verificationTokenGenerator: VerificationTokenGenerator,
    private moduleRef: ModuleRef,
  ) {}

  async getUserById(ctx: RequestContext, userId: ID): Promise<User | undefined> {
    return this.connection
      .getRepository(ctx, User)
      .findOne({
        where: { id: userId },
        relations: {
          roles: true,
          authenticationMethods: true,
        },
      })
      .then((result) => result ?? undefined);
  }

  async getUserByEmailAddress(
    ctx: RequestContext,
    emailAddress: string,
    userType?: 'administrator' | 'customer',
  ): Promise<User | undefined> {
    const entity = userType ?? (ctx.apiType === 'admin' ? 'administrator' : 'customer');
    const table = `${this.configService.dbConnectionOptions.entityPrefix ?? ''}${entity}`;

    const qb = this.connection
      .getRepository(ctx, User)
      .createQueryBuilder('user')
      .innerJoin(table, table, `${table}.userId = user.id`)
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('user.authenticationMethods', 'authenticationMethods')
      .where('user.deletedAt IS NULL');

    if (isEmailAddressLike(emailAddress)) {
      qb.andWhere('LOWER(user.identifier) = :identifier', {
        identifier: normalizeEmailAddress(emailAddress),
      });
    } else {
      qb.andWhere('user.identifier = :identifier', {
        identifier: emailAddress,
      });
    }
    return qb.getOne().then((result) => result ?? undefined);
  }

  async createCustomerUser(ctx: RequestContext, customerType: CustomerType, identifier: string, password?: string): Promise<User> {
    const user = new User();
    user.identifier = normalizeEmailAddress(identifier);
    let customerRole: Role | undefined;
    if (customerType === CustomerType.SELLER) {
      customerRole = await this.roleService.getSellerRole(ctx);
    } else if (customerType === CustomerType.BUYER) {
      customerRole = await this.roleService.getBuyerRole(ctx);
    } else {
      throw new BadRequestException('Invalid CustomerType');
    }
    user.roles = [customerRole];
    const updatedUser = await this.addNativeAuthenticationMethod(ctx, user, identifier, password);
    return this.connection.getRepository(ctx, User).save(updatedUser);
  }

  /**
   * @description
   * Adds a new NativeAuthenticationMethod to the User. If the AuthOptions `requireVerification`
   * is set to `true` (as is the default), the User will be marked as unverified until the email verification
   * flow is completed.
   */
  async addNativeAuthenticationMethod(ctx: RequestContext, user: User, identifier: string, password?: string): Promise<User> {
    const checkUser = user.id != null && (await this.getUserById(ctx, user.id));
    if (checkUser) {
      if (checkUser.authenticationMethods.find((m): m is NativeAuthenticationMethod => m instanceof NativeAuthenticationMethod)) {
        return user;
      }
    }
    const authenticationMethod = new NativeAuthenticationMethod();
    if (this.configService.authOptions.requireVerification) {
      authenticationMethod.verificationToken = this.verificationTokenGenerator.generateVerificationToken();
      user.verified = false;
    } else {
      user.verified = true;
    }
    if (password) {
      await this.validatePassword(ctx, password);
      authenticationMethod.passwordHash = await this.passwordCipher.hash(password);
    } else {
      authenticationMethod.passwordHash = '';
    }
    authenticationMethod.identifier = normalizeEmailAddress(identifier);
    authenticationMethod.user = user;
    await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(authenticationMethod);
    user.authenticationMethods = [...(user.authenticationMethods ?? []), authenticationMethod];
    return user;
  }

  /**
   * @description
   * Creates a new verified User using the NativeAuthenticationStrategy.
   */
  async createAdminUser(ctx: RequestContext, identifier: string, password: string): Promise<User> {
    const user = new User({
      identifier: normalizeEmailAddress(identifier),
      verified: true,
    });
    const authenticationMethod = await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(
      new NativeAuthenticationMethod({
        identifier: normalizeEmailAddress(identifier),
        passwordHash: await this.passwordCipher.hash(password),
      }),
    );
    user.authenticationMethods = [authenticationMethod];
    return this.connection.getRepository(ctx, User).save(user);
  }

  async softDelete(ctx: RequestContext, userId: ID): Promise<void> {
    await this.moduleRef.get((await import('./session.service.js')).SessionService).deleteSessionsByUser(ctx, new User({ id: userId }));
    await this.connection.getEntityOrThrow(ctx, User, userId);
    await this.connection.getRepository(ctx, User).update({ id: userId }, { deletedAt: new Date() });
  }

  /**
   * @description
   * Sets the NativeAuthenticationMethod `verificationToken` as part of the User email verification
   * flow.
   */
  async setVerificationToken(ctx: RequestContext, user: User): Promise<User> {
    const nativeAuthMethod = user.getNativeAuthenticationMethod();
    nativeAuthMethod.verificationToken = this.verificationTokenGenerator.generateVerificationToken();
    user.verified = false;
    await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod);
    return this.connection.getRepository(ctx, User).save(user);
  }

  /**
   * @description
   * Verifies a verificationToken by looking for a User which has previously had it set using the
   * `setVerificationToken()` method, and checks that the token is valid and has not expired.
   *
   * If valid, the User will be set to `verified: true`.
   */
  async verifyUserByToken(ctx: RequestContext, verificationToken: string, password?: string): Promise<User> {
    const user = await this.connection
      .getRepository(ctx, User)
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.authenticationMethods', 'aums')
      .leftJoin('user.authenticationMethods', 'authenticationMethod')
      .addSelect('aums.passwordHash')
      .where('authenticationMethod.verificationToken = :verificationToken', { verificationToken })
      .getOne();
    if (user) {
      if (this.verificationTokenGenerator.verifyVerificationToken(verificationToken)) {
        const nativeAuthMethod = user.getNativeAuthenticationMethod();
        if (!password) {
          if (!nativeAuthMethod.passwordHash) {
            throw new MissingPasswordError();
          }
        } else {
          if (nativeAuthMethod.passwordHash) {
            throw new PasswordAlreadySetError();
          }
          await this.validatePassword(ctx, password);
          nativeAuthMethod.passwordHash = await this.passwordCipher.hash(password);
        }
        nativeAuthMethod.verificationToken = null;
        user.verified = true;
        await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod);
        return this.connection.getRepository(ctx, User).save(user);
      } else {
        throw new VerificationTokenExpiredError();
      }
    } else {
      throw new VerificationTokenInvalidError();
    }
  }

  /**
   * @description
   * Sets the NativeAuthenticationMethod `passwordResetToken` as part of the User password reset
   * flow.
   */
  async setPasswordResetToken(ctx: RequestContext, emailAddress: string): Promise<User | undefined> {
    const user = await this.getUserByEmailAddress(ctx, emailAddress);
    if (!user) {
      return;
    }
    const nativeAuthMethod = user.getNativeAuthenticationMethod(false);
    if (!nativeAuthMethod) {
      return undefined;
    }
    nativeAuthMethod.passwordResetToken = this.verificationTokenGenerator.generateVerificationToken();
    await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod);
    return user;
  }

  /**
   * @description
   * Verifies a passwordResetToken by looking for a User which has previously had it set using the
   * `setPasswordResetToken()` method, and checks that the token is valid and has not expired.
   *
   * If valid, the User's credentials will be updated with the new password.
   */
  async resetPasswordByToken(ctx: RequestContext, passwordResetToken: string, password: string): Promise<User> {
    const user = await this.connection
      .getRepository(ctx, User)
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.authenticationMethods', 'aums')
      .leftJoin('user.authenticationMethods', 'authenticationMethod')
      .where('authenticationMethod.passwordResetToken = :passwordResetToken', { passwordResetToken })
      .getOne();
    if (!user) {
      throw new PasswordResetTokenInvalidError();
    }
    await this.validatePassword(ctx, password);

    if (this.verificationTokenGenerator.verifyVerificationToken(passwordResetToken)) {
      const nativeAuthMethod = user.getNativeAuthenticationMethod();
      nativeAuthMethod.passwordHash = await this.passwordCipher.hash(password);
      nativeAuthMethod.passwordResetToken = null;
      await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod);
      if (user.verified === false && this.configService.authOptions.requireVerification) {
        // This code path represents an edge-case in which the Customer creates an account,
        // but prior to verifying their email address, they start the password reset flow.
        // Since the password reset flow makes the exact same guarantee as the email verification
        // flow (i.e. the person controls the specified email account), we can also consider it
        // a verification.
        user.verified = true;
      }
      return this.connection.getRepository(ctx, User).save(user);
    } else {
      throw new PasswordResetTokenExpiredError();
    }
  }

  /**
   * @description
   * Changes the User identifier without an email verification step, so this should be only used when
   * an Administrator is setting a new email address.
   */
  async changeUserAndNativeIdentifier(ctx: RequestContext, userId: ID, newIdentifier: string) {
    const user = await this.getUserById(ctx, userId);
    if (!user) {
      return;
    }
    const nativeAuthMethod = user.authenticationMethods.find(
      (m): m is NativeAuthenticationMethod => m instanceof NativeAuthenticationMethod,
    );
    if (nativeAuthMethod) {
      nativeAuthMethod.identifier = newIdentifier;
      nativeAuthMethod.identifierChangeToken = null;
      nativeAuthMethod.pendingIdentifier = null;
      await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod, { reload: false });
    }
    user.identifier = newIdentifier;
    await this.connection.getRepository(ctx, User).save(user, { reload: false });
  }

  /**
   * @description
   * Sets the NativeAuthenticationMethod `identifierChangeToken` as part of the User email address change
   * flow.
   */
  async setIdentifierChangeToken(ctx: RequestContext, user: User): Promise<User> {
    const nativeAuthMethod = user.getNativeAuthenticationMethod();
    nativeAuthMethod.identifierChangeToken = this.verificationTokenGenerator.generateVerificationToken();
    await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod);
    return user;
  }

  /**
   * @description
   * Changes the User identifier as part of the storefront flow used by Customers to set a
   * new email address, with the token previously set using the `setIdentifierChangeToken()` method.
   */
  async changeIdentifierByToken(ctx: RequestContext, token: string): Promise<{ user: User; oldIdentifier: string }> {
    const user = await this.connection
      .getRepository(ctx, User)
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.authenticationMethods', 'aums')
      .leftJoin('user.authenticationMethods', 'authenticationMethod')
      .where('authenticationMethod.identifierChangeToken = :identifierChangeToken', {
        identifierChangeToken: token,
      })
      .getOne();
    if (!user) {
      throw new IdentifierChangeTokenInvalidError();
    }
    if (!this.verificationTokenGenerator.verifyVerificationToken(token)) {
      throw new IdentifierChangeTokenExpiredError();
    }
    const nativeAuthMethod = user.getNativeAuthenticationMethod();
    const pendingIdentifier = nativeAuthMethod.pendingIdentifier;
    if (!pendingIdentifier) {
      throw new InternalServerError('error.pending-identifier-missing');
    }
    const oldIdentifier = user.identifier;
    user.identifier = pendingIdentifier;
    nativeAuthMethod.identifier = pendingIdentifier;
    nativeAuthMethod.identifierChangeToken = null;
    nativeAuthMethod.pendingIdentifier = null;
    await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod, { reload: false });
    await this.connection.getRepository(ctx, User).save(user, { reload: false });
    return { user, oldIdentifier };
  }

  /**
   * @description
   * Updates the password for a User with the NativeAuthenticationMethod.
   */
  async updatePassword(ctx: RequestContext, userId: ID, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.connection
      .getRepository(ctx, User)
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.authenticationMethods', 'authenticationMethods')
      .addSelect('authenticationMethods.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new EntityNotFoundError('User', userId);
    }

    const password = newPassword;
    await this.validatePassword(ctx, password);

    const nativeAuthMethod = user.getNativeAuthenticationMethod();
    const matches = await this.passwordCipher.check(currentPassword, nativeAuthMethod.passwordHash);

    if (!matches) {
      throw new InvalidCredentialsError();
    }

    nativeAuthMethod.passwordHash = await this.passwordCipher.hash(newPassword);
    await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod, { reload: false });
  }

  private async validatePassword(ctx: RequestContext, password: string): Promise<void> {
    const passwordValidationResult = await this.configService.authOptions.passwordValidationStrategy.validate(ctx, password);
    if (passwordValidationResult !== true) {
      const message = typeof passwordValidationResult === 'string' ? passwordValidationResult : 'Password is invalid';
      throw new PasswordValidationError(message);
    }
  }
}
