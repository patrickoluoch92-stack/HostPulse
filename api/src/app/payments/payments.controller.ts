import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

class StkPushDto {
  bookingId: number;
  phone: string;
}

@Controller('payments/mpesa')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('stk-push')
  async stkPush(@Body() dto: StkPushDto) {
    return this.paymentsService.initiateMpesaStkPush(dto.bookingId, dto.phone);
  }
}
