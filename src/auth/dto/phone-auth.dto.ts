import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SignupExtrasDto } from './signup-extras.dto.js';
import { toInternationalNumber } from '../../notifications/whatsapp/whatsapp-phone.js';

const PHONE_MESSAGE =
  'El teléfono debe tener entre 8 y 15 dígitos, con indicativo de país.';

/** Queda con `+` para que normalizarlo de nuevo no aplique la regla de Colombia. */
const toWhatsappNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? toInternationalNumber(value) : value;

export class RequestOtpDto {
  @Transform(toWhatsappNumber)
  @Matches(/^\+\d{8,15}$/, { message: PHONE_MESSAGE })
  phone: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos.' })
  code: string;
}

export class RegisterWithPhoneDto extends SignupExtrasDto {
  @IsString()
  @Length(20, 2000)
  registrationToken: string;

  @IsString()
  @Length(1, 120)
  name: string;

  /** Opcional: se pide al pagar un plan (Wompi lo exige). */
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class GoogleLoginDto {
  @IsString()
  @Length(20, 4096)
  idToken: string;

  @IsString()
  @Length(16, 128)
  nonce: string;
}

/** Verificación del WhatsApp tras entrar con Google. */
export class SocialVerifyPhoneDto extends VerifyOtpDto {
  @IsString()
  @Length(20, 4096)
  pendingToken: string;

  /** Solo se usan si al verificar se crea una cuenta nueva. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SignupExtrasDto)
  signup?: SignupExtrasDto;
}
