'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Profile, QuestionBank, PayoutRequest } from '@/types';
import { formatNaira } from '@/lib/paystack';
import {
  Plus, BookOpen, TrendingUp, Wallet, Clock,
  CheckCircle2, XCircle, Loader2, LogOut,
  GraduationCap, ChevronRight, AlertCircle, Star
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ amount: '', bank_name: '', account_number: '', account_name: '' });
  const [submittingPayout, setSubmittingPayout] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const [{ data: prof }, { data: banksData }, { data: payoutsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('question_banks').select('*').eq('vendor_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payout_requests').select('*').eq('vendor_id', user.id).order('requested_at', { ascending: false }),
      ]);

      if (prof?.role !== 'vendor') { router.push('/browse'); return; }
      setProfile(prof);
      setBanks((banksData as any) || []);
      setPayouts((payoutsData as any) || []);
      setLoading(false);
    }
    load();
  }, []);

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/'); };

  const handlePayoutRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const amount = parseFloat(payoutForm.amount) * 100; // convert to kobo
    if (amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > profile.pending_payout) {
      toast.error(`Maximum payout is ${formatNaira(profile.pending_payout)}`); return;
    }

    setSubmittingPayout(true);
    try {
      const { error } = await supabase.from('payout_requests').insert({
        vendor_id: profile.id,
        amount,
        bank_name: payoutForm.bank_name,
        account_number: payoutForm.account_number,
        account_name: payoutForm.account_name,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Payout request submitted! We\'ll process it within 3 business days.');
      setShowPayoutForm(false);
      setPayoutForm({ amount: '', bank_name: '', account_number: '', account_name: '' });
      // Refresh payouts
      const { data } = await supabase.from('payout_requests').select('*').eq('vendor_id', profile.id).order('requested_at', { ascending: false });
      setPayouts((data as any) || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit payout request');
    } finally {
      setSubmittingPayout(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-green-600" />
    </div>
  );

  const STATUS_CONFIG = {
    pending: { label: 'Pending Review', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
    approved: { label: 'Approved', color: 'text-blue-600', bg: 'bg-blue-50', icon: CheckCircle2 },
    live: { label: 'Live', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'text-rose-600', bg: 'bg-rose-50', icon: XCircle },
  };

  const PAYOUT_STATUS = {
    pending: { label: 'Pending', color: 'text-amber-600 bg-amber-50' },
    processing: { label: 'Processing', color: 'text-blue-600 bg-blue-50' },
    paid: { label: 'Paid ✓', color: 'text-green-600 bg-green-50' },
    rejected: { label: 'Rejected', color: 'text-rose-600 bg-rose-50' },
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      {/* Nav */}
      <nav className="bg-white border-b border-black/8 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
            <GraduationCap size={15} className="text-white" />
          </div>
          <span className="font-black">PastQ</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium ml-1">Vendor</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/vendor/upload" className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
            <Plus size={15} /> Upload Questions
          </Link>
          <button onClick={handleSignOut} className="p-2 text-gray-400 hover:text-gray-700">
            <LogOut size={17} />
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black">Welcome, {profile?.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 text-sm">Manage your question banks and track your earnings</p>
        </div>

        {/* Earnings Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Earnings', value: formatNaira(profile?.total_earnings || 0), color: 'text-green-600', icon: TrendingUp },
            { label: 'Available for Payout', value: formatNaira(profile?.pending_payout || 0), color: 'text-indigo-600', icon: Wallet },
            { label: 'Total Paid Out', value: formatNaira(profile?.total_paid_out || 0), color: 'text-gray-600', icon: CheckCircle2 },
            { label: 'Active Banks', value: banks.filter(b => b.status === 'live').length.toString(), color: 'text-amber-600', icon: BookOpen },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-3xl p-5 border border-black/5">
              <card.icon size={18} className={`${card.color} mb-3`} />
              <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Payout Section */}
        <div className="bg-white rounded-3xl p-6 border border-black/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-black text-lg">Payout</h2>
              <p className="text-xs text-gray-400">Manual processing within 3 business days via bank transfer</p>
            </div>
            {(profile?.pending_payout || 0) > 0 && (
              <button onClick={() => setShowPayoutForm(!showPayoutForm)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold">
                <Wallet size={15} /> Request Payout
              </button>
            )}
          </div>

          {/* Payout info notice */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl mb-4">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-700">
              <p className="font-semibold">How payouts work</p>
              <p className="mt-0.5">You earn <strong>70%</strong> of every sale. Submit a payout request with your bank details and we'll transfer within 3 business days. Minimum payout: ₦1,000.</p>
            </div>
          </div>

          {showPayoutForm && (
            <form onSubmit={handlePayoutRequest} className="bg-gray-50 rounded-2xl p-5 mb-4 space-y-3">
              <h3 className="font-bold text-sm">Request Payout</h3>
              <p className="text-xs text-gray-500">Available: <strong>{formatNaira(profile?.pending_payout || 0)}</strong></p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Amount (₦)</label>
                  <input type="number" value={payoutForm.amount} onChange={e => setPayoutForm(p => ({ ...p, amount: e.target.value }))}
                    required min="1000" max={(profile?.pending_payout || 0) / 100} step="100"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Bank Name</label>
                  <input value={payoutForm.bank_name} onChange={e => setPayoutForm(p => ({ ...p, bank_name: e.target.value }))}
                    required placeholder="e.g. GTBank" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Account Number</label>
                  <input value={payoutForm.account_number} onChange={e => setPayoutForm(p => ({ ...p, account_number: e.target.value }))}
                    required pattern="[0-9]{10}" placeholder="0000000000" maxLength={10}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Account Name</label>
                  <input value={payoutForm.account_name} onChange={e => setPayoutForm(p => ({ ...p, account_name: e.target.value }))}
                    required placeholder="Name on account" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submittingPayout}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold">
                  {submittingPayout ? <Loader2 size={14} className="animate-spin" /> : null}
                  Submit Request
                </button>
                <button type="button" onClick={() => setShowPayoutForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-200">Cancel</button>
              </div>
            </form>
          )}

          {/* Payout history */}
          {payouts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-500">Payout History</p>
              {payouts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-sm">{formatNaira(p.amount)}</p>
                    <p className="text-xs text-gray-400">{p.bank_name} • {p.account_number} • {new Date(p.requested_at).toLocaleDateString()}</p>
                    {p.admin_note && <p className="text-xs text-gray-500 mt-0.5">Note: {p.admin_note}</p>}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PAYOUT_STATUS[p.status]?.color}`}>
                    {PAYOUT_STATUS[p.status]?.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No payout requests yet</p>
          )}
        </div>

        {/* Question Banks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-lg">Your Question Banks</h2>
            <Link href="/vendor/upload" className="text-sm text-green-600 font-semibold flex items-center gap-1 hover:underline">
              <Plus size={14} /> Add New
            </Link>
          </div>

          {banks.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
              <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-500">No question banks yet</p>
              <p className="text-sm text-gray-400 mt-1">Upload your first compiled past questions to start earning</p>
              <Link href="/vendor/upload" className="inline-flex items-center gap-2 mt-4 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold">
                <Plus size={15} /> Upload Questions
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {banks.map(bank => {
                const statusConf = STATUS_CONFIG[bank.status] || STATUS_CONFIG.pending;
                return (
                  <div key={bank.id} className="bg-white rounded-3xl p-5 border border-black/5">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${statusConf.bg} ${statusConf.color}`}>
                        <statusConf.icon size={11} /> {statusConf.label}
                      </span>
                      <span className="text-xs text-gray-400">{bank.exam_type}</span>
                    </div>
                    <h3 className="font-bold text-sm mb-1">{bank.title}
                <span className="ml-2 text-[10px] font-black uppercase text-gray-500">
                  {bank.access_type === 'free' ? 'FREE' : bank.access_type === 'preview_paid' ? 'PREVIEW + PAID' : 'PAID'}
                </span></h3>
                    <p className="text-xs text-gray-400">{bank.subject} · {bank.question_count} questions</p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/5">
                      <div>
                        <p className="font-black text-green-600">{formatNaira(bank.price)}</p>
                        <p className="text-[10px] text-gray-400">{bank.total_sales} sales · {bank.rating > 0 ? `${bank.rating.toFixed(1)}★` : 'No ratings'}</p>
                      </div>
                      <Link href={`/bank/${bank.id}`} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1">
                        View <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
