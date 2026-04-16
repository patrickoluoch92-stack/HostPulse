import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HospitalityController } from './hospitality.controller';
import { HospitalityService } from './hospitality.service';

@Module({
  imports: [PrismaModule],
  controllers: [HospitalityController],
  providers: [HospitalityService],
  exports: [HospitalityService],
})
export class HospitalityModule {}
