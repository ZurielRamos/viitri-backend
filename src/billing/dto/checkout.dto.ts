import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { Plan } from '../../businesses/plans/plans.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Tipos de documento que acepta Wompi. */
export const LEGAL_ID_TYPES = ['CC', 'CE', 'NIT', 'PP', 'TI', 'OTHER'];

export class BillingDetailsDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre para la factura.' })
  @MaxLength(120)
  fullName: string;

  @Transform(trim)
  @IsEmail({}, { message: 'Revisa el correo.' })
  @MaxLength(254)
  email: string;

  @IsIn(LEGAL_ID_TYPES)
  legalIdType: string;

  @Transform(trim)
  @Matches(/^[0-9A-Za-z-]{3,20}$/, {
    message: 'Revisa el número de documento.',
  })
  legalId: string;
}

export class CheckoutDto {
  @IsIn(['advanced', 'pro'])
  plan: Exclude<Plan, 'basic'>;

  @ValidateNested()
  @Type(() => BillingDetailsDto)
  billing: BillingDetailsDto;

  /** A dónde vuelve después de pagar (la tienda). */
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(500)
  redirectUrl: string;
}
