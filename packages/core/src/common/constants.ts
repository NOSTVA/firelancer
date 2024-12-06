import { CrudPermissionDefinition, PermissionDefinition, PermissionMetadata } from './permission-definition';

/**
 * This value should be rarely used - only in those contexts where we have no access to the
 * FirelancerConfig to ensure at least a valid LanguageCode is available.
 */
export const TRANSACTION_MANAGER_KEY = Symbol('TRANSACTION_MANAGER');
export const REQUEST_CONTEXT_KEY = 'firelancerRequestContext';
export const REQUEST_CONTEXT_MAP_KEY = 'firelancerRequestContextMap';
export const API_PORT = 3000;
export const ADMIN_API_PATH = 'admin-api';
export const SHOP_API_PATH = 'shop-api';
export const SUPER_ADMIN_ROLE_CODE = '__super_admin_role__';
export const SUPER_ADMIN_ROLE_DESCRIPTION = 'SuperAdmin';
export const SUPER_ADMIN_USER_IDENTIFIER = 'superadmin';
export const SUPER_ADMIN_USER_PASSWORD = 'superadmin';
export const BUYER_ROLE_CODE = '__buyer_role__';
export const SELLER_ROLE_CODE = '__seller_role__';
export const BUYER_ROLE_DESCRIPTION = 'Buyer';
export const SELLER_ROLE_DESCRIPTION = 'Seller';
export const DEFAULT_AUTH_TOKEN_HEADER_KEY = 'firelancer-auth-token';
export const DEFAULT_COOKIE_NAME = 'session';
export const SKILL_FACET_CODE = '__skill_facet__';
export const SPECIALITY_FACET_CODE = '__speciality_facet__';

export const DEFAULT_PERMISSIONS: PermissionDefinition[] = [
  new PermissionDefinition({
    name: 'Authenticated',
    description: 'Authenticated means simply that the user is logged in',
    assignable: true,
    internal: true,
  }),
  new PermissionDefinition({
    name: 'SuperAdmin',
    description: 'SuperAdmin has unrestricted access to all operations',
    assignable: true,
    internal: true,
  }),
  new PermissionDefinition({
    name: 'Owner',
    description: "Owner means the user owns this entity, e.g. a Customer's own Order",
    assignable: false,
    internal: true,
  }),
  new PermissionDefinition({
    name: 'Public',
    description: 'Public means any unauthenticated user may perform the operation',
    assignable: false,
    internal: true,
  }),
  new CrudPermissionDefinition('Administrator'),
  new CrudPermissionDefinition('Customer'),
  new CrudPermissionDefinition('JobPost'),
  new CrudPermissionDefinition('Asset'),
  new CrudPermissionDefinition('Facet'),
];

export function getAllPermissionsMetadata(customPermissions: PermissionDefinition[]): PermissionMetadata[] {
  const allPermissions = [...DEFAULT_PERMISSIONS, ...customPermissions];
  return allPermissions.reduce((all, def) => [...all, ...def.getMetadata()], [] as PermissionMetadata[]);
}
