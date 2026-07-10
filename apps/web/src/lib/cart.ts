import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartOption {
  id: string;
  name: string;
  extraPrice: number;
}

export interface CartItem {
  key: string; // id local da linha (produto + opções podem repetir)
  productId: string;
  name: string;
  basePrice: number;
  quantity: number;
  note?: string;
  options: CartOption[];
}

interface CartState {
  storeId: string | null;
  storeSlug: string | null;
  storeName: string | null;
  items: CartItem[];
  /** Retorna false se o carrinho pertence a outra loja (chamador confirma a troca). */
  addItem: (
    store: { id: string; slug: string; name: string },
    item: Omit<CartItem, 'key'>,
  ) => boolean;
  forceAddItem: (
    store: { id: string; slug: string; name: string },
    item: Omit<CartItem, 'key'>,
  ) => void;
  updateQty: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const newKey = () => Math.random().toString(36).slice(2);

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      storeSlug: null,
      storeName: null,
      items: [],

      addItem: (store, item) => {
        const { storeId } = get();
        if (storeId && storeId !== store.id) return false; // 1 loja por carrinho
        get().forceAddItem(store, item);
        return true;
      },

      forceAddItem: (store, item) =>
        set((state) => ({
          storeId: store.id,
          storeSlug: store.slug,
          storeName: store.name,
          items:
            state.storeId === store.id
              ? [...state.items, { ...item, key: newKey() }]
              : [{ ...item, key: newKey() }],
        })),

      updateQty: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.key !== key)
              : state.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
        })),

      removeItem: (key) =>
        set((state) => ({ items: state.items.filter((i) => i.key !== key) })),

      clear: () => set({ storeId: null, storeSlug: null, storeName: null, items: [] }),
    }),
    { name: 'cart' },
  ),
);

export const itemUnitPrice = (item: Pick<CartItem, 'basePrice' | 'options'>) =>
  item.basePrice + item.options.reduce((s, o) => s + o.extraPrice, 0);

export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((s, i) => s + itemUnitPrice(i) * i.quantity, 0);
