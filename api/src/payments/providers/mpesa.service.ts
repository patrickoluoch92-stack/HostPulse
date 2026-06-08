import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { DarajaAuthService } from './daraja-auth.service';
import { darajaTimestampNairobi } from '../../utils/daraja-timestamp.util';

interface StkPushParams {
  phone: string;
  amount: number;
  bookingId: number;
  email?: string;
  name?: string;
}

export interface StkPushResponse {
  merchantRequestId: string;
  checkoutRequestId?: string;
  responseCode?: string;
  responseDescription?: string;
  customerMessage?: string;
  txRef?: string;
}

interface DarajaStkPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

interface DarajaStkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

interface DarajaStkQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

/**
 * MpesaService - Production-ready Safaricom Daraja API integration
 * 
 * Features:
 * - Direct Daraja STK Push integration
 * - Transaction query and verification
 * - Secure credential management
 * - Comprehensive error handling
 * - Production and sandbox support
 */
@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly queryUrl: string;

  constructor(private readonly darajaAuth: DarajaAuthService) {
    this.axiosInstance = axios.create({
      baseURL: this.darajaAuth.getBaseUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.queryUrl = process.env.MPESA_QUERY_URL || '/mpesa/stkpush/v1/query';
  }

  /**
   * Initiate M-Pesa STK Push via Safaricom Daraja API
   */
  async initiateStkPush(params: StkPushParams): Promise<StkPushResponse> {
    try {
      // Get OAuth token
      const accessToken = await this.darajaAuth.getAccessToken();

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(params.phone);

      // Get configuration
      const shortcode = process.env.MPESA_SHORTCODE || '';
      const callBackUrl =
        process.env.MPESA_CALLBACK_URL ||
        `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/mpesa/callback`;

      if (!shortcode) {
        throw new HttpException(
          'M-Pesa shortcode not configured (MPESA_SHORTCODE)',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const passkey = process.env.MPESA_PASSKEY || '';
      if (!passkey) {
        throw new HttpException(
          'M-Pesa passkey not configured (MPESA_PASSKEY)',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // Timestamp must be YYYYMMDDHHmmss in Africa/Nairobi per Daraja STK docs
      const timestamp = darajaTimestampNairobi();

      // Generate password (shortcode + passkey + timestamp, base64 encoded)
      const passwordString = `${shortcode}${passkey}${timestamp}`;
      const password = Buffer.from(passwordString).toString('base64');

      // Generate unique account reference
      const accountReference = `HP-BOOKING-${params.bookingId}`;
      const transactionDesc = `HostPulse Booking ${params.bookingId}`;

      // Prepare STK Push request
      const stkPushRequest: DarajaStkPushRequest = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(params.amount), // Round to integer (KES)
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callBackUrl,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc,
      };

      this.logger.log(
        `Initiating Daraja STK push for bookingId=${params.bookingId}, phoneTail=${this.maskPhone(formattedPhone)}, amount=${params.amount}`,
      );

      // Make STK Push request
      const response = await this.axiosInstance.post<DarajaStkPushResponse>(
        '/mpesa/stkpush/v1/processrequest',
        stkPushRequest,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.data.ResponseCode === '0') {
        this.logger.log(
          `Daraja STK push initiated successfully. MerchantRequestID: ${response.data.MerchantRequestID}, CheckoutRequestID: ${response.data.CheckoutRequestID}`,
        );

        return {
          merchantRequestId: response.data.MerchantRequestID,
          checkoutRequestId: response.data.CheckoutRequestID,
          responseCode: response.data.ResponseCode,
          responseDescription: response.data.ResponseDescription,
          customerMessage: response.data.CustomerMessage,
          txRef: response.data.CheckoutRequestID,
        };
      } else {
        throw new HttpException(
          response.data.ResponseDescription || 'Failed to initiate STK push',
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error: any) {
      this.logger.error(`Daraja STK push failed: ${error.message}`, error.stack);

      if (error.response) {
        const status = error.response.status;
        const errorMessage =
          error.response.data?.errorMessage ||
          error.response.data?.ResponseDescription ||
          'Payment initiation failed';

        throw new HttpException(
          errorMessage,
          status >= 500 ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_REQUEST,
        );
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to initiate payment. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Query STK Push transaction status
   */
  async queryStkPush(checkoutRequestId: string): Promise<DarajaStkQueryResponse> {
    try {
      const accessToken = await this.darajaAuth.getAccessToken();
      const shortcode = process.env.MPESA_SHORTCODE || '';
      const passkey = process.env.MPESA_PASSKEY || '';

      if (!shortcode || !passkey) {
        throw new HttpException(
          'M-Pesa credentials not configured (MPESA_SHORTCODE, MPESA_PASSKEY)',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const timestamp = darajaTimestampNairobi();
      const passwordString = `${shortcode}${passkey}${timestamp}`;
      const password = Buffer.from(passwordString).toString('base64');

      const response = await this.axiosInstance.post<DarajaStkQueryResponse>(
        this.queryUrl,
        {
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`STK Push query failed: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to query transaction status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify payment using transaction query
   */
  async verifyPayment(checkoutRequestId: string): Promise<any> {
    try {
      const queryResult = await this.queryStkPush(checkoutRequestId);
      return {
        resultCode: queryResult.ResultCode,
        resultDesc: queryResult.ResultDesc,
        merchantRequestId: queryResult.MerchantRequestID,
        checkoutRequestId: queryResult.CheckoutRequestID,
        responseCode: queryResult.ResponseCode,
        responseDescription: queryResult.ResponseDescription,
      };
    } catch (error: any) {
      this.logger.error(`Payment verification failed: ${error.message}`);
      throw error;
    }
  }

  normalizePhoneNumber(phone: string): string {
    return this.formatPhoneNumber(phone);
  }

  /**
   * Format phone number to Daraja format (254XXXXXXXXX)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    // If starts with +254, remove the +
    else if (cleaned.startsWith('254')) {
      // Already in correct format
    }
    // If 9 digits, assume local number
    else if (cleaned.length === 9) {
      cleaned = '254' + cleaned;
    }

    // Ensure it's exactly 12 digits (254 + 9 digits)
    if (cleaned.length !== 12 || !cleaned.startsWith('254')) {
      throw new HttpException(
        'Invalid phone number format. Please use format: +254XXXXXXXXX or 0XXXXXXXXX',
        HttpStatus.BAD_REQUEST,
      );
    }

    return cleaned;
  }

  private maskPhone(phone: string): string {
    return phone.slice(-4);
  }
}
