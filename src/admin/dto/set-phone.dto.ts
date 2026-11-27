import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { toInternationalNumber } from '../../notifications/whatsapp/whatsapp-phone.js';

/** El WhatsApp nuevo de una cuenta (soporte: cambió de número o perdió el celular). */
export class SetPhoneDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? toInternationalNumber(value) : value,
  )
  @Matches(/^\+\d{8,15}$/, {
    message:
      'El teléfono debe tener entre 8 y 15 dígitos, con indicativo de país.',
  })
  phone: string;
}
