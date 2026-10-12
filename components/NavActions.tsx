'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, LayoutDashboard, ShieldAlert, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

export type NavUser =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; role: 'student' | 'vendor' | 'admin' };

/** Tracks the signed-in user + role (from profiles.role) and reacts to login/logout. */
export function useNavUser() {
  const router = useRouter();
  const [user, setUser] = useState<NavUser>({ status: 'loading' });

  const load = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { setUser({ status: 'out' }); return; }
    const { data: p } = await supabase.from('profiles').select('role').eq('id', u.id).maybeSingle();
    setUser({ status: 'in', role: (p?.role as any) || 'student' });
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser({ status: 'out' });
    router.push('/');
    router.refresh();
  };

  const becomeVendor = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { router.push('/auth/signup?role=vendor'); return; }
    // Students may switch themselves to vendor; the database blocks every other role change.
    const { error } = await supabase.from('profiles').update({ role: 'vendor' }).eq('id', u.id);
    if (error) { toast.error('Could not switch to a vendor account'); return; }
    setUser({ status: 'in', role: 'vendor' });
    router.push('/vendor/dashboard');
  };

  return { user, signOut, becomeVendor };
}

const linkCls = 'text-sm text-gray-500 hover:text-gray-800 whitespace-nowrap flex items-center gap-1.5';

/** Right-hand side of the top bar: changes with login state and role. */
export default function NavActions() {
  const { user, signOut, becomeVendor } = useNavUser();

  if (user.status === 'loading') return <div className="h-5 w-28 rounded-full bg-gray-100 animate-pulse" aria-hidden />;

  if (user.status === 'out') {
    return (
      <div className="flex items-center gap-3">
        <Link href="/auth/signup?role=vendor" className={linkCls}>Sell Questions</Link>
        <Link href="/auth/login" className="text-sm font-semibold text-green-600">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user.role === 'admin' && <Link href="/admin" className={linkCls}><ShieldAlert size={15} /> Admin</Link>}
      {user.role === 'vendor' && <Link href="/vendor/dashboard" className="text-sm font-semibold text-green-600 flex items-center gap-1.5 whitespace-nowrap"><LayoutDashboard size={15} /> Dashboard</Link>}
      {user.role === 'student' && <button onClick={becomeVendor} className={linkCls}><Store size={15} /> Sell Questions</button>}
      <button onClick={signOut} className="text-sm font-semibold text-gray-600 hover:text-rose-600 flex items-center gap-1.5 whitespace-nowrap" aria-label="Sign out">
        <LogOut size={15} /> <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}
