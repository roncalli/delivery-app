'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/types';
import { useStore } from '../store-context';

interface ReportRow {
  id: string;
  number: number;
  deliveredAt: string;
  paymentMethod: 'PIX' | 'CARD_ONLINE' | 'ON_DELIVERY';
  itemsSummary: string;
  subtotal: number;
  deliveryFee: number;
  commission: number;
}

interface Report {
  from: string;
  to: string;
  orders: ReportRow[];
  totals: {
    count: number;
    sales: number;
    deliveryFees: number;
    commission: number;
    net: number;
  };
}

/** Data local em AAAA-MM-DD (sem sustos de fuso do toISOString). */
function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function RelatoriosPage() {
  const { store } = useStore();
  const hoje = localDate(new Date());
  const [from, setFrom] = useState(hoje);
  const [to, setTo] = useState(hoje);
  const [report, setReport] = useState<Report | null>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (f: string, t: string) => {
      setErro('');
      setLoading(true);
      try {
        setReport(await api<Report>(`/stores/${store.id}/orders-report?from=${f}&to=${t}`));
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao gerar o relatório');
      } finally {
        setLoading(false);
      }
    },
    [store.id],
  );

  useEffect(() => {
    void load(hoje, hoje);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id]);

  function atalho(dias: number) {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - dias + 1);
    const fs = localDate(f);
    const ts = localDate(t);
    setFrom(fs);
    setTo(ts);
    void load(fs, ts);
  }

  function esteMes() {
    const now = new Date();
    const fs = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const ts = localDate(now);
    setFrom(fs);
    setTo(ts);
    void load(fs, ts);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-bold">Relatório de pedidos entregues</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
        <label className="text-sm">
          De
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Até
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <button
          onClick={() => void load(from, to)}
          disabled={loading}
          className="rounded-lg bg-rose-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Gerando…' : 'Gerar'}
        </button>
        <div className="flex gap-2 text-xs">
          <button onClick={() => atalho(1)} className="rounded-full bg-neutral-100 px-3 py-1.5">Hoje</button>
          <button onClick={() => atalho(7)} className="rounded-full bg-neutral-100 px-3 py-1.5">7 dias</button>
          <button onClick={esteMes} className="rounded-full bg-neutral-100 px-3 py-1.5">Este mês</button>
        </div>
      </div>

      {erro && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {report && (
        <>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="px-3 py-2">Entregue em</th>
                  <th>Pedido</th>
                  <th>Itens</th>
                  <th>Pagamento</th>
                  <th className="text-right">Produtos</th>
                  <th className="text-right">Entrega</th>
                  <th className="pr-3 text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((o) => (
                  <tr key={o.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2 text-neutral-500">
                      {new Date(o.deliveredAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="font-medium">#{o.number}</td>
                    <td className="max-w-56 truncate text-xs text-neutral-500">{o.itemsSummary}</td>
                    <td className="text-xs">{o.paymentMethod === 'PIX' ? '⚡ Pix' : '💵 Na entrega'}</td>
                    <td className="text-right">{money(o.subtotal)}</td>
                    <td className="text-right text-neutral-500">{money(o.deliveryFee)}</td>
                    <td className="pr-3 text-right text-red-600">−{money(o.commission)}</td>
                  </tr>
                ))}
                {report.orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-neutral-400">
                      Nenhum pedido entregue no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-bold">
              Resumo do período ({report.totals.count} pedido{report.totals.count === 1 ? '' : 's'})
            </h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Produtos vendidos</span>
                <span className="font-medium">{money(report.totals.sales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxas de entrega recebidas</span>
                <span className="font-medium">{money(report.totals.deliveryFees)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Pago à plataforma (comissão)</span>
                <span className="font-medium">−{money(report.totals.commission)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-base font-bold">
                <span>Valor líquido do lojista</span>
                <span className="text-green-700">{money(report.totals.net)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
