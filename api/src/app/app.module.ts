import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminModule } from '../admin/admin.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, BookingsModule, PaymentsModule, AdminModule],
})
export class AppModule {}
