import { Permission } from 'src/common/shared-types';
import { Column, DeepPartial, Entity } from 'typeorm';
import { FirelancerEntity } from '../base/base.entity';

/**
 * @description
 * A Role represents a collection of permissions which determine the authorization level of a User.
 */
@Entity()
export class Role extends FirelancerEntity {
  constructor(input?: DeepPartial<Role>) {
    super(input);
  }

  @Column()
  code: string;

  @Column()
  description: string;

  @Column('simple-array')
  permissions: Permission[];
}
