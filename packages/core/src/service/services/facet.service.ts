import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreateFacetInput, UpdateFacetInput } from 'src/api';
import { assertFound, ID, idsAreEqual, RequestContext } from 'src/common';
import { TransactionalConnection } from 'src/connection';
import { Facet } from 'src/entity/facet/facet.entity';
import { EventBus } from 'src/event-bus';
import { FacetEvent } from 'src/event-bus/events/facet-event';
import { EntityNotFoundError } from 'typeorm';
import { patchEntity } from '../helpers/utils/patch-entity';
import { FacetValueService } from './facet-value.service';
import { facets } from 'src/data-sources/facets.json';

/**
 * @description
 * Contains methods relating to Facet entities.
 */
@Injectable()
export class FacetService {
  constructor(
    private connection: TransactionalConnection,
    private eventBus: EventBus,
    @Inject(forwardRef(() => FacetValueService))
    private facetValueService: FacetValueService,
  ) {}

  async initFacets() {
    return this.connection.withTransaction(async (ctx) => {
      for (const facet of facets) {
        const existing = await this.findByCode(ctx, facet.code);
        if (!existing) {
          await this.create(ctx, facet);
        }
      }
    });
  }

  async findAll(ctx: RequestContext): Promise<Facet[]> {
    return this.connection.getRepository(ctx, Facet).find({
      relations: {
        values: {
          facet: true,
        },
      },
    });
  }

  async findOne(ctx: RequestContext, facetId: ID): Promise<Facet | undefined> {
    return this.connection
      .getRepository(ctx, Facet)
      .findOne({
        where: {
          id: facetId,
        },
        relations: {
          values: {
            facet: true,
          },
        },
      })
      .then((result) => result ?? undefined);
  }

  async findByCode(ctx: RequestContext, facetCode: string): Promise<Facet | undefined> {
    return this.connection
      .getRepository(ctx, Facet)
      .findOne({
        where: { code: facetCode },
        relations: { values: { facet: true } },
      })
      .then((result) => result ?? undefined);
  }

  /**
   * @description
   * Returns the Facet which contains the given FacetValue id.
   */
  async findByFacetValueId(ctx: RequestContext, facetValueId: ID): Promise<Facet | undefined> {
    return this.connection
      .getRepository(ctx, Facet)
      .findOne({
        where: {
          values: {
            id: facetValueId,
          },
        },
        relations: {
          values: {
            facet: true,
          },
        },
      })
      .then((result) => result ?? undefined);
  }

  async create(ctx: RequestContext, input: CreateFacetInput): Promise<Facet> {
    const facet = new Facet({ ...input, code: await this.ensureUniqueCode(ctx, input.code) });
    await this.connection.getRepository(ctx, Facet).save(facet);
    await this.eventBus.publish(new FacetEvent(ctx, facet, 'created', input));
    return assertFound(this.findOne(ctx, facet.id));
  }

  async update(ctx: RequestContext, input: UpdateFacetInput): Promise<Facet> {
    const facet = await this.findOne(ctx, input.id);
    if (!facet) {
      throw new EntityNotFoundError('Facet', input.id);
    }
    let updatedFacet = patchEntity(facet, input);
    await this.connection.getRepository(ctx, Facet).save(updatedFacet);
    await this.eventBus.publish(new FacetEvent(ctx, facet, 'updated', input));
    return assertFound(this.findOne(ctx, facet.id));
  }

  async delete(ctx: RequestContext, id: ID, force: boolean = false): Promise<void> {
    const facet = await this.connection.getEntityOrThrow(ctx, Facet, id, {
      relations: { values: true },
    });
    let jobPostsCount = 0;
    if (facet.values.length) {
      const counts = await this.facetValueService.checkFacetValueUsage(
        ctx,
        facet.values.map((fv) => fv.id),
      );
      jobPostsCount = counts.jobPostsCount;
    }

    const hasUsages = !!jobPostsCount;
    const deletedFacet = new Facet(facet);
    if (hasUsages && !force) {
      throw new Error('message.asset-to-be-deleted-is-in-use');
    }
    await this.connection.getRepository(ctx, Facet).remove(facet);
    await this.eventBus.publish(new FacetEvent(ctx, deletedFacet, 'deleted', id));
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
      const match = await this.connection.getRepository(ctx, Facet).findOne({ where: { code: candidate } });

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
