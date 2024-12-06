import { InjectableStrategy } from 'src/common/injectable-strategy';

/**
 * @description
 * Defines how user passwords get hashed when using the NativeAuthenticationStrategy.
 *
 * :::info
 *
 * This is configured via the `authOptions.passwordHashingStrategy` property of
 * your FirelancerConfig.
 *
 * :::
 */
export interface PasswordHashingStrategy extends InjectableStrategy {
  hash(plaintext: string): Promise<string>;
  check(plaintext: string, hash: string): Promise<boolean>;
}
