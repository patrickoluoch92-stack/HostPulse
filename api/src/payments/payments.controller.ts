import {
  Body,
  Controller,
  HttpCode,
  Post,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebhookSignatureGuard } from '../auth/webhook-signature.guard';
import { IsObject, IsOptional, IsString } from 'class-validator';

class WebhookPayloadDto {
  @IsOptional()
  @IsObject()
  Body?: Record<string, unknown>;
}

class B2CCallbackDto {
  @IsOptional()
  @IsString()
  ConversationID?: string;

  @IsOptional()
  @IsString()
  OriginatorConversationID?: string;

  @IsOptional()
  @IsObject()
  Result?: Record<string, unknown>;
}

@Controller('payments/mpesa')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stk-push')
  @UseGuards(JwtAuthGuard)
  async initiateStkPush(
    @Body() body: { bookingId: number; phone: string; email?: string; name?: string },
  ) {
    return this.paymentsService.initiateStkPush(
      body.bookingId,
      body.phone,
      body.email,
      body.name,
    );
  }

  @Post('webhook')
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  async webhook(@Body() body: WebhookPayloadDto) {
    return this.paymentsService.handleWebhook(body);
  }

  @Post('b2c-result')
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  async b2cResult(@Body() body: B2CCallbackDto) {
    return this.paymentsService.handleB2CResult(body);
  }

  @Post('b2c-timeout')
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  async b2cTimeout(@Body() body: B2CCallbackDto) {
    return this.paymentsService.handleB2CTimeout(body);
  }

  @Get('verify/:paymentId')
  @UseGuards(JwtAuthGuard)
  async verifyPayment(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.paymentsService.verifyPayment(paymentId);
  }

  @Post('escrow/release/:paymentId')
  @UseGuards(JwtAuthGuard)
  async releaseEscrow(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() body: { releasedBy?: number },
  ) {
    return this.paymentsService.releaseEscrow(paymentId, body.releasedBy);
  }

  @Get('escrow/status/:paymentId')
  @UseGuards(JwtAuthGuard)
  async getEscrowStatus(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.paymentsService.getEscrowStatus(paymentId);
  }
}
