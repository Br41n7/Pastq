'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Plus, Pencil, Trash2, Eye, Flag, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/client-api';
import { formatNaira } from '@/lib/paystack';
import { BankStatusBadge, Card, Spinner } from '@/components/vendor/ui';

const ACCESS_LABEL: Record<string, string> = { free: 'Free', paid: 'Paid', preview_paid: 'Preview + paid' };

export default function VendorBanksPage() {
  const [banks, setBanks] = useState<any[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => api('/api/vendor/banks').then(d => setBanks(d.banks)).catch(e => { toast.error(e.message); setBanks([]); });
  useEffect(() => { load(); }, []);

  const remove = async (b: any) => {
    if (!confirm(`Delete "${b.title}" and all its questions? This cannot be undone.`)) return;
    setDeleting(b.id);
    const { error } = await supabase.from('question_banks').delete().eq('id', b.id);
    setDeleting(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Bank deleted');
    load();
  };

  if (!banks) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">My question banks</h1>
          <p className="text-sm text-gray-500">Edit details, fix questions and track each bank</p>
        </div>
        <Link href="/vendor/upload" className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold">
          <Plus size={15} /> New bank
        </Link>
      </div>

      {banks.length === 0 ? (
        <Card className="text-center py-12 border-dashed">
          <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-gray-500">No question banks yet</p>
          <Link href="/vendor/upload" className="inline-flex items-center gap-2 mt-4 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold"><Plus size={15} /> Upload questions</Link>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {banks.map(b => {
            const canDelete = ['pending', 'rejected'].includes(b.status) && b.total_sales === 0;
            return (
              <Card key={b.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <BankStatusBadge status={b.status} />
                  <span className="text-[10px] font-black uppercase text-gray-400">{ACCESS_LABEL[b.access_type] || b.access_type} · {b.exam_type}</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm">{b.title}</h3>
                  <p className="text-xs text-gray-400">{b.course_code ? `${b.course_code} · ` : ''}{b.subject} · {b.question_count} questions</p>
                </div>
                {b.moderation_note && (
                  <p className="text-xs bg-amber-50 text-amber-700 rounded-xl px-3 py-2">Admin note: {b.moderation_note}</p>
                )}
                {b.open_reports > 0 && (
                  <p className="text-xs text-rose-600 flex items-center gap-1"><Flag size={12} /> {b.open_reports} open report{b.open_reports > 1 ? 's' : ''} from students</p>
                )}
                <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-2xl py-2.5">
                  <div><p className="font-black text-sm">{b.access_type === 'free' ? 'Free' : formatNaira(b.price)}</p><p className="text-[10px] text-gray-400">Price</p></div>
                  <div><p className="font-black text-sm">{b.total_sales}</p><p className="text-[10px] text-gray-400">Sales</p></div>
                  <div><p className="font-black text-sm text-green-600">{formatNaira(b.revenue)}</p><p className="text-[10px] text-gray-400">Earned</p></div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Link href={`/vendor/banks/${b.id}`} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-900 text-white py-2 rounded-xl text-xs font-bold"><Pencil size={13} /> Manage</Link>
                  {b.status === 'live' && <Link href={`/bank/${b.id}`} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800" aria-label="View public page"><Eye size={15} /></Link>}
                  {canDelete && (
                    <button onClick={() => remove(b)} disabled={deleting === b.id} className="p-2 rounded-xl border border-gray-200 text-rose-500 hover:bg-rose-50" aria-label="Delete bank">
                      {deleting === b.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
