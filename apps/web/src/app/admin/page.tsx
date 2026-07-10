'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/types';

interface Dashboard {
  ordersToday: number;
  gmvToday: number;
  avgTicket: number;
  activeStores: number;
  pendingStores: number;
  commissionMonth: number;
  stuckOrders: {
    id: string;
    number: number;
    createdAt: string;
    store: { name: string };
    customer: { name: string; phone: string };
  }[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    const load = () => void api<Dashboard>('/admin/dashboard').then(setData);
    load();
    const timer = setInterval(load, 30_000); // atualiza a cada 30s
    return () => clearInterval(timer);
  }, []);

  if (!data) return <p className="py-10 text-center text-neutral-500">Carregando…</p>;

  const cards = [
    { label: 'Pedidos hoje', value: String(data.ordersToday) },
    { label: 'GMV hoje', value: money(data.gmvToday) },
    { label: 'Ticket médio', value: money(data.avgTicket) },
    { label: 'Lojas ativas', value: String(data.activeStores) },
    { label: 'Lojas aguardando', value: String(data.pendingStores), highlight: data.pendingStores > 0 },
    { label: 'Comissões no mês', value: money(data.commissionMonth) },
  ];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Dashboard</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl p-4 shadow-sm ${card.highlight ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-white'}`}
          >
            <p className="text-xs text-neutral-500">{card.label}</p>
            <p className="text-lg font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-bold">
          🚨 Pedidos presos (sem aceite há +5 min)
          {data.stuckOrders.length > 0 && (
            <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
              {data.stuckOrders.length}
            </span>
          )}
        </h2>
        {data.stuckOrders.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">Nenhum pedido preso 🎉</p>
        ) : (
          <ul className="space-y-2">
            {data.stuckOrders.map((order) => {
              const min = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
              return (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm ring-1 ring-red-200"
                >
                  <span>
                    <strong>#{order.number}</strong> · {order.store.name} ·{' '}
                    <span className="font-semibold text-red-700">{min} min sem resposta</span>
                  </span>
                  <a
                    href={`https://wa.me/${order.customer.phone.replace('+', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-green-700 underline"
                  >
                    WhatsApp do cliente
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
