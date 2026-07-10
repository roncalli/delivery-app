'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, uploadFile } from '@/lib/api';
import { MenuCategory, money, Product } from '@/lib/types';
import { useStore } from '../store-context';

export default function CardapioPage() {
  const { store } = useStore();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setCategories(await api<MenuCategory[]>(`/stores/${store.id}/menu-categories`));
  }, [store.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold">Cardápio</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newCategory.trim()) return;
          void run(() =>
            api(`/stores/${store.id}/menu-categories`, {
              method: 'POST',
              body: JSON.stringify({ name: newCategory.trim() }),
            }),
          ).then(() => setNewCategory(''));
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Nova categoria (ex.: Pizzas, Bebidas)"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <button disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          Adicionar
        </button>
      </form>

      {categories.map((cat) => (
        <CategorySection key={cat.id} category={cat} run={run} busy={busy} storeId={store.id} />
      ))}
      {categories.length === 0 && (
        <p className="py-10 text-center text-neutral-500">Crie a primeira categoria para montar o cardápio.</p>
      )}
    </div>
  );
}

function CategorySection({
  category,
  run,
  busy,
  storeId,
}: {
  category: MenuCategory;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
  storeId: string;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  return (
    <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{category.name}</h2>
        <button
          onClick={() => {
            if (confirm(`Excluir a categoria "${category.name}"?`))
              void run(() => api(`/menu-categories/${category.id}`, { method: 'DELETE' }));
          }}
          className="text-xs text-red-500 underline"
        >
          excluir
        </button>
      </div>

      {category.products.map((p) => (
        <ProductRow key={p.id} product={p} run={run} busy={busy} />
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = Number(price.replace(',', '.'));
          if (!name.trim() || !parsed) return;
          void run(() =>
            api(`/stores/${storeId}/products`, {
              method: 'POST',
              body: JSON.stringify({ categoryId: category.id, name: name.trim(), price: parsed }),
            }),
          ).then(() => {
            setName('');
            setPrice('');
          });
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Novo produto"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preço"
          inputMode="decimal"
          className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button disabled={busy} className="rounded-lg bg-neutral-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          +
        </button>
      </form>
    </section>
  );
}

function ProductRow({
  product,
  run,
  busy,
}: {
  product: Product;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState('');

  async function editProduct() {
    const name = window.prompt('Nome do produto:', product.name);
    if (name === null) return;
    const priceRaw = window.prompt('Preço (ex.: 25.90):', product.price);
    if (priceRaw === null) return;
    const description = window.prompt('Descrição:', product.description ?? '') ?? undefined;
    await run(() =>
      api(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, price: Number(priceRaw.replace(',', '.')), description }),
      }),
    );
  }

  async function changePhoto(file: File) {
    await run(async () => {
      const { url } = await uploadFile(file);
      await api(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ imageUrl: url }),
      });
    });
  }

  return (
    <div className="border-b border-neutral-100 py-2 last:border-0">
      <div className="flex items-center gap-3">
        <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-neutral-100 text-center text-[10px] leading-[48px] text-neutral-400">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            'foto'
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void changePhoto(e.target.files[0])}
          />
        </label>

        <div className="min-w-0 flex-1">
          <button onClick={editProduct} className="block truncate text-left font-medium hover:underline">
            {product.name}
          </button>
          <span className="text-sm text-neutral-500">{money(product.price)}</span>
          <button onClick={() => setOpen((o) => !o)} className="ml-3 text-xs text-blue-600 underline">
            complementos ({product.optionGroups.length})
          </button>
        </div>

        <button
          disabled={busy}
          onClick={() =>
            void run(() =>
              api(`/products/${product.id}/availability`, {
                method: 'PATCH',
                body: JSON.stringify({ available: !product.available }),
              }),
            )
          }
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            product.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {product.available ? 'Disponível' : 'Esgotado'}
        </button>
      </div>

      {open && (
        <div className="ml-15 mt-2 rounded-lg bg-neutral-50 p-3 text-sm">
          {product.optionGroups.map((group) => (
            <div key={group.id} className="mb-3">
              <div className="flex items-center justify-between">
                <strong>
                  {group.name}{' '}
                  <span className="font-normal text-neutral-500">
                    (mín {group.minSelect} · máx {group.maxSelect})
                  </span>
                </strong>
                <button
                  onClick={() => void run(() => api(`/option-groups/${group.id}`, { method: 'DELETE' }))}
                  className="text-xs text-red-500 underline"
                >
                  excluir grupo
                </button>
              </div>
              <ul className="mt-1">
                {group.options.map((op) => (
                  <li key={op.id} className="flex items-center justify-between py-0.5">
                    <span>
                      {op.name}
                      {Number(op.extraPrice) > 0 && (
                        <span className="text-neutral-500"> +{money(op.extraPrice)}</span>
                      )}
                    </span>
                    <button
                      onClick={() => void run(() => api(`/options/${op.id}`, { method: 'DELETE' }))}
                      className="text-xs text-red-400"
                    >
                      remover
                    </button>
                  </li>
                ))}
              </ul>
              <AddOption groupId={group.id} run={run} />
            </div>
          ))}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!groupName.trim()) return;
              const max = Number(window.prompt('Máximo de escolhas neste grupo:', '1') ?? '1');
              void run(() =>
                api(`/products/${product.id}/option-groups`, {
                  method: 'POST',
                  body: JSON.stringify({ name: groupName.trim(), minSelect: 0, maxSelect: max || 1 }),
                }),
              ).then(() => setGroupName(''));
            }}
            className="flex gap-2"
          >
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Novo grupo (ex.: Adicionais)"
              className="flex-1 rounded border border-neutral-300 px-2 py-1"
            />
            <button className="rounded bg-neutral-700 px-3 py-1 text-xs font-semibold text-white">criar</button>
          </form>
        </div>
      )}
    </div>
  );
}

function AddOption({
  groupId,
  run,
}: {
  groupId: string;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [extra, setExtra] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        void run(() =>
          api(`/option-groups/${groupId}/options`, {
            method: 'POST',
            body: JSON.stringify({
              name: name.trim(),
              extraPrice: Number(extra.replace(',', '.')) || 0,
            }),
          }),
        ).then(() => {
          setName('');
          setExtra('');
        });
      }}
      className="mt-1 flex gap-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="nova opção"
        className="flex-1 rounded border border-neutral-200 px-2 py-1 text-xs"
      />
      <input
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        placeholder="+R$"
        inputMode="decimal"
        className="w-16 rounded border border-neutral-200 px-2 py-1 text-xs"
      />
      <button className="rounded bg-neutral-500 px-2 py-1 text-xs text-white">+</button>
    </form>
  );
}
