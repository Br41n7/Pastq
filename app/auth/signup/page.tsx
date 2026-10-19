'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { homeForRole } from '@/lib/auth-redirect';
import { resolveRole } from '@/lib/resolve-role';

function SignupForm() {
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get('role') === 'vendor' ? 'vendor' : 'student';

  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: defaultRole, school: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);

    try {
      const target = form.role === 'vendor' ? '/vendor/dashboard' : '/browse';
      // The DB signup trigger reads `role` from this metadata and writes the profile,
      // so the role is correct even when no session exists yet.
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name, role: form.role, school: form.school },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
        },
      });
      if (error) throw error;

      // Email confirmation is enabled: no session yet, so nothing to redirect into.
      if (!data.session || !data.user) {
        setAwaitingConfirm(true);
        setLoading(false);
        return;
      }

      const role = await resolveRole(data.user);
      toast.success('Account created! Welcome to PastQ.');
      window.location.href = homeForRole(role);
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
      setLoading(false);
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  if (awaitingConfirm) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5 max-w-md text-center space-y-3">
          <h1 className="text-xl font-black">Check your email</h1>
          <p className="text-sm text-gray-500">
            We sent a confirmation link to <strong>{form.email}</strong>. Open it to finish setting up
            {form.role === 'vendor' ? ' your vendor account — you will land on your dashboard.' : ' your account.'}
          </p>
          <Link href="/auth/login" className="inline-block text-sm text-green-600 font-semibold">Already confirmed? Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="font-black text-xl">PastQ</span>
          </Link>
          <h1 className="text-2xl font-black">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">
            Already have an account? <Link href="/auth/login" className="text-green-600 font-semibold">Sign in</Link>
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
          {/* Role toggle */}
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
            {(['student', 'vendor'] as const).map(r => (
              <button key={r} type="button" onClick={() => setForm(p => ({ ...p, role: r }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${form.role === r ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {r === 'student' ? '🎓 Student' : '📦 Vendor'}
              </button>
            ))}
          </div>

          {form.role === 'vendor' && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-5 text-sm text-green-700">
              <strong>Vendors earn 70%</strong> on every sale. Upload once, earn forever.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold block mb-1">Full Name</label>
              <input value={form.full_name} onChange={set('full_name')} required placeholder="Your full name"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1">Email</label>
              <input type="email" value={form.email} onChange={set('email')} required placeholder="you@gmail.com"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1">School / Institution</label>
              <input value={form.school} onChange={set('school')} placeholder="e.g. UNILAG, Abeokuta Grammar School"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm" />
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required
                  placeholder="Min. 8 characters" minLength={8}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm pr-12" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            By signing up you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>;
}
