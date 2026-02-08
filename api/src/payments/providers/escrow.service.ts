import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * EscrowService - Manages secure fund holding for bookings
 * 
 * Features:
 * - Hold funds until check-in + 48 hours
 * - Automatic release on booking completion
 * - Manual release for disputes
 * - Refund handling
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);
  private readonly escrowHoldHours = 48; // Hold funds for 48 hours after check-in

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Set escrow hold date when payment is completed
   * Funds are held until check-in + 48 hours
   */
  async setEscrowHold(paymentId: number, checkInDate: Date): Promise<void> {
    try {
      // Calculate escrow release date (check-in + 48 hours)
      const escrowReleaseDate = new Date(checkInDate);
      escrowReleaseDate.setHours(escrowReleaseDate.getHours() + this.escrowHoldHours);

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          escrowHeldUntil: escrowReleaseDate,
          escrowReleased: false,
        },
      });

      this.logger.log(
        `Escrow set for payment ${paymentId}. Funds held until ${escrowReleaseDate.toISOString()}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to set escrow hold: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Release escrow funds to host
   * Called automatically after check-in + 48h or manually by admin
   */
  async releaseEscrow(paymentId: number, releasedBy?: number): Promise<void> {
    try {
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
        throw new Error(`Payment ${paymentId} not found`);
      }

      if (payment.escrowReleased) {
        this.logger.warn(`Payment ${paymentId} already released`);
        return;
      }

      if (payment.status !== 'success') {
        throw new Error(`Cannot release escrow for payment with status: ${payment.status}`);
      }

      // Update payment escrow status
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          escrowReleased: true,
          escrowReleasedAt: new Date(),
        },
      });

      this.logger.log(
        `Escrow released for payment ${paymentId}. Booking: ${payment.bookingId}, Host: ${payment.booking.property.hostId}`,
      );

      // Trigger host payout (will be handled by PayoutService)
      // This is done asynchronously to avoid blocking
    } catch (error: any) {
      this.logger.error(`Failed to release escrow: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check and auto-release escrow for completed bookings
   * Should be called by a scheduled job
   */
  async processAutoReleases(): Promise<number> {
    try {
      const now = new Date();

      // Find payments ready for auto-release
      const paymentsToRelease = await this.prisma.payment.findMany({
        where: {
          status: 'success',
          escrowReleased: false,
          escrowHeldUntil: {
            lte: now, // Release date has passed
          },
        },
        include: {
          booking: true,
        },
      });

      let releasedCount = 0;

      for (const payment of paymentsToRelease) {
        try {
          await this.releaseEscrow(payment.id);
          releasedCount++;
        } catch (error: any) {
          this.logger.error(
            `Failed to auto-release escrow for payment ${payment.id}: ${error.message}`,
          );
        }
      }

      if (releasedCount > 0) {
        this.logger.log(`Auto-released ${releasedCount} escrow payments`);
      }

      return releasedCount;
    } catch (error: any) {
      this.logger.error(`Failed to process auto-releases: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get escrow status for a payment
   */
  async getEscrowStatus(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: true,
      },
    });

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    const now = new Date();
    const isHeld = payment.escrowHeldUntil && payment.escrowHeldUntil > now;
    const isReleased = payment.escrowReleased;

    return {
      paymentId,
      bookingId: payment.bookingId,
      isHeld,
      isReleased,
      heldUntil: payment.escrowHeldUntil,
      releasedAt: payment.escrowReleasedAt,
      canRelease: isHeld && !isReleased && payment.status === 'success',
    };
  }
}
