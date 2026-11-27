import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  /** Clave → texto para guardar, o `null` para volver al valor del `.env`. */
  @IsObject()
  values: Record<string, string | null>;
}
