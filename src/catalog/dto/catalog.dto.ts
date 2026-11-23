import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_MONEY } from '../../common/money.js';
import {
  CategoryDisplayMode,
  ItemKind,
  PlanInterval,
  PriceType,
} from '../catalog.enums.js';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import { IsOptionalNotNull } from '../../common/validation.js';

/**
 * Las fotos las sirve la API (API_PUBLIC_URL/media); en desarrollo es
 * http://localhost:3000, sin dominio de nivel superior.
 */
const URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Decorador común para montos: >= 0 y hasta 2 decimales. */
const money = () => [
  IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }),
  Min(0),
  Max(MAX_MONEY),
];
function Money(): PropertyDecorator {
  return (target, key) => money().forEach((d) => d(target, key));
}

const sortOrder = (): PropertyDecorator => (target, key) => {
  IsInt()(target, key);
  Min(-1_000_000)(target, key);
  Max(1_000_000)(target, key);
};

// ---------- Categorías ----------

export class CreateCategoryDto {
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptionalNotNull()
  @IsEnum(CategoryDisplayMode)
  displayMode?: CategoryDisplayMode;

  /** En la barra de categorías de la tienda. Por defecto, sí. */
  @IsOptionalNotNull()
  @IsBoolean()
  showInBar?: boolean;

  /** Clave de un icono de la web, como "burger". */
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  icon?: string | null;

  @IsOptionalNotNull()
  @sortOrder()
  sortOrder?: number;

  @IsOptionalNotNull()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  declare name: string;
}

// ---------- Elementos (productos, servicios y planes) ----------

export class VariantInputDto {
  /** Si se envía, actualiza esa variante; si no, crea una nueva. */
  @IsOptional()
  @IsUUID()
  id?: string;

  /** Obligatorio cuando hay más de una: "Personal", "Talla M". */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  name?: string | null;

  @Money()
  price: number;

  /** Precio de antes, tachado. Debe ser mayor que `price`. */
  @IsOptional()
  @Money()
  compareAtPrice?: number | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(64)
  sku?: string | null;

  /** `null` o ausente = no se lleva inventario. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number | null;

  @IsOptionalNotNull()
  @IsBoolean()
  isAvailable?: boolean;
}

export class ServiceDetailsDto {
  @IsInt()
  @Min(5)
  @Max(24 * 60)
  durationMinutes: number;

  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(8 * 60)
  bufferMinutes?: number;
}

export class PlanBenefitInputDto {
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  label: string;

  /** Servicio o producto del mismo negocio que incluye el plan. */
  @IsOptional()
  @IsUUID()
  includedItemId?: string | null;

  /** Usos por cobro; `null` o ausente = ilimitado. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number | null;
}

export class PlanDetailsDto {
  @IsEnum(PlanInterval)
  interval: PlanInterval;

  @IsOptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(12)
  intervalCount?: number;

  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  /** Reemplaza la lista completa. */
  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PlanBenefitInputDto)
  benefits?: PlanBenefitInputDto[];
}

/**
 * Campos comunes de crear y editar. El precio se envía de una de dos formas:
 * `price` (una sola variante, lo normal) o `variants` (varias presentaciones).
 */
class ItemFieldsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptionalNotNull()
  @IsEnum(PriceType)
  priceType?: PriceType;

  /** Precio de la variante única. No se puede usar si hay varias. */
  @IsOptionalNotNull()
  @Money()
  price?: number;
  /** "Antes" de la variante única (se muestra tachado); `null` lo quita. Va con `price`. */
  @IsOptional()
  @Money()
  compareAtPrice?: number | null;

  /** Reemplaza la lista: las que no vienen se borran, las que traen `id` se actualizan. */
  @IsOptionalNotNull()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants?: VariantInputDto[];

  /** `null` = sin categoría. */
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl(URL_OPTIONS, {
    each: true,
    message: 'Una de las fotos no tiene un enlace válido.',
  })
  @MaxLength(2048, { each: true })
  imageUrls?: string[];

  /** Grupos de opciones en el orden en que se muestran. Reemplaza la lista. */
  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  optionGroupIds?: string[];

  /** Solo para servicios. */
  @IsOptionalNotNull()
  @ValidateNested()
  @Type(() => ServiceDetailsDto)
  service?: ServiceDetailsDto;

  /** Solo para planes. */
  @IsOptionalNotNull()
  @ValidateNested()
  @Type(() => PlanDetailsDto)
  plan?: PlanDetailsDto;

  @IsOptionalNotNull()
  @sortOrder()
  sortOrder?: number;

  @IsOptionalNotNull()
  @IsBoolean()
  isActive?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  isAvailable?: boolean;
}

export class CreateItemDto extends ItemFieldsDto {
  /** No cambia después de crearlo. Por defecto, producto. */
  @IsOptionalNotNull()
  @IsEnum(ItemKind)
  kind?: ItemKind;

  @Transform(trim)
  @IsString()
  @Length(1, 160)
  name: string;
}

export class UpdateItemDto extends ItemFieldsDto {
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  name?: string;
}

/** Nuevo orden de algunos elementos: el primero de la lista va primero. */
export class ReorderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  itemIds: string[];
}

export class ItemAvailabilityDto {
  @IsBoolean()
  isAvailable: boolean;
}

export class ListItemsQueryDto extends PaginationQueryDto {
  /** `none` = elementos sin categoría. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(36)
  categoryId?: string;

  @IsOptional()
  @IsEnum(ItemKind)
  kind?: ItemKind;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  q?: string;
}

// ---------- Grupos de opciones ----------

export class OptionInputDto {
  /** Si se envía, actualiza esa opción; si no, crea una nueva. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name: string;

  @IsOptionalNotNull()
  @Money()
  priceDelta?: number;

  /** Cuántas veces se puede elegir la misma opción. Por defecto 1. */
  @IsOptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(50)
  maxQuantity?: number;

  @IsOptionalNotNull()
  @IsBoolean()
  isAvailable?: boolean;
}

export class CreateOptionGroupDto {
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name: string;

  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(50)
  minSelect?: number;

  @IsOptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(50)
  maxSelect?: number;

  /**
   * Opciones en el orden en que se muestran. En una edición reemplaza la
   * lista: las que no vienen se borran, las que traen `id` se actualizan.
   */
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OptionInputDto)
  options: OptionInputDto[];
}

export class UpdateOptionGroupDto extends CreateOptionGroupDto {
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  declare name: string;

  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OptionInputDto)
  declare options: OptionInputDto[];
}
