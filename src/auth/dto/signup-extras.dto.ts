import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const SHORT = 200;
const LONG = 500;

export class AcquisitionDto {
  @IsOptional() @IsString() @MaxLength(SHORT) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) utmTerm?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) utmContent?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) gclid?: string;
  @IsOptional() @IsString() @MaxLength(SHORT) fbclid?: string;
  @IsOptional() @IsString() @MaxLength(LONG) referrer?: string;
  @IsOptional() @IsString() @MaxLength(LONG) landingPath?: string;
  @IsOptional() @IsISO8601() firstSeenAt?: string;
}

/** Datos que acompañan a toda cuenta nueva. */
export class SignupExtrasDto {
  /**
   * Aceptación de términos y del tratamiento de datos (Ley 1581). Se guarda
   * la fecha como constancia. Las rutas de registro la exigen.
   */
  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;

  /** Autorización aparte para recibir novedades y promociones. */
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AcquisitionDto)
  acquisition?: AcquisitionDto;
}
