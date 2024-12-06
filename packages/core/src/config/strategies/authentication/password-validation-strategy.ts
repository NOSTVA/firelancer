import { InjectableStrategy } from 'src/common/injectable-strategy';
import { RequestContext } from 'src/common/request-context';

/**
 * @description
 * Defines validation to apply to new password (when creating an account or updating an existing account's
 * password when using the NativeAuthenticationStrategy.
 *
 * :::info
 *
 * This is configured via the `authOptions.passwordValidationStrategy` property of
 * your FirelancerConfig.
 *
 * :::
 */
export interface PasswordValidationStrategy extends InjectableStrategy {
  /**
   * @description
   * Validates a password submitted during account registration or when a customer updates their password.
   * The method should resolve to `true` if the password is acceptable. If not, it should return `false` or
   * optionally a string which will be passed to the returned ErrorResult, which can e.g. advise on why
   * exactly the proposed password is not valid.
   */
  validate(ctx: RequestContext, password: string): Promise<boolean | string> | boolean | string;
}
