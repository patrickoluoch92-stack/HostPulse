import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class InitiateStkPushDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  bookingId: number;

  @IsString()
  @MinLength(8)
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
