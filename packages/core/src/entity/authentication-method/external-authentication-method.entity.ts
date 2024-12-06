import { ChildEntity, Column, DeepPartial } from 'typeorm';
import { AuthenticationMethod } from './authentication-method.entity';

/**
 * @description
 * This method is used when an external authentication service is used to authenticate Firelancer Users.
 * Examples of external auth include social logins or corporate identity servers.
 */
@ChildEntity()
export class ExternalAuthenticationMethod extends AuthenticationMethod {
  constructor(input: DeepPartial<ExternalAuthenticationMethod>) {
    super(input);
  }

  @Column()
  strategy: string;

  @Column()
  externalIdentifier: string;

  @Column('simple-json')
  metadata: any;
}
