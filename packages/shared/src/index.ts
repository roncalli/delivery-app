// Enums e tipos compartilhados entre API e frontend.
// Devem espelhar os enums do apps/api/prisma/schema.prisma — se mudar lá, mude aqui.

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  STORE_OWNER = 'STORE_OWNER',
  COURIER = 'COURIER',
  ADMIN = 'ADMIN',
}

export enum StoreStatus {
  PENDING = 'PENDING', // aguardando aprovação do admin
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED', // pausada pelo lojista ("fechar temporariamente")
  SUSPENDED = 'SUSPENDED', // suspensa pelo admin
}

export enum DeliveryMode {
  OWN = 'OWN', // entregadores do próprio lojista
  PLATFORM = 'PLATFORM', // frota da plataforma
  HYBRID = 'HYBRID',
}

export enum OrderStatus {
  CREATED = 'CREATED', // aguardando aceite do lojista
  ACCEPTED = 'ACCEPTED',
  PREPARING = 'PREPARING',
  READY = 'READY', // pronto para coleta/retirada
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELED = 'CANCELED',
}

/**
 * Transições válidas da máquina de estados de pedido.
 * ACCEPTED já significa "em preparo" para a UI; PREPARING é um refinamento
 * opcional — por isso ACCEPTED→READY também é permitido.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.CANCELED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELED],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELED]: [],
};

export enum PaymentMethod {
  PIX = 'PIX',
  CARD_ONLINE = 'CARD_ONLINE',
  ON_DELIVERY = 'ON_DELIVERY', // dinheiro ou maquininha na entrega
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED', // cartão pré-autorizado, captura no aceite
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum CourierStatus {
  PENDING = 'PENDING', // documentos em análise
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum DeliveryStatus {
  SEARCHING = 'SEARCHING', // procurando entregador (matching)
  ASSIGNED = 'ASSIGNED',
  PICKED_UP = 'PICKED_UP',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export enum WalletOwnerType {
  STORE = 'STORE',
  COURIER = 'COURIER',
}

export enum TransactionType {
  SALE = 'SALE', // crédito da venda para o lojista
  COMMISSION = 'COMMISSION', // débito da comissão da plataforma
  DELIVERY_FEE = 'DELIVERY_FEE', // crédito da corrida para o entregador
  PAYOUT = 'PAYOUT', // saque/repasse
  ADJUSTMENT = 'ADJUSTMENT', // ajuste manual do admin
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SETTLED = 'SETTLED',
  CANCELED = 'CANCELED',
}

export enum CouponScope {
  PLATFORM = 'PLATFORM',
  STORE = 'STORE',
}

export enum CouponType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
  FREE_DELIVERY = 'FREE_DELIVERY',
}

export enum ZoneType {
  RADIUS = 'RADIUS', // raio em km a partir da loja
  NEIGHBORHOOD = 'NEIGHBORHOOD', // taxa por bairro
}

// --- Eventos WebSocket (nome do evento → payload) ---

export const WS_EVENTS = {
  /** Emitido para a sala da loja quando entra pedido novo. */
  ORDER_CREATED: 'order:created',
  /** Emitido para cliente, loja e entregador quando o status muda. */
  ORDER_STATUS_CHANGED: 'order:status_changed',
  /** Oferta de corrida para um entregador específico (Fase 2). */
  DELIVERY_OFFER: 'delivery:offer',
  /** Posição do entregador para o cliente acompanhar (Fase 2). */
  COURIER_LOCATION: 'courier:location',
  /** Emitido para a sala do admin quando um pedido fica preso sem aceite. */
  ORDER_STUCK: 'order:stuck',
} as const;

export interface OrderStatusChangedPayload {
  orderId: string;
  status: OrderStatus;
  changedAt: string; // ISO 8601
}
