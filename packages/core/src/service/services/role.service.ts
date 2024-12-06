import { Injectable } from '@nestjs/common';
import { CreateRoleInput, UpdateRoleInput } from 'src/api/schema';
import {
  BUYER_ROLE_CODE,
  BUYER_ROLE_DESCRIPTION,
  getAllPermissionsMetadata,
  SELLER_ROLE_CODE,
  SELLER_ROLE_DESCRIPTION,
  SUPER_ADMIN_ROLE_CODE,
  SUPER_ADMIN_ROLE_DESCRIPTION,
} from 'src/common/constants';
import { EntityNotFoundError, InternalServerError, UserInputError } from 'src/common/error/errors';
import { RequestContext } from 'src/common/request-context';
import { ID, Permission } from 'src/common/shared-types';
import { assertFound } from 'src/common/utils';
import { unique } from 'src/common/utils/unique';
import { ConfigService } from 'src/config/config.service';
import { TransactionalConnection } from 'src/connection/transactional-connection';
import { Role } from 'src/entity/role/role.entity';
import { EventBus } from 'src/event-bus/event-bus';
import { RoleEvent } from 'src/event-bus/events/role-event';
import { patchEntity } from '../helpers/utils/patch-entity';

/**
 * @description
 * Contains methods relating to Role entities.
 */
@Injectable()
export class RoleService {
  constructor(
    private connection: TransactionalConnection,
    private configService: ConfigService,
    private eventBus: EventBus,
  ) {}

  async initRoles() {
    await this.ensureSuperAdminRoleExists();
    await this.ensureBuyerRoleExists();
    await this.ensureSellerRoleExists();
    this.ensureRolesHaveValidPermissions();
  }

  async findAll(ctx: RequestContext): Promise<Role[]> {
    return this.connection.getRepository(ctx, Role).find();
  }

  async findOne(ctx: RequestContext, roleId: ID): Promise<Role | undefined> {
    return this.connection
      .getRepository(ctx, Role)
      .findOne({ where: { id: roleId } })
      .then((role) => role ?? undefined);
  }

  /**
   * @description
   * Returns the special SuperAdmin Role, which always exists in Firelancer.
   */
  async getSuperAdminRole(ctx?: RequestContext): Promise<Role> {
    return this.getRoleByCode(ctx, SUPER_ADMIN_ROLE_CODE).then((role) => {
      if (!role) {
        throw new InternalServerError('error.super-admin-role-not-found');
      }
      return role;
    });
  }

  /**
   * @description
   * Returns the special Buyer, which always exists in Firelancer.
   */
  async getBuyerRole(ctx?: RequestContext): Promise<Role> {
    return this.getRoleByCode(ctx, BUYER_ROLE_CODE).then((role) => {
      if (!role) {
        throw new InternalServerError('error.buyer-role-not-found');
      }
      return role;
    });
  }

  /**
   * @description
   * Returns the special Buyer, which always exists in Firelancer.
   */
  async getSellerRole(ctx?: RequestContext): Promise<Role> {
    return this.getRoleByCode(ctx, SELLER_ROLE_CODE).then((role) => {
      if (!role) {
        throw new InternalServerError('error.seller-role-not-found');
      }
      return role;
    });
  }

  /**
   * @description
   * Returns all the valid Permission values
   */
  getAllPermissions(): string[] {
    return Object.values(Permission);
  }

  async create(ctx: RequestContext, input: CreateRoleInput): Promise<Role> {
    this.checkPermissionsAreValid(input.permissions);
    const role = new Role({
      code: input.code,
      description: input.description,
      permissions: unique([Permission.Authenticated, ...input.permissions]),
    });
    await this.connection.getRepository(ctx, Role).save(role, { reload: false });
    await this.eventBus.publish(new RoleEvent(ctx, role, 'created', input));
    return role;
  }

  async update(ctx: RequestContext, input: UpdateRoleInput): Promise<Role> {
    this.checkPermissionsAreValid(input.permissions);
    const role = await this.findOne(ctx, input.id);
    if (!role) {
      throw new EntityNotFoundError('Role', input.id);
    }
    if (role.code === SUPER_ADMIN_ROLE_CODE || role.code === SELLER_ROLE_CODE || role.code === BUYER_ROLE_CODE) {
      throw new InternalServerError('error.cannot-modify-role');
    }
    const updatedRole = patchEntity(role, {
      code: input.code,
      description: input.description,
      permissions: input.permissions ? unique([Permission.Authenticated, ...input.permissions]) : undefined,
    });
    await this.connection.getRepository(ctx, Role).save(updatedRole, { reload: false });
    await this.eventBus.publish(new RoleEvent(ctx, role, 'updated', input));
    return assertFound(this.findOne(ctx, role.id));
  }

  async delete(ctx: RequestContext, id: ID): Promise<void> {
    const role = await this.findOne(ctx, id);
    if (!role) {
      throw new EntityNotFoundError('Role', id);
    }
    if (role.code === SUPER_ADMIN_ROLE_CODE || role.code === SELLER_ROLE_CODE || role.code === BUYER_ROLE_CODE) {
      throw new InternalServerError('error.cannot-delete-role');
    }
    await this.connection.getRepository(ctx, Role).remove(role);
    await this.eventBus.publish(new RoleEvent(ctx, role, 'deleted', id));
  }

  private checkPermissionsAreValid(permissions?: Permission[] | null) {
    if (!permissions) {
      return;
    }
    const allAssignablePermissions = this.getAllAssignablePermissions();
    for (const permission of permissions) {
      if (!allAssignablePermissions.includes(permission) || permission === Permission.SuperAdmin) {
        throw new UserInputError('error.permission-invalid');
      }
    }
  }

  private getRoleByCode(ctx: RequestContext | undefined, code: string) {
    const repository = ctx ? this.connection.getRepository(ctx, Role) : this.connection.rawConnection.getRepository(Role);

    return repository.findOne({
      where: { code },
    });
  }

  private async ensureSuperAdminRoleExists() {
    const assignablePermissions = this.getAllAssignablePermissions();
    try {
      const superAdminRole = await this.getSuperAdminRole();
      superAdminRole.permissions = assignablePermissions;
      await this.connection.rawConnection.getRepository(Role).save(superAdminRole, { reload: false });
    } catch (err) {
      const superAdminRole = new Role({
        code: SUPER_ADMIN_ROLE_CODE,
        description: SUPER_ADMIN_ROLE_DESCRIPTION,
        permissions: assignablePermissions,
      });
      await this.connection.rawConnection.getRepository(Role).save(superAdminRole, { reload: false });
    }
  }

  private async ensureBuyerRoleExists() {
    try {
      await this.getBuyerRole();
    } catch (err) {
      const buyerRole = new Role({
        code: BUYER_ROLE_CODE,
        description: BUYER_ROLE_DESCRIPTION,
        permissions: [
          Permission.Authenticated,
          Permission.CreateJobPost,
          Permission.ReadJobPost,
          Permission.DeleteJobPost,
          Permission.UpdateJobPost,
        ],
      });
      await this.connection.rawConnection.getRepository(Role).save(buyerRole, { reload: false });
    }
  }

  private async ensureSellerRoleExists() {
    try {
      await this.getSellerRole();
    } catch (err) {
      const sellerRole = new Role({
        code: SELLER_ROLE_CODE,
        description: SELLER_ROLE_DESCRIPTION,
        permissions: [Permission.Authenticated, Permission.ReadJobPost],
      });
      await this.connection.rawConnection.getRepository(Role).save(sellerRole, { reload: false });
    }
  }

  private ensureRolesHaveValidPermissions() {
    const allPermissions = Object.values(Permission);
    for (const permission of allPermissions) {
      if (permission === Permission.SuperAdmin) {
        continue;
      }
      // Check for other validations if necessary
    }
  }

  private getAllAssignablePermissions(): Permission[] {
    return getAllPermissionsMetadata(this.configService.authOptions.customPermissions)
      .filter((p) => p.assignable)
      .map((p) => p.name as Permission);
  }
}
