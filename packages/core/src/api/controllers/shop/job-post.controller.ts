import { Body, Controller, Get, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Allow } from '../../../api/decorators/allow.decorator';
import { Ctx } from '../../../api/decorators/request-context.decorator';
import { Transaction } from '../../../api/decorators/transaction.decorator';
import { CreateJobPostInput, MutationCreateJobPostArgs } from '../../../api/schema';
import { Permission, RequestContext } from '../../../common';
import { AssetService, CustomerService } from '../../../service';
import { JobPostService } from '../../../service/services/job-post.service';

@Controller('job-posts')
export class ShopJobPostController {
  constructor(
    private jobPostService: JobPostService,
    private assetService: AssetService,
    private customerService: CustomerService,
  ) {}

  @Transaction()
  @Post('create')
  @Allow(Permission.CreateJobPost)
  @UseInterceptors(FilesInterceptor('files'))
  async createJobPost(
    @Ctx() ctx: RequestContext,
    @Body() args: MutationCreateJobPostArgs,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const customer = await this.customerService.getUserCustomerFromRequest(ctx);
    const input: CreateJobPostInput = { ...args, customerId: customer.id, enabled: true, assetIds: [] };
    if (files && files.length > 0) {
      for (const file of files) {
        const asset = await this.assetService.create(ctx, { file });
        input?.assetIds?.push(asset.id);
      }
    }
    const jobPost = await this.jobPostService.create(ctx, input);
    return jobPost;
  }

  @Get()
  @Allow(Permission.ReadJobPost)
  async getJobPosts(@Ctx() ctx: RequestContext) {
    return this.jobPostService.findAll(ctx);
  }
}