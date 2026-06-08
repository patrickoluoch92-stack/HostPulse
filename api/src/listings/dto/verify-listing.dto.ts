import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyListingDto {
  @IsBoolean()
  isVerified: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  verificationNote?: string;
}

