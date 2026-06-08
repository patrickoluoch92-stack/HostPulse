import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ListingsService } from '../services/listings.service';

type ListingsJobType = 'refresh_listings' | 'refresh_ratings';

@Injectable()
export class ListingsJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ListingsJobsService.name);
  private readonly redisUrl = process.env.REDIS_URL || '';

  private redisConnection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(private readonly listingsService: ListingsService) {}

  async onModuleInit() {
    if (!this.redisUrl) {
      this.logger.warn('REDIS_URL not configured. Listings background jobs are disabled.');
      return;
    }

    this.redisConnection = new IORedis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.queue = new Queue('listings-jobs', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });

    this.worker = new Worker(
      'listings-jobs',
      async (job) => this.processJob(job),
      { connection: this.redisConnection, concurrency: 1 },
    );

    this.worker.on('completed', (job) => this.logger.log(`Completed job: ${job.name}`));
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Failed job: ${job?.name ?? 'unknown'} - ${err.message}`),
    );

    this.logger.log('Listings background jobs initialized.');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.redisConnection?.quit();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleListingsRefresh() {
    await this.enqueueJob('refresh_listings');
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduleRatingsRefresh() {
    await this.enqueueJob('refresh_ratings');
  }

  async enqueueJob(type: ListingsJobType) {
    if (!this.queue) {
      this.logger.warn(`Queue unavailable, skip enqueuing job: ${type}`);
      return { queued: false, type, reason: 'REDIS_URL not configured' };
    }
    const job = await this.queue.add(type, { enqueuedAt: new Date().toISOString() });
    return { queued: true, type, jobId: job.id };
  }

  private async processJob(job: Job) {
    if (job.name === 'refresh_listings') {
      return this.listingsService.ingestFromGooglePlaces();
    }
    if (job.name === 'refresh_ratings') {
      return this.listingsService.refreshListingRatingsFromSources();
    }
    this.logger.warn(`Unknown listings job type: ${job.name}`);
    return null;
  }
}

