import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MpesaService } from './providers/mpesa.service';
import { DarajaAuthService } from './providers/daraja-auth.service';
import { EscrowService } from './providers/escrow.service';
import { RevenueService } from './providers/revenue.service';
import { PayoutService } from './providers/payout.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MpesaService,
    DarajaAuthService,
    EscrowService,
    RevenueService,
    PayoutService,
  ],
  exports: [PaymentsService, EscrowService, RevenueService, PayoutService],
})
export class PaymentsModule {}
