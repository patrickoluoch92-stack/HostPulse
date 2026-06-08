import { IsIn, IsOptional } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

export class ListPayoutsQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsIn(['pending', 'processing', 'paid', 'failed'])
  status?: 'pending' | 'processing' | 'paid' | 'failed';
}
