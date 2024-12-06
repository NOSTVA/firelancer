import { SetMetadata } from '@nestjs/common';
import { Permission } from 'src/common/shared-types';

export const PERMISSIONS_METADATA_KEY = '__permissions__';

/**
 * @description
 * Attaches metadata to the resolver defining which permissions are required to execute the
 * operation, using one or more Permission values.
 *
 * For REST controllers, it can be applied to route handler.
 *
 * ## Allow and Sessions
 * The `@Allow()` decorator is closely linked to the way Firelancer manages sessions. For any operation or route that is decorated
 * with `@Allow()`, there must be an authenticated session in progress, which would have been created during a prior authentication
 * step.
 *
 * The exception to this is when the operation is decorated with `@Allow(Permission.Owner)`. This is a special permission which is designed
 * to give access to certain resources to potentially un-authenticated users. For this reason, any operation decorated with this permission
 * will always have an anonymous session created if no session is currently in progress.
 *
 * @example
 * ```ts
 *  \@Allow(Permission.SuperAdmin)
 *  \@Get()
 *  getAdministrators() {
 *      // ...
 *  }
 * ```
 */
export const Allow = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
