import { Type } from '@nestjs/common';

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | {
      [prop: string]: Json;
    };

export type JsonCompatible<T> = {
  [P in keyof T]: T[P] extends Json ? T[P] : Pick<T, P> extends Required<Pick<T, P>> ? never : JsonCompatible<T[P]>;
};

export type MiddlewareHandler = Type<any> | Function;

export interface Middleware {
  /**
   * @description
   * The Express middleware function or NestJS `NestMiddleware` class.
   */
  handler: MiddlewareHandler;
  /**
   * @description
   * The route to which this middleware will apply. Pattern based routes are supported as well.
   *
   * The `'ab*cd'` route path will match `abcd`, `ab_cd`, `abecd`, and so on. The characters `?`, `+`, `*`, and `()` may be used in a route path,
   * and are subsets of their regular expression counterparts. The hyphen (`-`) and the dot (`.`) are interpreted literally.
   */
  route: string;
}

export type ID = number;

/**
 * @description
 * Entities which can be soft deleted should implement this interface.
 */
export interface SoftDeletable {
  deletedAt: Date | null;
}

/**
 * @description
 * Entities which can be drafted and published later should implement this interface.
 */
export interface Draftable {
  publishedAt: Date | null;
}

/**
 * @description
 * Entities which can be ordered relative to their siblings in a list.
 */
export interface Orderable {
  position: number;
}

export enum CustomerType {
  SELLER = 'SELLER',
  BUYER = 'BUYER',
}

export enum Permission {
  /** Authenticated means simply that the user is logged in */
  Authenticated = 'Authenticated',
  /** Grants permission to create Administrator */
  CreateAdministrator = 'CreateAdministrator',
  /** Grants permission to create Asset */
  CreateAsset = 'CreateAsset',
  /** Grants permission to create Customer */
  CreateCustomer = 'CreateCustomer',
  /** Grants permission to create JobPost */
  CreateJobPost = 'CreateJobPost',
  /** Grants permission to create Facet */
  CreateFacet = 'CreateFacet',
  /** Grants permission to delete Administrator */
  DeleteAdministrator = 'DeleteAdministrator',
  /** Grants permission to delete Asset */
  DeleteAsset = 'DeleteAsset',
  /** Grants permission to delete Customer */
  DeleteCustomer = 'DeleteCustomer',
  /** Grants permission to delete JobPost */
  DeleteJobPost = 'DeleteJobPost',
  /** Grants permission to delete Facet */
  DeleteFacet = 'DeleteFacet',
  /** Owner means the user owns this entity, e.g. a Customer's own Order */
  Owner = 'Owner',
  /** Public means any unauthenticated user may perform the operation */
  Public = 'Public',
  /** Grants permission to read Administrator */
  ReadAdministrator = 'ReadAdministrator',
  /** Grants permission to read Asset */
  ReadAsset = 'ReadAsset',
  /** Grants permission to read Customer */
  ReadCustomer = 'ReadCustomer',
  /** Grants permission to read JobPost */
  ReadJobPost = 'ReadJobPost',
  /** Grants permission to read Facet */
  ReadFacet = 'ReadFacet',
  /** SuperAdmin has unrestricted access to all operations */
  SuperAdmin = 'SuperAdmin',
  /** Grants permission to update Administrator */
  UpdateAdministrator = 'UpdateAdministrator',
  /** Grants permission to update Asset */
  UpdateAsset = 'UpdateAsset',
  /** Grants permission to update Customer */
  UpdateCustomer = 'UpdateCustomer',
  /** Grants permission to update JobPost */
  UpdateJobPost = 'UpdateJobPost',
  /** Grants permission to update Facet */
  UpdateFacet = 'UpdateFacet',
}

export enum HistoryEntryType {
  CUSTOMER_EMAIL_UPDATE_REQUESTED = 'CUSTOMER_EMAIL_UPDATE_REQUESTED',
  CUSTOMER_EMAIL_UPDATE_VERIFIED = 'CUSTOMER_EMAIL_UPDATE_VERIFIED',
  CUSTOMER_DETAIL_UPDATED = 'CUSTOMER_DETAIL_UPDATED',
  CUSTOMER_PASSWORD_RESET_REQUESTED = 'CUSTOMER_PASSWORD_RESET_REQUESTED',
  CUSTOMER_PASSWORD_RESET_VERIFIED = 'CUSTOMER_PASSWORD_RESET_VERIFIED',
  CUSTOMER_PASSWORD_UPDATED = 'CUSTOMER_PASSWORD_UPDATED',
  CUSTOMER_REGISTERED = 'CUSTOMER_REGISTERED',
  CUSTOMER_VERIFIED = 'CUSTOMER_VERIFIED',
}

export enum AssetType {
  BINARY = 'BINARY',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export enum BalanceEntryType {
  FIXED_PRICE = 'FIXED_PRICE',
  BONUS = 'BONUS',
  PAYMENT = 'PAYMENT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum BalanceEntryStatus {
  PENDING = 'PENDING',
  SETTELABLE = 'SETTELABLE',
  SETTLED = 'SETTLED',
}
