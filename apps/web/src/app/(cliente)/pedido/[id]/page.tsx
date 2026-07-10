'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { createSocket } from '@/lib/socket';
import { money, Order, OrderStatus } from '@/lib/types';

const STEPS: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'CREATED', label: 'Pedido enviado', icon: '📨' },
  { status: 'ACCEPTED', label: 'Em preparo', icon: '👨‍🍳' },
  { status: 'READY', label: 'Pronto', icon: '✅' },
  { status: 'OUT_FOR_DELIVERY', label: 'Saiu para entrega', icon: '🛵' },
  { status: 'DELIVERED', label: 'Entregue', icon: '🎉' },
];

const ORDER_OF: Record<OrderStatus, number> = {
  CREATED: 0,
  ACCEPTED: 1,
  PREPARING: 1,
  READY: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  CANCELED: -1,
};

interface OrderWithReview extends Order {
  review?: { id: string; storeRating: number } | null;
  cancelReason?: string | null;
  store: Order['customer'] & { slug: string; name: string };
}

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithReview | null>(null);

  useEffect(() => {
    void api<OrderWithReview>(`/orders/${id}`).then(setOrder);

    const socket = createSocket();
    socket.on('order:status_changed', (p: { orderId: string; status: OrderStatus }) => {
      if (p.orderId === id) {
        // refetch para pegar timestamps/review atualizados
        void api<OrderWithReview>(`/orders/${id}`).then(setOrder);
      }
    });
    socket.on('order:payment_confirmed', (p: { orderId: string }) => {
      if (p.orderId === id) void api<OrderWithReview>(`/orders/${id}`).then(setOrder);
    });
    socket.on('connect', () => void api<OrderWithReview>(`/orders/${id}`).then(setOrder));
    return () => {
      socket.close();
    };
  }, [id]);

  if (!order) return <p className="py-16 text-center text-neutral-400">Carregando…</p>;

  const current = ORDER_OF[order.status];

  return (
    <main className="px-4 py-4">
      <Link href="/pedidos" className="text-sm text-neutral-500">← meus pedidos</Link>
      <h1 className="mb-1 mt-2 text-lg font-bold">Pedido #{order.number}</h1>
      <p className="mb-4 text-sm text-neutral-500">{order.store.name}</p>

      {order.paymentMethod === 'PIX' &&
        order.paymentStatus === 'PENDING' &&
        order.status === 'CREATED' && (
          <PixBox order={order} onPaid={() => void api<OrderWithReview>(`/orders/${id}`).then(setOrder)} />
        )}
      {order.paymentMethod === 'PIX' && order.paymentStatus === 'PAID' && (
        <p className="mb-3 rounded-2xl bg-green-50 px-4 py-2 text-center text-sm font-semibold text-green-700">
          ⚡ Pagamento Pix confirmado
        </p>
      )}
      {order.paymentStatus === 'REFUNDED' && (
        <p className="mb-3 rounded-2xl bg-blue-50 px-4 py-2 text-center text-sm font-semibold text-blue-700">
          Valor estornado — o Pix volta para sua conta
        </p>
      )}

      {order.status === 'CANCELED' ? (
        <div className="rounded-2xl bg-red-50 p-4 text-center">
          <p className="text-3xl">😕</p>
          <p className="mt-1 font-bold text-red-700">Pedido cancelado</p>
          {order.cancelReason && <p className="text-sm text-red-600">{order.cancelReason}</p>}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          {STEPS.map((step, i) => (
            <div key={step.status} className="flex items-center gap-3 py-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                  i <= current ? 'bg-rose-600' : 'bg-neutral-100'
                }`}
              >
                {i <= current ? step.icon : ''}
              </span>
              <span className={i <= current ? 'font-semibold' : 'text-neutral-400'}>
                {step.label}
                {i === current && i < 4 && (
                  <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <section className="mt-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <h2 className="mb-2 font-bold">Resumo</h2>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-0.5">
            <span>
              {item.quantity}× {item.name}
              {item.options.length > 0 && (
                <span className="text-neutral-400"> · {item.options.map((o) => o.name).join(', ')}</span>
              )}
            </span>
            <span>{money(Number(item.unitPrice) * item.quantity)}</span>
          </div>
        ))}
        <div className="flex justify-between py-0.5 text-neutral-500">
          <span>Entrega</span>
          <span>{money(order.deliveryFee)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-neutral-100 pt-2 font-bold">
          <span>Total</span>
          <span>{money(order.total)}</span>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Pagamento na entrega
          {order.changeFor && ` — troco para ${money(order.changeFor)}`}
        </p>
      </section>

      {order.status === 'DELIVERED' && !order.review && <ReviewForm orderId={order.id} onDone={() => void api<OrderWithReview>(`/orders/${id}`).then(setOrder)} />}
      {order.review && (
        <p className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-center text-sm text-green-700">
          Obrigado pela avaliação! ★ {order.review.storeRating}
        </p>
      )}
    </main>
  );
}

/** Pagamento Pix pendente: copia-e-cola, countdown e (no mock) simulação. */
function PixBox({ order, onPaid }: { order: OrderWithReview; onPaid: () => void }) {
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState('');
  const isMock = order.pixCopiaECola?.includes('MOCK') ?? false;

  useEffect(() => {
    const tick = () => {
      if (!order.pixExpiresAt) return;
      const ms = new Date(order.pixExpiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setLeft('expirado');
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [order.pixExpiresAt]);

  async function copiar() {
    if (!order.pixCopiaECola) return;
    await navigator.clipboard.writeText(order.pixCopiaECola);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function simular() {
    try {
      await api(`/payments/dev/simulate/${order.id}`, { method: 'POST' });
      onPaid();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Erro ao simular');
    }
  }

  return (
    <section className="mb-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-center">
      <p className="font-bold text-emerald-800">⚡ Pague com Pix para confirmar o pedido</p>
      <p className="mt-1 text-sm text-emerald-700">
        Expira em <strong>{left}</strong> — após pagar, a confirmação é automática.
      </p>
      <div className="mt-3 max-h-20 overflow-hidden break-all rounded-lg bg-white px-3 py-2 text-left text-[10px] text-neutral-500">
        {order.pixCopiaECola}
      </div>
      <button
        onClick={copiar}
        className="mt-2 w-full rounded-xl bg-emerald-600 py-2.5 font-bold text-white"
      >
        {copied ? 'Copiado! ✓' : 'Copiar código Pix'}
      </button>
      {isMock && (
        <button
          onClick={simular}
          className="mt-2 w-full rounded-xl border border-dashed border-emerald-600 py-2 text-sm font-semibold text-emerald-700"
        >
          🧪 Simular pagamento (ambiente de testes)
        </button>
      )}
    </section>
  );
}

function ReviewForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function enviar() {
    if (!rating) return;
    setBusy(true);
    try {
      await api(`/orders/${orderId}/review`, {
        method: 'POST',
        body: JSON.stringify({ storeRating: rating, comment: comment.trim() || undefined }),
      });
      onDone();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Erro ao avaliar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-bold">Como foi seu pedido?</h2>
      <div className="mb-2 flex justify-center gap-2 text-3xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)}>
            {n <= rating ? '★' : '☆'}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentário (opcional)"
        rows={2}
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      <button
        onClick={enviar}
        disabled={busy || !rating}
        className="mt-2 w-full rounded-xl bg-rose-600 py-2.5 font-semibold text-white disabled:opacity-40"
      >
        Enviar avaliação
      </button>
    </section>
  );
}
