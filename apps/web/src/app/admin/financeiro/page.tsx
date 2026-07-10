'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/types';

interface AdminFinance {
  commissionTotal: number;
  wallets: {
    id: string;
    ownerType: 'STORE' | 'COURIER';
    ownerName: string;
    balance: number;
    pixKey: string | null;
  }[];
  recentPayouts: {
    id: string;
    ownerName: string;
    amount: number;
    pixKey: string;
    createdAt: string;
  }[];
}

export default function AdminFinanceiroPage() {
  const [data, setData] = useState<AdminFinance | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setData(await api<AdminFinance>('/admin/finance'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function repassar(wallet: AdminFinance['wallets'][0]) {
    const pixKey = window.prompt(
      `Repasse de ${money(wallet.balance)} para ${wallet.ownerName}.\n` +
        'Faça o Pix no seu banco e informe aqui a chave usada (fica registrada):',
      wallet.pixKey ?? '',
    );
    if (pixKey === null) return;
    setBusy(true);
    try {
      await api(`/admin/wallets/${wallet.id}/payout`, {
        method: 'POST',
        body: JSON.stringify({ pixKey }),
      });
      await load();
      alert('Repasse registrado — saldo zerado.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro no repasse');
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="py-10 text-center text-neutral-500">Carregando…</p>;

  const totalAPagar = data.wallets.reduce((s, w) => s + w.balance, 0);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Financeiro da plataforma</h1>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-neutral-900 p-4 text-white shadow-sm">
          <p className="text-xs text-neutral-400">Receita de comissões (total)</p>
          <p className="text-2xl font-bold">{money(data.commissionTotal)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-neutral-500">A repassar aos parceiros</p>
          <p className="text-2xl font-bold">{money(totalAPagar)}</p>
        </div>
      </div>

      <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">Saldos a repassar</h2>
        {data.wallets.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">Nenhum saldo pendente.</p>
        ) : (
          data.wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="flex items-center justify-between border-b border-neutral-100 py-2 text-sm last:border-0"
            >
              <span>
                {wallet.ownerType === 'STORE' ? '🏪' : '🛵'} <strong>{wallet.ownerName}</strong>
                {wallet.pixKey && <span className="ml-2 text-xs text-neutral-400">Pix: {wallet.pixKey}</span>}
              </span>
              <span className="flex items-center gap-3">
                <strong>{money(wallet.balance)}</strong>
                <button
                  disabled={busy}
                  onClick={() => repassar(wallet)}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  Registrar repasse
                </button>
              </span>
            </div>
          ))
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">Repasses recentes</h2>
        {data.recentPayouts.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">Nenhum repasse ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.recentPayouts.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 text-neutral-500">
                    {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td>{p.ownerName}</td>
                  <td className="text-xs text-neutral-400">{p.pixKey}</td>
                  <td className="text-right font-medium">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
