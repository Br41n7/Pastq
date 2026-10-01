'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, Ban, Undo2, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, send } from '@/lib/client-api';
import { formatNaira } from '@/lib/paystack';
import { useAdmin } from '@/components/admin/AdminProvider';
import { BankStatusBadge, Card, Spinner } from '@/components/vendor/ui';
import { Pill, QuestionPreview, REASON_LABEL, ReasonDialog } from '@/components/admin/ui';
import QuestionEditorModal from '@/components/admin/QuestionEditorModal';

type Dialog = { kind: 'reject' | 'unpublish' } | { kind: 'deleteQ'; q: any } | null;

export default function AdminBankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { refresh } = useAdmin();
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(() => api(`/api/admin/banks/${id}`).then(setData).catch(e => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<any>, msg: string) => {
    try { await fn(); toast.success(msg); setDialog(null); setEditing(null); await Promise.all([load(), refresh()]); } catch (e: any) { toast.error(e.message); }
  };

  if (error) return <Card className="text-center">{error} · <Link href="/admin/banks" className="text-green-600 font-semibold">Back</Link></Card>;
  if (!data) return <Spinner />;

  const { bank, vendor, questions, reports } = data;
  const reportsByQuestion = new Map<string, any[]>();
  reports.forEach((r: any) => r.question_id && reportsByQuestion.set(r.question_id, [...(reportsByQuestion.get(r.question_id) || []), r]));
  const bankLevel = reports.filter((r: any) => !r.question_id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/banks" className="p-2 hover:bg-white rounded-xl"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black truncate">{bank.title}</h1>
          <p className="text-xs text-gray-400">{bank.course_code ? `${bank.course_code} · ` : ''}{bank.subject} · {bank.access_type === 'free' ? 'Free' : formatNaira(bank.price)} · {bank.total_sales} sales</p>
        </div>
        <BankStatusBadge status={bank.status} />
      </div>

      <Card className="space-y-3">
        <p className="text-sm">
          Vendor: <b>{vendor?.full_name}</b> ({vendor?.email}) {vendor?.vendor_status === 'suspended' && <Pill tone="red">suspended</Pill>}
          <span className="text-xs text-gray-400 block mt-0.5">Agreement: {vendor?.vendor_terms_accepted_at ? `v${vendor.vendor_terms_version}, accepted ${new Date(vendor.vendor_terms_accepted_at).toLocaleDateString()}` : 'not accepted'}</span>
        </p>
        {bank.description && <p className="text-sm text-gray-600">{bank.description}</p>}
        {bank.moderation_note && <p className="text-xs bg-amber-50 text-amber-700 rounded-xl px-3 py-2">Last note: {bank.moderation_note}</p>}
        <div className="flex flex-wrap gap-2">
          {bank.status !== 'live' && <button onClick={() => act(() => send(`/api/admin/banks/${id}`, 'PATCH', { action: 'approve' }), 'Bank is now live')} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold"><Check size={14} /> {bank.status === 'rejected' ? 'Re-approve' : 'Approve'}</button>}
          {bank.status === 'live' && <button onClick={() => setDialog({ kind: 'unpublish' })} className="flex items-center gap-1.5 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-bold"><Undo2 size={14} /> Send back</button>}
          {bank.status !== 'rejected' && <button onClick={() => setDialog({ kind: 'reject' })} className="flex items-center gap-1.5 border border-rose-200 text-rose-600 px-4 py-2 rounded-xl text-sm font-bold"><Ban size={14} /> {bank.status === 'live' ? 'Take down' : 'Reject'}</button>}
        </div>
      </Card>

      {bankLevel.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-black text-sm">Open bank-level reports</h2>
          {bankLevel.map((r: any) => <p key={r.id} className="text-sm"><Pill tone={r.reason === 'copyright' ? 'red' : 'amber'}>{REASON_LABEL[r.reason]}</Pill> {r.details}</p>)}
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-black">Questions ({questions.length})</h2>
        {questions.map((q: any) => {
          const rs = reportsByQuestion.get(q.id) || [];
          return (
            <div key={q.id} className={`space-y-2 ${rs.length ? 'ring-2 ring-rose-200 rounded-2xl p-1' : ''}`}>
              <QuestionPreview q={q} />
              <div className="flex flex-wrap items-center gap-2 px-1">
                {rs.map((r: any) => <Pill key={r.id} tone="red">{REASON_LABEL[r.reason]}{r.details ? `: ${r.details.slice(0, 50)}` : ''}</Pill>)}
                <button onClick={() => setEditing(q)} className="flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-green-700 ml-auto"><Pencil size={12} /> Adjust</button>
                <button onClick={() => setDialog({ kind: 'deleteQ', q })} className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-rose-600"><Trash2 size={12} /> Delete</button>
              </div>
            </div>
          );
        })}
      </Card>

      {dialog?.kind === 'reject' && <ReasonDialog title={bank.status === 'live' ? 'Take down this bank?' : 'Reject this bank?'} required danger confirmLabel="Confirm" placeholder="Reason (shown to the vendor)"
        description={bank.total_sales > 0 ? 'Students who already bought this bank will lose access. Open reports on it will be closed.' : 'Open reports on it will be closed.'}
        onClose={() => setDialog(null)} onConfirm={n => act(() => send(`/api/admin/banks/${id}`, 'PATCH', { action: 'reject', note: n }), 'Bank rejected')} />}
      {dialog?.kind === 'unpublish' && <ReasonDialog title="Send back for fixes?" required confirmLabel="Send back" placeholder="What needs fixing" onClose={() => setDialog(null)}
        onConfirm={n => act(() => send(`/api/admin/banks/${id}`, 'PATCH', { action: 'unpublish', note: n }), 'Sent back to vendor')} />}
      {dialog?.kind === 'deleteQ' && <ReasonDialog title={`Delete question ${dialog.q.question_number}?`} danger confirmLabel="Delete question" description="This removes the question permanently and closes its reports." onClose={() => setDialog(null)}
        onConfirm={n => act(() => send(`/api/admin/questions/${dialog.q.id}`, 'DELETE', { note: n }), 'Question deleted')} />}
      {editing && <QuestionEditorModal question={editing} onClose={() => setEditing(null)} onSaved={() => act(async () => {}, 'Question adjusted')} />}
    </div>
  );
}
