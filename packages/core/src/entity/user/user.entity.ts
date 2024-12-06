import { Column, DeepPartial, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { InternalServerError } from '../../common/error/errors';
import { SoftDeletable } from '../../common/shared-types';
import { AuthenticationMethod } from '../authentication-method/authentication-method.entity';
import { NativeAuthenticationMethod } from '../authentication-method/native-authentication-method.entity';
import { FirelancerEntity } from '../base/base.entity';
import { AuthenticatedSession } from '../session/authenticated-session.entity';
import { Role } from '../role/role.entity';

/**
 * @description
 * A User represents any authenticated user of the Firelancer API.
 */
@Entity()
export class User extends FirelancerEntity implements SoftDeletable {
  constructor(input?: DeepPartial<User>) {
    super(input);
  }

  @Column({ type: Date, nullable: true })
  deletedAt: Date | null;

  @Column()
  identifier: string;

  @OneToMany(() => AuthenticationMethod, (method) => method.user)
  authenticationMethods: AuthenticationMethod[];

  @Column({ default: false })
  verified: boolean;

  @ManyToMany(() => Role, { eager: true })
  @JoinTable()
  roles: Role[];

  @Column({ type: Date, nullable: true })
  lastLogin: Date | null;

  @OneToMany(() => AuthenticatedSession, (session) => session.user)
  sessions: AuthenticatedSession[];

  getNativeAuthenticationMethod(): NativeAuthenticationMethod;
  getNativeAuthenticationMethod(strict?: boolean): NativeAuthenticationMethod | undefined;
  getNativeAuthenticationMethod(strict?: boolean): NativeAuthenticationMethod | undefined {
    if (!this.authenticationMethods) {
      throw new InternalServerError('error.user-authentication-methods-not-loaded');
    }
    const match = this.authenticationMethods.find((m): m is NativeAuthenticationMethod => m instanceof NativeAuthenticationMethod);
    if (!match && (strict === undefined || strict)) {
      throw new InternalServerError('error.native-authentication-methods-not-found');
    }
    return match;
  }
}
