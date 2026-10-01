'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Ban, Trash2, Undo2, Search, Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, send } from '@/lib/client-api';
import { formatNaira } from '@/lib/paystack';
import { useAdmin } from '@/components/admin/AdminProvider';
import { BankStatusBadge, Card, Spinner, inputCls } from '@/components/vendor/ui';
import { Pill, ReasonDialog, Tabs } from '@/components/admin/ui';

type Filter = 'pending' | 'live' | 'rejected' | 'all';
type Dialog = { kind: 'reject' | 'unpublish' | 'delete'; bank: any } | null;

export default function AdminBanksPage() {
  const { summary, refresh } = useAdmin();
  const [filter, setFilter] = useState<Filter>('pending');
  const [q, setQ] = useState('');
  const [banks, setBanks] = useState<any[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const load = useCallback(() => {
    setBanks(null);
    api(`/api/admin/banks?status=${filter}&q=${encodeURIComponent(q)}`).then(d => setBanks(d.banks)).catch(e => { toast.error(e.message); setBanks([]); });
  }, [filter, q]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const act = async (fn: () => Promise<any>, msg: string) => {
    try { await fn(); toast.success(msg); setDialog(null); await Promise.all([load(), refresh()]); } catch (e: any) { toast.error(e.message); }
  };
  const approve = (b: any) => act(() => send(`/api/admin/banks/${b.id}`, 'PATCH', { action: 'approve' }), 'Bank is now live');

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-black">Question banks</h1><p className="text-sm text-gray-500">Approve new uploads, send banks back for fixes, or take them down</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs<Filter> value={filter} onChange={setFilter} tabs={[{ v: 'pending', l: 'Pending', n: summary.pendingBanks }, { v: 'live', l: 'Live' }, { v: 'rejected', l: 'Taken down' }, { v: 'all', l: 'All' }]} />
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title or course code" className={`${inputCls} pl-9`} />
        </div>
      </div>

      {!banks ? <Spinner /> : banks.length === 0 ? <Card className="text-center text-sm text-gray-400 py-12">No banks found</Card> : (
        <div className="grid md:grid-cols-2 gap-4">
          {banks.map(b => (
            <Card key={b.id} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <BankStatusBadge status={b.status} />
                {b.open_reports > 0 && <Pill tone="red"><Flag size={10} className="inline -mt-0.5" /> {b.open_reports} report{b.open_reports > 1 ? 's' : ''}</Pill>}
              </div>
              <div>
                <Link href={`/admin/banks/${b.id}`} className="font-bold text-sm hover:underline">{b.title}</Link>
                <p className="text-xs text-gray-400">{b.course_code ? `${b.course_code} · ` : ''}{b.university || b.exam_type} · {b.question_count} questions · {b.access_type === 'free' ? 'Free' : formatNaira(b.price)} · {b.total_sales} sales</p>
                <p className="text-xs text-gray-500 mt-1">By {b.vendor?.full_name || 'unknown'} {b.vendor?.vendor_status === 'suspended' && <Pill tone="red">suspended</Pill>}</p>
              </div>
              {b.moderation_note && <p className="text-xs bg-amber-50 text-amber-700 rounded-xl px-3 py-2">Note: {b.moderation_note}</p>}
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/banks/${b.id}`} className="px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-700">Review questions</Link>
                {b.status !== 'live' && <button onClick={() => approve(b)} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold"><Check size={13} /> {b.status === 'rejected' ? 'Re-approve' : 'Approve'}</button>}
                {b.status === 'live' && <button onClick={() => setDialog({ kind: 'unpublish', bank: b })} className="flex items-center gap-1.5 border border-amber-200 text-amber-700 px-3.5 py-2 rounded-xl text-xs font-bold"><Undo2 size={13} /> Send back</button>}
                {b.status !== 'rejected' && <button onClick={() => setDialog({ kind: 'reject', bank: b })} className="flex items-center gap-1.5 border border-rose-200 text-rose-600 px-3.5 py-2 rounded-xl text-xs font-bold"><Ban size={13} /> {b.status === 'live' ? 'Take down' : 'Reject'}</button>}
                {b.total_sales === 0 && <button onClick={() => setDialog({ kind: 'delete', bank: b })} className="flex items-center gap-1.5 text-gray-400 hover:text-rose-600 px-2 py-2 text-xs font-bold"><Trash2 size={13} /> Delete</button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {dialog?.kind === 'reject' && <ReasonDialog title={dialog.bank.status === 'live' ? 'Take down this bank?' : 'Reject this bank?'} required danger confirmLabel="Confirm" placeholder="Reason (shown to the vendor)"
        description={dialog.bank.total_sales > 0 ? 'Students who already bought this bank will lose access.' : 'The vendor will see your reason.'}
        onClose={() => setDialog(null)} onConfirm={n => act(() => send(`/api/admin/banks/${dialog.bank.id}`, 'PATCH', { action: 'reject', note: n }), 'Bank rejected')} />}
      {dialog?.kind === 'unpublish' && <ReasonDialog title="Send back for fixes?" required confirmLabel="Send back" placeholder="What needs fixing"
        description="The bank is hidden from students until you approve it again." onClose={() => setDialog(null)}
        onConfirm={n => act(() => send(`/api/admin/banks/${dialog.bank.id}`, 'PATCH', { action: 'unpublish', note: n }), 'Sent back to vendor')} />}
      {dialog?.kind === 'delete' && <ReasonDialog title="Permanently delete?" danger confirmLabel="Delete forever" description={`"${dialog.bank.title}" and its questions will be removed. This cannot be undone.`}
        onClose={() => setDialog(null)} onConfirm={() => act(() => send(`/api/admin/banks/${dialog.bank.id}`, 'DELETE'), 'Bank deleted')} />}
    </div>
  );
}
