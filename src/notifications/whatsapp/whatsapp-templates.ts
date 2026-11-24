/**
 * Plantillas de WhatsApp (Utilidad) que usa la operación. El nombre de cada
 * una viene del `.env`: sin la variable, ese aviso no se envía y lo demás
 * sigue igual. Los textos y sus variables están en docs/plantillas-whatsapp.md;
 * `header`, `body` y `urlButtons` son cuántas variables lleva cada parte, y
 * deben coincidir con la plantilla aprobada en Meta.
 */
export const WHATSAPP_TEMPLATES = {
  // Para el dueño: su plan y sus pagos.
  planPorVencer: {
    env: 'WHATSAPP_TEMPLATE_PLAN_POR_VENCER',
    header: 0,
    body: 5,
    urlButtons: 1,
  },
  planVenceHoy: {
    env: 'WHATSAPP_TEMPLATE_PLAN_VENCE_HOY',
    header: 0,
    body: 3,
    urlButtons: 1,
  },
  planUltimoDia: {
    env: 'WHATSAPP_TEMPLATE_PLAN_ULTIMO_DIA',
    header: 0,
    body: 3,
    urlButtons: 1,
  },
  planPasoABasico: {
    env: 'WHATSAPP_TEMPLATE_PLAN_PASO_A_BASICO',
    header: 0,
    body: 3,
    urlButtons: 1,
  },
  pruebaPorTerminar: {
    env: 'WHATSAPP_TEMPLATE_PRUEBA_POR_TERMINAR',
    header: 0,
    body: 5,
    urlButtons: 2,
  },
  pagoRecibido: {
    env: 'WHATSAPP_TEMPLATE_PAGO_RECIBIDO',
    header: 0,
    body: 6,
    urlButtons: 1,
  },
  pagoRechazado: {
    env: 'WHATSAPP_TEMPLATE_PAGO_RECHAZADO',
    header: 0,
    body: 3,
    urlButtons: 1,
  },
  // Para el dueño: la operación.
  negocioListo: {
    env: 'WHATSAPP_TEMPLATE_NEGOCIO_LISTO',
    header: 0,
    body: 3,
    urlButtons: 1,
  },
  pedidoNuevo: {
    env: 'WHATSAPP_TEMPLATE_PEDIDO_NUEVO',
    header: 1,
    body: 4,
    urlButtons: 1,
  },
  reservaNueva: {
    env: 'WHATSAPP_TEMPLATE_RESERVA_NUEVA',
    header: 0,
    body: 5,
    urlButtons: 1,
  },
  // Para los clientes de los negocios.
  pedidoRecibido: {
    env: 'WHATSAPP_TEMPLATE_PEDIDO_RECIBIDO',
    header: 1,
    body: 3,
    urlButtons: 1,
  },
  pedidoAceptado: {
    env: 'WHATSAPP_TEMPLATE_PEDIDO_ACEPTADO',
    header: 0,
    body: 4,
    urlButtons: 1,
  },
  pedidoListo: {
    env: 'WHATSAPP_TEMPLATE_PEDIDO_LISTO',
    header: 0,
    body: 3,
    urlButtons: 1,
  },
  pedidoEnCamino: {
    env: 'WHATSAPP_TEMPLATE_PEDIDO_EN_CAMINO',
    header: 0,
    body: 3,
    urlButtons: 1,
  },
  pedidoRechazado: {
    env: 'WHATSAPP_TEMPLATE_PEDIDO_RECHAZADO',
    header: 0,
    body: 4,
    urlButtons: 1,
  },
  reservaConfirmada: {
    env: 'WHATSAPP_TEMPLATE_RESERVA_CONFIRMADA',
    header: 0,
    body: 5,
    urlButtons: 1,
  },
  reservaRecordatorio: {
    env: 'WHATSAPP_TEMPLATE_RESERVA_RECORDATORIO',
    header: 0,
    body: 4,
    urlButtons: 1,
  },
} as const;

export type WhatsappTemplateId = keyof typeof WHATSAPP_TEMPLATES;
