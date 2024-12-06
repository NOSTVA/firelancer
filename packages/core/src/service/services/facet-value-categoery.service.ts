import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreateFacetValueCategoryInput, UpdateFacetValueCategoryInput } from 'src/api';
import { assertFound, ID, idsAreEqual, RequestContext } from 'src/common';
import { TransactionalConnection } from 'src/connection';
import { facetValueCategories } from 'src/data-sources/facets.json';
import { FacetValueCategory } from 'src/entity/facet-value-category/facet-value-category.entity';
import { EventBus } from 'src/event-bus';
import { FacetValueCategoryEvent } from 'src/event-bus/events/facet-value-category-event';
import { EntityNotFoundError } from 'typeorm';
import { patchEntity } from '../helpers/utils/patch-entity';
import { FacetValueService } from './facet-value.service';
import { FacetService } from './facet.service';

/**
 * @description
 * Contains methods relating to FacetValueCategory entities.
 */
@Injectable()
export class FacetValueCategoryService {
  constructor(
    private connection: TransactionalConnection,
    private eventBus: EventBus,
    @Inject(forwardRef(() => FacetService))
    private facetService: FacetService,
    @Inject(forwardRef(() => FacetValueService))
    private facetValueService: FacetValueService,
  ) {}

  async initCategories() {
    return this.connection.withTransaction(async (ctx) => {
      for (const category of facetValueCategories) {
        const existing = await this.findByCode(ctx, category.code);
        const facet = await this.facetService.findByCode(ctx, category.facetCode);
        if (!existing && facet) {
          await this.create(ctx, { code: category.code, name: category.name, facetId: facet.id });
        }
      }
    });
  }

  async findAll(ctx: RequestContext): Promise<FacetValueCategory[]> {
    return this.connection.getRepository(ctx, FacetValueCategory).find({
      relations: { facet: true, values: true },
    });
  }

  async findOne(ctx: RequestContext, categoryId: ID): Promise<FacetValueCategory | undefined> {
    return this.connection
      .getRepository(ctx, FacetValueCategory)
      .findOne({
        where: {
          id: categoryId,
        },
        relations: {
          facet: true,
          values: true,
        },
      })
      .then((result) => result ?? undefined);
  }

  async findByCode(ctx: RequestContext, categoryCode: string): Promise<FacetValueCategory | undefined> {
    return this.connection
      .getRepository(ctx, FacetValueCategory)
      .findOne({
        where: {
          code: categoryCode,
        },
        relations: {
          facet: true,
          values: true,
        },
      })
      .then((result) => result ?? undefined);
  }

  /**
   * @description
   * Returns the Facet which contains the given FacetValue id.
   */
  async findByFacetValueId(ctx: RequestContext, facetValueId: ID): Promise<FacetValueCategory | undefined> {
    return this.connection
      .getRepository(ctx, FacetValueCategory)
      .findOne({
        where: {
          values: {
            id: facetValueId,
          },
        },
        relations: {
          facet: true,
          values: true,
        },
      })
      .then((result) => result ?? undefined);
  }

  async create(ctx: RequestContext, input: CreateFacetValueCategoryInput): Promise<FacetValueCategory> {
    const category = new FacetValueCategory({ ...input, code: await this.ensureUniqueCode(ctx, input.code) });
    await this.connection.getRepository(ctx, FacetValueCategory).save(category);
    await this.eventBus.publish(new FacetValueCategoryEvent(ctx, category, 'created', input));
    return assertFound(this.findOne(ctx, category.id));
  }

  async update(ctx: RequestContext, input: UpdateFacetValueCategoryInput): Promise<FacetValueCategory> {
    const category = await this.findOne(ctx, input.id);
    if (!category) {
      throw new EntityNotFoundError('FacetValueCategory', input.id);
    }
    let updatedCategory = patchEntity(category, input);
    await this.connection.getRepository(ctx, FacetValueCategory).save(updatedCategory);
    await this.eventBus.publish(new FacetValueCategoryEvent(ctx, category, 'updated', input));
    return assertFound(this.findOne(ctx, category.id));
  }

  async delete(ctx: RequestContext, id: ID, force: boolean = false): Promise<void> {
    const category = await this.connection.getEntityOrThrow(ctx, FacetValueCategory, id, {
      relations: { values: true },
    });
    let jobPostsCount = 0;
    if (category.values.length) {
      const counts = await this.facetValueService.checkFacetValueUsage(
        ctx,
        category.values.map((fv) => fv.id),
      );
      jobPostsCount = counts.jobPostsCount;
    }

    const hasUsages = !!jobPostsCount;
    const deletedCategory = new FacetValueCategory(category);
    if (hasUsages && !force) {
      throw new Error('message.asset-to-be-deleted-is-in-use');
    }
    await this.connection.getRepository(ctx, FacetValueCategory).remove(category);
    await this.eventBus.publish(new FacetValueCategoryEvent(ctx, deletedCategory, 'deleted', id));
  }

  /**
   * Checks to ensure the Facet code is unique. If there is a conflict, then the code is suffixed
   * with an incrementing integer.
   */
  private async ensureUniqueCode(ctx: RequestContext, code: string, id?: ID) {
    let candidate = code;
    let suffix = 1;
    let conflict = false;
    const alreadySuffixed = /-\d+$/;
    do {
      const match = await this.connection.getRepository(ctx, FacetValueCategory).findOne({ where: { code: candidate } });

      conflict = !!match && ((id != null && !idsAreEqual(match.id, id)) || id == null);
      if (conflict) {
        suffix++;
        if (alreadySuffixed.test(candidate)) {
          candidate = candidate.replace(alreadySuffixed, `-${suffix}`);
        } else {
          candidate = `${candidate}-${suffix}`;
        }
      }
    } while (conflict);

    return candidate;
  }
}
