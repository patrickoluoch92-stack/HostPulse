import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getData(): { message: string; status: 'ok' } {
    return { message: 'Hello API', status: 'ok' };
  }

  async getDbHealth() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'degraded',
        database: 'disconnected',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
