// Client HTTP da API com tokens em localStorage e refresh automático em 401.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: 'CUSTOMER' | 'STORE_OWNER' | 'COURIER' | 'ADMIN';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * As 4 frentes compartilham o mesmo domínio, mas cada uma tem sessão PRÓPRIA
 * (chaves prefixadas pela área). Assim o dono de loja pode testar o app do
 * cliente no mesmo navegador sem uma sessão atropelar a outra.
 */
function sessionScope(): string {
  if (typeof window === 'undefined') return 'cliente';
  const path = window.location.pathname;
  if (path.startsWith('/lojista')) return 'lojista';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/entregador')) return 'entregador';
  return 'cliente';
}

const storageKey = (name: string) => `${sessionScope()}:${name}`;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(storageKey('accessToken'));
}

export function saveSession(tokens: AuthTokens) {
  localStorage.setItem(storageKey('accessToken'), tokens.accessToken);
  localStorage.setItem(storageKey('refreshToken'), tokens.refreshToken);
  localStorage.setItem(storageKey('user'), JSON.stringify(tokens.user));
}

export function clearSession() {
  localStorage.removeItem(storageKey('accessToken'));
  localStorage.removeItem(storageKey('refreshToken'));
  localStorage.removeItem(storageKey('user'));
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(storageKey('user'));
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

async function rawFetch(path: string, options: RequestInit = {}) {
  const token = getAccessToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(storageKey('refreshToken'));
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearSession();
    return false;
  }
  saveSession((await res.json()) as AuthTokens);
  return true;
}

/** Upload multipart de imagem — retorna { url }. */
export async function uploadFile(file: File): Promise<{ url: string }> {
  const token = getAccessToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.message ?? 'Falha no upload');
  return body as { url: string };
}

/**
 * fetch autenticado: injeta o Bearer token e, em 401, tenta renovar a sessão
 * uma vez antes de falhar. Lança ApiError com a mensagem da API.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options);

  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await tryRefresh()) {
      res = await rawFetch(path, options);
    }
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? 'Erro de conexão');
    throw new ApiError(res.status, message);
  }
  return body as T;
}
