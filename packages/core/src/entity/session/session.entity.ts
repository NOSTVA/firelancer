import { Column, Entity, Index, TableInheritance } from 'typeorm';
import { FirelancerEntity } from '../base/base.entity';

/**
 * @description
 * A Session is created when a user makes a request to restricted API operations. A Session can be an AnonymousSession
 * in the case of un-authenticated users, otherwise it is an AuthenticatedSession.
 */
@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class Session extends FirelancerEntity {
  @Index({ unique: true })
  @Column()
  token: string;

  @Column()
  expires: Date;

  @Column()
  invalidated: boolean;

  // @RelationId((session: Session) => session.activeOrder)
  // activeOrderId?: ID;

  // @Index()
  // @ManyToOne((type) => Order)
  // activeOrder: Order | null;
}
