'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { City } from '@/lib/types';

interface AdminStore {
  id: string;
  name: string;
  slug: string;
  category: string;
  document: string;
  description: string | null;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
  commissionPct: string;
  createdAt: string;
  owner: { name: string; phone: string; email: string | null };
}

function NovaLojaForm({ onCreated }: { onCreated: () => void }) {
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({
    name: '',
    category: '',
    document: '',
    cityId: '',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    ownerPassword: '',
  });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    void api<City[]>('/cities').then((list) => {
      setCities(list);
      setForm((f) => ({ ...f, cityId: list[0]?.id ?? '' }));
    });
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Normaliza para E.164: aceita "(34) 99999-0000". */
  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setBusy(true);
    try {
      const result = await api<{ store: { name: string }; owner: { email: string } }>(
        '/admin/stores',
        {
          method: 'POST',
          body: JSON.stringify({
            store: {
              name: form.name,
              category: form.category,
              document: form.document.replace(/\D/g, ''),
              cityId: form.cityId,
            },
            ownerName: form.ownerName,
            ownerPhone: normalizePhone(form.ownerPhone),
            ownerEmail: form.ownerEmail,
            ownerPassword: form.ownerPassword || undefined,
          }),
        },
      );
      alert(
        `Loja "${result.store.name}" criada e ATIVA!\n\n` +
          `Login do lojista em /lojista/entrar:\nE-mail: ${result.owner.email}\n` +
          (form.ownerPassword ? `Senha: a que você definiu` : `Senha: a já existente do dono`),
      );
      onCreated();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar a loja');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={salvar} className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-bold">Cadastrar estabelecimento</h2>

      <p className="mb-2 text-xs font-semibold uppercase text-neutral-400">Dados da loja</p>
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <input required value={form.name} onChange={set('name')} placeholder="Nome da loja" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <input required value={form.category} onChange={set('category')} placeholder="Categoria (Pizza, Lanches…)" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <input required value={form.document} onChange={set('document')} placeholder="CNPJ ou CPF (só números)" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <select required value={form.cityId} onChange={set('cityId')} className="rounded-lg border border-neutral-300 px-2 py-2 text-sm">
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name} - {c.state}</option>
          ))}
        </select>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase text-neutral-400">
        Dono (conta de acesso ao painel do lojista)
      </p>
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <input required value={form.ownerName} onChange={set('ownerName')} placeholder="Nome do dono" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <input required value={form.ownerPhone} onChange={set('ownerPhone')} placeholder="Celular (34) 99999-0000" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <input required type="email" value={form.ownerEmail} onChange={set('ownerEmail')} placeholder="E-mail (login do painel)" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <input value={form.ownerPassword} onChange={set('ownerPassword')} placeholder="Senha inicial (se dono novo)" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
      </div>
      <p className="mb-3 text-xs text-neutral-400">
        Se o e-mail/celular já for de um lojista cadastrado, a loja é vinculada a ele (deixe a senha em branco).
      </p>

      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <button disabled={busy} className="rounded-lg bg-rose-600 px-5 py-2 font-bold text-white disabled:opacity-50">
        {busy ? 'Criando…' : 'Criar loja ativa'}
      </button>
    </form>
  );
}

function EditLojaForm({
  store,
  onClose,
  onSaved,
}: {
  store: AdminStore;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: store.name,
    category: store.category,
    document: store.document,
    description: store.description ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setBusy(true);
    try {
      await api(`/admin/stores/${store.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          document: form.document.replace(/\D/g, ''),
          description: form.description,
        }),
      });
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={salvar} className="mb-6 rounded-xl bg-white p-4 shadow-sm ring-2 ring-blue-300">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Editando: {store.name}</h2>
        <button type="button" onClick={onClose} className="text-sm text-neutral-400 underline">
          cancelar
        </button>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input required value={form.name} onChange={set('name')} placeholder="Nome da loja" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <input required value={form.category} onChange={set('category')} placeholder="Categoria" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <input required value={form.document} onChange={set('document')} placeholder="CNPJ ou CPF" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        <input value={form.description} onChange={set('description')} placeholder="Descrição (opcional)" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
      </div>
      <p className="mb-3 text-xs text-neutral-400">
        Horários, zonas de entrega e cardápio são gerenciados pelo lojista no painel dele.
        Comissão é editada clicando no % da tabela.
      </p>
      {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <button disabled={busy} className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-50">
        {busy ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </form>
  );
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
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<AdminStore | null>(null);

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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Lojas</h1>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white"
        >
          {showNew ? 'Fechar' : '+ Nova loja'}
        </button>
      </div>

      {showNew && (
        <NovaLojaForm
          onCreated={() => {
            setShowNew(false);
            void load();
          }}
        />
      )}

      {editing && (
        <EditLojaForm
          store={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

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
                  onClick={() => {
                    setEditing(store);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700"
                >
                  Editar
                </button>
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
                  <button
                    onClick={() => {
                      setEditing(store);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="mr-3 text-xs text-blue-600 underline"
                  >
                    editar
                  </button>
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
