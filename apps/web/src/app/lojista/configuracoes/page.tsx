'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { OpeningInterval, Store } from '@/lib/types';
import { useStore } from '../store-context';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function ConfiguracoesPage() {
  const { store, reload } = useStore();
  const [saving, setSaving] = useState(false);

  async function patch(data: Record<string, unknown>, ok = 'Salvo!') {
    setSaving(true);
    try {
      await api<Store>(`/stores/${store.id}`, { method: 'PATCH', body: JSON.stringify(data) });
      await reload();
      alert(ok);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function togglePause() {
    setSaving(true);
    try {
      await api(`/stores/${store.id}/${store.status === 'PAUSED' ? 'resume' : 'pause'}`, {
        method: 'POST',
      });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Configurações</h1>
        {(store.status === 'ACTIVE' || store.status === 'PAUSED') && (
          <button
            onClick={togglePause}
            disabled={saving}
            className={`rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50 ${
              store.status === 'PAUSED' ? 'bg-green-600' : 'bg-amber-500'
            }`}
          >
            {store.status === 'PAUSED' ? 'Reabrir loja' : 'Pausar loja'}
          </button>
        )}
      </div>

      <DadosForm store={store} saving={saving} onSave={patch} />
      <HorariosForm store={store} saving={saving} onSave={patch} />
      <ZonasSection store={store} reload={reload} />
    </div>
  );
}

function DadosForm({
  store,
  saving,
  onSave,
}: {
  store: Store;
  saving: boolean;
  onSave: (d: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: store.name,
    category: store.category,
    description: store.description ?? '',
    minOrderValue: String(store.minOrderValue),
    avgPrepMinutes: String(store.avgPrepMinutes),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-bold">Dados da loja</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Nome
          <input value={form.name} onChange={set('name')} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          Categoria
          <input value={form.category} onChange={set('category')} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="text-sm sm:col-span-2">
          Descrição
          <textarea value={form.description} onChange={set('description')} rows={2} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          Pedido mínimo (R$)
          <input value={form.minOrderValue} onChange={set('minOrderValue')} inputMode="decimal" className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="text-sm">
          Tempo médio de preparo (min)
          <input value={form.avgPrepMinutes} onChange={set('avgPrepMinutes')} inputMode="numeric" className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
      </div>
      <button
        disabled={saving}
        onClick={() =>
          void onSave({
            name: form.name,
            category: form.category,
            description: form.description,
            minOrderValue: Number(form.minOrderValue.replace(',', '.')) || 0,
            avgPrepMinutes: Number(form.avgPrepMinutes) || 30,
          })
        }
        className="mt-4 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        Salvar dados
      </button>
    </section>
  );
}

function HorariosForm({
  store,
  saving,
  onSave,
}: {
  store: Store;
  saving: boolean;
  onSave: (d: Record<string, unknown>) => Promise<void>;
}) {
  const [rows, setRows] = useState(
    DAYS.map((_, day) => {
      const interval = (store.openingHours ?? []).find((h) => h.day === day);
      return { enabled: Boolean(interval), open: interval?.open ?? '18:00', close: interval?.close ?? '23:00' };
    }),
  );

  function update(day: number, patch: Partial<(typeof rows)[0]>) {
    setRows((r) => r.map((row, i) => (i === day ? { ...row, ...patch } : row)));
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-bold">Horário de funcionamento</h2>
      <p className="mb-3 text-xs text-neutral-500">
        Fechamento menor que abertura significa que cruza a meia-noite (ex.: 18:00 às 01:00).
      </p>
      {rows.map((row, day) => (
        <div key={day} className="flex items-center gap-3 border-b border-neutral-100 py-1.5 text-sm last:border-0">
          <label className="flex w-28 items-center gap-2">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => update(day, { enabled: e.target.checked })}
            />
            {DAYS[day]}
          </label>
          <input
            type="time"
            value={row.open}
            disabled={!row.enabled}
            onChange={(e) => update(day, { open: e.target.value })}
            className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-30"
          />
          <span className="text-neutral-400">às</span>
          <input
            type="time"
            value={row.close}
            disabled={!row.enabled}
            onChange={(e) => update(day, { close: e.target.value })}
            className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-30"
          />
        </div>
      ))}
      <button
        disabled={saving}
        onClick={() => {
          const openingHours: OpeningInterval[] = rows
            .map((row, day) => ({ day, open: row.open, close: row.close, enabled: row.enabled }))
            .filter((r) => r.enabled)
            .map(({ day, open, close }) => ({ day, open, close }));
          void onSave({ openingHours }, 'Horários salvos!');
        }}
        className="mt-4 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        Salvar horários
      </button>
    </section>
  );
}

function ZonasSection({ store, reload }: { store: Store; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ type: 'NEIGHBORHOOD', neighborhood: '', radiusKm: '', fee: '', etaMinutes: '40' });
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/stores/${store.id}/delivery-zones`, {
        method: 'POST',
        body: JSON.stringify({
          type: form.type,
          neighborhood: form.type === 'NEIGHBORHOOD' ? form.neighborhood : undefined,
          radiusKm: form.type === 'RADIUS' ? Number(form.radiusKm.replace(',', '.')) : undefined,
          fee: Number(form.fee.replace(',', '.')) || 0,
          etaMinutes: Number(form.etaMinutes) || 40,
        }),
      });
      await reload();
      setForm((f) => ({ ...f, neighborhood: '', radiusKm: '', fee: '' }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-bold">Área e taxas de entrega</h2>
      <ul className="mb-3 space-y-1 text-sm">
        {store.deliveryZones.map((zone) => (
          <li key={zone.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
            <span>
              {zone.type === 'NEIGHBORHOOD' ? `Bairro ${zone.neighborhood}` : `Raio de ${zone.radiusKm} km`}
              {' — '}R$ {Number(zone.fee).toFixed(2)} · ~{zone.etaMinutes} min
            </span>
            <button
              onClick={async () => {
                await api(`/stores/delivery-zones/${zone.id}`, { method: 'DELETE' });
                await reload();
              }}
              className="text-xs text-red-500 underline"
            >
              remover
            </button>
          </li>
        ))}
        {store.deliveryZones.length === 0 && (
          <li className="text-neutral-400">Nenhuma zona — a loja não consegue receber pedidos sem área de entrega.</li>
        )}
      </ul>

      <form onSubmit={add} className="flex flex-wrap items-end gap-2 text-sm">
        <label>
          Tipo
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="mt-1 block rounded-lg border border-neutral-300 px-2 py-2"
          >
            <option value="NEIGHBORHOOD">Por bairro</option>
            <option value="RADIUS">Por raio (km)</option>
          </select>
        </label>
        {form.type === 'NEIGHBORHOOD' ? (
          <label>
            Bairro
            <input
              value={form.neighborhood}
              onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
              className="mt-1 block rounded-lg border border-neutral-300 px-2 py-2"
            />
          </label>
        ) : (
          <label>
            Raio (km)
            <input
              value={form.radiusKm}
              onChange={(e) => setForm((f) => ({ ...f, radiusKm: e.target.value }))}
              inputMode="decimal"
              className="mt-1 block w-20 rounded-lg border border-neutral-300 px-2 py-2"
            />
          </label>
        )}
        <label>
          Taxa (R$)
          <input
            value={form.fee}
            onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
            inputMode="decimal"
            className="mt-1 block w-20 rounded-lg border border-neutral-300 px-2 py-2"
          />
        </label>
        <label>
          Tempo (min)
          <input
            value={form.etaMinutes}
            onChange={(e) => setForm((f) => ({ ...f, etaMinutes: e.target.value }))}
            inputMode="numeric"
            className="mt-1 block w-20 rounded-lg border border-neutral-300 px-2 py-2"
          />
        </label>
        <button disabled={busy} className="rounded-lg bg-neutral-800 px-4 py-2 font-semibold text-white disabled:opacity-50">
          Adicionar
        </button>
      </form>
    </section>
  );
}
