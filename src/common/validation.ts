import { ValidateIf } from 'class-validator';

/**
 * Como @IsOptional(), pero solo omite `undefined`. Un `null` explícito se
 * valida (y falla), para campos que se pueden omitir pero no borrar.
 */
export const IsOptionalNotNull = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);
