import { Injectable } from '@nestjs/common';
import { alphabet, generateRandomString } from 'src/common/utils/random';
import { ConfigService } from 'src/config/config.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ms = require('ms');

/**
 * This class is responsible for generating and verifying the tokens issued when new accounts are registered
 * or when a password reset is requested.
 */
@Injectable()
export class VerificationTokenGenerator {
  constructor(private configService: ConfigService) {}

  /**
   * Generates a verification token which encodes the time of generation and concatenates it with a
   * random id.
   */
  generateVerificationToken() {
    const now = new Date();
    const base64Now = Buffer.from(now.toJSON()).toString('base64');
    const id = generateRandomString(8, alphabet('0-9'));
    return `${base64Now}_${id}`;
  }

  /**
   * Checks the age of the verification token to see if it falls within the token duration
   * as specified in the FirelancerConfig.
   */
  verifyVerificationToken(token: string): boolean {
    const { verificationTokenDuration } = this.configService.authOptions;
    const verificationTokenDurationInMs =
      typeof verificationTokenDuration === 'string' ? ms(verificationTokenDuration) : verificationTokenDuration;

    const [generatedOn] = token.split('_');
    const dateString = Buffer.from(generatedOn, 'base64').toString();
    const date = new Date(dateString);
    const elapsed = +new Date() - +date;
    return elapsed < verificationTokenDurationInMs;
  }
}
