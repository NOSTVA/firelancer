import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ApiModule } from './api/api.module';
import { Middleware, MiddlewareHandler } from './common/shared-types';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { ConnectionModule } from './connection/connection.module';
import { ServiceModule } from './service/service.module';
import { PluginModule } from './plugin/plugin.module';

const cookieSession = require('cookie-session');

@Module({
  imports: [PluginModule.forRoot(), ApiModule, ConfigModule, ServiceModule, ConnectionModule],
})
export class AppModule implements NestModule {
  constructor(private configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    const { middlewares, adminApiPath, shopApiPath } = this.configService.apiOptions;
    const { cookieOptions } = this.configService.authOptions;

    const allMiddlewares = middlewares || [];

    if (typeof cookieOptions?.name === 'object') {
      const shopApiCookieName = cookieOptions.name.shop;
      const adminApiCookieName = cookieOptions.name.admin;
      allMiddlewares.push({
        handler: cookieSession({ ...cookieOptions, name: adminApiCookieName }),
        route: adminApiPath,
      });
      allMiddlewares.push({
        handler: cookieSession({ ...cookieOptions, name: shopApiCookieName }),
        route: shopApiPath,
      });
    }

    const middlewareByRoute = this.groupMiddlewareByRoute(allMiddlewares);

    for (const [route, handlers] of Object.entries(middlewareByRoute)) {
      consumer.apply(...handlers).forRoutes(route);
    }
  }

  private groupMiddlewareByRoute(middlewareArray: Middleware[]): { [route: string]: MiddlewareHandler[] } {
    const result = {} as { [route: string]: MiddlewareHandler[] };
    for (const middleware of middlewareArray) {
      const route = middleware.route;
      if (!result[route]) {
        result[route] = [];
      }
      result[route].push(middleware.handler);
    }
    return result;
  }
}
