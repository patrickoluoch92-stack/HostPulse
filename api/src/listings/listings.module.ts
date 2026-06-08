import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../app/auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ListingsController } from './controllers/listings.controller';
import { ListingsJobsService } from './jobs/listings-jobs.service';
import { ListingsService } from './services/listings.service';

@Module({
  imports: [PrismaModule, AuthModule, ScheduleModule.forRoot()],
  controllers: [ListingsController],
  providers: [ListingsService, ListingsJobsService],
  exports: [ListingsService],
})
export class ListingsModule {}
