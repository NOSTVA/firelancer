import { Injectable } from '@nestjs/common';
import { CreateAdministratorInput, UpdateAdministratorInput } from 'src/api/schema';
import { EntityNotFoundError } from 'src/common/error/errors';
import { RequestContext } from 'src/common/request-context';
import { ID } from 'src/common/shared-types';
import { assertFound, normalizeEmailAddress } from 'src/common/utils';
import { ConfigService } from 'src/config/config.service';
import { TransactionalConnection } from 'src/connection/transactional-connection';
import { NativeAuthenticationMethod, User } from 'src/entity';
import { Administrator } from 'src/entity/administrator/administrator.entity';
import { PasswordCipher } from '../helpers/password-cipher/password-cipher';
import { RequestContextService } from '../helpers/request-context/request-context.service';
import { patchEntity } from '../helpers/utils/patch-entity';
import { UserService } from './user.service';
import { RoleService } from './role.service';
import { IsNull } from 'typeorm';
import { AdministratorEvent } from 'src/event-bus/events/administrator-event';
import { EventBus } from 'src/event-bus/event-bus';
import { RoleChangeEvent } from 'src/event-bus/events/role-change-event';

/**
 * @description
 * Contains methods relating to Administrator entities.
 */
@Injectable()
export class AdministratorService {
  constructor(
    private connection: TransactionalConnection,
    private configService: ConfigService,
    private passwordCipher: PasswordCipher,
    private userService: UserService,
    private roleService: RoleService,
    private requestContextService: RequestContextService,
    private eventBus: EventBus,
  ) {}

  async initAdministrators() {
    await this.ensureSuperAdminExists();
  }

  /**
   * @description
   * Get a paginated list of Administrators.
   */
  async findAll(ctx: RequestContext): Promise<Administrator[]> {
    return this.connection.getRepository(ctx, Administrator).find();
  }

  /**
   * @description
   * Get an Administrator by id.
   */
  async findOne(ctx: RequestContext, administratorId: ID): Promise<Administrator | undefined> {
    return this.connection
      .getRepository(ctx, Administrator)
      .findOne({
        relations: {
          user: {
            roles: true,
          },
        },
        where: {
          id: administratorId,
          deletedAt: IsNull(),
        },
      })
      .then((result) => result ?? undefined);
  }

  /**
   * @description
   * Get an Administrator based on the User id.
   */
  async findOneByUserId(ctx: RequestContext, userId: ID): Promise<Administrator | undefined> {
    return this.connection
      .getRepository(ctx, Administrator)
      .findOne({
        where: {
          user: {
            id: userId,
            deletedAt: IsNull(),
          },
        },
      })
      .then((result) => result ?? undefined);
  }

  /**
   * @description
   * Create a new Administrator.
   */
  async create(ctx: RequestContext, input: CreateAdministratorInput): Promise<Administrator> {
    const administrator = new Administrator(input);
    administrator.emailAddress = normalizeEmailAddress(input.emailAddress);
    administrator.user = await this.userService.createAdminUser(ctx, input.emailAddress, input.password);
    let createdAdministrator = await this.connection.getRepository(ctx, Administrator).save(administrator);
    for (const roleId of input.roleIds) {
      createdAdministrator = await this.assignRole(ctx, createdAdministrator.id, roleId);
    }
    await this.eventBus.publish(new AdministratorEvent(ctx, createdAdministrator, 'created', input));
    return createdAdministrator;
  }

  /**
   * @description
   * Update an existing Administrator.
   */
  async update(ctx: RequestContext, input: UpdateAdministratorInput): Promise<Administrator> {
    const administrator = await this.findOne(ctx, input.id);
    if (!administrator) {
      throw new EntityNotFoundError('Administrator', input.id);
    }
    let updatedAdministrator = patchEntity(administrator, input);
    await this.connection.getRepository(ctx, Administrator).save(administrator, { reload: false });

    if (input.emailAddress) {
      updatedAdministrator.user.identifier = input.emailAddress;
      await this.connection.getRepository(ctx, User).save(updatedAdministrator.user);
    }
    if (input.password) {
      const user = await this.userService.getUserById(ctx, administrator.user.id);
      if (user) {
        const nativeAuthMethod = user.getNativeAuthenticationMethod();
        nativeAuthMethod.passwordHash = await this.passwordCipher.hash(input.password);
        await this.connection.getRepository(ctx, NativeAuthenticationMethod).save(nativeAuthMethod);
      }
    }
    if (input.roleIds) {
      const removeIds = administrator.user.roles.map((role) => role.id).filter((roleId) => (input.roleIds as ID[]).indexOf(roleId) === -1);

      const addIds = (input.roleIds as ID[]).filter((roleId) => !administrator.user.roles.some((role) => role.id === roleId));

      administrator.user.roles = [];
      await this.connection.getRepository(ctx, User).save(administrator.user, { reload: false });
      for (const roleId of input.roleIds) {
        updatedAdministrator = await this.assignRole(ctx, administrator.id, roleId);
      }
      await this.eventBus.publish(new RoleChangeEvent(ctx, administrator, addIds, 'assigned'));
      await this.eventBus.publish(new RoleChangeEvent(ctx, administrator, removeIds, 'removed'));
    }
    await this.eventBus.publish(new AdministratorEvent(ctx, administrator, 'updated', input));
    return updatedAdministrator;
  }

  /**
   * @description
   * Assigns a Role to the Administrator's User entity.
   */
  async assignRole(ctx: RequestContext, administratorId: ID, roleId: ID): Promise<Administrator> {
    const administrator = await this.findOne(ctx, administratorId);
    if (!administrator) {
      throw new EntityNotFoundError('Administrator', administratorId);
    }
    const role = await this.roleService.findOne(ctx, roleId);
    if (!role) {
      throw new EntityNotFoundError('Role', roleId);
    }
    administrator.user.roles.push(role);
    await this.connection.getRepository(ctx, User).save(administrator.user, { reload: false });
    return administrator;
  }

  /**
   * @description
   * Soft deletes an Administrator (sets the `deletedAt` field).
   */
  async softDelete(ctx: RequestContext, id: ID): Promise<void> {
    const administrator = await this.connection.getEntityOrThrow(ctx, Administrator, id, {
      relations: ['user'],
    });
    await this.connection.getRepository(ctx, Administrator).update({ id }, { deletedAt: new Date() });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.userService.softDelete(ctx, administrator.user.id);
    await this.eventBus.publish(new AdministratorEvent(ctx, administrator, 'deleted', id));
  }

  /**
   * @description
   * Ensures that a SuperAdmin user and corresponding Administrator entity exist and are active.
   * This method handles the following cases:
   * - No SuperAdmin user exists.
   * - The SuperAdmin user exists but has no corresponding Administrator entity.
   * - The SuperAdmin user or Administrator entity exists but is soft-deleted.
   * - Ensures the SuperAdmin user has the SuperAdmin role.
   */
  private async ensureSuperAdminExists() {
    const { superadminCredentials } = this.configService.authOptions;

    const superAdminUser = await this.connection.rawConnection.getRepository(User).findOne({
      where: { identifier: superadminCredentials.identifier },
      relations: {
        roles: true,
      },
      withDeleted: true, // Include soft-deleted entities
    });

    if (!superAdminUser) {
      // Case: No SuperAdmin user exists
      const ctx = await this.requestContextService.create({ apiType: 'admin' });
      const superAdminRole = await this.roleService.getSuperAdminRole();
      const administrator = new Administrator({
        emailAddress: superadminCredentials.identifier,
        firstName: 'Super',
        lastName: 'Admin',
      });
      administrator.user = await this.userService.createAdminUser(ctx, superadminCredentials.identifier, superadminCredentials.password);
      const { id } = await this.connection.getRepository(ctx, Administrator).save(administrator);
      const createdAdministrator = await assertFound(this.findOne(ctx, id));
      createdAdministrator.user.roles.push(superAdminRole);
      await this.connection.getRepository(ctx, User).save(createdAdministrator.user, { reload: false });
    } else {
      // Case: SuperAdmin user exists
      if (superAdminUser.deletedAt) {
        // Reactivate the soft-deleted user
        superAdminUser.deletedAt = null;
        await this.connection.rawConnection.getRepository(User).save(superAdminUser);
      }

      const superAdministrator = await this.connection.rawConnection.getRepository(Administrator).findOne({
        where: { user: { id: superAdminUser.id } },
        withDeleted: true, // Include soft-deleted entities
      });

      if (!superAdministrator) {
        // Case: Administrator entity does not exist for the SuperAdmin user
        const administrator = new Administrator({
          emailAddress: superadminCredentials.identifier,
          firstName: 'Super',
          lastName: 'Admin',
          user: superAdminUser,
        });
        await this.connection.rawConnection.getRepository(Administrator).save(administrator);
      } else if (superAdministrator.deletedAt) {
        // Reactivate the soft-deleted Administrator entity
        superAdministrator.deletedAt = null;
        await this.connection.rawConnection.getRepository(Administrator).save(superAdministrator);
      }

      const superAdminRole = await this.roleService.getSuperAdminRole();
      if (!superAdminUser.roles.some((role) => role.id === superAdminRole.id)) {
        // Ensure the user has the SuperAdmin role
        superAdminUser.roles.push(superAdminRole);
        await this.connection.rawConnection.getRepository(User).save(superAdminUser, { reload: false });
      }
    }
  }
}
