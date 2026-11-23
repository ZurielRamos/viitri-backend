import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsString,
  Length,
  Matches,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import {
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
  normalizeSlug,
} from '../slug.js';

@ValidatorConstraint({ name: 'notReservedSlug' })
class NotReservedSlug implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && !RESERVED_SLUGS.has(value);
  }

  defaultMessage(): string {
    return 'El slug está reservado por la plataforma.';
  }
}

/** Normaliza y valida el formato del slug. La unicidad la valida el servicio. */
export function IsBusinessSlug() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeSlug(value) : value,
    ),
    IsString(),
    Length(SLUG_MIN_LENGTH, SLUG_MAX_LENGTH),
    Matches(SLUG_PATTERN, {
      message:
        'El slug solo puede tener minúsculas, números y guiones simples entre palabras.',
    }),
    Validate(NotReservedSlug),
  );
}
