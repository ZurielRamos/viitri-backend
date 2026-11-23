import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RequestOtpDto } from './phone-auth.dto.js';

function parse(phone: unknown) {
  const dto = plainToInstance(RequestOtpDto, { phone });
  return { phone: dto.phone, errors: validateSync(dto).length };
}

describe('RequestOtpDto', () => {
  it.each([
    ['3001234567', '+573001234567'],
    ['573001234567', '+573001234567'],
    ['+57 300 123 4567', '+573001234567'],
    ['+372 5123 456', '+3725123456'],
    ['+1 (415) 555-2671', '+14155552671'],
  ])('%s → %s', (input, expected) => {
    expect(parse(input)).toEqual({ phone: expected, errors: 0 });
  });

  it.each(['123', '+1234567', 'abc', '', 12345678])('rechaza %j', (input) => {
    expect(parse(input).errors).toBeGreaterThan(0);
  });
});
