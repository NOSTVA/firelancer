import { Column, DeepPartial, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { FirelancerEntity } from '../base/base.entity';
import { FacetValue } from '../facet-value/facet-value.entity';
import { Facet } from '../facet/facet.entity';
import { ID } from 'src/common';

/**
 * @description
 * FacetValueCategory
 */
@Entity()
export class FacetValueCategory extends FirelancerEntity {
  constructor(input?: DeepPartial<FacetValueCategory>) {
    super(input);
  }

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column()
  facetId: ID;

  @Index()
  @ManyToOne(() => Facet, { onDelete: 'CASCADE' })
  facet: Facet;

  @OneToMany(() => FacetValue, (value) => value.facet)
  values: FacetValue[];
}
