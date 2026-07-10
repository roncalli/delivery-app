'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cartSubtotal, itemUnitPrice, useCart } from '@/lib/cart';
import { getUser } from '@/lib/api';
import { money } from '@/lib/types';

export default function CarrinhoPage() {
  const router = useRouter();
  const { items, storeName, storeSlug, updateQty, clear } = useCart();
  const subtotal = cartSubtotal(items);

  if (items.length === 0) {
    return (
      <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-5xl">🛒</span>
        <p className="text-neutral-500">Seu carrinho está vazio.</p>
        <Link href="/" className="rounded-xl bg-rose-600 px-5 py-2.5 font-semibold text-white">
          Ver lojas
        </Link>
      </main>
    );
  }

  function continuar() {
    if (!getUser()) {
      router.push('/entrar?next=/checkout');
      return;
    }
    router.push('/checkout');
  }

  return (
    <main className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Carrinho</h1>
        <button onClick={clear} className="text-xs text-red-500 underline">
          esvaziar
        </button>
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        Pedido em <Link href={`/loja/${storeSlug}`} className="font-semibold text-rose-600">{storeName}</Link>
      </p>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{item.name}</p>
                {item.options.length > 0 && (
                  <p className="text-xs text-neutral-500">
                    {item.options.map((o) => o.name).join(', ')}
                  </p>
                )}
                {item.note && <p className="text-xs text-amber-700">Obs: {item.note}</p>}
              </div>
              <p className="font-semibold">{money(itemUnitPrice(item) * item.quantity)}</p>
            </div>
            <div className="mt-2 flex items-center rounded-lg border border-neutral-200 w-fit">
              <button onClick={() => updateQty(item.key, item.quantity - 1)} className="px-3 py-1">
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
              <button onClick={() => updateQty(item.key, item.quantity + 1)} className="px-3 py-1">
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-semibold">{money(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-neutral-400">Taxa de entrega calculada no checkout</p>
      </div>

      <button
        onClick={continuar}
        className="mt-4 w-full rounded-xl bg-rose-600 py-3.5 font-bold text-white"
      >
        Continuar · {money(subtotal)}
      </button>
    </main>
  );
}
