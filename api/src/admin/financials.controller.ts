import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
  ParseBoolPipe,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueService } from '../payments/providers/revenue.service';
import { PayoutService } from '../payments/providers/payout.service';
import { EscrowService } from '../payments/providers/escrow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * FinancialsController - Admin financial oversight and reporting
 * 
 * Features:
 * - Revenue reporting and analytics
 * - Payout management
 * - Escrow oversight
 * - Financial dashboard
 */
@Controller('admin/financials')
@UseGuards(JwtAuthGuard)
export class FinancialsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revenueService: RevenueService,
    private readonly payoutService: PayoutService,
    private readonly escrowService: EscrowService,
  ) {}

  /**
   * Get financial dashboard overview
   */
  @Get('dashboard')
  async getDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // Get revenue summary
    const revenueSummary = await this.revenueService.getRevenueSummary(start, end);

    // Get escrow statistics
    const now = new Date();
    const totalEscrow = await this.prisma.payment.count({
      where: {
        status: 'success',
        escrowReleased: false,
        escrowHeldUntil: {
          gt: now,
        },
      },
    });

    const totalEscrowAmount = await this.prisma.payment.aggregate({
      where: {
        status: 'success',
        escrowReleased: false,
        escrowHeldUntil: {
          gt: now,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Get payout statistics
    const pendingPayouts = await this.prisma.revenueRecord.count({
      where: {
        payoutStatus: 'pending',
      },
    });

    const processingPayouts = await this.prisma.revenueRecord.count({
      where: {
        payoutStatus: 'processing',
      },
    });

    const totalPendingPayoutAmount = await this.prisma.revenueRecord.aggregate({
      where: {
        payoutStatus: 'pending',
      },
      _sum: {
        netAmount: true,
      },
    });

    return {
      period: {
        start: start,
        end: end,
      },
      revenue: {
        totalGross: revenueSummary.totals.grossAmount,
        totalCommission: revenueSummary.totals.commission,
        totalVat: revenueSummary.totals.vat,
        totalNet: revenueSummary.totals.netAmount,
        transactionCount: revenueSummary.counts.totalTransactions,
      },
      escrow: {
        totalHeld: totalEscrow,
        totalAmount: Number(totalEscrowAmount._sum.amount || 0),
      },
      payouts: {
        pending: {
          count: pendingPayouts,
          amount: Number(totalPendingPayoutAmount._sum.netAmount || 0),
        },
        processing: {
          count: processingPayouts,
        },
      },
    };
  }

  /**
   * Get revenue summary
   */
  @Get('revenue')
  async getRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.revenueService.getRevenueSummary(start, end);
  }

  /**
   * Get revenue by host
   */
  @Get('revenue/host/:hostId')
  async getRevenueByHost(
    @Param('hostId', ParseIntPipe) hostId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.revenueService.getRevenueByHost(hostId, start, end);
  }

  /**
   * Get payout list
   */
  @Get('payouts')
  async getPayouts(
    @Query('status') status?: 'pending' | 'processing' | 'paid' | 'failed',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: any = {};

    if (status) {
      where.payoutStatus = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const payouts = await this.prisma.revenueRecord.findMany({
      where,
      include: {
        host: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        booking: {
          select: {
            id: true,
            total: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      payouts: payouts.map((p) => ({
        id: p.id,
        host: {
          id: p.host.id,
          email: p.host.email,
          name: `${p.host.firstName || ''} ${p.host.lastName || ''}`.trim(),
          phone: p.host.phone,
        },
        property: {
          id: p.property.id,
          name: p.property.name,
        },
        booking: {
          id: p.booking.id,
          total: Number(p.booking.total),
        },
        grossAmount: Number(p.grossAmount),
        commission: Number(p.commission),
        vat: Number(p.vat),
        netAmount: Number(p.netAmount),
        payoutStatus: p.payoutStatus,
        payoutDate: p.payoutDate,
        payoutTransactionId: p.payoutTransactionId,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Process pending payouts
   */
  @Post('payouts/process')
  async processPayouts() {
    const count = await this.payoutService.processPendingPayouts();
    return {
      success: true,
      message: `Processed ${count} payouts`,
      count,
    };
  }

  /**
   * Get escrow overview
   */
  @Get('escrow')
  async getEscrowOverview() {
    const now = new Date();

    const held = await this.prisma.payment.findMany({
      where: {
        status: 'success',
        escrowReleased: false,
        escrowHeldUntil: {
          gt: now,
        },
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

    const totalAmount = held.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      totalHeld: held.length,
      totalAmount,
      payments: held.map((p) => ({
        paymentId: p.id,
        bookingId: p.bookingId,
        amount: Number(p.amount),
        heldUntil: p.escrowHeldUntil,
        property: {
          id: p.booking.property.id,
          name: p.booking.property.name,
        },
        host: {
          id: p.booking.property.host.id,
          email: p.booking.property.host.email,
        },
      })),
    };
  }

  /**
   * Process auto-release escrow (scheduled job endpoint)
   */
  @Post('escrow/auto-release')
  async processAutoRelease() {
    const count = await this.escrowService.processAutoReleases();

    // After releasing escrow, process pending payouts
    await this.payoutService.processPendingPayouts();

    return {
      success: true,
      message: `Auto-released ${count} escrow payments`,
      count,
    };
  }
}
