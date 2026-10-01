'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, send } from '@/lib/client-api';
import { formatNaira } from '@/lib/paystack';
import { useAdmin } from '@/components/admin/AdminProvider';
import { Card, PAYOUT_STATUS, Spinner } from '@/components/vendor/ui';
import { Pill, ReasonDialog, Tabs } from '@/components/admin/ui';

type Filter = 'pending' | 'processing' | 'paid' | 'rejected';

export default function AdminPayoutsPage() {
  const { summary, refresh } = useAdmin();
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<any[] | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'paid' | 'rejected'; p: any } | null>(null);

  const load = useCallback(() => { setRows(null); api(`/api/admin/payouts?status=${filter}`).then(d => setRows(d.payouts)).catch(e => { toast.error(e.message); setRows([]); }); }, [filter]);
  useEffect(() => { load(); }, [load]);

  const update = async (p: any, action: string, note = '') => {
    try { await send(`/api/admin/payouts/${p.id}`, 'PATCH', { action, note }); toast.success(`Marked ${action}`); setDialog(null); await Promise.all([load(), refresh()]); }
    catch (e: any) { toast.error(e.message); }
  };
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast.success('Copied'));

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-black">Payouts</h1><p className="text-sm text-gray-500">Transfer the money yourself, then mark the request paid. Rejecting returns the amount to the vendor.</p></div>
      <Tabs<Filter> value={filter} onChange={setFilter} tabs={[{ v: 'pending', l: 'Pending', n: summary.pendingPayouts }, { v: 'processing', l: 'Processing' }, { v: 'paid', l: 'Paid' }, { v: 'rejected', l: 'Rejected' }]} />

      {!rows ? <Spinner /> : rows.length === 0 ? <Card className="text-center text-sm text-gray-400 py-12">No {filter} requests</Card> : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map(p => (
            <Card key={p.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-2xl font-black text-green-600">{formatNaira(p.amount)}</p>
                  <p className="text-xs text-gray-500">{p.vendor?.full_name} · {p.vendor?.email}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PAYOUT_STATUS[p.status]?.cls}`}>{PAYOUT_STATUS[p.status]?.label}</span>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-sm space-y-1">
                <p><b>{p.account_name}</b></p>
                <p className="flex items-center gap-2 text-gray-600">{p.bank_name} · <span className="font-mono">{p.account_number}</span>
                  <button onClick={() => copy(p.account_number)} className="text-gray-400 hover:text-gray-800" aria-label="Copy account number"><Copy size={13} /></button></p>
              </div>
              <p className="text-[11px] text-gray-400">
                Requested {new Date(p.requested_at).toLocaleString()}{p.processed_at ? ` · Closed ${new Date(p.processed_at).toLocaleDateString()}` : ''}
                {p.vendor?.vendor_status === 'suspended' && <> · <Pill tone="red">vendor suspended</Pill></>}
              </p>
              {p.admin_note && <p className="text-xs text-gray-600">Note: {p.admin_note}</p>}
              {['pending', 'processing'].includes(p.status) && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setDialog({ kind: 'paid', p })} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold"><Check size={13} /> Mark paid</button>
                  {p.status === 'pending' && <button onClick={() => update(p, 'processing')} className="flex items-center gap-1.5 border border-blue-200 text-blue-600 px-3.5 py-2 rounded-xl text-xs font-bold"><Loader size={13} /> Mark processing</button>}
                  <button onClick={() => setDialog({ kind: 'rejected', p })} className="flex items-center gap-1.5 border border-rose-200 text-rose-600 px-3.5 py-2 rounded-xl text-xs font-bold"><X size={13} /> Reject</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {dialog?.kind === 'paid' && <ReasonDialog title="Confirm transfer" confirmLabel="Yes, it's paid" placeholder="Transfer reference (optional)"
        description={`Only confirm after you have sent ${formatNaira(dialog.p.amount)} to ${dialog.p.account_name} (${dialog.p.bank_name} ${dialog.p.account_number}). This cannot be undone.`}
        onClose={() => setDialog(null)} onConfirm={n => update(dialog.p, 'paid', n)} />}
      {dialog?.kind === 'rejected' && <ReasonDialog title="Reject this withdrawal?" required danger confirmLabel="Reject & refund balance" placeholder="Reason (shown to the vendor)"
        description="The reserved amount goes back to the vendor's available balance." onClose={() => setDialog(null)} onConfirm={n => update(dialog.p, 'rejected', n)} />}
    </div>
  );
}
