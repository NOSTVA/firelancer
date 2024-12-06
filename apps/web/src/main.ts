require('dotenv').config();
import { bootstrap, LocalAssetStorageStrategy, Logger, SharpAssetPreviewStrategy } from '@firelancer/core';
import { HelloWorldPlugin } from './plugins/hello-world/plugin';
import { join } from 'path';

bootstrap({
  apiOptions: {
    hostname: '0.0.0.0',
    port: 3001,
    adminApiPath: 'admin-api',
    shopApiPath: 'shop-api',
    middlewares: [
      {
        route: 'admin-api',
        handler: (req, res, next) => {
          Logger.log(`admin-api middleware`);
          next();
        },
      },
      {
        route: 'shop-api',
        handler: (req, res, next) => {
          Logger.log(`shop-api middleware`);
          next();
        },
      },
    ],
  },
  dbConnectionOptions: {
    type: 'postgres',
    port: Number(process.env.POSTGRES_CONNECTION_PORT!),
    host: process.env.POSTGRES_CONNECTION_HOST!,
    username: process.env.POSTGRES_CONNECTION_USERNAME!,
    password: process.env.POSTGRES_CONNECTION_PASSWORD!,
    database: process.env.POSTGRES_DATABASE!,
    synchronize: true,
  },
  authOptions: {
    tokenMethod: ['cookie', 'bearer'],
    cookieOptions: {
      name: {
        admin: 'admin-session',
        shop: 'shop-session',
      },
    },
  },
  assetOptions: {
    assetStorageStrategy: new LocalAssetStorageStrategy(join(__dirname, '../public/assets')),
    assetPreviewStrategy: new SharpAssetPreviewStrategy(),
  },
  plugins: [HelloWorldPlugin],
});
