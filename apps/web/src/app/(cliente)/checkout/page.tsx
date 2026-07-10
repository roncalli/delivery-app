'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, getUser } from '@/lib/api';
import { cartSubtotal, useCart } from '@/lib/cart';
import { AddressItem, City, money, PublicStoreDetail } from '@/lib/types';

type Pagamento = 'dinheiro' | 'maquininha';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, storeId, storeSlug, clear } = useCart();
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [store, setStore] = useState<PublicStoreDetail | null>(null);
  const [pagamento, setPagamento] = useState<Pagamento>('dinheiro');
  const [troco, setTroco] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const subtotal = cartSubtotal(items);

  useEffect(() => {
    if (!getUser()) {
      router.replace('/entrar?next=/checkout');
      return;
    }
    if (items.length === 0) {
      router.replace('/carrinho');
      return;
    }
    void api<AddressItem[]>('/users/me/addresses').then((list) => {
      setAddresses(list);
      setAddressId(list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null);
      if (list.length === 0) setShowNewAddress(true);
    });
    if (storeSlug) void api<PublicStoreDetail>(`/catalog/stores/${storeSlug}`).then(setStore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Estimativa da taxa (o servidor recalcula e é a palavra final). */
  const taxaEstimada = useMemo(() => {
    const addr = addresses.find((a) => a.id === addressId);
    if (!store || !addr) return null;
    const fees = store.deliveryZones
      .filter(
        (z) =>
          z.type === 'NEIGHBORHOOD' &&
          z.neighborhood?.trim().toLowerCase() === addr.neighborhood.trim().toLowerCase(),
      )
      .map((z) => Number(z.fee));
    // zonas por raio dependem de coordenadas — deixa o servidor decidir
    if (fees.length === 0 && store.deliveryZones.some((z) => z.type === 'RADIUS')) return null;
    return fees.length ? Math.min(...fees) : undefined; // undefined = fora da área (bairro)
  }, [store, addresses, addressId]);

  async function confirmar() {
    if (!addressId) {
      setErro('Escolha um endereço de entrega');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      const order = await api<{ id: string }>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          addressId,
          paymentMethod: 'ON_DELIVERY',
          changeFor:
            pagamento === 'dinheiro' && troco ? Number(troco.replace(',', '.')) : undefined,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            note: i.note,
            optionIds: i.options.map((o) => o.id),
          })),
        }),
      });
      clear();
      router.replace(`/pedido/${order.id}`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Erro ao enviar o pedido');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="px-4 py-4">
      <button onClick={() => router.push('/carrinho')} className="mb-2 text-sm text-neutral-500">
        ← voltar ao carrinho
      </button>
      <h1 className="mb-4 text-lg font-bold">Finalizar pedido</h1>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-bold">Entregar em</h2>
        {addresses.map((addr) => (
          <label key={addr.id} className="flex items-center gap-3 border-b border-neutral-100 py-2 text-sm last:border-0">
            <input
              type="radio"
              name="addr"
              checked={addressId === addr.id}
              onChange={() => setAddressId(addr.id)}
              className="h-4 w-4 accent-rose-600"
            />
            <span>
              {addr.label && <strong>{addr.label} — </strong>}
              {addr.street}, {addr.number}
              {addr.complement ? ` (${addr.complement})` : ''} · {addr.neighborhood}
            </span>
          </label>
        ))}
        {taxaEstimada === undefined && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Este endereço parece fora da área de entrega da loja.
          </p>
        )}
        <button
          onClick={() => setShowNewAddress((s) => !s)}
          className="mt-2 text-sm font-medium text-rose-600 underline"
        >
          {showNewAddress ? 'fechar' : '+ novo endereço'}
        </button>
        {showNewAddress && (
          <NovoEndereco
            onCreated={(addr) => {
              setAddresses((list) => [...list, addr]);
              setAddressId(addr.id);
              setShowNewAddress(false);
            }}
          />
        )}
      </section>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-bold">Pagamento na entrega</h2>
        <label className="flex items-center gap-3 py-1.5 text-sm">
          <input
            type="radio"
            checked={pagamento === 'dinheiro'}
            onChange={() => setPagamento('dinheiro')}
            className="h-4 w-4 accent-rose-600"
          />
          💵 Dinheiro
        </label>
        {pagamento === 'dinheiro' && (
          <input
            value={troco}
            onChange={(e) => setTroco(e.target.value)}
            placeholder="Troco para quanto? (opcional)"
            inputMode="decimal"
            className="mb-2 ml-7 w-56 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        )}
        <label className="flex items-center gap-3 py-1.5 text-sm">
          <input
            type="radio"
            checked={pagamento === 'maquininha'}
            onChange={() => setPagamento('maquininha')}
            className="h-4 w-4 accent-rose-600"
          />
          💳 Cartão na maquininha
        </label>
        <label className="flex items-center gap-3 py-1.5 text-sm text-neutral-400">
          <input type="radio" disabled className="h-4 w-4" />
          ⚡ Pix online — em breve
        </label>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <div className="flex justify-between py-0.5">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span>Entrega</span>
          <span>{taxaEstimada != null ? money(taxaEstimada) : 'calculada na confirmação'}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-neutral-100 pt-2 font-bold">
          <span>Total</span>
          <span>{taxaEstimada != null ? money(subtotal + taxaEstimada) : `${money(subtotal)} + entrega`}</span>
        </div>
      </section>

      {erro && (
        <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</p>
      )}

      <button
        onClick={confirmar}
        disabled={enviando || !addressId}
        className="w-full rounded-xl bg-rose-600 py-3.5 font-bold text-white disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : 'Confirmar pedido'}
      </button>
    </main>
  );
}

function NovoEndereco({ onCreated }: { onCreated: (addr: AddressItem) => void }) {
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({
    label: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    cityId: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
  });
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<'idle' | 'ok' | 'erro'>('idle');

  useEffect(() => {
    void api<City[]>('/cities').then((list) => {
      setCities(list);
      const saved = localStorage.getItem('cityId');
      setForm((f) => ({ ...f, cityId: saved ?? list[0]?.id ?? '' }));
    });
  }, []);

  function usarLocalizacao() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setGeo('ok');
      },
      () => setGeo('erro'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const addr = await api<AddressItem>('/users/me/addresses', {
        method: 'POST',
        body: JSON.stringify({ ...form, complement: form.complement || undefined, label: form.label || undefined }),
      });
      onCreated(addr);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erro ao salvar endereço');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={salvar} className="mt-3 space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
      <button
        type="button"
        onClick={usarLocalizacao}
        className="w-full rounded-lg border border-rose-200 bg-rose-50 py-2 font-medium text-rose-700"
      >
        📍 {geo === 'ok' ? 'Localização capturada!' : 'Usar minha localização'}
      </button>
      {geo === 'erro' && <p className="text-xs text-red-500">Não foi possível obter a localização.</p>}
      <div className="flex gap-2">
        <input required value={form.street} onChange={set('street')} placeholder="Rua" className="flex-1 rounded-lg border border-neutral-200 px-3 py-2" />
        <input required value={form.number} onChange={set('number')} placeholder="Nº" className="w-16 rounded-lg border border-neutral-200 px-3 py-2" />
      </div>
      <input required value={form.neighborhood} onChange={set('neighborhood')} placeholder="Bairro" className="w-full rounded-lg border border-neutral-200 px-3 py-2" />
      <input value={form.complement} onChange={set('complement')} placeholder="Complemento (opcional)" className="w-full rounded-lg border border-neutral-200 px-3 py-2" />
      <div className="flex gap-2">
        <select value={form.cityId} onChange={set('cityId')} className="flex-1 rounded-lg border border-neutral-200 px-2 py-2">
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name} - {c.state}</option>
          ))}
        </select>
        <input value={form.label} onChange={set('label')} placeholder="Apelido (Casa)" className="w-28 rounded-lg border border-neutral-200 px-3 py-2" />
      </div>
      <button disabled={busy} className="w-full rounded-lg bg-neutral-800 py-2 font-semibold text-white disabled:opacity-50">
        Salvar endereço
      </button>
    </form>
  );
}
