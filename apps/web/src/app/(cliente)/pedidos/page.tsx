'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getUser } from '@/lib/api';
import { money, Order, OrderStatus } from '@/lib/types';

const STATUS_LABEL: Record<OrderStatus, { text: string; style: string }> = {
  CREATED: { text: 'Aguardando loja', style: 'bg-amber-100 text-amber-700' },
  ACCEPTED: { text: 'Em preparo', style: 'bg-blue-100 text-blue-700' },
  PREPARING: { text: 'Em preparo', style: 'bg-blue-100 text-blue-700' },
  READY: { text: 'Pronto', style: 'bg-indigo-100 text-indigo-700' },
  OUT_FOR_DELIVERY: { text: 'Em entrega', style: 'bg-purple-100 text-purple-700' },
  DELIVERED: { text: 'Entregue', style: 'bg-green-100 text-green-700' },
  CANCELED: { text: 'Cancelado', style: 'bg-red-100 text-red-700' },
};

interface OrderRow extends Order {
  store: Order['customer'] & { slug: string; name: string };
}

export default function PedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    if (!getUser()) {
      router.replace('/entrar?next=/pedidos');
      return;
    }
    void api<OrderRow[]>('/orders/mine').then(setOrders);
  }, [router]);

  if (!orders) return <p className="py-16 text-center text-neutral-400">Carregando…</p>;

  return (
    <main className="px-4 py-4">
      <h1 className="mb-4 text-lg font-bold">Meus pedidos</h1>
      {orders.length === 0 && (
        <p className="py-10 text-center text-neutral-400">Você ainda não fez pedidos.</p>
      )}
      <div className="space-y-3">
        {orders.map((order) => {
          const badge = STATUS_LABEL[order.status];
          return (
            <Link
              key={order.id}
              href={`/pedido/${order.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{order.store.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.style}`}>
                  {badge.text}
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                #{order.number} · {new Date(order.createdAt).toLocaleDateString('pt-BR')} ·{' '}
                {money(order.total)}
              </p>
              <p className="mt-1 truncate text-xs text-neutral-400">
                {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
