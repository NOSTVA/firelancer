import { ChildEntity, DeepPartial } from 'typeorm';
import { Session } from './session.entity';

/**
 * @description
 * An anonymous session is created when a unauthenticated user interacts with restricted operations.
 * Anonymous sessions allow a guest Customer to maintain an order without requiring authentication and a registered account beforehand.
 */
@ChildEntity()
export class AnonymousSession extends Session {
  constructor(input: DeepPartial<AnonymousSession>) {
    super(input);
  }
}
