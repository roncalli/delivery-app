'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, AuthTokens, saveSession } from '@/lib/api';

interface Props {
  title: string;
  /** Papel exigido; login com outro papel é rejeitado. */
  expectedRole: 'STORE_OWNER' | 'ADMIN';
  redirectTo: string;
}

/** Login por e-mail/senha — usado pelo painel do lojista e do admin. */
export function EmailLoginForm({ title, expectedRole, redirectTo }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const tokens = await api<AuthTokens>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (tokens.user.role !== expectedRole && tokens.user.role !== 'ADMIN') {
        setError('Esta conta não tem acesso a este painel');
        return;
      }
      saveSession(tokens);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-3"
        />
        <input
          type="password"
          required
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-neutral-300 px-4 py-3"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-rose-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
