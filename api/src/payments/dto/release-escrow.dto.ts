import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class ReleaseEscrowDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  releasedBy?: number;
}
