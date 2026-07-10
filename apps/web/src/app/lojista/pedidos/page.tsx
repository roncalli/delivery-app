'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { createSocket } from '@/lib/socket';
import { money, Order, OrderStatus } from '@/lib/types';
import { useStore } from '../store-context';

const COLUMNS: { title: string; statuses: OrderStatus[] }[] = [
  { title: 'Novos', statuses: ['CREATED'] },
  { title: 'Em preparo', statuses: ['ACCEPTED', 'PREPARING'] },
  { title: 'Prontos', statuses: ['READY'] },
  { title: 'Em entrega', statuses: ['OUT_FOR_DELIVERY'] },
];

/** Ações disponíveis por status atual. */
const ACTIONS: Partial<Record<OrderStatus, { label: string; path: string; style: string }[]>> = {
  CREATED: [
    { label: 'Aceitar', path: 'accept', style: 'bg-green-600 text-white' },
    { label: 'Recusar', path: 'cancel', style: 'bg-red-100 text-red-700' },
  ],
  ACCEPTED: [{ label: 'Pronto', path: 'ready', style: 'bg-blue-600 text-white' }],
  PREPARING: [{ label: 'Pronto', path: 'ready', style: 'bg-blue-600 text-white' }],
  READY: [
    { label: 'Saiu p/ entrega', path: 'dispatch', style: 'bg-purple-600 text-white' },
    { label: 'Entregue', path: 'deliver', style: 'bg-neutral-800 text-white' },
  ],
  OUT_FOR_DELIVERY: [{ label: 'Entregue', path: 'deliver', style: 'bg-neutral-800 text-white' }],
};

// --- Alarme sonoro (WebAudio — sem arquivo de áudio) ---
let audioCtx: AudioContext | null = null;
function beep() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {
    // navegador bloqueou áudio antes da primeira interação — silencioso
  }
}

function tempoDesde(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? 'agora' : min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60}`;
}

export default function PedidosPage() {
  const { store } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(true);
  const [muted, setMuted] = useState(false);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const load = useCallback(async () => {
    const data = await api<Order[]>(`/orders/store/${store.id}`);
    setOrders(data);
  }, [store.id]);

  // Socket: sala da loja, eventos e reconexão resiliente
  useEffect(() => {
    const socket = createSocket();
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join:store', store.id);
      void load(); // reconectou → refetch (não confiar só nos eventos)
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('order:created', (order: Order) => {
      setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
    });
    socket.on('order:status_changed', (p: { orderId: string; status: OrderStatus }) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === p.orderId ? { ...o, status: p.status } : o)),
      );
    });
    return () => {
      socket.close();
    };
  }, [store.id, load]);

  // Alarme: bipa a cada 2,5s enquanto houver pedido novo não tratado
  useEffect(() => {
    const timer = setInterval(() => {
      const hasNew = ordersRef.current.some((o) => o.status === 'CREATED');
      if (hasNew && !mutedRef.current) beep();
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  async function act(order: Order, path: string) {
    let body = {};
    if (path === 'cancel') {
      const reason = window.prompt('Motivo da recusa/cancelamento:');
      if (reason === null) return;
      body = { reason };
    }
    try {
      const updated = await api<Order>(`/orders/${order.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar o pedido');
      void load();
    }
  }

  const novos = orders.filter((o) => o.status === 'CREATED').length;

  return (
    <div>
      {!connected && (
        <div className="mb-4 rounded-lg bg-red-600 px-4 py-3 text-center font-bold text-white">
          SEM CONEXÃO — verifique a internet. Os pedidos serão atualizados quando reconectar.
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Pedidos {novos > 0 && <span className="ml-2 rounded-full bg-rose-600 px-2.5 py-0.5 text-sm text-white">{novos} novo{novos > 1 ? 's' : ''}</span>}
        </h1>
        <button
          onClick={() => setMuted((m) => !m)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        >
          {muted ? '🔇 Som desligado' : '🔔 Som ligado'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => col.statuses.includes(o.status));
          return (
            <section key={col.title} className="rounded-xl bg-neutral-200/60 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 font-semibold text-neutral-700">
                {col.title}
                <span className="text-sm text-neutral-500">{list.length}</span>
              </h2>
              <div className="flex flex-col gap-3">
                {list.map((order) => (
                  <article
                    key={order.id}
                    className={`rounded-xl bg-white p-3 shadow-sm ${
                      order.status === 'CREATED' ? 'ring-2 ring-rose-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">#{order.number}</span>
                      <span className="text-xs text-neutral-500">{tempoDesde(order.createdAt)}</span>
                    </div>

                    <ul className="mt-2 space-y-1 text-sm">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          <span className="font-medium">{item.quantity}× {item.name}</span>
                          {item.options.length > 0 && (
                            <span className="text-neutral-500"> · {item.options.map((op) => op.name).join(', ')}</span>
                          )}
                          {item.note && <div className="text-xs text-amber-700">Obs: {item.note}</div>}
                        </li>
                      ))}
                    </ul>
                    {order.customerNote && (
                      <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        “{order.customerNote}”
                      </p>
                    )}

                    <div className="mt-2 border-t border-neutral-100 pt-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total</span>
                        <span className="font-semibold">{money(order.total)}</span>
                      </div>
                      <div className="text-xs text-neutral-600">
                        {order.paymentMethod === 'ON_DELIVERY' ? 'Pagamento na entrega' : order.paymentMethod}
                        {order.changeFor && (
                          <strong className="ml-1 text-rose-700">— TROCO PARA {money(order.changeFor)}</strong>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-neutral-600">
                        {order.address.street}, {order.address.number}
                        {order.address.complement ? ` (${order.address.complement})` : ''} — {order.address.neighborhood}
                      </div>
                      <a
                        href={`https://wa.me/${order.customer.phone.replace('+', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-green-700 underline"
                      >
                        WhatsApp de {order.customer.name}
                      </a>
                    </div>

                    <div className="mt-3 flex gap-2">
                      {(ACTIONS[order.status] ?? []).map((action) => (
                        <button
                          key={action.path}
                          onClick={() => act(order, action.path)}
                          className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${action.style}`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
                {list.length === 0 && (
                  <p className="px-1 py-6 text-center text-sm text-neutral-400">vazio</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
