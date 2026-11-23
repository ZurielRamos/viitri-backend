import { SignupExtrasDto } from './signup-extras.dto.js';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto extends SignupExtrasDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;

  @IsString()
  @Length(1, 120)
  name: string;
}
