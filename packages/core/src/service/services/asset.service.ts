import { Injectable, Logger, Type } from '@nestjs/common';
import { imageSize } from 'image-size';
import mime from 'mime-types';
import path from 'path';
import { CreateAssetInput, UpdateAssetInput } from 'src/api/schema';
import { AssetType, getAssetType, ID, idsAreEqual, InternalServerError, notNullOrUndefined, RequestContext } from 'src/common';
import { ConfigService } from 'src/config';
import { TransactionalConnection } from 'src/connection';
import { Asset, FirelancerEntity, JobPost, OrderableAsset } from 'src/entity';
import { EventBus } from 'src/event-bus';
import { AssetEvent } from 'src/event-bus/events/asset-event';
import { Readable, Stream } from 'stream';
import { In, IsNull } from 'typeorm';
import { camelCase } from 'typeorm/util/StringUtils.js';
import { patchEntity } from '../helpers/utils/patch-entity';

export interface EntityWithAssets extends FirelancerEntity {
  assets: OrderableAsset[];
}

export interface EntityAssetInput {
  assetIds?: ID[] | null;
}

@Injectable()
export class AssetService {
  private permittedMimeTypes: Array<{ type: string; subtype: string }> = [];

  constructor(
    private connection: TransactionalConnection,
    private configService: ConfigService,
    private eventBus: EventBus,
  ) {
    this.permittedMimeTypes = this.configService.assetOptions.permittedFileTypes
      .map((val) => (/\.[\w]+/.test(val) ? mime.lookup(val) || undefined : val))
      .filter(notNullOrUndefined)
      .map((val) => {
        const [type, subtype] = val.split('/');
        return { type, subtype };
      });
  }

  /**
   * @description
   * Create an Asset based on a file uploaded via the REST API.
   */
  async create(ctx: RequestContext, input: CreateAssetInput): Promise<Asset> {
    const { originalname, mimetype, buffer } = input.file;

    try {
      const stream = Readable.from(buffer);
      stream.on('error', (err) => {
        throw err;
      });

      const asset = await this.createAssetInternal(ctx, stream, originalname, mimetype);

      await this.eventBus.publish(new AssetEvent(ctx, asset, 'created', input));
      return asset;
    } catch (e) {
      if (e instanceof Error) {
        Logger.error(`Error while creating asset: ${e.message}`, e.stack);
      }
      throw e;
    }
  }

  /**
   * @description
   * Deletes an Asset after performing checks to ensure that the Asset is not currently in use
   * by a JobPost.
   */
  async delete(ctx: RequestContext, ids: ID[], force: boolean = false): Promise<void> {
    const assets = await this.connection.getRepository(ctx, Asset).find({
      where: {
        id: In(ids),
      },
    });

    const usageCount = {
      jobPosts: 0,
    };

    for (const asset of assets) {
      const usages = await this.findAssetUsages(ctx, asset);
      usageCount.jobPosts += usages.jobPosts.length;
    }

    const hasUsages = !!usageCount.jobPosts;
    if (hasUsages && !force) {
      throw new Error('message.asset-to-be-deleted-is-in-use');
    }

    // Delete assets unconditionally as no channel logic is involved
    await this.deleteUnconditional(ctx, assets);
  }

  /**
   * @description
   * Updates the name, focalPoint, tags & custom fields of an Asset.
   */
  async update(ctx: RequestContext, input: UpdateAssetInput): Promise<Asset> {
    const asset = await this.connection.getEntityOrThrow(ctx, Asset, input.id);
    if (input.focalPoint) {
      const to3dp = (x: number) => +x.toFixed(3);
      input.focalPoint.x = to3dp(input.focalPoint.x);
      input.focalPoint.y = to3dp(input.focalPoint.y);
    }
    patchEntity(asset, input);
    const updatedAsset = await this.connection.getRepository(ctx, Asset).save(asset);
    await this.eventBus.publish(new AssetEvent(ctx, updatedAsset, 'updated', input));
    return updatedAsset;
  }

  /**
   * @description
   * Updates the assets of an entity, ensuring that only valid assetIds are used.
   */
  async updateEntityAssets<T extends EntityWithAssets>(ctx: RequestContext, entity: T, input: EntityAssetInput): Promise<T> {
    if (!entity.id) {
      throw new InternalServerError('error.entity-must-have-an-id');
    }
    const { assetIds } = input;
    if (assetIds && assetIds.length) {
      const assets = await this.connection.getRepository(ctx, Asset).find({
        where: {
          id: In(assetIds),
        },
      });

      const sortedAssets = assetIds.map((id) => assets.find((a) => idsAreEqual(a.id, id))).filter(notNullOrUndefined);

      await this.removeExistingOrderableAssets(ctx, entity);
      entity.assets = await this.createOrderableAssets(ctx, entity, sortedAssets);
    } else if (assetIds && assetIds.length === 0) {
      await this.removeExistingOrderableAssets(ctx, entity);
    }
    return entity;
  }

  /**
   * @description
   * Returns the Assets of an entity which has a well-ordered list of Assets, such as JobPost.
   */
  async getEntityAssets<T extends EntityWithAssets>(ctx: RequestContext, entity: T): Promise<Asset[] | undefined> {
    let orderableAssets = entity.assets;
    if (!orderableAssets) {
      const entityType: Type<EntityWithAssets> = Object.getPrototypeOf(entity).constructor;
      const entityWithAssets = await this.connection.getRepository(ctx, entityType).findOne({
        where: {
          id: entity.id,
        },
        relations: {
          assets: { asset: true },
        },
      });

      orderableAssets = entityWithAssets?.assets ?? [];
    }

    return orderableAssets.sort((a, b) => a.position - b.position).map((a) => a.asset);
  }

  private async createAssetInternal(ctx: RequestContext, stream: Stream, filename: string, mimetype: string): Promise<Asset> {
    const { assetOptions } = this.configService;
    if (!this.validateMimeType(mimetype)) {
      // return new MimeTypeError({ fileName: filename, mimeType: mimetype });
      throw new Error('MIME_TYPE_ERROR');
    }
    const { assetPreviewStrategy, assetStorageStrategy } = assetOptions;
    const sourceFileName = await this.getSourceFileName(ctx, filename);
    const previewFileName = await this.getPreviewFileName(ctx, sourceFileName);

    const sourceFileIdentifier = await assetStorageStrategy.writeFileFromStream(sourceFileName, stream);
    const sourceFile = await assetStorageStrategy.readFileToBuffer(sourceFileIdentifier);
    let preview: Buffer;
    try {
      preview = await assetPreviewStrategy.generatePreviewImage(ctx, mimetype, sourceFile);
    } catch (e) {
      if (e instanceof Error) {
        Logger.error(`Could not create Asset preview image: ${e.message}`, e.stack);
      }
      throw e;
    }
    const previewFileIdentifier = await assetStorageStrategy.writeFileFromBuffer(previewFileName, preview);
    const type = getAssetType(mimetype);
    const { width, height } = this.getDimensions(type === AssetType.IMAGE ? sourceFile : preview);

    const asset = new Asset({
      type,
      width,
      height,
      name: path.basename(sourceFileName),
      fileSize: sourceFile.byteLength,
      mimeType: mimetype,
      source: sourceFileIdentifier,
      preview: previewFileIdentifier,
      focalPoint: null,
    });

    return this.connection.getRepository(ctx, Asset).save(asset);
  }

  private async getSourceFileName(ctx: RequestContext, fileName: string): Promise<string> {
    const { assetOptions } = this.configService;
    return this.generateUniqueName(fileName, (name, conflict) =>
      assetOptions.assetNamingStrategy.generateSourceFileName(ctx, name, conflict),
    );
  }

  private async getPreviewFileName(ctx: RequestContext, fileName: string): Promise<string> {
    const { assetOptions } = this.configService;
    return this.generateUniqueName(fileName, (name, conflict) =>
      assetOptions.assetNamingStrategy.generatePreviewFileName(ctx, name, conflict),
    );
  }

  private async generateUniqueName(
    inputFileName: string,
    generateNameFn: (fileName: string, conflictName?: string) => string,
  ): Promise<string> {
    const { assetOptions } = this.configService;
    let outputFileName: string | undefined;
    do {
      outputFileName = generateNameFn(inputFileName, outputFileName);
    } while (await assetOptions.assetStorageStrategy.fileExists(outputFileName));
    return outputFileName;
  }

  private getDimensions(imageFile: Buffer): { width: number; height: number } {
    const { width, height } = imageSize(imageFile);

    if (notNullOrUndefined(width) && notNullOrUndefined(height)) {
      return { width, height };
    }

    Logger.error('Could not determine Asset dimensions');
    return { width: 0, height: 0 };
  }

  private validateMimeType(mimeType: string): boolean {
    const [type, subtype] = mimeType.split('/');
    const typeMatches = this.permittedMimeTypes.filter((t) => t.type === type);

    for (const match of typeMatches) {
      if (match.subtype === subtype || match.subtype === '*') {
        return true;
      }
    }
    return false;
  }

  /**
   * @description
   * Unconditionally delete given assets.
   */
  private async deleteUnconditional(ctx: RequestContext, assets: Asset[]): Promise<void> {
    for (const asset of assets) {
      // Create a new asset so that the id is still available after deletion (the .remove() method sets it to undefined)
      const deletedAsset = new Asset(asset);
      await this.connection.getRepository(ctx, Asset).remove(asset);
      try {
        await this.configService.assetOptions.assetStorageStrategy.deleteFile(asset.source);
        await this.configService.assetOptions.assetStorageStrategy.deleteFile(asset.preview);
      } catch (e: any) {
        Logger.error('error.could-not-delete-asset-file', undefined, e.stack);
      }
      await this.eventBus.publish(new AssetEvent(ctx, deletedAsset, 'deleted', deletedAsset.id));
    }
  }

  /**
   * @description
   * Find the entities which reference the given Asset as a featuredAsset.
   */
  private async findAssetUsages(ctx: RequestContext, asset: Asset): Promise<{ jobPosts: JobPost[] }> {
    const jobPosts = await this.connection.getRepository(ctx, JobPost).find({
      where: {
        assets: { asset: { id: asset.id } },
        deletedAt: IsNull(),
      },
    });
    return { jobPosts };
  }

  private async createOrderableAssets(ctx: RequestContext, entity: EntityWithAssets, assets: Asset[]): Promise<OrderableAsset[]> {
    const orderableAssets = assets.map((asset, i) => this.getOrderableAsset(ctx, entity, asset, i));
    return this.connection.getRepository(ctx, orderableAssets[0].constructor).save(orderableAssets);
  }

  private async removeExistingOrderableAssets(ctx: RequestContext, entity: EntityWithAssets) {
    const propertyName = this.getHostEntityIdProperty(entity);
    const orderableAssetType = this.getOrderableAssetType(ctx, entity);
    await this.connection.getRepository(ctx, orderableAssetType).delete({
      [propertyName]: entity.id,
    });
  }

  private getOrderableAsset(ctx: RequestContext, entity: EntityWithAssets, asset: Asset, index: number): OrderableAsset {
    const entityIdProperty = this.getHostEntityIdProperty(entity);
    const orderableAssetType = this.getOrderableAssetType(ctx, entity);
    return new orderableAssetType({
      assetId: asset.id,
      position: index,
      [entityIdProperty]: entity.id,
    });
  }

  private getHostEntityIdProperty(entity: EntityWithAssets): string {
    const entityName = entity.constructor.name;
    switch (entityName) {
      case 'JobPost':
        return 'jobPostId';
      default:
        return `${camelCase(entityName)}Id`;
    }
  }

  private getOrderableAssetType(ctx: RequestContext, entity: EntityWithAssets): Type<OrderableAsset> {
    const assetRelation = this.connection
      .getRepository(ctx, entity.constructor)
      .metadata.relations.find((r) => r.propertyName === 'assets');
    if (!assetRelation || typeof assetRelation.type === 'string') {
      throw new InternalServerError('error.could-not-find-matching-orderable-asset');
    }
    return assetRelation.type as Type<OrderableAsset>;
  }
}
