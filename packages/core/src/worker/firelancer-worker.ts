import { INestApplicationContext } from '@nestjs/common';
import { JobQueueService } from '../job-queue/job-queue.service';
import { WorkerHealthCheckConfig, WorkerHealthService } from './worker-health.service';

/**
 * @description
 * This object is created by calling the bootstrapWorker function.
 */
export class FirelancerWorker {
    /**
     * @description
     * A reference to the `INestApplicationContext` object, which represents
     * the NestJS [standalone application](https://docs.nestjs.com/standalone-applications) instance.
     */
    public app: INestApplicationContext;

    constructor(app: INestApplicationContext) {
        this.app = app;
    }

    /**
     * @description
     * Starts the job queues running so that the worker can handle background jobs.
     */
    async startJobQueue(): Promise<FirelancerWorker> {
        await this.app.get(JobQueueService).start();
        return this;
    }

    /**
     * @description
     * Starts a simple http server which can be used as a health check on the worker instance.
     * This endpoint can be used by container orchestration services such as Kubernetes to
     * verify whether the worker is running.
     */
    async startHealthCheckServer(healthCheckConfig: WorkerHealthCheckConfig): Promise<FirelancerWorker> {
        await this.app.get(WorkerHealthService).initializeHealthCheckEndpoint(healthCheckConfig);
        return this;
    }
}
