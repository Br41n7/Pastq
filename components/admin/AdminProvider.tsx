'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { GraduationCap, LogOut, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/vendor/ui';

export interface AdminSummary {
  openReports: number; reviewingReports: number; pendingBanks: number; liveBanks: number;
  pendingPayouts: number; processingPayouts: number; vendors: number; suspended: number; payoutsOwed: number;
}
const Ctx = createContext<{ summary: AdminSummary; refresh: () => Promise<void> } | null>(null);
export const useAdmin = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdmin must be used inside AdminProvider');
  return c;
};

export default function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [summary, setSummary] = useState<AdminSummary | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/summary', { cache: 'no-store' });
    if (res.status === 401) { router.replace('/auth/login'); return; }
    if (res.status === 403) { router.replace('/browse'); return; }
    if (res.ok) setSummary(await res.json());
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!summary) return <Spinner full />;

  const tabs = [
    { href: '/admin', label: 'Overview', n: 0 },
    { href: '/admin/reports', label: 'Reports', n: summary.openReports },
    { href: '/admin/banks', label: 'Banks', n: summary.pendingBanks },
    { href: '/admin/vendors', label: 'Vendors', n: 0 },
    { href: '/admin/payouts', label: 'Payouts', n: summary.pendingPayouts },
  ];

  return (
    <Ctx.Provider value={{ summary, refresh }}>
      <div className="min-h-screen bg-[#F8F8F8]">
        <nav className="bg-white border-b border-black/5 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center"><GraduationCap size={15} className="text-white" /></div>
              <span className="font-black">PastQ</span>
              <span className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><ShieldAlert size={11} /> Admin</span>
            </Link>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="p-2 text-gray-400 hover:text-gray-700" aria-label="Sign out"><LogOut size={17} /></button>
          </div>
          <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto no-scrollbar">
            {tabs.map(t => {
              const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} className={`px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 flex items-center gap-1.5 ${active ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                  {t.label}{t.n > 0 && <span className="bg-rose-500 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none">{t.n}</span>}
                </Link>
              );
            })}
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </div>
    </Ctx.Provider>
  );
}
