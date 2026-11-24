import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  auth: string;
}

/** `PushSubscription.toJSON()` del navegador (sin `expirationTime`). */
export class PushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(1000)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

export class PushEndpointDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(1000)
  endpoint: string;
}
