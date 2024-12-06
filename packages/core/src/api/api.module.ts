import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE, RouterModule } from '@nestjs/core';
import { ConfigModule } from 'src/config/config.module';
import { ConnectionModule } from 'src/connection/connection.module';
import { createDynamicRestModulesForPlugins } from 'src/plugin/dynamic-plugin-api.module';
import { ServiceModule } from 'src/service/service.module';
import { getConfig } from '../config/config-helpers';
import { AdminAuthController } from './controllers/admin/auth.controller';
import { ShopAuthController } from './controllers/shop/auth.controller';
import { AuthGuard } from './middlewares/auth-guard';
import { AdministratorController } from './controllers/admin/administrator.controller';
import { HttpExceptionFilter } from './middlewares/http-exception.filter';
import { ShopJobPostController } from './controllers/shop/job-post.controller';

const { apiOptions } = getConfig();

@Module({
  imports: [ConfigModule, ServiceModule, RouterModule.register([{ path: apiOptions.adminApiPath, module: AdminModule }])],
  controllers: [AdminAuthController, AdministratorController],
})
export class AdminModule {}

@Module({
  imports: [ConfigModule, ServiceModule, RouterModule.register([{ path: apiOptions.shopApiPath, module: ShopModule }])],
  controllers: [ShopAuthController, ShopJobPostController],
})
export class ShopModule {}

@Module({
  imports: [
    ConfigModule,
    ServiceModule,
    ConnectionModule,
    AdminModule,
    ShopModule,
    ...createDynamicRestModulesForPlugins('admin'),
    ...createDynamicRestModulesForPlugins('shop'),
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class ApiModule {}
