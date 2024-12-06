import { Column, DeepPartial, Entity, Index, ManyToOne } from 'typeorm';
import { OrderableAsset } from '../asset/orderable-asset.entity';
import { JobPost } from './job-post.entity';
import { ID } from 'src/common';

@Entity()
export class JobPostAsset extends OrderableAsset {
  constructor(input?: DeepPartial<JobPostAsset>) {
    super(input);
  }

  @Column()
  jobPostId: ID;

  @Index()
  @ManyToOne(() => JobPost, (jobPost) => jobPost.assets, { onDelete: 'CASCADE' })
  jobPost: JobPost;
}
