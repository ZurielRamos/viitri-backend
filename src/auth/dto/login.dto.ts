import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;

  /**
   * Recordarme. Sin enviarlo, la sesión dura lo de siempre. Con `false` es
   * corta (un día), para equipos compartidos.
   */
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
