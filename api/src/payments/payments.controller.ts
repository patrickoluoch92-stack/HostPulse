import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Logger,
  ForbiddenException,
  Headers,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { InitiateMpesaPaymentDto } from './dto/initiate-mpesa-payment.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('payments/mpesa')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stk-push')
  @UseGuards(AuthGuard('jwt'))
  async initiateStkPush(
    @Request() req: any,
    @Body() dto: InitiateMpesaPaymentDto,
  ) {
    return this.paymentsService.initiateStkPush(
      dto.bookingId,
      dto.phone,
      req.user?.id,
    );
  }

  @Post('webhook')
  @SkipThrottle()
  async webhook(
    @Body() body: any,
    @Headers('x-forwarded-for') forwardedFor: string,
    @Request() req: any,
  ) {
    const allowedIps = (process.env.MPESA_ALLOWED_IPS || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    if (allowedIps.length > 0) {
      const clientIp = forwardedFor?.split(',')[0]?.trim() || req.ip;
      if (!allowedIps.includes(clientIp)) {
        this.logger.warn(`Webhook rejected from unauthorized IP: ${clientIp}`);
        throw new ForbiddenException('Unauthorized');
      }
    }
    return this.paymentsService.handleWebhook(body);
  }

  @Post('b2c-result')
  @SkipThrottle()
  async b2cResult(@Body() body: any) {
    return this.paymentsService.handleB2CResult(body);
  }

  @Post('b2c-timeout')
  @SkipThrottle()
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
    @Request() req: any,
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
