'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { GraduationCap, LogOut, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner } from './ui';
import TermsGate from './TermsGate';

export interface VendorMe {
  profile: {
    id: string; full_name: string; email: string; school?: string; phone?: string; bio?: string;
    vendor_status: 'active' | 'suspended'; vendor_terms_version: string | null; vendor_terms_accepted_at: string | null;
    total_earnings: number; total_paid_out: number; pending_payout: number;
  };
  termsVersion: string;
  termsCurrent: boolean;
  payoutAccount: { bank_name: string; account_number: string; account_name: string } | null;
  suspensionReason: string | null;
}

const Ctx = createContext<{ me: VendorMe; reload: () => Promise<void> } | null>(null);
export const useVendor = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useVendor must be used inside VendorProvider');
  return c;
};

const TABS = [
  { href: '/vendor/dashboard', label: 'Overview' },
  { href: '/vendor/banks', label: 'My Banks' },
  { href: '/vendor/upload', label: 'Upload' },
  { href: '/vendor/sales', label: 'Sales' },
  { href: '/vendor/payouts', label: 'Payouts' },
  { href: '/vendor/settings', label: 'Settings' },
];

export default function VendorProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<VendorMe | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch('/api/vendor/me', { cache: 'no-store' });
    if (res.status === 401) { router.replace('/auth/login'); return; }
    if (res.status === 403) { router.replace('/browse'); return; }
    if (res.ok) setMe(await res.json());
  }, [router]);

  useEffect(() => { reload(); }, [reload]);

  const signOut = async () => { await supabase.auth.signOut(); router.push('/'); };

  if (!me) return <Spinner full />;

  if (me.profile.vendor_status === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-black/5 p-8 max-w-md text-center space-y-3">
          <Ban size={30} className="mx-auto text-rose-500" />
          <h1 className="text-xl font-black">Vendor account suspended</h1>
          {me.suspensionReason && <p className="text-sm text-gray-600">Reason: {me.suspensionReason}</p>}
          <p className="text-sm text-gray-500">Your listings are hidden and withdrawals are paused. Contact PastQ support to resolve this.</p>
          <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-700">Sign out</button>
        </div>
      </div>
    );
  }

  if (!me.termsCurrent) {
    return <TermsGate fullName={me.profile.full_name} renewal={!!me.profile.vendor_terms_accepted_at} onAccepted={reload} />;
  }

  return (
    <Ctx.Provider value={{ me, reload }}>
      <div className="min-h-screen bg-[#F8F8F8]">
        <nav className="bg-white border-b border-black/5 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center"><GraduationCap size={15} className="text-white" /></div>
              <span className="font-black">PastQ</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Vendor</span>
            </Link>
            <button onClick={signOut} className="p-2 text-gray-400 hover:text-gray-700" aria-label="Sign out"><LogOut size={17} /></button>
          </div>
          <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto no-scrollbar">
            {TABS.map(t => {
              const active = pathname === t.href || (t.href !== '/vendor/dashboard' && pathname.startsWith(t.href));
              return (
                <Link key={t.href} href={t.href}
                  className={`px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 ${active ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </div>
    </Ctx.Provider>
  );
}
