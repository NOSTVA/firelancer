import { Module, OnApplicationShutdown } from '@nestjs/common';
import { Logger } from '../config';
import { ConfigModule } from '../config/config.module';
import { ConnectionModule } from '../connection/connection.module';
import { PluginModule } from '../plugin/plugin.module';
import { ProcessContextModule } from '../process-context/process-context.module';
import { ServiceModule } from '../service/service.module';
import { WorkerHealthService } from './worker-health.service';

/**
 * This is the main module used when bootstrapping the worker process via
 * `bootstrapWorker()`. It contains the same imports as the AppModule except
 * for the ApiModule, which is not needed for the worker. Omitting the ApiModule
 * greatly increases startup time (about 4x in testing).
 */
@Module({
    imports: [ProcessContextModule, ConfigModule, PluginModule.forRoot(), ConnectionModule.forRoot(), ServiceModule],
    providers: [WorkerHealthService],
})
export class WorkerModule implements OnApplicationShutdown {
    async onApplicationShutdown(signal?: string) {
        if (signal) {
            Logger.info('Received shutdown signal:' + signal);
        }
    }
}
