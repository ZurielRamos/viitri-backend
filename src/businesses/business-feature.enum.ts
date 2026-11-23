/**
 * Módulos que se activan por negocio. Un negocio puede tener varios a la vez
 * y se pueden activar o desactivar en cualquier momento. Desactivar un
 * feature lo oculta, pero no borra sus datos.
 *
 * El detalle de cada uno está en docs/alcance-features.md.
 */
export enum BusinessFeature {
  /** Menú de comidas: mesas, preferencias, adicionales y pedidos. */
  Menu = 'menu',
  /** Venta de productos con stock y envíos. */
  Ecommerce = 'ecommerce',
  /** Reservas de servicios (spa, barbería, salón de belleza). */
  Bookings = 'bookings',
  /** Cupones, descuentos, combos y happy hour. */
  Promotions = 'promotions',
  /** Puntos o tarjeta de sellos. */
  Loyalty = 'loyalty',
  /** Tarjetas de regalo con saldo. */
  GiftCards = 'gift_cards',
  /** Reseñas y calificaciones de clientes. */
  Reviews = 'reviews',
  /** Reserva de mesas en restaurantes. */
  TableReservations = 'table_reservations',
  /** Planes recurrentes con beneficios. */
  Memberships = 'memberships',
  /** Eventos con cupos o entradas. */
  Events = 'events',
  /** Fila virtual con aviso al cliente. */
  Waitlist = 'waitlist',
  /** Solicitudes de cotización. */
  Quotes = 'quotes',
}
