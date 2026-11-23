import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MAX_MONEY } from '../../common/money.js';
import {
  E164_MESSAGE,
  E164_PATTERN,
  normalizePhone,
} from '../../common/phone.js';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import { OrderStatus, OrderType, PaymentMethod } from '../order.enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class OrderOptionInputDto {
  @IsUUID()
  optionId: string;

  /** Veces que se elige; por defecto 1. No puede pasar del máximo de la opción. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  quantity?: number;
}

export class OrderItemInputDto {
  @IsUUID()
  itemId: string;

  /** Presentación elegida. Opcional si el elemento tiene una sola. */
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  /** Opciones elegidas (preferencias y adicionales), cada una con su cantidad. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique((o: OrderOptionInputDto) => o.optionId)
  @ValidateNested({ each: true })
  @Type(() => OrderOptionInputDto)
  options?: OrderOptionInputDto[];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class DeliveryInputDto {
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  address: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  reference?: string;

  /** Barrio o zona elegida, si el negocio cobra el domicilio por zona. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  zone?: string;

  /**
   * Punto exacto de entrega (la ubicación del teléfono). Hace falta si el
   * negocio cobra el envío por distancia; si no, ayuda al domiciliario.
   */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ValidateIf((o: DeliveryInputDto) => o.latitude !== undefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

/** Productos del carrito, para revisarlos antes de elegir cómo recibirlos. */
export class PriceCartDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];
}

/** Campos comunes a cotizar y crear un pedido. */
class OrderInputBaseDto {
  @IsEnum(OrderType)
  type: OrderType;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  /** Obligatorio para domicilio. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryInputDto)
  delivery?: DeliveryInputDto;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  contactName?: string;

  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(E164_PATTERN, { message: E164_MESSAGE })
  contactPhone?: string;

  /** Efectivo o transferencia, en cualquier forma de entrega. */
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  cashChangeFor?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** En mesa sin QR ni mesa registrada: la mesa escrita ("Mesa 4"). */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  tableLabel?: string;
}

/** Pedido hecho por el cliente desde la página pública. */
export class PlaceOrderDto extends OrderInputBaseDto {
  /** Código del QR de la mesa. */
  @IsOptional()
  @IsString()
  @Length(1, 32)
  tableToken?: string;
}

/** Pedido tomado por el personal (por ejemplo, un mesero o por teléfono). */
export class StaffCreateOrderDto extends OrderInputBaseDto {
  @IsOptional()
  @IsUUID()
  tableId?: string;

  /** Cliente existente del negocio. Si no, se usan los datos de contacto. */
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  /** Para rechazar o cancelar. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class MarkOrderPaidDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}

export class ListOrdersQueryDto extends PaginationQueryDto {
  /** Uno o varios estados separados por coma: `pending,accepted`. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((s) => s.trim()) : value,
  )
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  status?: OrderStatus[];

  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  /** Pedidos de un cliente. */
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
