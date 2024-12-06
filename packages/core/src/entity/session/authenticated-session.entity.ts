import { ChildEntity, Column, DeepPartial, Index, ManyToOne } from 'typeorm';
import { User } from '../user/user.entity';
import { Session } from './session.entity';

/**
 * @description
 * An AuthenticatedSession is created upon successful authentication.
 */
@ChildEntity()
export class AuthenticatedSession extends Session {
  constructor(input: DeepPartial<AuthenticatedSession>) {
    super(input);
  }

  /**
   * @description
   * The User who has authenticated to create this session.
   */
  @Index()
  @ManyToOne(() => User, (user) => user.sessions)
  user: User;

  /**
   * @description
   * The name of the AuthenticationStrategy used when authenticating
   * to create this session.
   */
  @Column()
  authenticationStrategy: string;
}
