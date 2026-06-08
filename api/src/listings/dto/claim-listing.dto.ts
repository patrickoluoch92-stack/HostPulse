import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClaimListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

