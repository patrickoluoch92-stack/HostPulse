import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateListingDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsIn(['hotel', 'lodge', 'resort', 'airbnb', 'tour_company'])
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  locationName?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  county?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

