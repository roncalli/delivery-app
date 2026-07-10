'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError, AuthTokens, saveSession } from '@/lib/api';

/** Login do cliente: telefone → código OTP (em dev o código aparece no log da API). */
export default function EntrarPage() {
  return (
    <Suspense>
      <EntrarForm />
    </Suspense>
  );
}

function EntrarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** Normaliza para E.164 (+55...): aceita "(34) 99999-0000" etc. */
  function normalizePhone(raw: string) {
    const digits = raw.replace(/\D/g, '');
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone: normalizePhone(phone) }),
      });
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const tokens = await api<AuthTokens>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: normalizePhone(phone), code }),
      });
      saveSession(tokens);
      router.push(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-bold">Entrar</h1>

      {step === 'phone' ? (
        <form onSubmit={requestCode} className="mt-6 flex flex-col gap-3">
          <label className="text-sm text-neutral-600">
            Seu celular (com DDD) — enviaremos um código de acesso
          </label>
          <input
            type="tel"
            required
            placeholder="(34) 99999-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-neutral-300 px-4 py-3"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-rose-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Enviando…' : 'Receber código'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-6 flex flex-col gap-3">
          <label className="text-sm text-neutral-600">
            Digite o código de 6 dígitos enviado para {phone}
          </label>
          <input
            type="text"
            inputMode="numeric"
            required
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="rounded-lg bg-rose-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => setStep('phone')}
            className="text-sm text-neutral-500 underline"
          >
            Trocar número
          </button>
        </form>
      )}
    </main>
  );
}
