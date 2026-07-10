'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { itemUnitPrice, useCart } from '@/lib/cart';
import { money, Product, PublicStoreDetail } from '@/lib/types';

export default function LojaPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [store, setStore] = useState<PublicStoreDetail | null>(null);
  const [erro, setErro] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    void api<PublicStoreDetail>(`/catalog/stores/${slug}`)
      .then(setStore)
      .catch(() => setErro(true));
  }, [slug]);

  if (erro) return <p className="py-16 text-center text-neutral-500">Loja não encontrada.</p>;
  if (!store) return <p className="py-16 text-center text-neutral-400">Carregando…</p>;

  return (
    <main>
      <header className="bg-white px-4 pb-4 pt-3 shadow-sm">
        <button onClick={() => router.push('/')} className="mb-2 text-sm text-neutral-500">
          ← voltar
        </button>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-2xl bg-neutral-100 text-center text-3xl leading-[64px]">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              '🍽️'
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold">{store.name}</h1>
            <p className="text-xs text-neutral-500">
              {store.ratingAvg != null && (
                <span className="font-semibold text-amber-600">
                  ★ {store.ratingAvg.toFixed(1)} ({store.ratingCount}){' '}
                </span>
              )}
              {store.category} · ~{store.avgPrepMinutes} min
            </p>
            {Number(store.minOrderValue) > 0 && (
              <p className="text-xs text-neutral-400">
                Pedido mínimo {money(store.minOrderValue)}
              </p>
            )}
          </div>
        </div>
        {!store.isOpenNow && (
          <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-center text-sm font-semibold text-neutral-600">
            Loja fechada no momento — confira os horários
          </p>
        )}
      </header>

      <div className="px-4 py-4">
        {store.menuCategories.map((cat) => (
          <section key={cat.id} className="mb-6">
            <h2 className="mb-2 font-bold">{cat.name}</h2>
            <div className="space-y-2">
              {cat.products.map((p) => (
                <button
                  key={p.id}
                  disabled={!p.available || !store.isOpenNow}
                  onClick={() => setSelected(p)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    {p.description && (
                      <p className="truncate text-xs text-neutral-500">{p.description}</p>
                    )}
                    <p className="mt-1 text-sm font-semibold text-neutral-800">{money(p.price)}</p>
                    {!p.available && (
                      <span className="text-xs font-semibold text-red-500">Esgotado</span>
                    )}
                  </div>
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selected && (
        <ProductModal store={store} product={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}

function ProductModal({
  store,
  product,
  onClose,
}: {
  store: PublicStoreDetail;
  product: Product;
  onClose: () => void;
}) {
  const router = useRouter();
  const { addItem, forceAddItem } = useCart();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [chosen, setChosen] = useState<Record<string, string[]>>({}); // groupId → optionIds

  function toggle(groupId: string, optionId: string, max: number) {
    setChosen((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (max === 1) return { ...prev, [groupId]: [optionId] }; // rádio
      if (current.length >= max) return prev; // limite atingido
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  /** Grupos com mínimo não atendido — bloqueiam o botão. */
  const pendentes = product.optionGroups.filter(
    (g) => (chosen[g.id]?.length ?? 0) < g.minSelect,
  );

  const options = useMemo(
    () =>
      product.optionGroups.flatMap((g) =>
        g.options
          .filter((o) => (chosen[g.id] ?? []).includes(o.id))
          .map((o) => ({ id: o.id, name: o.name, extraPrice: Number(o.extraPrice) })),
      ),
    [product, chosen],
  );

  const unit = itemUnitPrice({ basePrice: Number(product.price), options });

  function add() {
    const item = {
      productId: product.id,
      name: product.name,
      basePrice: Number(product.price),
      quantity: qty,
      note: note.trim() || undefined,
      options,
    };
    const storeRef = { id: store.id, slug: store.slug, name: store.name };
    if (!addItem(storeRef, item)) {
      if (
        confirm(
          `Seu carrinho tem itens de outra loja. Esvaziar e adicionar itens de ${store.name}?`,
        )
      ) {
        forceAddItem(storeRef, item);
      } else {
        return;
      }
    }
    onClose();
    router.push('/carrinho');
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="mb-3 h-44 w-full rounded-2xl object-cover" />
        )}
        <h2 className="text-lg font-bold">{product.name}</h2>
        {product.description && <p className="text-sm text-neutral-500">{product.description}</p>}

        {product.optionGroups.map((group) => (
          <fieldset key={group.id} className="mt-4">
            <legend className="flex w-full items-center justify-between text-sm font-bold">
              {group.name}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  (chosen[group.id]?.length ?? 0) < group.minSelect
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {group.minSelect > 0 ? 'OBRIGATÓRIO · ' : ''}
                {group.maxSelect === 1 ? 'escolha 1' : `até ${group.maxSelect}`}
              </span>
            </legend>
            {group.options.map((option) => {
              const marked = (chosen[group.id] ?? []).includes(option.id);
              return (
                <label
                  key={option.id}
                  className="flex items-center justify-between border-b border-neutral-100 py-2 text-sm last:border-0"
                >
                  <span>
                    {option.name}
                    {Number(option.extraPrice) > 0 && (
                      <span className="text-neutral-400"> +{money(option.extraPrice)}</span>
                    )}
                  </span>
                  <input
                    type={group.maxSelect === 1 ? 'radio' : 'checkbox'}
                    name={group.id}
                    checked={marked}
                    onChange={() => toggle(group.id, option.id, group.maxSelect)}
                    className="h-5 w-5 accent-rose-600"
                  />
                </label>
              );
            })}
          </fieldset>
        ))}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Alguma observação? (ex.: sem cebola)"
          rows={2}
          className="mt-4 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />

        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-neutral-200">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-2 text-lg">
              −
            </button>
            <span className="w-6 text-center font-semibold">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="px-4 py-2 text-lg">
              +
            </button>
          </div>
          <button
            onClick={add}
            disabled={pendentes.length > 0}
            className="flex-1 rounded-xl bg-rose-600 py-3 font-bold text-white disabled:opacity-40"
          >
            {pendentes.length > 0
              ? `Escolha: ${pendentes[0].name}`
              : `Adicionar · ${money(unit * qty)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
