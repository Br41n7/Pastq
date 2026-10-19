'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { GraduationCap, ShieldCheck, TrendingUp, CheckCircle2, ArrowLeft, Loader2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorApplyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?next=/vendor/apply');
        return;
      }
      setUser(user);

      // The server is the source of truth for the role (browser reads of `profiles` can be empty).
      const res = await fetch('/api/vendor/me', { cache: 'no-store' });
      if (res.ok) { router.replace('/vendor/dashboard'); return; }
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === 'Admin access required') { router.replace('/admin'); return; }
      }
      setLoading(false);
    }
    checkAuth();
  }, [router]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.error('Please agree to the Vendor Terms & Policy to continue');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'vendor' })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Vendor access granted! Welcome to the PastQ Vendor Dashboard.');
      window.location.href = '/vendor/dashboard';
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile to vendor');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F8F8]">
        <Loader2 size={28} className="animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/browse" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Back to Browse
        </Link>

        {/* Header */}
        <div className="bg-white rounded-3xl p-8 border border-black/5 text-center space-y-3">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto text-green-600 mb-2">
            <GraduationCap size={24} />
          </div>
          <h1 className="text-2xl font-black">Become a PastQ Vendor</h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Turn your compiled past questions into recurring income. Sell to thousands of students studying for school and university exams.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: TrendingUp, title: '70% Revenue Share', desc: 'Keep 70% of every sale you make.' },
            { icon: BookOpen, title: 'Easy Uploads', desc: 'Create question banks with preview questions.' },
            { icon: ShieldCheck, title: 'Direct Payouts', desc: 'Request payouts directly to your bank account.' },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-3xl p-5 border border-black/5">
              <f.icon size={20} className="text-green-600 mb-2" />
              <p className="font-bold text-sm">{f.title}</p>
              <p className="text-xs text-gray-400 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Terms & Policy Form */}
        <div className="bg-white rounded-3xl p-8 border border-black/5 space-y-6">
          <h2 className="font-black text-lg">Vendor Terms & Policy Agreement</h2>

          <div className="space-y-4 text-xs text-gray-600 bg-gray-50 rounded-2xl p-5 border border-gray-100 max-h-60 overflow-y-auto leading-relaxed">
            <p className="font-bold text-gray-900 text-sm">1. Accuracy & Content Integrity</p>
            <p>You confirm that all questions, options, answers, and explanations uploaded to PastQ are accurate, clear, and genuine past exam materials.</p>

            <p className="font-bold text-gray-900 text-sm">2. Earnings & Commission</p>
            <p>Vendors earn 70% of the sale price for each purchased question bank. PastQ retains a 30% platform fee for hosting, security, and payment processing.</p>

            <p className="font-bold text-gray-900 text-sm">3. Moderation & Review</p>
            <p>Uploaded question banks undergo quality review within 24 hours. Content containing spam, fake answers, or duplicate material will be rejected.</p>

            <p className="font-bold text-gray-900 text-sm">4. Payout Terms</p>
            <p>Payouts can be requested anytime once your balance reaches at least ₦1,000. Transfers are processed to your designated Nigerian bank account within 3 business days.</p>
          </div>

          <form onSubmit={handleApply} className="space-y-6">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-2xl border border-gray-200 hover:border-green-300 transition-all">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 accent-green-600 w-4 h-4 rounded"
              />
              <span className="text-xs font-semibold text-gray-700">
                I have read and agree to the PastQ Vendor Terms of Service, Content Integrity Policy, and 70/30 Revenue Split terms.
              </span>
            </label>

            <button
              type="submit"
              disabled={!agreed || submitting}
              className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Enabling Vendor Access...</>
              ) : (
                <><CheckCircle2 size={16} /> Agree & Grant Vendor Access</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
