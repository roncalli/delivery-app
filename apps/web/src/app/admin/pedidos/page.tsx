'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { createSocket } from '@/lib/socket';
import { money, OrderStatus } from '@/lib/types';

const STATUS_LABEL: Record<OrderStatus, { text: string; style: string }> = {
  CREATED: { text: 'Aguardando loja', style: 'bg-amber-100 text-amber-700' },
  ACCEPTED: { text: 'Em preparo', style: 'bg-blue-100 text-blue-700' },
  PREPARING: { text: 'Em preparo', style: 'bg-blue-100 text-blue-700' },
  READY: { text: 'Pronto', style: 'bg-indigo-100 text-indigo-700' },
  OUT_FOR_DELIVERY: { text: 'Em entrega', style: 'bg-purple-100 text-purple-700' },
  DELIVERED: { text: 'Entregue', style: 'bg-green-100 text-green-700' },
  CANCELED: { text: 'Cancelado', style: 'bg-red-100 text-red-700' },
};

interface AdminOrder {
  id: string;
  number: number;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  total: string;
  createdAt: string;
  store: { id: string; name: string };
  customer: { name: string; phone: string };
  items: { quantity: number; name: string }[];
}

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<OrderStatus | ''>('');

  const load = useCallback(async () => {
    setOrders(await api<AdminOrder[]>(`/admin/orders${filter ? `?status=${filter}` : ''}`));
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tempo real: qualquer evento de pedido → recarrega a lista
  useEffect(() => {
    const socket = createSocket();
    socket.on('order:created', () => void load());
    socket.on('order:status_changed', () => void load());
    socket.on('connect', () => void load());
    return () => {
      socket.close();
    };
  }, [load]);

  async function cancelar(order: AdminOrder) {
    const reason = window.prompt(`Motivo do cancelamento do pedido #${order.number}:`);
    if (reason === null) return;
    try {
      await api(`/orders/${order.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao cancelar');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Monitor de pedidos</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as OrderStatus | '')}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([status, s]) => (
            <option key={status} value={status}>
              {s.text}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-3 py-2">Pedido</th>
              <th>Loja</th>
              <th>Cliente</th>
              <th>Itens</th>
              <th>Pagamento</th>
              <th className="text-right">Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const badge = STATUS_LABEL[order.status];
              const aguardandoPix =
                order.paymentMethod === 'PIX' && order.paymentStatus === 'PENDING';
              return (
                <tr key={order.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-3 py-2">
                    <strong>#{order.number}</strong>
                    <div className="text-xs text-neutral-400">
                      {new Date(order.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td>{order.store.name}</td>
                  <td>
                    <a
                      href={`https://wa.me/${order.customer.phone.replace('+', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-700 underline"
                    >
                      {order.customer.name}
                    </a>
                  </td>
                  <td className="max-w-48 truncate text-xs text-neutral-500">
                    {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </td>
                  <td className="text-xs">
                    {order.paymentMethod === 'PIX' ? '⚡ Pix' : '💵 Na entrega'}
                    {aguardandoPix && (
                      <span className="ml-1 text-amber-600">(não pago)</span>
                    )}
                    {order.paymentStatus === 'REFUNDED' && (
                      <span className="ml-1 text-blue-600">(estornado)</span>
                    )}
                  </td>
                  <td className="text-right font-medium">{money(order.total)}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.style}`}>
                      {badge.text}
                    </span>
                  </td>
                  <td className="pr-3 text-right">
                    {!['DELIVERED', 'CANCELED'].includes(order.status) && (
                      <button
                        onClick={() => cancelar(order)}
                        className="text-xs text-red-500 underline"
                      >
                        cancelar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-neutral-400">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
