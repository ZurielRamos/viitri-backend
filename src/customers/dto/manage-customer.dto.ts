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
import { PaginationQueryDto } from '../../common/pagination.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lowerTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** El personal crea clientes invitados (sin contraseña). */
export class CreateCustomerDto {
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name: string;

  @IsOptional()
  @Transform(lowerTrim)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(E164_PATTERN, { message: E164_MESSAGE })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

/**
 * El personal puede editar nombre, teléfono y notas. El email de una cuenta
 * registrada no se cambia desde aquí, porque es su credencial de acceso.
 */
export class UpdateCustomerDto {
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @Transform(lowerTrim)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(E164_PATTERN, { message: E164_MESSAGE })
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class ListCustomersQueryDto extends PaginationQueryDto {
  /** Busca por nombre, email o teléfono. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  q?: string;
}
