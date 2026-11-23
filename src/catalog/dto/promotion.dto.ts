import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class PromotionInputDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 60)
  name: string;

  @IsInt()
  @Min(1)
  @Max(90)
  percent: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days: number[];

  @Matches(HH_MM, { message: 'startTime debe tener formato HH:mm.' })
  startTime: string;

  @Matches(HH_MM, { message: 'endTime debe tener formato HH:mm.' })
  endTime: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  itemIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
