import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsEmail,
  IsISO31661Alpha2,
  IsISO4217CurrencyCode,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  E164_MESSAGE,
  E164_PATTERN,
  normalizePhone,
} from '../../../common/phone.js';
import { IsOptionalNotNull } from '../../../common/validation.js';
import {
  THEME_BACKGROUNDS,
  THEME_CORNERS,
  THEME_FONTS,
  THEME_MODES,
  type StoreTheme,
} from '../theme.js';
import {
  MAX_SPECIALTIES,
  PAYMENT_METHOD_IDS,
  SERVICE_MODE_IDS,
} from '../profile-options.js';

/** Pasos que se confirman a mano (sus valores por defecto también sirven). */
export const SETUP_CONFIRMABLE = ['payments', 'delivery', 'reservations'];

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

const URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class OpeningHoursRangeDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @IsString()
  @Matches(HH_MM, { message: 'open debe tener formato HH:mm (24 horas).' })
  open: string;

  @IsString()
  @Matches(HH_MM, { message: 'close debe tener formato HH:mm (24 horas).' })
  close: string;
}

export class HolidayHoursRangeDto {
  @IsString()
  @Matches(HH_MM, { message: 'open debe tener formato HH:mm (24 horas).' })
  open: string;

  @IsString()
  @Matches(HH_MM, { message: 'close debe tener formato HH:mm (24 horas).' })
  close: string;
}

export class StoreThemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  preset?: string;

  @Matches(/^#[0-9a-f]{6}$/i, {
    message: 'El color debe tener el formato #rrggbb.',
  })
  primary: string;

  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i, {
    message: 'El color de acento debe tener el formato #rrggbb.',
  })
  accent?: string;

  @IsIn(THEME_MODES)
  mode: StoreTheme['mode'];

  @IsIn(THEME_FONTS)
  font: StoreTheme['font'];

  @IsIn(THEME_CORNERS)
  corners: StoreTheme['corners'];

  @IsOptional()
  @IsIn(THEME_BACKGROUNDS)
  background?: StoreTheme['background'];
}

export class SocialLinksDto {
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  website?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  instagram?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  facebook?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  tiktok?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  x?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  youtube?: string;
}

/**
 * Actualización parcial del perfil:
 * - Un campo omitido no se toca.
 * - `null` borra el valor, en los campos que lo permiten.
 * - `openingHours`, `holidayHours` y `socialLinks` reemplazan el valor completo.
 */
export class UpdateBusinessProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  logoUrl?: string | null;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  coverUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(E164_PATTERN, { message: E164_MESSAGE })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(E164_PATTERN, { message: E164_MESSAGE })
  whatsapp?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  addressLine?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  city?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  region?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 20)
  postalCode?: string | null;

  /** Con un país con datos (Colombia), fija el nombre del departamento. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 10)
  regionCode?: string | null;

  /** Con un país con datos, fija el nombre del municipio. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 10)
  cityCode?: string | null;

  @IsOptional()
  @Transform(upper)
  @IsISO31661Alpha2()
  countryCode?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptionalNotNull()
  @Transform(upper)
  @IsISO4217CurrencyCode()
  currency?: string;

  @IsOptionalNotNull()
  @IsTimeZone()
  timezone?: string;

  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(42)
  @ValidateNested({ each: true })
  @Type(() => OpeningHoursRangeDto)
  openingHours?: OpeningHoursRangeDto[];

  /** Reemplaza el horario de festivos completo. Vacío: cerrado en festivos. */
  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => HolidayHoursRangeDto)
  holidayHours?: HolidayHoursRangeDto[];

  @IsOptionalNotNull()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  /** Se validan contra el tipo de negocio en el servicio. */
  @IsOptionalNotNull()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_SPECIALTIES)
  @IsString({ each: true })
  specialties?: string[];

  @IsOptionalNotNull()
  @IsArray()
  @ArrayUnique()
  @IsIn(SERVICE_MODE_IDS, { each: true })
  serviceModes?: string[];

  @IsOptionalNotNull()
  @IsArray()
  @ArrayUnique()
  @IsIn(PAYMENT_METHOD_IDS, { each: true })
  paymentMethods?: string[];

  /** Pasos confirmados de la configuración asistida (se envía la lista completa). */
  @IsOptionalNotNull()
  @IsArray()
  @ArrayUnique()
  @IsIn(SETUP_CONFIRMABLE, { each: true })
  setupConfirmed?: string[];

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  foundedYear?: number | null;

  /** Reemplaza el diseño completo de la tienda. */
  @IsOptionalNotNull()
  @IsObject()
  @ValidateNested()
  @Type(() => StoreThemeDto)
  theme?: StoreThemeDto;
}
