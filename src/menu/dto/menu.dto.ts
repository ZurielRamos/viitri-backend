import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_MONEY } from '../../common/money.js';
import { IsOptionalNotNull } from '../../common/validation.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DeliveryFeeTierDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(500)
  upToKm: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  fee: number;
}

export class DeliveryZoneDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 60)
  name: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  fee: number;
}
export class UpdateMenuSettingsDto {
  @IsOptionalNotNull()
  @IsBoolean()
  isAcceptingOrders?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  requireOrderAcceptance?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  dineInEnabled?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  pickupEnabled?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  deliveryEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  pickupEstimatedMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  deliveryEstimatedMinutes?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  deliveryMinOrder?: number | null;

  /** Reemplaza la lista completa. Ejemplo: [{ upToKm: 4, fee: 5000 }]. */
  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DeliveryFeeTierDto)
  deliveryFeeTiers?: DeliveryFeeTierDto[];
  @IsOptional()
  @IsIn(['to_confirm', 'fixed', 'zones'])
  deliveryFeeMode?: 'to_confirm' | 'fixed' | 'zones';
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  deliveryFixedFee?: number | null;
  /** Reemplaza la lista completa. */
  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => DeliveryZoneDto)
  deliveryZones?: DeliveryZoneDto[];
  /** A dónde transferir. Vacío o `null`: sin datos. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(300)
  transferInstructions?: string | null;
}

export class CreateTableDto {
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  zone?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity?: number | null;

  @IsOptionalNotNull()
  @IsBoolean()
  isActive?: boolean;

  @IsOptionalNotNull()
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  sortOrder?: number;
}

export class UpdateTableDto extends CreateTableDto {
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  declare name: string;
}
