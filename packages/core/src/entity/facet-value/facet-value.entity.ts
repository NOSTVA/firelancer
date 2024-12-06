import { Column, DeepPartial, Entity, Index, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { FirelancerEntity } from '../base/base.entity';
import { Facet } from '../facet/facet.entity';
import { ID } from 'src/common';
import { JobPost } from '../job-post/job-post.entity';
import { FacetValueCategory } from '../facet-value-category/facet-value-category.entity';

/**
 * @description
 * A particular value of a Facet.
 */
@Entity()
export class FacetValue extends FirelancerEntity {
  constructor(input?: DeepPartial<FacetValue>) {
    super(input);
  }

  @Column({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column()
  facetId: ID;

  @Index()
  @ManyToOne(() => Facet, (group) => group.values, { onDelete: 'CASCADE' })
  facet: Facet;

  @Column({ nullable: true })
  categoryId: ID | null;

  @ManyToOne(() => FacetValueCategory, (facetValueCategory) => facetValueCategory.values, { nullable: true, onDelete: 'CASCADE' })
  category: FacetValueCategory | null;

  @ManyToMany(() => JobPost, (jobPost) => jobPost.facetValues)
  jobPosts: JobPost[];
}
