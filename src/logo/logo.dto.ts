import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  BUSINESS_TYPES,
  type BusinessType,
} from '../businesses/business-type.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Respuestas del cuestionario. Los ids se revisan contra las opciones al armar el prompt. */
export class GenerateLogoDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Escribe el nombre del negocio.' })
  @MaxLength(40)
  name: string;

  @IsIn(BUSINESS_TYPES)
  businessType: BusinessType;

  @IsString()
  format: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  symbols?: string[];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  symbolOther?: string;

  @IsString()
  style: string;

  @IsString()
  palette: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  personalities?: string[];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  extra?: string;
}
