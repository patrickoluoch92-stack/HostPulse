import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class GetNearbyListingsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(100)
  radius = 5;
}

