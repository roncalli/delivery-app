// Tipos das respostas da API usados pelo painel (espelham os includes do backend).

export interface Option {
  id: string;
  name: string;
  extraPrice: string;
  available: boolean;
}

export interface OptionGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: Option[];
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  available: boolean;
  optionGroups: OptionGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  active: boolean;
  products: Product[];
}

export interface DeliveryZone {
  id: string;
  type: 'RADIUS' | 'NEIGHBORHOOD';
  neighborhood: string | null;
  radiusKm: number | null;
  fee: string;
  etaMinutes: number;
}

export interface OpeningInterval {
  day: number;
  open: string;
  close: string;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
  minOrderValue: string;
  avgPrepMinutes: number;
  openingHours: OpeningInterval[];
  deliveryZones: DeliveryZone[];
}

export type OrderStatus =
  | 'CREATED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELED';

export interface OrderItemOption {
  id: string;
  name: string;
  extraPrice: string;
}

export interface OrderItem {
  id: string;
  name: string;
  unitPrice: string;
  quantity: number;
  note: string | null;
  options: OrderItemOption[];
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  paymentMethod: 'PIX' | 'CARD_ONLINE' | 'ON_DELIVERY';
  paymentStatus: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'REFUNDED' | 'FAILED';
  changeFor: string | null;
  pixCopiaECola: string | null;
  pixExpiresAt: string | null;
  subtotal: string;
  deliveryFee: string;
  total: string;
  customerNote: string | null;
  createdAt: string;
  items: OrderItem[];
  customer: { id: string; name: string; phone: string };
  address: {
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
  };
}

export interface WalletTransaction {
  id: string;
  type: 'SALE' | 'COMMISSION' | 'DELIVERY_FEE' | 'PAYOUT' | 'ADJUSTMENT';
  amount: string;
  note: string | null;
  createdAt: string;
}

export interface Finance {
  balance: number;
  pixKey: string | null;
  today: { total: number; orders: number };
  week: { total: number; orders: number };
  month: { total: number; orders: number };
  transactions: WalletTransaction[];
}

export const money = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- Vitrine pública (respostas de /catalog) ---

export interface PublicStoreListItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  minOrderValue: string;
  avgPrepMinutes: number;
  ratingAvg: number | null;
  ratingCount: number;
  isOpenNow: boolean;
  minDeliveryFee: number | null;
}

export interface PublicStoreDetail extends Omit<PublicStoreListItem, 'minDeliveryFee'> {
  status: string;
  menuCategories: MenuCategory[];
  deliveryZones: DeliveryZone[];
}

export interface City {
  id: string;
  name: string;
  state: string;
}

export interface AddressItem {
  id: string;
  label: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  cityId: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}
