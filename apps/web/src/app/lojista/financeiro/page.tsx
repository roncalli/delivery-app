'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Finance, money } from '@/lib/types';
import { useStore } from '../store-context';

const TYPE_LABEL: Record<string, string> = {
  SALE: 'Venda',
  COMMISSION: 'Comissão',
  DELIVERY_FEE: 'Corrida',
  PAYOUT: 'Repasse',
  ADJUSTMENT: 'Ajuste',
};

export default function FinanceiroPage() {
  const { store } = useStore();
  const [finance, setFinance] = useState<Finance | null>(null);

  useEffect(() => {
    void api<Finance>(`/stores/${store.id}/finance`).then(setFinance);
  }, [store.id]);

  if (!finance) return <p className="py-10 text-center text-neutral-500">Carregando…</p>;

  const cards = [
    { label: 'Hoje', ...finance.today },
    { label: 'Esta semana', ...finance.week },
    { label: 'Este mês', ...finance.month },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold">Financeiro</h1>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-500">{card.label}</p>
            <p className="text-lg font-bold">{money(card.total)}</p>
            <p className="text-xs text-neutral-400">
              {card.orders} pedido{card.orders === 1 ? '' : 's'} entregue{card.orders === 1 ? '' : 's'}
            </p>
          </div>
        ))}
        <div className="rounded-xl bg-neutral-800 p-4 text-white shadow-sm">
          <p className="text-xs text-neutral-300">Saldo a receber</p>
          <p className="text-lg font-bold">{money(finance.balance)}</p>
          <p className="text-xs text-neutral-400">repasse semanal via Pix</p>
        </div>
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">Extrato</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-2">Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {finance.transactions.map((t) => (
                <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 text-neutral-500">
                    {new Date(t.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className="text-neutral-500">{t.note}</td>
                  <td
                    className={`text-right font-medium ${
                      Number(t.amount) >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {money(t.amount)}
                  </td>
                </tr>
              ))}
              {finance.transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-neutral-400">
                    Nenhuma movimentação ainda — entregue o primeiro pedido!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
