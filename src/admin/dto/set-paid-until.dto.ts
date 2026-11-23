import { IsDateString, ValidateIf } from 'class-validator';

export class SetPaidUntilDto {
  /** Fecha ISO hasta la que está pagado el plan; `null` lo quita. */
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  paidUntil: string | null;
}
