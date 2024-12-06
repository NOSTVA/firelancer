import { Injectable } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { TransactionalConnection } from 'src/connection/transactional-connection';
import { UserService } from './user.service';
import { HistoryService } from './history.service';
import { RequestContext } from 'src/common/request-context';
import { Customer } from 'src/entity/customer/customer.entity';
import { IsNull } from 'typeorm';
import { CustomerType, HistoryEntryType, ID } from 'src/common/shared-types';
import { CreateCustomerInput, RegisterCustomerInput, UpdateCustomerInput } from 'src/api/schema';
import { assertFound, normalizeEmailAddress } from 'src/common/utils';
import { patchEntity } from '../helpers/utils/patch-entity';
import {
  EmailAddressConflictError,
  EntityNotFoundError,
  InternalServerError,
  MissingPasswordError,
  UnauthorizedError,
} from 'src/common/error/errors';
import { NATIVE_AUTH_STRATEGY_NAME } from 'src/config/strategies/authentication/default/native-authentication-strategy';
import { NativeAuthenticationMethod, User } from 'src/entity';
import { CustomerEvent } from 'src/event-bus/events/customer-event';
import { EventBus } from 'src/event-bus/event-bus';
import { AccountRegistrationEvent } from 'src/event-bus/events/account-registration-event';
import { AccountVerifiedEvent } from 'src/event-bus/events/account-verified-event';
import { PasswordResetEvent } from 'src/event-bus/events/password-reset-event';
import { PasswordResetVerifiedEvent } from 'src/event-bus/events/password-reset-verified-event';
import { IdentifierChangeRequestEvent } from 'src/event-bus/events/identifier-change-request-event';
import { IdentifierChangeEvent } from 'src/event-bus/events/identifier-change-event';

/**
 * @description
 * Contains methods relating to Customer entities.
 */
@Injectable()
export class CustomerService {
  constructor(
    private connection: TransactionalConnection,
    private configService: ConfigService,
    private userService: UserService,
    private historyService: HistoryService,
    private eventBus: EventBus,
  ) {}

  async findAll(ctx: RequestContext): Promise<Customer[]> {
    return this.connection.getRepository(ctx, Customer).find({
      where: {
        deletedAt: IsNull(),
      },
    });
  }

  async findOne(ctx: RequestContext, id: ID): Promise<Customer | undefined> {
    return this.connection
      .getRepository(ctx, Customer)
      .findOne({
        where: {
          id,
          deletedAt: IsNull(),
        },
      })
      .then((customer) => customer ?? undefined);
  }

  /**
   * @description
   * Returns the Customer entity associated with the given userId, if one exists.
   */
  async findOneByUserId(ctx: RequestContext, userId: ID): Promise<Customer | undefined> {
    return this.connection
      .getRepository(ctx, Customer)
      .findOne({
        where: {
          user: {
            id: userId,
          },
          deletedAt: IsNull(),
        },
      })
      .then((customer) => customer ?? undefined);
  }

  async create(ctx: RequestContext, input: CreateCustomerInput, password?: string): Promise<Customer> {
    input.emailAddress = normalizeEmailAddress(input.emailAddress);
    const customer = new Customer(input);

    const existingCustomer = await this.connection.getRepository(ctx, Customer).findOne({
      where: {
        emailAddress: input.emailAddress,
        deletedAt: IsNull(),
      },
    });
    const existingUser = await this.userService.getUserByEmailAddress(ctx, input.emailAddress, 'customer');

    if (existingCustomer && existingUser) {
      // Customer already exists
      const updatedCustomer = patchEntity(existingCustomer, input);
      return this.connection.getRepository(ctx, Customer).save(updatedCustomer);
    } else if (existingCustomer || existingUser) {
      // Not sure when this situation would occur
      throw new EmailAddressConflictError();
    }

    const customerUser = await this.userService.createCustomerUser(ctx, input.customerType, input.emailAddress, password);
    customer.user = customerUser;
    if (password && password !== '') {
      const verificationToken = customer.user.getNativeAuthenticationMethod().verificationToken;
      if (verificationToken) {
        customer.user = await this.userService.verifyUserByToken(ctx, verificationToken);
      }
    }

    const createdCustomer = await this.connection.getRepository(ctx, Customer).save(customer);
    await this.historyService.createHistoryEntryForCustomer({
      ctx,
      customerId: createdCustomer.id,
      type: HistoryEntryType.CUSTOMER_REGISTERED,
      data: {
        strategy: NATIVE_AUTH_STRATEGY_NAME,
      },
    });

    if (customer.user?.verified) {
      await this.historyService.createHistoryEntryForCustomer({
        ctx,
        customerId: createdCustomer.id,
        type: HistoryEntryType.CUSTOMER_VERIFIED,
        data: {
          strategy: NATIVE_AUTH_STRATEGY_NAME,
        },
      });
    }
    await this.eventBus.publish(new CustomerEvent(ctx, createdCustomer, 'created', input));
    return createdCustomer;
  }

  async update(ctx: RequestContext, input: UpdateCustomerInput): Promise<Customer> {
    const customer = await this.connection.getEntityOrThrow(ctx, Customer, input.id);

    if (input.emailAddress) {
      input.emailAddress = normalizeEmailAddress(input.emailAddress);
      if (input.emailAddress !== customer.emailAddress) {
        const existingCustomer = await this.connection.getRepository(ctx, Customer).findOne({
          where: {
            emailAddress: input.emailAddress,
            deletedAt: IsNull(),
          },
        });

        if (existingCustomer) {
          throw new EmailAddressConflictError();
        }

        if (customer.user) {
          await this.userService.changeUserAndNativeIdentifier(ctx, customer.user.id, input.emailAddress);
        }
      }
    }

    const updatedCustomer = patchEntity(customer, input);
    await this.connection.getRepository(ctx, Customer).save(updatedCustomer);
    await this.historyService.createHistoryEntryForCustomer({
      customerId: customer.id,
      ctx,
      type: HistoryEntryType.CUSTOMER_DETAIL_UPDATED,
      data: {
        input,
      },
    });
    return assertFound(this.findOne(ctx, customer.id));
  }

  /**
   * @description
   * Registers a new Customer account with the NativeAuthenticationStrategy and starts
   * the email verification flow (unless AuthOptions `requireVerification` is set to `false`)
   * by publishing an AccountRegistrationEvent
   *
   * This method is intended to be used in storefront Customer-creation flows.
   */
  async registerCustomerAccount(ctx: RequestContext, input: RegisterCustomerInput): Promise<void> {
    if (!this.configService.authOptions.requireVerification) {
      if (!input.password) {
        throw new MissingPasswordError();
      }
    }
    let user = await this.userService.getUserByEmailAddress(ctx, input.emailAddress);
    const hasNativeAuthMethod = !!user?.authenticationMethods.find((m) => m instanceof NativeAuthenticationMethod);
    if (user && user.verified) {
      if (hasNativeAuthMethod) {
        // If the user has already been verified and has already registered
        // with the native authentication strategy, do nothing.
        return;
      }
    }
    const customer = await this.createOrUpdate(ctx, {
      emailAddress: input.emailAddress,
      customerType: input.customerType,
      title: input.title || '',
      firstName: input.firstName || '',
      lastName: input.lastName || '',
      phoneNumber: input.phoneNumber || '',
    });

    await this.historyService.createHistoryEntryForCustomer({
      customerId: customer.id,
      ctx,
      type: HistoryEntryType.CUSTOMER_REGISTERED,
      data: {
        strategy: NATIVE_AUTH_STRATEGY_NAME,
      },
    });

    if (!user) {
      const customerUser = await this.userService.createCustomerUser(
        ctx,
        input.customerType,
        input.emailAddress,
        input.password || undefined,
      );
      user = customerUser;
    }

    if (!hasNativeAuthMethod) {
      const addAuthenticationResult = await this.userService.addNativeAuthenticationMethod(
        ctx,
        user,
        input.emailAddress,
        input.password || undefined,
      );
      user = addAuthenticationResult;
    }

    if (!user.verified) {
      user = await this.userService.setVerificationToken(ctx, user);
    }

    customer.user = user;
    await this.connection.getRepository(ctx, User).save(user, { reload: false });
    await this.connection.getRepository(ctx, Customer).save(customer, { reload: false });
    if (!user.verified) {
      await this.eventBus.publish(new AccountRegistrationEvent(ctx, user));
    } else {
      await this.historyService.createHistoryEntryForCustomer({
        customerId: customer.id,
        ctx,
        type: HistoryEntryType.CUSTOMER_VERIFIED,
        data: {
          strategy: NATIVE_AUTH_STRATEGY_NAME,
        },
      });
    }
    return;
  }

  /**
   * @description
   * Refreshes a stale email address verification token by generating a new one and
   * publishing a AccountRegistrationEvent.
   */
  async refreshVerificationToken(ctx: RequestContext, emailAddress: string): Promise<void> {
    const user = await this.userService.getUserByEmailAddress(ctx, emailAddress);
    if (user && !user.verified) {
      await this.userService.setVerificationToken(ctx, user);
      await this.eventBus.publish(new AccountRegistrationEvent(ctx, user));
    }
  }

  /**
   * @description
   * Given a valid verification token which has been published in an AccountRegistrationEvent, this
   * method is used to set the Customer as `verified` as part of the account registration flow.
   */
  async verifyCustomerEmailAddress(ctx: RequestContext, verificationToken: string, password?: string): Promise<Customer> {
    const user = await this.userService.verifyUserByToken(ctx, verificationToken, password);

    const customer = await this.findOneByUserId(ctx, user.id);
    if (!customer) {
      throw new InternalServerError('error.cannot-locate-customer-for-user');
    }

    await this.historyService.createHistoryEntryForCustomer({
      ctx,
      customerId: customer.id,
      type: HistoryEntryType.CUSTOMER_VERIFIED,
      data: {
        strategy: NATIVE_AUTH_STRATEGY_NAME,
      },
    });

    const verifiedUser = assertFound(this.findOneByUserId(ctx, user.id));
    await this.eventBus.publish(new AccountVerifiedEvent(ctx, customer));
    return verifiedUser;
  }

  /**
   * @description
   * Publishes a new PasswordResetEvent for the given email address. This event creates
   * a token which can be used in the `resetPassword()` method.
   */
  async requestPasswordReset(ctx: RequestContext, emailAddress: string): Promise<void> {
    const user = await this.userService.setPasswordResetToken(ctx, emailAddress);
    if (user) {
      await this.eventBus.publish(new PasswordResetEvent(ctx, user));
      const customer = await this.findOneByUserId(ctx, user.id);
      if (!customer) {
        throw new InternalServerError('error.cannot-locate-customer-for-user');
      }
      await this.historyService.createHistoryEntryForCustomer({
        customerId: customer.id,
        ctx,
        type: HistoryEntryType.CUSTOMER_PASSWORD_RESET_REQUESTED,
        data: {},
      });
    }
  }

  /**
   * @description
   * Given a valid password reset token created by a call to the `requestPasswordReset()` method,
   * this method will change the Customer's password to that given as the `password` argument.
   */
  async resetPassword(ctx: RequestContext, passwordResetToken: string, password: string): Promise<User> {
    const user = await this.userService.resetPasswordByToken(ctx, passwordResetToken, password);

    const customer = await this.findOneByUserId(ctx, user.id);
    if (!customer) {
      throw new InternalServerError('error.cannot-locate-customer-for-user');
    }
    await this.historyService.createHistoryEntryForCustomer({
      customerId: customer.id,
      ctx,
      type: HistoryEntryType.CUSTOMER_PASSWORD_RESET_VERIFIED,
      data: {},
    });
    await this.eventBus.publish(new PasswordResetVerifiedEvent(ctx, user));
    return user;
  }

  /**
   * @description
   * Publishes a IdentifierChangeRequestEvent for the given User. This event contains a token
   * which is then used in the `updateEmailAddress()` method to change the email address of the User &
   * Customer.
   */
  async requestUpdateEmailAddress(ctx: RequestContext, userId: ID, newEmailAddress: string): Promise<boolean> {
    const normalizedEmailAddress = normalizeEmailAddress(newEmailAddress);
    const userWithConflictingIdentifier = await this.userService.getUserByEmailAddress(ctx, newEmailAddress);
    if (userWithConflictingIdentifier) {
      throw new EmailAddressConflictError();
    }
    const user = await this.userService.getUserById(ctx, userId);
    if (!user) {
      return false;
    }
    const customer = await this.findOneByUserId(ctx, user.id);
    if (!customer) {
      return false;
    }
    const oldEmailAddress = customer.emailAddress;
    await this.historyService.createHistoryEntryForCustomer({
      customerId: customer.id,
      ctx,
      type: HistoryEntryType.CUSTOMER_EMAIL_UPDATE_REQUESTED,
      data: {
        oldEmailAddress,
        newEmailAddress: normalizedEmailAddress,
      },
    });
    if (this.configService.authOptions.requireVerification) {
      user.getNativeAuthenticationMethod().pendingIdentifier = normalizedEmailAddress;
      await this.userService.setIdentifierChangeToken(ctx, user);
      await this.eventBus.publish(new IdentifierChangeRequestEvent(ctx, user));
      return true;
    } else {
      const oldIdentifier = user.identifier;
      user.identifier = normalizedEmailAddress;
      customer.emailAddress = normalizedEmailAddress;
      await this.connection.getRepository(ctx, User).save(user, { reload: false });
      await this.connection.getRepository(ctx, Customer).save(customer, { reload: false });
      await this.eventBus.publish(new IdentifierChangeEvent(ctx, user, oldIdentifier));
      await this.historyService.createHistoryEntryForCustomer({
        customerId: customer.id,
        ctx,
        type: HistoryEntryType.CUSTOMER_EMAIL_UPDATE_VERIFIED,
        data: {
          oldEmailAddress,
          newEmailAddress: normalizedEmailAddress,
        },
      });
      return true;
    }
  }

  /**
   * @description
   * Given a valid email update token published in a IdentifierChangeRequestEvent, this method
   * will update the Customer & User email address.
   */
  async updateEmailAddress(ctx: RequestContext, token: string): Promise<boolean> {
    const { user, oldIdentifier } = await this.userService.changeIdentifierByToken(ctx, token);
    if (!user) {
      return false;
    }
    const customer = await this.findOneByUserId(ctx, user.id);
    if (!customer) {
      return false;
    }
    await this.eventBus.publish(new IdentifierChangeEvent(ctx, user, oldIdentifier));
    customer.emailAddress = user.identifier;
    await this.connection.getRepository(ctx, Customer).save(customer, { reload: false });
    await this.historyService.createHistoryEntryForCustomer({
      customerId: customer.id,
      ctx,
      type: HistoryEntryType.CUSTOMER_EMAIL_UPDATE_VERIFIED,
      data: {
        oldEmailAddress: oldIdentifier,
        newEmailAddress: customer.emailAddress,
      },
    });
    return true;
  }

  /**
   * @description
   * For guest checkouts, we assume that a matching email address is the same customer.
   */
  async createOrUpdate(
    ctx: RequestContext,
    input: Partial<CreateCustomerInput> & { customerType: CustomerType; emailAddress: string },
    errorOnExistingUser: boolean = false,
  ): Promise<Customer> {
    input.emailAddress = normalizeEmailAddress(input.emailAddress);
    let customer: Customer;
    const existing = await this.connection.getRepository(ctx, Customer).findOne({
      relations: {
        user: true,
      },
      where: {
        emailAddress: input.emailAddress,
        deletedAt: IsNull(),
      },
    });
    if (existing) {
      if (existing.user && errorOnExistingUser) {
        // It is not permitted to modify an existing *registered* Customer
        throw new EmailAddressConflictError();
      }
      customer = patchEntity(existing, input);
    } else {
      customer = await this.connection.getRepository(ctx, Customer).save(new Customer(input));
      await this.eventBus.publish(new CustomerEvent(ctx, customer, 'created', input));
    }
    return this.connection.getRepository(ctx, Customer).save(customer);
  }

  async softDelete(ctx: RequestContext, customerId: ID): Promise<void> {
    const customer = await this.connection.getEntityOrThrow(ctx, Customer, customerId);
    await this.connection.getRepository(ctx, Customer).update({ id: customerId }, { deletedAt: new Date() });
    if (customer.user) {
      await this.userService.softDelete(ctx, customer.user.id);
    }
    await this.eventBus.publish(new CustomerEvent(ctx, customer, 'deleted', customerId));
  }

  // TODO: fix error types
  async getUserCustomerFromRequest(ctx: RequestContext) {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Unauthenticated user');
    }
    const customer = await this.findOneByUserId(ctx, userId);
    if (!customer) {
      // TODO: fix error
      throw new EntityNotFoundError('Customer', userId);
    }
    return customer;
  }
}
