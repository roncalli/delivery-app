'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useCart } from '@/lib/cart';

/** Registra o service worker do PWA. */
function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
}

const TABS = [
  { href: '/', label: 'Início', icon: '🏠' },
  { href: '/pedidos', label: 'Pedidos', icon: '📋' },
  { href: '/carrinho', label: 'Carrinho', icon: '🛒' },
];

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const count = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  useServiceWorker();

  const hideNav = pathname === '/entrar';

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-neutral-50 pb-20">
      {children}

      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-lg">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex flex-1 flex-col items-center py-2 text-xs ${
                  pathname === tab.href ? 'font-bold text-rose-600' : 'text-neutral-500'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
                {tab.href === '/carrinho' && count > 0 && (
                  <span className="absolute right-1/4 top-1 rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
