import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { DarajaAuthService } from './daraja-auth.service';

interface B2CPayoutParams {
  amount: number;
  phoneNumber: string;
  remarks: string;
  occasion: string;
}

interface B2CPayoutResponse {
  OriginatorConversationID: string;
  ConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

/**
 * PayoutService - Handles automatic host payouts via Daraja B2C API
 * 
 * Features:
 * - Daraja B2C integration for host payouts
 * - Scheduled payout processing
 * - Payout status tracking
 * - Batch payout support
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly initiatorName: string;
  private readonly securityCredential: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly darajaAuth: DarajaAuthService,
  ) {
    this.axiosInstance = axios.create({
      baseURL: this.darajaAuth.getBaseUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.initiatorName = process.env.MPESA_INITIATOR_NAME || '';
    this.securityCredential = process.env.MPESA_SECURITY_CREDENTIAL || '';

    if (!this.initiatorName || !this.securityCredential) {
      this.logger.warn(
        'MPESA_INITIATOR_NAME or MPESA_SECURITY_CREDENTIAL not configured. Payouts will not work.',
      );
    }
  }

  /**
   * Initiate B2C payout to host
   */
  async initiatePayout(
    revenueRecordId: number,
    hostPhoneNumber: string,
    amount: number,
  ): Promise<any> {
    try {
      if (!this.initiatorName || !this.securityCredential) {
        throw new HttpException(
          'M-Pesa payout credentials not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Get access token
      const accessToken = await this.darajaAuth.getAccessToken();

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(hostPhoneNumber);

      // Get shortcode
      const shortcode = process.env.MPESA_SHORTCODE || '';
      const queueTimeOutURL =
        process.env.MPESA_QUEUE_TIMEOUT_URL ||
        `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/payments/mpesa/b2c-timeout`;
      const resultURL =
        process.env.MPESA_RESULT_URL ||
        `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/payments/mpesa/b2c-result`;

      // Generate unique conversation ID
      const conversationId = `HP-PAYOUT-${revenueRecordId}-${Date.now()}`;

      // Prepare B2C request
      const b2cRequest = {
        InitiatorName: this.initiatorName,
        SecurityCredential: this.securityCredential,
        CommandID: 'BusinessPayment', // or 'SalaryPayment', 'PromotionPayment'
        Amount: Math.round(amount),
        PartyA: shortcode,
        PartyB: formattedPhone,
        Remarks: `HostPulse payout for revenue record ${revenueRecordId}`,
        QueueTimeOutURL: queueTimeOutURL,
        ResultURL: resultURL,
        Occasion: `HostPayout-${revenueRecordId}`,
      };

      this.logger.log(
        `Initiating B2C payout for revenue record ${revenueRecordId}. Amount: ${amount}, Phone: ${formattedPhone}`,
      );

      // Make B2C request
      const response = await this.axiosInstance.post<B2CPayoutResponse>(
        '/mpesa/b2c/v1/paymentrequest',
        b2cRequest,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.data.ResponseCode === '0') {
        // Update revenue record with payout transaction ID
        await this.prisma.revenueRecord.update({
          where: { id: revenueRecordId },
          data: {
            payoutStatus: 'processing',
            payoutTransactionId: response.data.ConversationID,
            payoutDate: new Date(),
          },
        });

        this.logger.log(
          `B2C payout initiated successfully. Revenue Record: ${revenueRecordId}, ConversationID: ${response.data.ConversationID}`,
        );

        return {
          revenueRecordId,
          conversationId: response.data.ConversationID,
          originatorConversationId: response.data.OriginatorConversationID,
          responseCode: response.data.ResponseCode,
          responseDescription: response.data.ResponseDescription,
        };
      } else {
        throw new HttpException(
          response.data.ResponseDescription || 'Failed to initiate payout',
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error: any) {
      this.logger.error(`B2C payout failed: ${error.message}`, error.stack);

      // Update revenue record to failed
      try {
        await this.prisma.revenueRecord.update({
          where: { id: revenueRecordId },
          data: {
            payoutStatus: 'failed',
          },
        });
      } catch (updateError) {
        this.logger.error(`Failed to update payout status: ${updateError}`);
      }

      if (error.response) {
        const status = error.response.status;
        const errorMessage =
          error.response.data?.errorMessage ||
          error.response.data?.ResponseDescription ||
          'Payout initiation failed';

        throw new HttpException(
          errorMessage,
          status >= 500 ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_REQUEST,
        );
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to initiate payout. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Process pending payouts for released escrow
   * Should be called after escrow release
   */
  async processPendingPayouts(): Promise<number> {
    try {
      // Find revenue records ready for payout
      const pendingPayouts = await this.prisma.revenueRecord.findMany({
        where: {
          payoutStatus: 'pending',
        },
        include: {
          host: true,
          booking: {
            include: {
              payments: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      // Filter only those with released escrow
      const readyForPayout = pendingPayouts.filter(
        (record) => record.booking.payments?.[0]?.escrowReleased === true,
      );

      let processedCount = 0;

      for (const record of readyForPayout) {
        try {
          if (!record.host.phone) {
            this.logger.warn(
              `Host ${record.hostId} has no phone number. Cannot process payout.`,
            );
            continue;
          }

          await this.initiatePayout(
            record.id,
            record.host.phone,
            Number(record.netAmount),
          );
          processedCount++;
        } catch (error: any) {
          this.logger.error(
            `Failed to process payout for revenue record ${record.id}: ${error.message}`,
          );
        }
      }

      if (processedCount > 0) {
        this.logger.log(`Processed ${processedCount} pending payouts`);
      }

      return processedCount;
    } catch (error: any) {
      this.logger.error(`Failed to process pending payouts: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle B2C result callback
   */
  async handleB2CResult(result: any): Promise<void> {
    try {
      const conversationId = result.ConversationID || result.OriginatorConversationID;

      if (!conversationId) {
        this.logger.warn('B2C result missing conversation ID');
        return;
      }

      // Find revenue record by transaction ID
      const revenueRecord = await this.prisma.revenueRecord.findFirst({
        where: {
          payoutTransactionId: conversationId,
        },
      });

      if (!revenueRecord) {
        this.logger.warn(`Revenue record not found for conversation ID: ${conversationId}`);
        return;
      }

      // Update payout status based on result
      const resultCode = result.Result?.ResultCode || result.ResultCode;
      const resultDesc = result.Result?.ResultDescription || result.ResultDescription;
      const normalizedResultCode = String(resultCode);

      let payoutStatus: 'pending' | 'processing' | 'paid' | 'failed' = 'failed';

      if (normalizedResultCode === '0') {
        payoutStatus = 'paid';
        this.logger.log(`Payout successful for revenue record ${revenueRecord.id}`);
      } else {
        this.logger.warn(
          `Payout failed for revenue record ${revenueRecord.id}. Code: ${normalizedResultCode}, Desc: ${resultDesc}`,
        );
      }

      await this.prisma.revenueRecord.update({
        where: { id: revenueRecord.id },
        data: {
          payoutStatus,
          payoutDate: payoutStatus === 'paid' ? new Date() : revenueRecord.payoutDate,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to handle B2C result: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Format phone number to Daraja format
   */
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('254')) {
      // Already correct
    } else if (cleaned.length === 9) {
      cleaned = '254' + cleaned;
    }

    if (cleaned.length !== 12 || !cleaned.startsWith('254')) {
      throw new HttpException(
        'Invalid phone number format for payout',
        HttpStatus.BAD_REQUEST,
      );
    }

    return cleaned;
  }
}
