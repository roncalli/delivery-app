'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, clearSession, getUser } from '@/lib/api';
import { Store } from '@/lib/types';
import { StoreContext } from './store-context';

const NAV = [
  { href: '/lojista/pedidos', label: 'Pedidos' },
  { href: '/lojista/cardapio', label: 'Cardápio' },
  { href: '/lojista/configuracoes', label: 'Configurações' },
  { href: '/lojista/financeiro', label: 'Financeiro' },
];

export default function LojistaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoginPage = pathname === '/lojista/entrar';

  const reload = useCallback(async () => {
    const list = await api<Store[]>('/stores/mine');
    setStores(list);
    setStoreId((current) => current ?? localStorage.getItem('storeId') ?? list[0]?.id ?? null);
  }, []);

  const store = stores.find((s) => s.id === storeId) ?? stores[0] ?? null;

  useEffect(() => {
    if (isLoginPage) return;
    const user = getUser();
    if (!user || (user.role !== 'STORE_OWNER' && user.role !== 'ADMIN')) {
      router.replace('/lojista/entrar');
      return;
    }
    reload()
      .catch(() => router.replace('/lojista/entrar'))
      .finally(() => setLoading(false));
  }, [isLoginPage, reload, router]);

  if (isLoginPage) return children;

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-neutral-500">Carregando…</div>;
  }

  if (!store) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-neutral-600">
        Nenhuma loja encontrada para esta conta.
      </div>
    );
  }

  return (
    <StoreContext.Provider value={{ store, reload }}>
      <div className="min-h-dvh bg-neutral-100">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              {stores.length > 1 ? (
                <select
                  value={store.id}
                  onChange={(e) => {
                    setStoreId(e.target.value);
                    localStorage.setItem('storeId', e.target.value);
                  }}
                  className="rounded-lg border border-neutral-300 px-2 py-1 font-bold"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold">{store.name}</span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  store.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : store.status === 'PAUSED'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {{ ACTIVE: 'Aberta', PAUSED: 'Pausada', PENDING: 'Em análise', SUSPENDED: 'Suspensa' }[store.status]}
              </span>
            </div>
            <nav className="flex gap-1 overflow-x-auto">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                    pathname.startsWith(item.href)
                      ? 'bg-rose-600 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  clearSession();
                  router.replace('/lojista/entrar');
                }}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-100"
              >
                Sair
              </button>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </StoreContext.Provider>
  );
}
