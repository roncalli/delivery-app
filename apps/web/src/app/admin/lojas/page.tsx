'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AdminStore {
  id: string;
  name: string;
  slug: string;
  category: string;
  document: string;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
  commissionPct: string;
  createdAt: string;
  owner: { name: string; phone: string; email: string | null };
}

const STATUS_STYLE: Record<AdminStore['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-neutral-200 text-neutral-600',
  SUSPENDED: 'bg-red-100 text-red-700',
};

export default function AdminLojasPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStores(await api<AdminStore[]>('/admin/stores'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function editarComissao(store: AdminStore) {
    const raw = window.prompt(
      `Comissão da plataforma para "${store.name}" (%):`,
      String(Number(store.commissionPct)),
    );
    if (raw === null) return;
    await run(() =>
      api(`/admin/stores/${store.id}/commission`, {
        method: 'PATCH',
        body: JSON.stringify({ commissionPct: Number(raw.replace(',', '.')) }),
      }),
    );
  }

  const pendentes = stores.filter((s) => s.status === 'PENDING');
  const demais = stores.filter((s) => s.status !== 'PENDING');

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Lojas</h1>

      {pendentes.length > 0 && (
        <section className="mb-6 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-300">
          <h2 className="mb-3 font-bold text-amber-800">
            Fila de aprovação ({pendentes.length})
          </h2>
          {pendentes.map((store) => (
            <div
              key={store.id}
              className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"
            >
              <div>
                <strong>{store.name}</strong> · {store.category}
                <div className="text-xs text-neutral-500">
                  Doc: {store.document} · Dono: {store.owner.name} ({store.owner.phone})
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => run(() => api(`/admin/stores/${store.id}/approve`, { method: 'POST' }))}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  Aprovar
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Rejeitar/suspender "${store.name}"?`))
                      void run(() => api(`/admin/stores/${store.id}/suspend`, { method: 'POST', body: '{}' }));
                  }}
                  className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"
                >
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-3 py-2">Loja</th>
              <th>Dono</th>
              <th>Comissão</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {demais.map((store) => (
              <tr key={store.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-3 py-2">
                  <strong>{store.name}</strong>
                  <div className="text-xs text-neutral-400">{store.category}</div>
                </td>
                <td className="text-xs">
                  {store.owner.name}
                  <div className="text-neutral-400">{store.owner.phone}</div>
                </td>
                <td>
                  <button onClick={() => editarComissao(store)} className="font-medium underline">
                    {Number(store.commissionPct)}%
                  </button>
                </td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[store.status]}`}>
                    {{ PENDING: 'Pendente', ACTIVE: 'Ativa', PAUSED: 'Pausada', SUSPENDED: 'Suspensa' }[store.status]}
                  </span>
                </td>
                <td className="pr-3 text-right">
                  {store.status === 'ACTIVE' ? (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Suspender "${store.name}"? Ela some da vitrine.`))
                          void run(() => api(`/admin/stores/${store.id}/suspend`, { method: 'POST', body: '{}' }));
                      }}
                      className="text-xs text-red-500 underline"
                    >
                      suspender
                    </button>
                  ) : store.status === 'SUSPENDED' ? (
                    <button
                      disabled={busy}
                      onClick={() => run(() => api(`/admin/stores/${store.id}/approve`, { method: 'POST' }))}
                      className="text-xs text-green-600 underline"
                    >
                      reativar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
