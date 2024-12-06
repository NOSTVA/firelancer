import { PasswordHashingStrategy } from '../password-hashing-strategy';

const SALT_ROUNDS = 12;

/**
 * @description
 * A hashing strategy which uses bcrypt to hash plaintext password strings.
 */
export class BcryptPasswordHashingStrategy implements PasswordHashingStrategy {
  private bcrypt: any;

  hash(plaintext: string): Promise<string> {
    this.getBcrypt();
    return this.bcrypt.hash(plaintext, SALT_ROUNDS);
  }

  check(plaintext: string, hash: string): Promise<boolean> {
    this.getBcrypt();
    return this.bcrypt.compare(plaintext, hash);
  }

  private getBcrypt() {
    if (!this.bcrypt) {
      // The bcrypt lib is lazily loaded so that if we want to run Firelancer
      // in an environment that does not support native Node modules
      // (such as an online sandbox like Stackblitz) the bcrypt dependency
      // does not get loaded when linking the source files on startup.
      this.bcrypt = require('bcrypt');
    }
  }
}
