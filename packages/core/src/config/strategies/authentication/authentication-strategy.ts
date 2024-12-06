import { InjectableStrategy } from 'src/common/injectable-strategy';
import { RequestContext } from 'src/common/request-context';
import { User } from 'src/entity';

/**
 * @description
 * An AuthenticationStrategy defines how a User (which can be a Customer in the Shop API or
 * and Administrator in the Admin API) may be authenticated.
 *
 * Real-world examples can be found in the [Authentication guide](/guides/core-concepts/auth/).
 *
 * :::info
 *
 * This is configured via the `authOptions.shopAuthenticationStrategy` and `authOptions.adminAuthenticationStrategy`
 * properties of your FirelancerConfig.
 *
 * :::
 */
export interface AuthenticationStrategy<Data = unknown> extends InjectableStrategy {
  /**
   * @description
   * The name of the strategy, for example `'facebook'`, `'google'`, `'keycloak'`.
   */
  readonly name: string;

  /**
   * @description
   * Used to authenticate a user with the authentication provider. This method
   * will implement the provider-specific authentication logic, and should resolve to either a
   * User object on success, or `false | string` on failure.
   * A `string` return could be used to describe what error happened, otherwise `false` to an unknown error.
   */
  authenticate(ctx: RequestContext, data: Data): Promise<User | false | string>;

  /**
   * @description
   * Called when a user logs out, and may perform any required tasks
   * related to the user logging out with the external provider.
   */
  onLogOut?(ctx: RequestContext, user: User): Promise<void>;
}
