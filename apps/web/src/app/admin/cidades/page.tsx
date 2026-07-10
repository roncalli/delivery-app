'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AdminCity {
  id: string;
  name: string;
  state: string;
  active: boolean;
  _count: { stores: number };
}

export default function AdminCidadesPage() {
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setCities(await api<AdminCity[]>('/admin/cities'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/admin/cities', {
        method: 'POST',
        body: JSON.stringify({ name, state }),
      });
      setName('');
      setState('');
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Cidades atendidas</h1>

      <form onSubmit={adicionar} className="mb-4 flex gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da cidade"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          required
          value={state}
          onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
          placeholder="UF"
          className="w-16 rounded-lg border border-neutral-300 px-3 py-2 text-center uppercase"
        />
        <button disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          Adicionar
        </button>
      </form>

      <div className="rounded-xl bg-white shadow-sm">
        {cities.map((city) => (
          <div
            key={city.id}
            className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 text-sm last:border-0"
          >
            <span>
              <strong>{city.name}</strong> - {city.state}
              <span className="ml-2 text-xs text-neutral-400">
                {city._count.stores} loja{city._count.stores === 1 ? '' : 's'}
              </span>
            </span>
            <button
              disabled={busy}
              onClick={async () => {
                await api(`/admin/cities/${city.id}/active`, {
                  method: 'PATCH',
                  body: JSON.stringify({ active: !city.active }),
                });
                await load();
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                city.active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {city.active ? 'Ativa' : 'Inativa'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
