'use client';
import { useState } from 'react';
import { Loader2, Save, ShieldCheck, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useVendor } from '@/components/vendor/VendorProvider';
import { Card, NIGERIAN_BANKS, inputCls } from '@/components/vendor/ui';
import { VENDOR_DECLARATIONS, VENDOR_TERMS_SECTIONS } from '@/lib/vendor-terms';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="text-xs font-semibold block mb-1">{label}</label>{children}</div>
);
const Btn = ({ loading, label }: { loading: boolean; label: string }) => (
  <button disabled={loading} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold">
    {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {label}
  </button>
);


export default function VendorSettingsPage() {
  const { me, reload } = useVendor();
  const p = me.profile;
  const [profile, setProfile] = useState({ full_name: p.full_name || '', school: p.school || '', phone: p.phone || '', bio: p.bio || '' });
  const [acct, setAcct] = useState({
    bank_name: me.payoutAccount?.bank_name || '', account_number: me.payoutAccount?.account_number || '', account_name: me.payoutAccount?.account_name || '',
  });
  const [busy, setBusy] = useState<'profile' | 'acct' | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.full_name.trim().length < 2) return toast.error('Enter your name');
    setBusy('profile');
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name.trim(), school: profile.school.trim() || null, phone: profile.phone.trim() || null, bio: profile.bio.trim().slice(0, 500) || null,
    }).eq('id', p.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Profile saved');
    reload();
  };

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{10}$/.test(acct.account_number)) return toast.error('Account number must be 10 digits');
    if (!acct.bank_name.trim() || !acct.account_name.trim()) return toast.error('Fill in all bank details');
    if (me.payoutAccount && !confirm('Change the account your payouts are sent to?')) return;
    setBusy('acct');
    const { error } = await supabase.from('vendor_payout_accounts').upsert({
      vendor_id: p.id, bank_name: acct.bank_name.trim(), account_number: acct.account_number, account_name: acct.account_name.trim(), updated_at: new Date().toISOString(),
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Payout account saved');
    reload();
  };

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-black">Settings</h1><p className="text-sm text-gray-500">Your vendor profile, payout account and agreement</p></div>

      <Card>
        <form onSubmit={saveProfile} className="space-y-3">
          <h2 className="font-black">Profile</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Full name"><input value={profile.full_name} onChange={e => setProfile(s => ({ ...s, full_name: e.target.value }))} className={inputCls} /></Field>
            <Field label="School / institution"><input value={profile.school} onChange={e => setProfile(s => ({ ...s, school: e.target.value }))} className={inputCls} /></Field>
            <Field label="Phone"><input value={profile.phone} onChange={e => setProfile(s => ({ ...s, phone: e.target.value }))} inputMode="tel" className={inputCls} /></Field>
            <Field label="Email"><input value={p.email} disabled className={`${inputCls} bg-gray-50 text-gray-400`} /></Field>
          </div>
          <Field label="Short bio (shown on your public vendor profile)"><textarea value={profile.bio} onChange={e => setProfile(s => ({ ...s, bio: e.target.value }))} rows={3} maxLength={500} className={inputCls} /></Field>
          <Btn loading={busy === 'profile'} label="Save profile" />
        </form>
      </Card>

      <Card>
        <form onSubmit={saveAccount} className="space-y-3">
          <h2 className="font-black">Payout bank account</h2>
          <p className="text-xs text-gray-400">Withdrawals are sent here. The account name should match your own name.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Bank">
              <input list="ng-banks" value={acct.bank_name} onChange={e => setAcct(s => ({ ...s, bank_name: e.target.value }))} placeholder="e.g. GTBank" className={inputCls} />
              <datalist id="ng-banks">{NIGERIAN_BANKS.map(b => <option key={b} value={b} />)}</datalist>
            </Field>
            <Field label="Account number (10 digits)"><input value={acct.account_number} onChange={e => setAcct(s => ({ ...s, account_number: e.target.value.replace(/\D/g, '').slice(0, 10) }))} inputMode="numeric" className={inputCls} /></Field>
          </div>
          <Field label="Account name"><input value={acct.account_name} onChange={e => setAcct(s => ({ ...s, account_name: e.target.value }))} className={inputCls} /></Field>
          <Btn loading={busy === 'acct'} label="Save account" />
        </form>
      </Card>

      <Card>
        <div className="flex items-center gap-2 font-black mb-1"><ShieldCheck size={17} className="text-green-600" /> Copyright &amp; permissions agreement</div>
        <p className="text-sm text-gray-500">
          Accepted version {p.vendor_terms_version} on {p.vendor_terms_accepted_at ? new Date(p.vendor_terms_accepted_at).toLocaleString() : '—'}.
        </p>
        <button onClick={() => setShowTerms(s => !s)} className="text-sm text-green-600 font-semibold mt-2 flex items-center gap-1">
          {showTerms ? 'Hide' : 'Read'} the terms <ChevronDown size={14} className={showTerms ? 'rotate-180' : ''} />
        </button>
        {showTerms && (
          <div className="mt-3 space-y-3 text-sm text-gray-600">
            {VENDOR_TERMS_SECTIONS.map(s => <div key={s.title}><p className="font-bold text-gray-800">{s.title}</p><p>{s.body}</p></div>)}
            <ul className="list-disc pl-5 space-y-1">{VENDOR_DECLARATIONS.map(d => <li key={d.id}>{d.label}</li>)}</ul>
          </div>
        )}
      </Card>
    </div>
  );
}
