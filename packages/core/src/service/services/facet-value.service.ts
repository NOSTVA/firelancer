import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreateFacetValueInput, UpdateFacetValueInput } from 'src/api';
import { assertFound, ID, RequestContext } from 'src/common';
import { TransactionalConnection } from 'src/connection';
import { FirelancerEntity, JobPost } from 'src/entity';
import { FacetValue } from 'src/entity/facet-value/facet-value.entity';
import { EventBus } from 'src/event-bus';
import { FacetValueEvent } from 'src/event-bus/events/facet-value-event';
import { EntityNotFoundError, In, IsNull } from 'typeorm';
import { patchEntity } from '../helpers/utils/patch-entity';
import { facetValues } from 'src/data-sources/facets.json';
import { FacetService } from './facet.service';
import { FacetValueCategoryService } from './facet-value-categoery.service';
import { Facet } from 'src/entity/facet/facet.entity';
import { FacetValueCategory } from 'src/entity/facet-value-category/facet-value-category.entity';

/**
 * @description
 * Contains methods relating to FacetValue entities.
 */
@Injectable()
export class FacetValueService {
  constructor(
    private connection: TransactionalConnection,
    private eventBus: EventBus,
    @Inject(forwardRef(() => FacetService))
    private facetService: FacetService,
    @Inject(forwardRef(() => FacetValueCategoryService))
    private facetValueCategoryService: FacetValueCategoryService,
  ) {}

  async initValues() {
    return this.connection.withTransaction(async (ctx) => {
      for (const value of facetValues) {
        const { facetCode, facetValueCategoryCode, ...rest } = value;
        let facet: Facet | undefined;
        let category: FacetValueCategory | undefined;

        facet = await this.facetService.findByCode(ctx, value.facetCode);
        if (facetValueCategoryCode) {
          category = await this.facetValueCategoryService.findByCode(ctx, value.facetValueCategoryCode);
        }

        if (facet) {
          const existing = await this.connection.getRepository(ctx, FacetValue).findOne({
            where: {
              code: rest.code,
              facetId: facet.id,
            },
          });

          if (!existing) {
            await this.create(ctx, { code: rest.code, name: rest.name, facetId: facet.id, categoryId: category?.id });
          }
        }
      }
    });
  }

  async findAll(ctx: RequestContext): Promise<FacetValue[]> {
    return this.connection.getRepository(ctx, FacetValue).find({
      relations: { facet: true },
    });
  }

  async findOne(ctx: RequestContext, id: ID): Promise<FacetValue | undefined> {
    return this.connection
      .getRepository(ctx, FacetValue)
      .findOne({
        where: { id },
        relations: { facet: true },
      })
      .then((result) => result ?? undefined);
  }

  async findByIds(ctx: RequestContext, ids: ID[]): Promise<FacetValue[]> {
    if (ids.length === 0) {
      return [];
    }
    const facetValues = await this.connection.getRepository(ctx, FacetValue).find({
      where: { id: In(ids) },
      relations: { facet: true },
    });
    return facetValues;
  }

  /**
   * @description
   * Returns all FacetValues belonging to the Facet with the given id.
   */
  async findByFacetId(ctx: RequestContext, id: ID): Promise<FacetValue[]> {
    return this.connection.getRepository(ctx, FacetValue).find({
      where: { facet: { id } },
      relations: { facet: true },
    });
  }

  async create(ctx: RequestContext, input: CreateFacetValueInput): Promise<FacetValue> {
    const facetValue = new FacetValue(input);
    await this.connection.getRepository(ctx, FacetValue).save(facetValue);
    await this.eventBus.publish(new FacetValueEvent(ctx, facetValue, 'created', input));
    return assertFound(this.findOne(ctx, facetValue.id));
  }

  async update(ctx: RequestContext, input: UpdateFacetValueInput): Promise<FacetValue> {
    const facetValue = await this.findOne(ctx, input.id);
    if (!facetValue) {
      throw new EntityNotFoundError('FacetValue', input.id);
    }
    let updatedFacetValue = patchEntity(facetValue, input);
    await this.connection.getRepository(ctx, FacetValue).save(updatedFacetValue);
    await this.eventBus.publish(new FacetValueEvent(ctx, facetValue, 'updated', input));
    return assertFound(this.findOne(ctx, facetValue.id));
  }

  async delete(ctx: RequestContext, id: ID, force: boolean = false): Promise<void> {
    const { jobPostsCount } = await this.checkFacetValueUsage(ctx, [id]);
    const hasUsages = !!jobPostsCount;
    const facetValue = await this.connection.getEntityOrThrow(ctx, FacetValue, id);
    // Create a new facetValue so that the id is still available
    // after deletion (the .remove() method sets it to undefined)
    const deletedFacetValue = new FacetValue(facetValue);
    if (hasUsages && !force) {
      throw new Error('message.asset-to-be-deleted-is-in-use');
    }
    await this.connection.getRepository(ctx, FacetValue).remove(facetValue);
    await this.eventBus.publish(new FacetValueEvent(ctx, deletedFacetValue, 'deleted', id));
  }

  /**
   * @description
   * Checks for usage of the given FacetValues in any JobPosts, and returns the counts.
   */
  async checkFacetValueUsage(ctx: RequestContext, facetValueIds: ID[]): Promise<{ jobPostsCount: number }> {
    const [_, jobPostsCount] = await this.connection.getRepository(ctx, JobPost).findAndCount({
      where: {
        facetValues: {
          id: In(facetValueIds),
        },
        deletedAt: IsNull(),
      },
    });

    return { jobPostsCount };
  }
}
