'use client';

import { createContext, useContext } from 'react';
import { Store } from '@/lib/types';

interface StoreContextValue {
  store: Store;
  reload: () => Promise<void>;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

/** Loja ativa do painel — disponível em todas as telas sob /lojista. */
export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore precisa estar dentro do layout do lojista');
  return ctx;
}
