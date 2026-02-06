import { Module } from '@nestjs/common';
import { FinancialsController } from './financials.controller';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [FinancialsController],
})
export class AdminModule {}
