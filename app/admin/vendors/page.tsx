'use client';
import { useCallback, useEffect, useState } from 'react';
import { Ban, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, send } from '@/lib/client-api';
import { formatNaira } from '@/lib/paystack';
import { useAdmin } from '@/components/admin/AdminProvider';
import { Card, Spinner, inputCls } from '@/components/vendor/ui';
import { Pill, ReasonDialog } from '@/components/admin/ui';

export default function AdminVendorsPage() {
  const { refresh } = useAdmin();
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ vendors: any[]; termsVersion: string } | null>(null);
  const [target, setTarget] = useState<{ v: any; action: 'suspend' | 'reinstate' } | null>(null);

  const load = useCallback(() => api(`/api/admin/vendors?q=${encodeURIComponent(q)}`).then(setData).catch(e => { toast.error(e.message); setData({ vendors: [], termsVersion: '' }); }), [q]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const run = async (note: string) => {
    if (!target) return;
    try {
      const r = await send(`/api/admin/vendors/${target.v.id}`, 'PATCH', { action: target.action, reason: note });
      toast.success(target.action === 'suspend' ? `Suspended · ${r.banksUnpublished} live bank(s) unpublished` : 'Vendor reinstated (re-approve their banks to relist)');
      setTarget(null); await Promise.all([load(), refresh()]);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-black">Vendors</h1><p className="text-sm text-gray-500">Agreement status, performance and account control</p></div>
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email" className={`${inputCls} pl-9`} />
      </div>

      {!data ? <Spinner /> : data.vendors.length === 0 ? <Card className="text-center text-sm text-gray-400 py-12">No vendors found</Card> : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.vendors.map(v => {
            const suspended = v.vendor_status === 'suspended';
            const agreed = v.vendor_terms_accepted_at && v.vendor_terms_version === data.termsVersion;
            return (
              <Card key={v.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{v.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{v.email}{v.school ? ` · ${v.school}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    <Pill tone={suspended ? 'red' : 'green'}>{suspended ? 'Suspended' : 'Active'}</Pill>
                    <Pill tone={agreed ? 'green' : 'amber'}>{agreed ? 'Agreement ✓' : v.vendor_terms_accepted_at ? 'Old terms' : 'No agreement'}</Pill>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center bg-gray-50 rounded-2xl py-2.5">
                  <div><p className="font-black text-sm">{v.live}/{v.banks}</p><p className="text-[10px] text-gray-400">Live</p></div>
                  <div><p className="font-black text-sm">{v.sales}</p><p className="text-[10px] text-gray-400">Sales</p></div>
                  <div><p className={`font-black text-sm ${v.reports ? 'text-rose-600' : ''}`}>{v.reports}</p><p className="text-[10px] text-gray-400">Reports</p></div>
                  <div><p className="font-black text-sm">{formatNaira(v.pending_payout)}</p><p className="text-[10px] text-gray-400">Balance</p></div>
                </div>
                <p className="text-[11px] text-gray-400">Earned {formatNaira(v.total_earnings)} · Paid out {formatNaira(v.total_paid_out)}{v.vendor_terms_accepted_at ? ` · Agreed ${new Date(v.vendor_terms_accepted_at).toLocaleDateString()}` : ''}</p>
                {suspended
                  ? <button onClick={() => setTarget({ v, action: 'reinstate' })} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold"><RotateCcw size={13} /> Reinstate</button>
                  : <button onClick={() => setTarget({ v, action: 'suspend' })} className="flex items-center gap-1.5 border border-rose-200 text-rose-600 px-4 py-2 rounded-xl text-xs font-bold"><Ban size={13} /> Suspend</button>}
              </Card>
            );
          })}
        </div>
      )}

      {target?.action === 'suspend' && <ReasonDialog title={`Suspend ${target.v.full_name}?`} required danger confirmLabel="Suspend vendor" placeholder="Reason (shown to the vendor)"
        description="Their live banks are unpublished, uploads and withdrawals are blocked, and the vendor sees this reason." onClose={() => setTarget(null)} onConfirm={run} />}
      {target?.action === 'reinstate' && <ReasonDialog title={`Reinstate ${target.v.full_name}?`} confirmLabel="Reinstate" description="They can upload and withdraw again. Their banks stay unpublished until you re-approve them." onClose={() => setTarget(null)} onConfirm={run} />}
    </div>
  );
}
