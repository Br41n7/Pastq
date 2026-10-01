'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Pencil, Trash2, Ban, Eye, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, send } from '@/lib/client-api';
import { useAdmin } from '@/components/admin/AdminProvider';
import { Card, Spinner } from '@/components/vendor/ui';
import { Pill, QuestionPreview, REASON_LABEL, ReasonDialog, Tabs } from '@/components/admin/ui';
import QuestionEditorModal from '@/components/admin/QuestionEditorModal';

type Filter = 'open' | 'reviewing' | 'resolved' | 'dismissed';
type Dialog = { kind: 'approve' | 'delete' | 'takedown'; report: any } | null;

const RESOLUTION: Record<string, string> = { fixed: 'Question adjusted', removed: 'Question deleted', bank_taken_down: 'Bank taken down', no_action: 'Approved as-is' };

export default function AdminReportsPage() {
  const { summary, refresh } = useAdmin();
  const [filter, setFilter] = useState<Filter>('open');
  const [reports, setReports] = useState<any[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(() => {
    setReports(null);
    api(`/api/admin/reports?status=${filter}`).then(d => setReports(d.reports)).catch(e => { toast.error(e.message); setReports([]); });
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const done = async (msg: string) => { toast.success(msg); setDialog(null); setEditing(null); await Promise.all([load(), refresh()]); };
  const fail = (e: any) => toast.error(e.message);

  const markReviewing = (r: any) => send(`/api/admin/reports/${r.id}`, 'PATCH', { action: 'reviewing' }).then(() => done('Marked as under review')).catch(fail);

  const confirm = async (note: string) => {
    if (!dialog) return;
    const { kind, report: r } = dialog;
    try {
      if (kind === 'approve') { await send(`/api/admin/reports/${r.id}`, 'PATCH', { action: 'approve', note }); await done('Report dismissed — content kept'); }
      if (kind === 'delete') { await send(`/api/admin/questions/${r.question_id}`, 'DELETE', { note }); await done('Question deleted'); }
      if (kind === 'takedown') { await send(`/api/admin/banks/${r.bank_id}`, 'PATCH', { action: 'reject', note }); await done('Bank taken down'); }
    } catch (e) { fail(e); }
  };

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-black">Reported content</h1><p className="text-sm text-gray-500">Approve (keep), adjust or delete reported questions, or take the bank down</p></div>
      <Tabs<Filter> value={filter} onChange={setFilter} tabs={[
        { v: 'open', l: 'Open', n: summary.openReports }, { v: 'reviewing', l: 'Reviewing' }, { v: 'resolved', l: 'Resolved' }, { v: 'dismissed', l: 'Dismissed' },
      ]} />

      {!reports ? <Spinner /> : reports.length === 0 ? (
        <Card className="text-center text-sm text-gray-400 py-12">Nothing here 🎉</Card>
      ) : (
        <div className="space-y-4">
          {reports.map(r => {
            const active = ['open', 'reviewing'].includes(r.status);
            return (
              <Card key={r.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={r.reason === 'copyright' ? 'red' : 'amber'}>{REASON_LABEL[r.reason] || r.reason}</Pill>
                  <Pill tone={r.status === 'open' ? 'red' : r.status === 'reviewing' ? 'blue' : 'green'}>{r.status}</Pill>
                  <span className="text-xs text-gray-400 ml-auto">{new Date(r.created_at).toLocaleString()}</span>
                </div>

                <div className="text-sm">
                  <Link href={`/admin/banks/${r.bank_id}`} className="font-bold hover:underline inline-flex items-center gap-1">{r.bank?.title || 'Deleted bank'} <ExternalLink size={12} /></Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Vendor: {r.vendor?.full_name || '—'} {r.vendor?.vendor_status === 'suspended' && <Pill tone="red">suspended</Pill>} · Bank: {r.bank?.status} · Reported by {r.reporter?.full_name || 'unknown'}
                  </p>
                </div>

                {r.details && <p className="text-sm bg-gray-50 rounded-xl p-3 text-gray-700">“{r.details}”</p>}
                {r.question ? <QuestionPreview q={r.question} /> : r.question_id ? <p className="text-xs text-gray-400">The reported question no longer exists.</p> : <p className="text-xs text-gray-400">Bank-level report (no specific question).</p>}

                {active ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={() => setDialog({ kind: 'approve', report: r })} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold"><Check size={13} /> Approve (keep)</button>
                    {r.question && <button onClick={() => setEditing(r.question)} className="flex items-center gap-1.5 bg-gray-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold"><Pencil size={13} /> Adjust</button>}
                    {r.question && <button onClick={() => setDialog({ kind: 'delete', report: r })} className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold"><Trash2 size={13} /> Delete question</button>}
                    {r.bank && r.bank.status !== 'rejected' && <button onClick={() => setDialog({ kind: 'takedown', report: r })} className="flex items-center gap-1.5 border border-rose-200 text-rose-600 px-3.5 py-2 rounded-xl text-xs font-bold"><Ban size={13} /> Take down bank</button>}
                    {r.status === 'open' && <button onClick={() => markReviewing(r)} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3.5 py-2 rounded-xl text-xs font-bold"><Eye size={13} /> Mark reviewing</button>}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">{r.resolution ? RESOLUTION[r.resolution] : 'Closed'}{r.admin_note ? ` — ${r.admin_note}` : ''}{r.reviewed_at ? ` · ${new Date(r.reviewed_at).toLocaleDateString()}` : ''}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {dialog?.kind === 'approve' && <ReasonDialog title="Approve — keep this content" description="The report will be dismissed and the question stays live unchanged." confirmLabel="Approve & dismiss" onClose={() => setDialog(null)} onConfirm={confirm} />}
      {dialog?.kind === 'delete' && <ReasonDialog title="Delete this question?" description="The question is permanently removed from the bank and the report is closed." confirmLabel="Delete question" danger onClose={() => setDialog(null)} onConfirm={confirm} />}
      {dialog?.kind === 'takedown' && <ReasonDialog title="Take down this bank?" required danger confirmLabel="Take down" placeholder="Why (shown to the vendor)"
        description="The bank is unpublished and every report on it is closed. Students who already bought it lose access too. Use this for copyright problems." onClose={() => setDialog(null)} onConfirm={confirm} />}
      {editing && <QuestionEditorModal question={editing} onClose={() => setEditing(null)} onSaved={() => done('Question adjusted')} />}
    </div>
  );
}
