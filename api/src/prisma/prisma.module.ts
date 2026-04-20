import { Module } from '@nestjs/common';
import { PrismaHealthController } from './prisma.controller';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [PrismaHealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
