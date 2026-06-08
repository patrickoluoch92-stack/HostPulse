import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class FirebaseExchangeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
