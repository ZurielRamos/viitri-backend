/**
 * Un tramo de horario. Un día puede tener varios tramos (por ejemplo,
 * almuerzo y cena). Si `close` es menor que `open`, el tramo termina al día
 * siguiente (por ejemplo, 20:00 a 02:00).
 */
export interface OpeningHoursRange {
  /** 0 = domingo … 6 = sábado. */
  day: number;
  /** HH:mm, 24 horas. */
  open: string;
  /** HH:mm, 24 horas. */
  close: string;
}

/** Horario de los festivos: tramos sin día, porque aplican a cualquier festivo. */
export type HolidayHoursRange = Pick<OpeningHoursRange, 'open' | 'close'>;

export interface SocialLinks {
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  x?: string;
  youtube?: string;
}
