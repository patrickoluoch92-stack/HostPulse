import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * RevenueService - Calculates and tracks HostPulse platform revenue
 * 
 * Features:
 * - Commission calculation (default 15%)
 * - VAT calculation (16% on commission)
 * - Revenue record creation
 * - Revenue tracking and reporting
 */
@Injectable()
export class RevenueService {
  private readonly logger = new Logger(RevenueService.name);
  private readonly defaultCommissionRate = 0.15; // 15% platform commission
  private readonly vatRate = 0.16; // 16% VAT on commission (Kenyan tax)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate platform commission and create revenue record
   * Called when payment is completed
   */
  async calculateAndRecordRevenue(
    bookingId: number,
    grossAmount: number,
  ): Promise<any> {
    try {
      // Get booking with property and host
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          property: {
            include: {
              host: true,
            },
          },
        },
      });

      if (!booking) {
        throw new NotFoundException(`Booking ${bookingId} not found`);
      }

      // Use booking commission if set, otherwise use default rate
      const commissionRate =
        booking.commission && Number(booking.commission) > 0
          ? Number(booking.commission) / Number(booking.total)
          : this.defaultCommissionRate;

      // Calculate commission
      const commission = Math.round(grossAmount * commissionRate * 100) / 100;

      // Calculate VAT on commission (16% of commission)
      const vat = Math.round(commission * this.vatRate * 100) / 100;

      // Calculate net amount to host (gross - commission)
      const netAmount = Math.round((grossAmount - commission) * 100) / 100;

      // Check if revenue record already exists
      const existingRecord = await this.prisma.revenueRecord.findFirst({
        where: { bookingId },
      });

      if (existingRecord) {
        this.logger.warn(`Revenue record already exists for booking ${bookingId}`);
        return existingRecord;
      }

      // Create revenue record
      const revenueRecord = await this.prisma.revenueRecord.create({
        data: {
          bookingId,
          hostId: booking.property.hostId,
          propertyId: booking.propertyId,
          grossAmount,
          commission,
          vat,
          netAmount,
          payoutStatus: 'pending',
        },
      });

      this.logger.log(
        `Revenue recorded for booking ${bookingId}. Gross: ${grossAmount}, Commission: ${commission}, Net: ${netAmount}`,
      );

      return revenueRecord;
    } catch (error: any) {
      this.logger.error(`Failed to calculate revenue: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get platform revenue summary
   */
  async getRevenueSummary(startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const records = await this.prisma.revenueRecord.findMany({
      where,
      include: {
        booking: true,
        property: true,
        host: true,
      },
    });

    const totalGross = records.reduce((sum, r) => sum + Number(r.grossAmount), 0);
    const totalCommission = records.reduce((sum, r) => sum + Number(r.commission), 0);
    const totalVat = records.reduce((sum, r) => sum + Number(r.vat), 0);
    const totalNet = records.reduce((sum, r) => sum + Number(r.netAmount), 0);

    const pendingPayouts = records.filter((r) => r.payoutStatus === 'pending');
    const totalPendingPayouts = pendingPayouts.reduce(
      (sum, r) => sum + Number(r.netAmount),
      0,
    );

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      totals: {
        grossAmount: totalGross,
        commission: totalCommission,
        vat: totalVat,
        netAmount: totalNet,
        pendingPayouts: totalPendingPayouts,
      },
      counts: {
        totalTransactions: records.length,
        pendingPayouts: pendingPayouts.length,
        paidPayouts: records.filter((r) => r.payoutStatus === 'paid').length,
      },
      records: records.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        grossAmount: Number(r.grossAmount),
        commission: Number(r.commission),
        vat: Number(r.vat),
        netAmount: Number(r.netAmount),
        payoutStatus: r.payoutStatus,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Get revenue by host
   */
  async getRevenueByHost(hostId: number, startDate?: Date, endDate?: Date) {
    const where: any = { hostId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const records = await this.prisma.revenueRecord.findMany({
      where,
      include: {
        booking: true,
        property: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalGross = records.reduce((sum, r) => sum + Number(r.grossAmount), 0);
    const totalNet = records.reduce((sum, r) => sum + Number(r.netAmount), 0);
    const totalCommission = records.reduce((sum, r) => sum + Number(r.commission), 0);

    return {
      hostId,
      period: {
        start: startDate,
        end: endDate,
      },
      totals: {
        grossAmount: totalGross,
        commission: totalCommission,
        netAmount: totalNet,
      },
      records: records.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        propertyId: r.propertyId,
        grossAmount: Number(r.grossAmount),
        commission: Number(r.commission),
        netAmount: Number(r.netAmount),
        payoutStatus: r.payoutStatus,
        createdAt: r.createdAt,
      })),
    };
  }
}
