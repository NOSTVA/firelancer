import { Entity, Index, ManyToOne, TableInheritance } from 'typeorm';
import { FirelancerEntity } from '../base/base.entity';
import type { User } from '../user/user.entity';

/**
 * @description
 * An AuthenticationMethod represents the means by which a user is authenticated. There are two kinds: NativeAuthenticationMethod and ExternalAuthenticationMethod
 */
@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class AuthenticationMethod extends FirelancerEntity {
  @Index()
  @ManyToOne('User', 'authenticationMethods')
  user: User;
}
