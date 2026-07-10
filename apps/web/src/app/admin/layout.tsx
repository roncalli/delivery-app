'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getUser } from '@/lib/api';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/lojas', label: 'Lojas' },
  { href: '/admin/financeiro', label: 'Financeiro' },
  { href: '/admin/cidades', label: 'Cidades' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const isLoginPage = pathname === '/admin/entrar';

  useEffect(() => {
    if (isLoginPage) return;
    const user = getUser();
    if (!user || user.role !== 'ADMIN') {
      router.replace('/admin/entrar');
      return;
    }
    setReady(true);
  }, [isLoginPage, router]);

  if (isLoginPage) return children;
  if (!ready) {
    return <div className="flex min-h-dvh items-center justify-center text-neutral-500">Carregando…</div>;
  }

  return (
    <div className="min-h-dvh bg-neutral-100">
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-bold">⚙️ Admin</span>
          <nav className="flex gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  pathname === item.href
                    ? 'bg-rose-600 text-white'
                    : 'text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => {
                clearSession();
                router.replace('/admin/entrar');
              }}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-800"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
