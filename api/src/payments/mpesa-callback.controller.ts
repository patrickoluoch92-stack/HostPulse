import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { MpesaWebhookGuard } from './guards/mpesa-webhook.guard';

/**
 * Optional Daraja callback URL alias: POST /api/mpesa/callback
 * Same handler as POST /api/payments/mpesa/webhook
 */
@Controller('mpesa')
export class MpesaCallbackController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('callback')
  @HttpCode(200)
  @UseGuards(MpesaWebhookGuard)
  async callback(@Body() body: unknown) {
    return this.paymentsService.handleWebhook(body);
  }

  @Post('result')
  @HttpCode(200)
  @UseGuards(MpesaWebhookGuard)
  async result(@Body() body: unknown) {
    return this.paymentsService.handleB2CResult(body);
  }

  @Post('timeout')
  @HttpCode(200)
  @UseGuards(MpesaWebhookGuard)
  async timeout(@Body() body: unknown) {
    return this.paymentsService.handleB2CTimeout(body);
  }
}
