import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { BusinessFeature } from '../business-feature.enum.js';
import { PLANS, type Plan } from '../plans/plans.js';
import { BUSINESS_TYPES, type BusinessType } from '../business-type.js';
import { IsBusinessSlug } from './slug.validator.js';

export class CreateBusinessDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsBusinessSlug()
  slug: string;

  @IsOptional()
  @IsIn(BUSINESS_TYPES)
  businessType?: BusinessType;

  /** Features que se activan al crear el negocio. Se pueden cambiar después. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(BusinessFeature, { each: true })
  features?: BusinessFeature[];

  /** Avanzado y Pro empiezan con 14 días de prueba gratis. Por defecto, Básico. */
  @IsOptional()
  @IsIn(PLANS)
  plan?: Plan;

  /**
   * Solo super_admin: crea el negocio a nombre de otro usuario registrado,
   * que queda como owner. Si se omite, el owner es quien lo crea.
   */
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  ownerEmail?: string;
}
