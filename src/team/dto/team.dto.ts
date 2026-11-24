import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** PIN de exactamente 4 dígitos. */
const PIN = /^\d{4}$/;
const PIN_MESSAGE = 'El PIN debe tener 4 números.';

export class CreateTeamProfileDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre.' })
  @MaxLength(60)
  name: string;

  @Matches(PIN, { message: PIN_MESSAGE })
  pin: string;

  /** Encargado: además puede cambiar el menú y los ajustes del negocio. */
  @IsOptional()
  @IsBoolean()
  manager?: boolean;
  /** Recibe las notificaciones push de pedidos y reservas (por defecto, sí). */
  @IsOptional()
  @IsBoolean()
  notifyOrders?: boolean;
}

export class UpdateTeamProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre.' })
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @Matches(PIN, { message: PIN_MESSAGE })
  pin?: string;

  @IsOptional()
  @IsBoolean()
  manager?: boolean;
  /** Recibe las notificaciones push de pedidos y reservas (por defecto, sí). */
  @IsOptional()
  @IsBoolean()
  notifyOrders?: boolean;
}

/** Solo el PIN: identifica a la persona dentro del negocio. */
export class TeamLoginDto {
  @Matches(PIN, { message: PIN_MESSAGE })
  pin: string;
}
