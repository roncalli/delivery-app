'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { City, money, PublicStoreListItem } from '@/lib/types';

export default function HomePage() {
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState<string | null>(null);
  const [stores, setStores] = useState<PublicStoreListItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<City[]>('/cities').then((list) => {
      setCities(list);
      const saved = localStorage.getItem('cityId');
      setCityId(saved && list.some((c) => c.id === saved) ? saved : (list[0]?.id ?? null));
    });
  }, []);

  useEffect(() => {
    if (!cityId) return;
    localStorage.setItem('cityId', cityId);
    setLoading(true);
    void api<PublicStoreListItem[]>(`/catalog/stores?cityId=${cityId}`)
      .then(setStores)
      .finally(() => setLoading(false));
  }, [cityId]);

  const categories = useMemo(
    () => [...new Set(stores.map((s) => s.category))].sort(),
    [stores],
  );

  const filtered = stores.filter(
    (s) =>
      (!category || s.category === category) &&
      (!search || s.name.toLowerCase().includes(search.toLowerCase())),
  );
  // abertas primeiro
  const sorted = [...filtered].sort((a, b) => Number(b.isOpenNow) - Number(a.isOpenNow));

  return (
    <main>
      <header className="sticky top-0 z-20 bg-rose-600 px-4 pb-3 pt-4 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black">Delivery App</h1>
          <select
            value={cityId ?? ''}
            onChange={(e) => setCityId(e.target.value)}
            className="rounded-lg bg-rose-700 px-2 py-1 text-sm"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} - {c.state}
              </option>
            ))}
          </select>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar loja…"
          className="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400"
        />
      </header>

      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          <Chip active={!category} onClick={() => setCategory(null)}>
            Todas
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
      )}

      <div className="space-y-3 px-4 pb-4 pt-1">
        {loading && <p className="py-10 text-center text-neutral-400">Carregando lojas…</p>}
        {!loading && sorted.length === 0 && (
          <p className="py-10 text-center text-neutral-400">Nenhuma loja encontrada.</p>
        )}
        {sorted.map((store) => (
          <Link
            key={store.id}
            href={`/loja/${store.slug}`}
            className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${
              store.isOpenNow ? '' : 'opacity-50'
            }`}
          >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-100 text-center text-2xl leading-[56px]">
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                '🍽️'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{store.name}</p>
              <p className="text-xs text-neutral-500">
                {store.ratingAvg != null && (
                  <span className="font-semibold text-amber-600">★ {store.ratingAvg.toFixed(1)} </span>
                )}
                {store.category} · ~{store.avgPrepMinutes} min
                {store.minDeliveryFee != null &&
                  ` · entrega ${store.minDeliveryFee === 0 ? 'grátis' : money(store.minDeliveryFee)}`}
              </p>
            </div>
            {!store.isOpenNow && (
              <span className="rounded-full bg-neutral-200 px-2 py-1 text-[10px] font-bold text-neutral-600">
                FECHADA
              </span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
        active ? 'bg-rose-600 text-white' : 'bg-white text-neutral-600 shadow-sm'
      }`}
    >
      {children}
    </button>
  );
}
