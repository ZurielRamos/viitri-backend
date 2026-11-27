import { IsEmail, IsEnum, IsString, Length, MaxLength } from 'class-validator';
import { PlatformRole } from '../../users/platform-role.enum.js';

/** Alta de una persona del equipo de viitri desde el panel admin. */
export class CreateAdminUserDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;

  @IsEnum(PlatformRole)
  platformRole: PlatformRole;
}
