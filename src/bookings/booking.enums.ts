/** Estado de una cita. */
export enum BookingStatus {
  /** Pedida por el cliente; el negocio debe confirmarla. */
  Pending = 'pending',
  Confirmed = 'confirmed',
  /** Ya se atendió. */
  Completed = 'completed',
  /** El cliente no llegó. */
  NoShow = 'no_show',
  Cancelled = 'cancelled',
}

export enum BookingSource {
  Customer = 'customer',
  Staff = 'staff',
}

/** Ocupan el horario: las demás lo liberan. */
export const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.Pending,
  BookingStatus.Confirmed,
];

/** A dónde puede pasar cada estado. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.Pending]: [BookingStatus.Confirmed, BookingStatus.Cancelled],
  [BookingStatus.Confirmed]: [
    BookingStatus.Completed,
    BookingStatus.NoShow,
    BookingStatus.Cancelled,
  ],
  [BookingStatus.Completed]: [],
  [BookingStatus.NoShow]: [],
  [BookingStatus.Cancelled]: [],
};

/** Qué se reserva: un servicio (con su duración) o una mesa (con personas). */
export enum BookingKind {
  Service = 'service',
  Table = 'table',
}
