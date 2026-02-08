import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async initiateMpesaStkPush(bookingId: number, phone: string) {
    // Check if booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Generate a mock M-PESA transaction ID
    const mpesaTxId = `MPESA${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Create payment record (stub - in production, this would call M-PESA API)
    const payment = await this.prisma.payment.create({
      data: {
        bookingId,
        amount: booking.total,
        method: 'mpesa',
        status: 'pending',
        mpesaTxId,
        phoneNumber: phone,
      },
      include: {
        booking: true,
      },
    });

    return {
      message: 'STK push simulated (stub)',
      payment,
    };
  }
}
