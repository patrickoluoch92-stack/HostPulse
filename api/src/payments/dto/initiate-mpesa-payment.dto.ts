import { IsInt, IsMobilePhone, IsNotEmpty, Min } from 'class-validator';

export class InitiateMpesaPaymentDto {
  @IsInt()
  @Min(1)
  bookingId!: number;

  // We can fine-tune to 'en-KE' or custom regex for +254
  @IsNotEmpty()
  @IsMobilePhone('en-KE', {}, { message: 'Phone must be a valid Kenyan number' })
  phone!: string;
}


