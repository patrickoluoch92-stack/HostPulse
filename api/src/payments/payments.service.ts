import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MpesaService } from './providers/mpesa.service';
import { EscrowService } from './providers/escrow.service';
import { RevenueService } from './providers/revenue.service';
import { PayoutService } from './providers/payout.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private mpesaService: MpesaService,
    private escrowService: EscrowService,
    private revenueService: RevenueService,
    private payoutService: PayoutService,
  ) {}

  /**
   * Initiate M-Pesa STK Push with full payment flow
   * Includes escrow setup and revenue calculation
   */
  async initiateStkPush(bookingId: number, phone: string, email?: string, name?: string) {
    // Find booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        property: {
          include: {
            host: true,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check if payment already exists and is completed
    const existingPayment = booking.payments?.[0];
    if (existingPayment && existingPayment.status === 'success') {
      return {
        payment: existingPayment,
        mpesaResponse: {
          merchantRequestId: existingPayment.mpesaTxId || `PAID-${existingPayment.id}`,
          checkoutRequestId: existingPayment.mpesaTxId,
          responseCode: '0',
          responseDescription: 'Payment already completed',
        },
      };
    }

    // Use customer info from booking if available
    const customerEmail = email || booking.user?.email || `booking${bookingId}@hostpulse.com`;
    const customerName = name || booking.user?.name || 
      (booking.user?.firstName && booking.user?.lastName 
        ? `${booking.user.firstName} ${booking.user.lastName}` 
        : 'HostPulse Customer');

    // Generate unique transaction reference
    const idempotencyKey = `stk-${bookingId}-${Date.now()}`;

    try {
      // Initiate Daraja M-Pesa STK push
      const mpesaResponse = await this.mpesaService.initiateStkPush({
        phone,
        amount: Number(booking.total),
        bookingId,
        email: customerEmail,
        name: customerName,
      });

      // Create or update payment record
      let payment;
      if (existingPayment) {
        // Update existing payment record
        payment = await this.prisma.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: 'pending',
            mpesaTxId: mpesaResponse.checkoutRequestId || mpesaResponse.merchantRequestId,
            phoneNumber: phone,
            idempotencyKey,
          },
        });
      } else {
        // Create new payment record
        payment = await this.prisma.payment.create({
          data: {
            bookingId,
            amount: booking.total,
            method: 'mpesa',
            status: 'pending',
            mpesaTxId: mpesaResponse.checkoutRequestId || mpesaResponse.merchantRequestId,
            phoneNumber: phone,
            idempotencyKey,
          },
        });
      }

      this.logger.log(
        `M-Pesa STK push initiated for booking ${bookingId}. Payment ID: ${payment.id}, CheckoutRequestID: ${mpesaResponse.checkoutRequestId}`,
      );

      return {
        payment,
        mpesaResponse,
      };
    } catch (error: any) {
      this.logger.error(`Failed to initiate STK push for booking ${bookingId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle Daraja webhook callback
   * Processes payment completion, sets up escrow, and calculates revenue
   */
  async handleWebhook(body: any) {
    this.logger.log('Received Daraja webhook', JSON.stringify(body));

    try {
      // Daraja STK Push callback structure
      const callbackMetadata = body.Body?.stkCallback?.CallbackMetadata;
      const resultCode = body.Body?.stkCallback?.ResultCode;
      const resultDesc = body.Body?.stkCallback?.ResultDesc;
      const merchantRequestId = body.Body?.stkCallback?.MerchantRequestID;
      const checkoutRequestId = body.Body?.stkCallback?.CheckoutRequestID;

      if (!checkoutRequestId) {
        this.logger.warn('Webhook missing CheckoutRequestID');
        return {
          ResultCode: 0,
          ResultDesc: 'Webhook received but missing CheckoutRequestID',
        };
      }

      // Find payment by checkout request ID
      const payment = await this.prisma.payment.findFirst({
        where: {
          mpesaTxId: checkoutRequestId,
        },
        include: {
          booking: {
            include: {
              property: {
                include: {
                  host: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        this.logger.warn(`Payment not found for CheckoutRequestID: ${checkoutRequestId}`);
        return {
          ResultCode: 0,
          ResultDesc: 'Payment not found',
        };
      }

      // Process payment result
      if (resultCode === 0 && callbackMetadata) {
        // Payment successful
        const receiptNumber = callbackMetadata.Item?.find(
          (item: any) => item.Name === 'MpesaReceiptNumber',
        )?.Value;
        const transactionDate = callbackMetadata.Item?.find(
          (item: any) => item.Name === 'TransactionDate',
        )?.Value;
        const phoneNumber = callbackMetadata.Item?.find(
          (item: any) => item.Name === 'PhoneNumber',
        )?.Value;

        // Update payment status
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'success',
            receiptNumber: receiptNumber?.toString(),
            transactionDate: transactionDate
              ? new Date(transactionDate.toString())
              : new Date(),
            resultCode: resultCode.toString(),
            resultDesc: resultDesc,
            processedAt: new Date(),
          },
        });

        // Set up escrow (hold funds until check-in + 48h)
        const bookingDates = payment.booking.dates as any;
        const checkInDate = bookingDates?.start
          ? new Date(bookingDates.start)
          : new Date(); // Fallback to now if dates not available
        await this.escrowService.setEscrowHold(payment.id, checkInDate);

        // Calculate and record revenue
        await this.revenueService.calculateAndRecordRevenue(
          payment.bookingId,
          Number(payment.amount),
        );

        // Update booking status
        await this.prisma.booking.update({
          where: { id: payment.bookingId },
          data: {
            status: 'confirmed',
          },
        });

        this.logger.log(
          `Payment ${payment.id} completed successfully. Receipt: ${receiptNumber}, Escrow set, Revenue recorded.`,
        );

        return {
          ResultCode: 0,
          ResultDesc: 'Payment processed successfully',
        };
      } else {
        // Payment failed
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            resultCode: resultCode?.toString(),
            resultDesc: resultDesc,
            processedAt: new Date(),
          },
        });

        this.logger.warn(
          `Payment ${payment.id} failed. Code: ${resultCode}, Desc: ${resultDesc}`,
        );

        return {
          ResultCode: 0,
          ResultDesc: 'Payment failure recorded',
        };
      }
    } catch (error: any) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
      return {
        ResultCode: 1,
        ResultDesc: error.message,
      };
    }
  }

  /**
   * Handle B2C payout result callback
   */
  async handleB2CResult(body: any) {
    this.logger.log('Received B2C result callback', JSON.stringify(body));
    await this.payoutService.handleB2CResult(body);
    return {
      ResultCode: 0,
      ResultDesc: 'B2C result processed',
    };
  }

  /**
   * Handle B2C timeout callback
   */
  async handleB2CTimeout(body: any) {
    this.logger.log('Received B2C timeout callback', JSON.stringify(body));
    return {
      ResultCode: 0,
      ResultDesc: 'B2C timeout acknowledged',
    };
  }

  /**
   * Verify payment status
   */
  async verifyPayment(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!payment.mpesaTxId) {
      throw new NotFoundException('Transaction reference not found');
    }

    try {
      // Query Daraja for transaction status
      const verification = await this.mpesaService.verifyPayment(payment.mpesaTxId);

      // Update payment status if verification shows different status
      if (verification.resultCode === '0' && payment.status !== 'success') {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'success' },
        });
      }

      return {
        payment,
        verification,
      };
    } catch (error: any) {
      this.logger.error(`Payment verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Release escrow manually (admin function)
   */
  async releaseEscrow(paymentId: number, releasedBy?: number) {
    await this.escrowService.releaseEscrow(paymentId, releasedBy);

    // Trigger payout processing
    await this.payoutService.processPendingPayouts();

    return {
      success: true,
      message: 'Escrow released and payout initiated',
    };
  }

  /**
   * Get escrow status
   */
  async getEscrowStatus(paymentId: number) {
    return this.escrowService.getEscrowStatus(paymentId);
  }
}
