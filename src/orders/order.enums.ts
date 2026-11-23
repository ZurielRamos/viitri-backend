export enum OrderType {
  /** En mesa. Se paga al mesero. */
  DineIn = 'dine_in',
  /** Para recoger en el local. */
  Pickup = 'pickup',
  /** A domicilio. El costo depende de los km de la ruta. */
  Delivery = 'delivery',
}

export enum OrderStatus {
  /** Esperando que el personal lo acepte (si el negocio lo exige). */
  Pending = 'pending',
  Accepted = 'accepted',
  Preparing = 'preparing',
  Ready = 'ready',
  /** Solo domicilios. */
  OutForDelivery = 'out_for_delivery',
  Completed = 'completed',
  /** El negocio no aceptó el pedido. */
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

/** Quién creó el pedido. */
export enum OrderSource {
  Customer = 'customer',
  Staff = 'staff',
}

export enum PaymentMethod {
  /** Efectivo. */
  Cash = 'cash',
  /** Pago en el local con otro medio (tarjeta en el datáfono, etc.). */
  InStore = 'in_store',
  /** Transferencia (Nequi, Daviplata, Bre-B, cuenta bancaria). */
  Transfer = 'transfer',
}

export enum PaymentStatus {
  Unpaid = 'unpaid',
  Paid = 'paid',
}

export const FINAL_STATUSES = [
  OrderStatus.Completed,
  OrderStatus.Rejected,
  OrderStatus.Cancelled,
];

/** Cambios de estado permitidos. Se puede saltar "preparing". */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.Pending]: [
    OrderStatus.Accepted,
    OrderStatus.Rejected,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.Accepted]: [
    OrderStatus.Preparing,
    OrderStatus.Ready,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.Preparing]: [OrderStatus.Ready, OrderStatus.Cancelled],
  [OrderStatus.Ready]: [
    OrderStatus.OutForDelivery,
    OrderStatus.Completed,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.OutForDelivery]: [OrderStatus.Completed, OrderStatus.Cancelled],
  [OrderStatus.Completed]: [],
  [OrderStatus.Rejected]: [],
  [OrderStatus.Cancelled]: [],
};
