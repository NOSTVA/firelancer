import { Injectable } from '@nestjs/common';
import { CreateJobPostInput } from 'src/api';
import { assertFound, ID, notNullOrUndefined, RequestContext } from 'src/common';
import { TransactionalConnection } from 'src/connection';
import { JobPost } from 'src/entity';
import { EventBus } from 'src/event-bus';
import { JobPostEvent } from 'src/event-bus/events/job-post-event';
import { AssetService } from './asset.service';
import { FacetValueService } from './facet-value.service';

@Injectable()
export class JobPostService {
  constructor(
    private connection: TransactionalConnection,
    private assetService: AssetService,
    private facetValueService: FacetValueService,
    private eventBus: EventBus,
  ) {}

  async findAll(ctx: RequestContext): Promise<JobPost[]> {
    return this.connection.getRepository(ctx, JobPost).find({
      relations: {
        customer: true,
        assets: { asset: true },
        facetValues: { facet: true },
      },
    });
  }

  async findOne(ctx: RequestContext, jobPostId: ID): Promise<JobPost | undefined> {
    return this.connection
      .getRepository(ctx, JobPost)
      .findOne({
        where: { id: jobPostId },
        relations: {
          customer: true,
          assets: { asset: true },
          facetValues: { facet: true },
        },
      })
      .then((result) => result ?? undefined);
  }

  async create(ctx: RequestContext, input: CreateJobPostInput): Promise<JobPost> {
    const { assetIds, facetValueIds, ...rest } = input;

    const jobPost = new JobPost(rest);
    jobPost.facetValues = await this.facetValueService.findByIds(ctx, facetValueIds || []);
    await this.connection.getRepository(ctx, JobPost).save(jobPost);
    await this.assetService.updateEntityAssets(ctx, jobPost, { assetIds });

    await this.eventBus.publish(new JobPostEvent(ctx, jobPost, 'created', rest));
    return assertFound(this.findOne(ctx, jobPost.id));
  }
}
