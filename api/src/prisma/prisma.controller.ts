import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('health')
export class PrismaHealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('db')
  async checkDatabaseConnection() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok' as const,
      database: 'connected' as const,
      provider: 'postgresql' as const,
    };
  }
}
