import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) response: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      response.status(503);
      return {
        status: 'degraded',
        database: 'disconnected',
        message: 'Database health check failed',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      };
    }
  }
}
