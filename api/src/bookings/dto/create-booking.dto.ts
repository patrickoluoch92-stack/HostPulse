import { IsDateString, IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreateBookingDto {
  @IsInt()
  @Min(1)
  propertyId!: number;

  @IsNotEmpty()
  @IsDateString()
  startDate!: string;

  @IsNotEmpty()
  @IsDateString()
  endDate!: string;

  // For now caller supplies total; in production we’ll derive from pricing engine.
  @IsInt()
  @Min(1)
  total!: number;
}

