import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ImportVariantDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(0)
  price: number;
}

export class ImportItemDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Cada producto necesita nombre.' })
  @MaxLength(160)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  /** `null`: sin precio (queda "A convenir" y oculto hasta ponerlo). */
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ImportVariantDto)
  variants?: ImportVariantDto[];
}

export class ImportCategoryDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Cada categoría necesita nombre.' })
  @MaxLength(120)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ImportItemDto)
  items: ImportItemDto[];
}

/** El borrador que el dueño revisó y confirmó. */
export class ImportMenuDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'No hay nada para agregar.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ImportCategoryDto)
  categories: ImportCategoryDto[];
}
