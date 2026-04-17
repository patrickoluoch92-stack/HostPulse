import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiateMpesaPaymentDto } from './dto/initiate-mpesa-payment.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('payments/mpesa')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stk-push')
  @UseGuards(AuthGuard('jwt'))
  async initiateStkPush(
    @Request() req,
    @Body() dto: InitiateMpesaPaymentDto,
  ) {
    return this.paymentsService.initiateStkPush(
      dto.bookingId,
      dto.phone,
      req.user?.id,
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
  @UseGuards(AuthGuard('jwt'))
  async verifyPayment(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.paymentsService.verifyPayment(paymentId);
  }

  @Post('escrow/release/:paymentId')
  @UseGuards(AuthGuard('jwt'))
  async releaseEscrow(
    @Request() req,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.paymentsService.releaseEscrow(paymentId, req.user?.id);
  }

  @Get('escrow/status/:paymentId')
  @UseGuards(AuthGuard('jwt'))
  async getEscrowStatus(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.paymentsService.getEscrowStatus(paymentId);
  }
}
