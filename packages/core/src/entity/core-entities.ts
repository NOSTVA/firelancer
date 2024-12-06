import { Administrator } from './administrator/administrator.entity';
import { Asset } from './asset/asset.entity';
import { OrderableAsset } from './asset/orderable-asset.entity';
import { AuthenticationMethod } from './authentication-method/authentication-method.entity';
import { ExternalAuthenticationMethod } from './authentication-method/external-authentication-method.entity';
import { NativeAuthenticationMethod } from './authentication-method/native-authentication-method.entity';
import { BalanceEntry } from './balance-entry/balance-entry.entity';
import { Customer } from './customer/customer.entity';
import { FacetValue } from './facet-value/facet-value.entity';
import { Facet } from './facet/facet.entity';
import { FacetValueCategory } from './facet-value-category/facet-value-category.entity';
import { CustomerHistoryEntry } from './history-entry/customer-history-entry.entity';
import { HistoryEntry } from './history-entry/history-entry.entity';
import { JobPostAsset } from './job-post/job-post-asset.entity';
import { JobPost } from './job-post/job-post.entity';
import { Role } from './role/role.entity';
import { AnonymousSession } from './session/anonymous-session.entity';
import { AuthenticatedSession } from './session/authenticated-session.entity';
import { Session } from './session/session.entity';
import { User } from './user/user.entity';

/**
 * A map of all the core database entities.
 */
export const coreEntitiesMap = {
  Asset,
  AuthenticatedSession,
  AuthenticationMethod,
  Administrator,
  AnonymousSession,
  BalanceEntry,
  Customer,
  CustomerHistoryEntry,
  Session,
  Facet,
  FacetValue,
  FacetValueCategory,
  JobPost,
  JobPostAsset,
  ExternalAuthenticationMethod,
  NativeAuthenticationMethod,
  OrderableAsset,
  User,
  Role,
  HistoryEntry,
};
