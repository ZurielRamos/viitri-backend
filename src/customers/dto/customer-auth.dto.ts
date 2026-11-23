import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  E164_MESSAGE,
  E164_PATTERN,
  normalizePhone,
} from '../../common/phone.js';
import { IsOptionalNotNull } from '../../common/validation.js';

const lowerTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CustomerRegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  name: string;

  @Transform(lowerTrim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;

  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(E164_PATTERN, { message: E164_MESSAGE })
  phone?: string;
}

export class CustomerLoginDto {
  @Transform(lowerTrim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;
}

/** Lo que el cliente puede cambiar de su propia cuenta. */
export class UpdateMyCustomerDto {
  @IsOptionalNotNull()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(E164_PATTERN, { message: E164_MESSAGE })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(255)
  addressReference?: string | null;
}
