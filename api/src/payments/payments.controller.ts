import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiateMpesaPaymentDto } from './dto/initiate-mpesa-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
  async webhook(@Body() body: any) {
    return this.paymentsService.handleWebhook(body);
  }

  @Post('b2c-result')
  async b2cResult(@Body() body: any) {
    return this.paymentsService.handleB2CResult(body);
  }

  @Post('b2c-timeout')
  async b2cTimeout(@Body() body: any) {
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
