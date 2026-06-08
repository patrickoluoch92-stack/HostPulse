import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MpesaService } from './providers/mpesa.service';
import { EscrowService } from './providers/escrow.service';
import { RevenueService } from './providers/revenue.service';
import { PayoutService } from './providers/payout.service';

type AuthActor = {
  role?: string | null;
  userId?: number | null;
};

type CallbackItem = {
  Name?: string;
  Value?: unknown;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly pendingReuseWindowMs = 2 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mpesaService: MpesaService,
    private readonly escrowService: EscrowService,
    private readonly revenueService: RevenueService,
    private readonly payoutService: PayoutService,
  ) {}

  async initiateStkPush(
    bookingId: number,
    phone: string,
    requestingUserId?: number,
    email?: string,
    name?: string,
  ) {
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      throw new BadRequestException('bookingId must be a positive integer');
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
      throw new BadRequestException('phone is required and must be a valid string');
    }

    this.logger.log(
      `STK initiate bookingId=${bookingId} userId=${requestingUserId ?? 'unknown'} phoneTail=${this.maskPhone(phone)}`,
    );

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

    if (
      requestingUserId !== undefined &&
      requestingUserId !== null &&
      booking.userId !== requestingUserId
    ) {
      this.logger.warn(
        `STK forbidden booking=${bookingId} owner=${booking.userId} caller=${requestingUserId}`,
      );
      throw new ForbiddenException('You can only initiate payment for your own booking.');
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestException('Cancelled bookings cannot be paid.');
    }

    const existingPayment = booking.payments?.[0];
    if (existingPayment?.status === 'success') {
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

    if (
      existingPayment &&
      existingPayment.status === 'pending' &&
      !existingPayment.processedAt &&
      Date.now() - existingPayment.createdAt.getTime() < this.pendingReuseWindowMs
    ) {
      this.logger.warn(
        `Reusing pending payment ${existingPayment.id} for booking ${bookingId} instead of opening another STK request`,
      );
      return {
        payment: existingPayment,
        mpesaResponse: {
          merchantRequestId: existingPayment.mpesaTxId || `PENDING-${existingPayment.id}`,
          checkoutRequestId: existingPayment.mpesaTxId ?? undefined,
          responseCode: '0',
          responseDescription: 'Payment request already pending',
        },
      };
    }

    const customerEmail = email || booking.user?.email || `booking${bookingId}@hostpulse.com`;
    const customerName =
      name ||
      booking.user?.name ||
      (booking.user?.firstName && booking.user?.lastName
        ? `${booking.user.firstName} ${booking.user.lastName}`
        : 'HostPulse Customer');
    const normalizedPhone = this.mpesaService.normalizePhoneNumber(phone);
    const idempotencyKey = `stk-${bookingId}-${normalizedPhone}`;

    try {
      const mpesaResponse = await this.mpesaService.initiateStkPush({
        phone,
        amount: Number(booking.total),
        bookingId,
        email: customerEmail,
        name: customerName,
      });

      const payment = existingPayment
        ? await this.prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              status: 'pending',
              mpesaTxId: mpesaResponse.checkoutRequestId || mpesaResponse.merchantRequestId,
              phoneNumber: normalizedPhone,
              resultCode: null,
              resultDesc: null,
              receiptNumber: null,
              transactionDate: null,
              processedAt: null,
              idempotencyKey,
            },
          })
        : await this.prisma.payment.create({
            data: {
              bookingId,
              amount: booking.total,
              method: 'mpesa',
              status: 'pending',
              mpesaTxId: mpesaResponse.checkoutRequestId || mpesaResponse.merchantRequestId,
              phoneNumber: normalizedPhone,
              idempotencyKey,
            },
          });

      this.logger.log(
        `STK push initiated paymentId=${payment.id} bookingId=${bookingId} checkoutRequestId=${mpesaResponse.checkoutRequestId ?? 'n/a'}`,
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

  async handleWebhook(body: any) {
    try {
      const callback = body?.Body?.stkCallback;
      const callbackMetadata = callback?.CallbackMetadata;
      const resultCode = this.normalizeExternalCode(callback?.ResultCode);
      const resultDesc = callback?.ResultDesc ? String(callback.ResultDesc) : 'Unknown callback result';
      const checkoutRequestId = callback?.CheckoutRequestID ? String(callback.CheckoutRequestID) : '';

      this.logger.log(
        `Daraja callback received checkoutRequestId=${checkoutRequestId || 'missing'} resultCode=${resultCode ?? 'missing'}`,
      );

      if (!checkoutRequestId) {
        this.logger.warn('Webhook missing CheckoutRequestID');
        return {
          ResultCode: 0,
          ResultDesc: 'Webhook received but missing CheckoutRequestID',
        };
      }

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
        this.logger.warn(`Payment not found for checkoutRequestId=${checkoutRequestId}`);
        return {
          ResultCode: 0,
          ResultDesc: 'Payment not found',
        };
      }

      if (payment.processedAt) {
        this.logger.log(`Duplicate STK callback ignored for payment ${payment.id}`);
        return {
          ResultCode: 0,
          ResultDesc: 'Duplicate callback ignored',
        };
      }

      if (resultCode === '0' && callbackMetadata) {
        const callbackItems = Array.isArray(callbackMetadata.Item)
          ? (callbackMetadata.Item as CallbackItem[])
          : [];
        const amount = this.extractCallbackNumber(callbackItems, 'Amount');
        const receiptNumber = this.extractCallbackValue(callbackItems, 'MpesaReceiptNumber');
        const transactionDate = this.extractCallbackValue(callbackItems, 'TransactionDate');
        const phoneNumber = this.extractCallbackValue(callbackItems, 'PhoneNumber');

        if (amount !== null && Number(payment.amount) !== amount) {
          this.logger.error(
            `Amount mismatch for payment ${payment.id}: expected=${payment.amount} received=${amount}`,
          );
          await this.markPaymentFailed(
            payment.id,
            'amount_mismatch',
            'Callback amount mismatch',
          );
          return {
            ResultCode: 0,
            ResultDesc: 'Amount mismatch recorded',
          };
        }

        const normalizedPhone =
          phoneNumber !== null ? this.tryNormalizePhone(String(phoneNumber)) : null;
        if (
          normalizedPhone &&
          payment.phoneNumber &&
          normalizedPhone !== this.tryNormalizePhone(payment.phoneNumber)
        ) {
          this.logger.error(
            `Phone mismatch for payment ${payment.id}: expected=${this.maskPhone(payment.phoneNumber)} received=${this.maskPhone(normalizedPhone)}`,
          );
          await this.markPaymentFailed(
            payment.id,
            'phone_mismatch',
            'Callback phone number mismatch',
          );
          return {
            ResultCode: 0,
            ResultDesc: 'Phone mismatch recorded',
          };
        }

        await this.finalizeSuccessfulPayment(payment.id, {
          receiptNumber,
          transactionDate,
          resultCode,
          resultDesc,
          phoneNumber: normalizedPhone ?? payment.phoneNumber ?? undefined,
        });

        return {
          ResultCode: 0,
          ResultDesc: 'Payment processed successfully',
        };
      }

      await this.markPaymentFailed(payment.id, resultCode || 'unknown', resultDesc);
      this.logger.warn(`Payment ${payment.id} failed code=${resultCode} desc=${resultDesc}`);

      return {
        ResultCode: 0,
        ResultDesc: 'Payment failure recorded',
      };
    } catch (error: any) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
      return {
        ResultCode: 1,
        ResultDesc: error.message,
      };
    }
  }

  async handleB2CResult(body: any) {
    this.logger.log('Received B2C result callback');
    await this.payoutService.handleB2CResult(body);
    return {
      ResultCode: 0,
      ResultDesc: 'B2C result processed',
    };
  }

  async handleB2CTimeout(body: any) {
    this.logger.log('Received B2C timeout callback');
    await this.payoutService.handleB2CTimeout(body);
    return {
      ResultCode: 0,
      ResultDesc: 'B2C timeout processed',
    };
  }

  async verifyPayment(paymentId: number, actor: AuthActor) {
    const payment = await this.getPaymentWithContext(paymentId);
    this.assertPaymentAccess(payment, actor);

    if (payment.processedAt) {
      return {
        payment,
        verification: null,
      };
    }

    if (!payment.mpesaTxId) {
      throw new NotFoundException('Transaction reference not found');
    }

    try {
      const verification = await this.mpesaService.verifyPayment(payment.mpesaTxId);
      const verificationCode = this.normalizeExternalCode(verification.resultCode);

      if (verificationCode === '0') {
        await this.finalizeSuccessfulPayment(payment.id, {
          resultCode: verificationCode,
          resultDesc: verification.resultDesc,
        });
      } else if (verificationCode) {
        await this.markPaymentFailed(
          payment.id,
          verificationCode,
          verification.resultDesc || 'Payment failed during verification query',
        );
      }

      const updatedPayment = await this.getPaymentWithContext(paymentId);
      return {
        payment: updatedPayment,
        verification,
      };
    } catch (error: any) {
      this.logger.error(`Payment verification failed: ${error.message}`);
      throw error;
    }
  }

  async releaseEscrow(paymentId: number, actor: AuthActor, releasedBy?: number) {
    if (actor.role !== 'admin') {
      throw new ForbiddenException('Only admin users can release escrow manually.');
    }

    await this.escrowService.releaseEscrow(
      paymentId,
      releasedBy ?? actor.userId ?? undefined,
    );
    await this.payoutService.processPendingPayouts();

    return {
      success: true,
      message: 'Escrow released and payout initiated',
    };
  }

  async getEscrowStatus(paymentId: number, actor: AuthActor) {
    const payment = await this.getPaymentWithContext(paymentId);
    this.assertPaymentAccess(payment, actor);
    return this.escrowService.getEscrowStatus(paymentId);
  }

  private async getPaymentWithContext(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
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
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  private assertPaymentAccess(payment: any, actor: AuthActor): void {
    if (actor.role === 'admin') {
      return;
    }

    const actorUserId = actor.userId ?? undefined;
    if (!actorUserId) {
      throw new ForbiddenException('Authenticated user is required.');
    }

    if (
      payment.booking.userId !== actorUserId &&
      payment.booking.property.hostId !== actorUserId
    ) {
      throw new ForbiddenException('You do not have permission to access this payment.');
    }
  }

  private async markPaymentFailed(
    paymentId: number,
    resultCode: string,
    resultDesc: string,
  ): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        processedAt: null,
      },
      data: {
        status: 'failed',
        resultCode,
        resultDesc,
        processedAt: new Date(),
      },
    });
  }

  private parseDarajaTimestamp(rawValue: unknown): Date {
    if (rawValue === undefined || rawValue === null) {
      return new Date();
    }

    const value = String(rawValue).trim();
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value);
    if (!match) {
      return new Date();
    }

    const [, year, month, day, hour, minute, second] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  private async finalizeSuccessfulPayment(
    paymentId: number,
    details: {
      phoneNumber?: unknown;
      receiptNumber?: unknown;
      transactionDate?: unknown;
      resultCode?: unknown;
      resultDesc?: unknown;
    },
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.processedAt && payment.status === 'success') {
      return;
    }

    const updated = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        processedAt: null,
      },
      data: {
        status: 'success',
        receiptNumber:
          details.receiptNumber !== undefined && details.receiptNumber !== null
            ? String(details.receiptNumber)
            : payment.receiptNumber,
        transactionDate:
          details.transactionDate !== undefined && details.transactionDate !== null
            ? this.parseDarajaTimestamp(details.transactionDate)
            : payment.transactionDate || new Date(),
        phoneNumber:
          details.phoneNumber !== undefined && details.phoneNumber !== null
            ? String(details.phoneNumber)
            : payment.phoneNumber,
        resultCode:
          details.resultCode !== undefined && details.resultCode !== null
            ? String(details.resultCode)
            : payment.resultCode,
        resultDesc:
          details.resultDesc !== undefined && details.resultDesc !== null
            ? String(details.resultDesc)
            : payment.resultDesc,
        processedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return;
    }

    await this.prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: 'confirmed',
      },
    });

    await this.escrowService.setEscrowHold(payment.id, payment.booking.startDate);
    await this.revenueService.calculateAndRecordRevenue(payment.bookingId, Number(payment.amount));
  }

  private extractCallbackValue(items: CallbackItem[], name: string): unknown | null {
    const match = items.find((item) => item.Name === name);
    return match?.Value ?? null;
  }

  private extractCallbackNumber(items: CallbackItem[], name: string): number | null {
    const rawValue = this.extractCallbackValue(items, name);
    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private normalizeExternalCode(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    return String(value);
  }

  private tryNormalizePhone(phone: string): string | null {
    try {
      return this.mpesaService.normalizePhoneNumber(phone);
    } catch {
      return null;
    }
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : digits;
  }
}
