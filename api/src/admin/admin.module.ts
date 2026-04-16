import { Module } from '@nestjs/common';
import { FinancialsController } from './financials.controller';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [FinancialsController],
  providers: [RolesGuard],
})
export class AdminModule {}
