import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminModule } from '../admin/admin.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HospitalityModule } from '../hospitality/hospitality.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, AuthModule, BookingsModule, PaymentsModule, AdminModule, HospitalityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
