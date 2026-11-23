import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OpeningHoursRangeDto } from '../../businesses/profile/dto/update-business-profile.dto.js';
import {
  E164_MESSAGE,
  E164_PATTERN,
  normalizePhone,
} from '../../common/phone.js';
import { BookingStatus } from '../booking.enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class AvailabilityQueryDto {
  /** YYYY-MM-DD en la zona del negocio. Sin fecha: el primer día con horarios. */
  @IsOptional()
  @Matches(DATE, { message: 'date debe tener formato YYYY-MM-DD.' })
  date?: string;

  /** Solo los horarios de este profesional. */
  @IsOptional()
  @IsUUID()
  professionalId?: string;
}

export class CreateBookingDto {
  @IsUUID()
  itemId: string;

  /** Inicio exacto de uno de los horarios libres (ISO 8601). */
  @IsDateString()
  startsAt: string;

  /** Sin profesional: cualquiera que esté libre. */
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  contactName: string;

  @Transform(({ value }) => normalizePhone(value))
  @Matches(E164_PATTERN, { message: E164_MESSAGE })
  contactPhone: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 300)
  reason?: string;
}

export class ListBookingsQueryDto {
  /** Desde esta fecha (YYYY-MM-DD, zona del negocio). Por defecto, hoy. */
  @IsOptional()
  @Matches(DATE, { message: 'from debe tener formato YYYY-MM-DD.' })
  from?: string;

  /** Hasta esta fecha, incluida. Por defecto, `from` más 30 días. */
  @IsOptional()
  @Matches(DATE, { message: 'to debe tener formato YYYY-MM-DD.' })
  to?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((s) => s.trim()) : value,
  )
  @IsArray()
  @IsEnum(BookingStatus, { each: true })
  status?: BookingStatus[];

  /** Citas de un cliente (todas las fechas). */
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class UpdateBookingSettingsDto {
  @IsOptional()
  @IsIn([15, 30, 60])
  slotIntervalMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7 * 24 * 60)
  minNoticeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  maxDaysAhead?: number;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  useBusinessHours?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(6 * 60)
  reservationDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  reservationsPerSlot?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPartySize?: number;

  /** Reemplaza el horario de citas completo. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(42)
  @ValidateNested({ each: true })
  @Type(() => OpeningHoursRangeDto)
  hours?: OpeningHoursRangeDto[];
}

export class ProfessionalInputDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name: string;

  /** Servicios que hace. Vacío: todos. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TableAvailabilityQueryDto {
  @IsOptional()
  @Matches(DATE, { message: 'date debe tener formato YYYY-MM-DD.' })
  date?: string;
}

/** Reserva de mesa: fecha y hora, cuántas personas y quién reserva. */
export class CreateTableReservationDto {
  @IsDateString()
  startsAt: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  partySize: number;

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  contactName: string;

  @Transform(({ value }) => normalizePhone(value))
  @Matches(E164_PATTERN, { message: E164_MESSAGE })
  contactPhone: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
