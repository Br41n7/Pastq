'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, GraduationCap, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { send } from '@/lib/client-api';
import { VENDOR_DECLARATIONS, VENDOR_TERMS_SECTIONS, VENDOR_TERMS_VERSION } from '@/lib/vendor-terms';

export default function TermsGate({ fullName, renewal, onAccepted }: {
  fullName: string; renewal: boolean; onAccepted: () => void;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const all = checked.length === VENDOR_DECLARATIONS.length;
  const toggle = (id: string) => setChecked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const accept = async () => {
    setSaving(true);
    try {
      await send('/api/vendor/agreement', 'POST', { version: VENDOR_TERMS_VERSION, declarations: checked, signed_name: name });
      toast.success('Agreement recorded. Welcome aboard!');
      onAccepted();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <nav className="bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center"><GraduationCap size={15} className="text-white" /></div>
          <span className="font-black">PastQ</span>
        </Link>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
          className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"><LogOut size={14} /> Sign out</button>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div>
          <div className="flex items-center gap-2 text-green-600 mb-1"><ShieldCheck size={18} /><span className="text-xs font-black uppercase tracking-wide">Vendor agreement</span></div>
          <h1 className="text-2xl font-black">Copyright &amp; permissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            {renewal ? 'Our vendor terms were updated. ' : ''}Before you upload, manage or withdraw, please read and accept the terms below, {fullName.split(' ')[0]}.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-black/5 p-5 max-h-72 overflow-y-auto space-y-4">
          {VENDOR_TERMS_SECTIONS.map(s => (
            <div key={s.title}>
              <h2 className="font-bold text-sm">{s.title}</h2>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-black/5 p-5 space-y-3">
          <p className="font-bold text-sm">I confirm that:</p>
          {VENDOR_DECLARATIONS.map(d => (
            <label key={d.id} className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={checked.includes(d.id)} onChange={() => toggle(d.id)}
                className="mt-1 h-4 w-4 accent-green-600 shrink-0" />
              <span>{d.label}</span>
            </label>
          ))}
          <div className="pt-2">
            <label className="text-xs font-semibold block mb-1">Type your full name to sign</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={fullName}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
          </div>
          <button onClick={accept} disabled={!all || name.trim().length < 3 || saving}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white py-3 rounded-2xl text-sm font-bold">
            {saving && <Loader2 size={15} className="animate-spin" />} I agree — continue to my dashboard
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Version {VENDOR_TERMS_VERSION}. Your acceptance is recorded with the date and time.
          </p>
        </div>
      </div>
    </div>
  );
}
