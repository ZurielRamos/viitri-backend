import { IsString, Matches } from 'class-validator';
export class RedeemHandoffDto {
  /** 32 bytes en base64url. */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  code: string;
}
