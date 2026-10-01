'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, AlertTriangle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { toKobo, formatNaira } from '@/lib/paystack';
import { useVendor } from '@/components/vendor/VendorProvider';
import { BankStatusBadge, Card, Spinner, inputCls } from '@/components/vendor/ui';

const BANK_FIELDS = 'id,title,description,subject,exam_type,course_code,course_title,academic_session,access_type,price,preview_count,question_count,status,total_sales,moderation_note';
const Q_FIELDS = 'id,bank_id,question_number,year,question_text,option_a,option_b,option_c,option_d,option_e,correct_answer,explanation,topic,difficulty,is_preview';
const MIN_QUESTIONS = 5;

type QForm = {
  question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; option_e: string;
  correct_answer: string; explanation: string; topic: string; difficulty: string; year: string; is_preview: boolean;
};
const blankQ = (): QForm => ({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', option_e: '', correct_answer: 'A', explanation: '', topic: '', difficulty: 'medium', year: '', is_preview: false });
const fromRow = (q: any): QForm => ({
  question_text: q.question_text || '', option_a: q.option_a || '', option_b: q.option_b || '', option_c: q.option_c || '', option_d: q.option_d || '', option_e: q.option_e || '',
  correct_answer: q.correct_answer || 'A', explanation: q.explanation || '', topic: q.topic || '', difficulty: q.difficulty || 'medium', year: q.year ? String(q.year) : '', is_preview: !!q.is_preview,
});

function QuestionForm({ initial, saving, onSave, onCancel }: { initial: QForm; saving: boolean; onSave: (v: QForm) => void; onCancel: () => void }) {
  const [v, setV] = useState<QForm>(initial);
  const set = (k: keyof QForm) => (e: React.ChangeEvent<any>) => setV(p => ({ ...p, [k]: e.target.value }));
  const opts = ['a', 'b', 'c', 'd', 'e'] as const;
  return (
    <div className="space-y-3 bg-gray-50 rounded-2xl p-4">
      <textarea value={v.question_text} onChange={set('question_text')} rows={3} placeholder="Question text *" className={inputCls} />
      <div className="grid sm:grid-cols-2 gap-2">
        {opts.map(o => (
          <input key={o} value={(v as any)[`option_${o}`]} onChange={set(`option_${o}` as keyof QForm)}
            placeholder={`Option ${o.toUpperCase()}${o === 'a' || o === 'b' ? ' *' : ''}`} className={inputCls} />
        ))}
        <select value={v.correct_answer} onChange={set('correct_answer')} className={inputCls}>
          {['A', 'B', 'C', 'D', 'E'].map(a => <option key={a} value={a}>Correct answer: {a}</option>)}
        </select>
      </div>
      <textarea value={v.explanation} onChange={set('explanation')} rows={2} placeholder="Explanation (optional)" className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <input value={v.topic} onChange={set('topic')} placeholder="Topic" className={inputCls} />
        <select value={v.difficulty} onChange={set('difficulty')} className={inputCls}>
          <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
        </select>
        <input value={v.year} onChange={set('year')} placeholder="Year" inputMode="numeric" className={inputCls} />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={v.is_preview} onChange={e => setV(p => ({ ...p, is_preview: e.target.checked }))} className="accent-green-600" />
        Show as a free preview question
      </label>
      <div className="flex gap-2">
        <button onClick={() => onSave(v)} disabled={saving} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-200">Cancel</button>
      </div>
    </div>
  );
}

export default function ManageBankPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useVendor();
  const [bank, setBank] = useState<any>(null);
  const [missing, setMissing] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', access_type: 'paid', price_naira: '', preview_count: '5', course_code: '', course_title: '', academic_session: '' });
  const [savingBank, setSavingBank] = useState(false);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [savingQ, setSavingQ] = useState(false);

  const load = useCallback(async () => {
    const { data: b } = await supabase.from('question_banks').select(BANK_FIELDS).eq('id', id).eq('vendor_id', me.profile.id).maybeSingle();
    if (!b) { setMissing(true); return; }
    const { data: qs } = await supabase.from('questions').select(Q_FIELDS).eq('bank_id', id).order('question_number');
    setBank(b);
    setQuestions(qs ?? []);
    setForm({
      title: b.title || '', description: b.description || '', access_type: b.access_type, price_naira: b.price ? String(Number(b.price) / 100) : '',
      preview_count: String(b.preview_count ?? 5), course_code: b.course_code || '', course_title: b.course_title || '', academic_session: b.academic_session || '',
    });
  }, [id, me.profile.id]);

  useEffect(() => { load(); }, [load]);

  if (missing) return <Card className="text-center">Bank not found. <Link href="/vendor/banks" className="text-green-600 font-semibold">Back to my banks</Link></Card>;
  if (!bank) return <Spinner />;

  const live = bank.status === 'live';
  const setF = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const saveBank = async () => {
    const price = parseFloat(form.price_naira);
    if (!form.title.trim()) return toast.error('Title is required');
    if (form.access_type !== 'free' && !(price > 0)) return toast.error('Enter a price above ₦0');
    const preview = Math.max(0, parseInt(form.preview_count || '0', 10) || 0);
    if (form.access_type === 'preview_paid' && preview > bank.question_count) return toast.error('Preview count is more than your questions');
    if (live && !confirm('Changing a live bank sends it back to review and hides it from students until approved. Continue?')) return;

    setSavingBank(true);
    const { error } = await supabase.from('question_banks').update({
      title: form.title.trim(), description: form.description.trim() || null, access_type: form.access_type,
      price: form.access_type === 'free' ? 0 : toKobo(price), preview_count: form.access_type === 'preview_paid' ? preview : 0,
      course_code: form.course_code ? form.course_code.toUpperCase().trim() : null, course_title: form.course_title.trim() || null,
      academic_session: form.academic_session.trim() || null,
    }).eq('id', id);
    setSavingBank(false);
    if (error) return toast.error(error.message);
    toast.success(live ? 'Saved — sent back for review' : 'Saved');
    load();
  };

  const saveQuestion = async (v: QForm) => {
    if (!v.question_text.trim() || !v.option_a.trim() || !v.option_b.trim()) return toast.error('Question text and options A & B are required');
    if (!(v as any)[`option_${v.correct_answer.toLowerCase()}`].trim()) return toast.error(`Option ${v.correct_answer} is empty`);
    const year = v.year ? parseInt(v.year, 10) : null;
    if (v.year && (!Number.isInteger(year) || year! < 1950 || year! > 2100)) return toast.error('Enter a valid year');
    if (live && !confirm('Editing questions sends this live bank back to review. Continue?')) return;

    const payload = {
      question_text: v.question_text.trim(), option_a: v.option_a.trim(), option_b: v.option_b.trim(), option_c: v.option_c.trim() || null,
      option_d: v.option_d.trim() || null, option_e: v.option_e.trim() || null, correct_answer: v.correct_answer,
      explanation: v.explanation.trim() || null, topic: v.topic.trim() || null, difficulty: v.difficulty, year, is_preview: v.is_preview,
    };
    setSavingQ(true);
    const res = editing === 'new'
      ? await supabase.from('questions').insert({ ...payload, bank_id: id, vendor_id: me.profile.id, question_number: Math.max(0, ...questions.map(q => q.question_number)) + 1 })
      : await supabase.from('questions').update(payload).eq('id', editing!);
    setSavingQ(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing === 'new' ? 'Question added' : 'Question updated');
    setEditing(null);
    load();
  };

  const deleteQuestion = async (q: any) => {
    if (questions.length <= MIN_QUESTIONS) return toast.error(`A bank needs at least ${MIN_QUESTIONS} questions`);
    if (!confirm(`Delete question ${q.question_number}?`)) return;
    if (live && !confirm('This live bank will go back to review. Continue?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', q.id);
    if (error) return toast.error(error.message);
    toast.success('Question deleted');
    load();
  };

  const deleteBank = async () => {
    if (!confirm(`Permanently delete "${bank.title}"?`)) return;
    const { error } = await supabase.from('question_banks').delete().eq('id', id);
    if (error) return toast.error(error.message);
    router.push('/vendor/banks');
  };

  const canDeleteBank = ['pending', 'rejected'].includes(bank.status) && bank.total_sales === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/vendor/banks" className="p-2 hover:bg-white rounded-xl"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black truncate">{bank.title}</h1>
          <p className="text-xs text-gray-400">{bank.subject} · {bank.exam_type} · {bank.total_sales} sales</p>
        </div>
        <BankStatusBadge status={bank.status} />
      </div>

      {bank.moderation_note && (
        <div className="flex gap-2 bg-amber-50 text-amber-700 rounded-2xl p-4 text-sm"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><div><b>Admin note:</b> {bank.moderation_note}</div></div>
      )}
      {live && <p className="text-xs text-gray-500 bg-white rounded-2xl border border-black/5 p-3">This bank is live. Editing its details or questions sends it back to review and hides it from students until it is approved again.</p>}

      <Card className="space-y-3">
        <h2 className="font-black">Bank details</h2>
        <input value={form.title} onChange={setF('title')} placeholder="Title *" className={inputCls} />
        <textarea value={form.description} onChange={setF('description')} rows={3} placeholder="Description" className={inputCls} />
        <div className="grid sm:grid-cols-3 gap-2">
          <input value={form.course_code} onChange={setF('course_code')} placeholder="Course code" className={inputCls} />
          <input value={form.course_title} onChange={setF('course_title')} placeholder="Course title" className={`${inputCls} sm:col-span-2`} />
        </div>
        <input value={form.academic_session} onChange={setF('academic_session')} placeholder="Academic session e.g. 2024/2025" className={inputCls} />
        <div className="grid sm:grid-cols-3 gap-2">
          <select value={form.access_type} onChange={setF('access_type')} className={inputCls}>
            <option value="free">Free</option><option value="paid">Paid</option><option value="preview_paid">Preview + paid</option>
          </select>
          {form.access_type !== 'free' && <input type="number" min="1" value={form.price_naira} onChange={setF('price_naira')} placeholder="Price (₦)" className={inputCls} />}
          {form.access_type === 'preview_paid' && <input type="number" min="0" value={form.preview_count} onChange={setF('preview_count')} placeholder="Preview count" className={inputCls} />}
        </div>
        {bank.total_sales > 0 && <p className="text-[11px] text-gray-400">Existing buyers keep access if you change the price or access type. Current price: {formatNaira(bank.price)}.</p>}
        <button onClick={saveBank} disabled={savingBank} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold">
          {savingBank ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save details
        </button>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-black">Questions ({questions.length})</h2>
          {editing !== 'new' && <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 text-sm text-green-600 font-semibold hover:underline"><Plus size={14} /> Add question</button>}
        </div>
        {editing === 'new' && <QuestionForm initial={blankQ()} saving={savingQ} onSave={saveQuestion} onCancel={() => setEditing(null)} />}
        <div className="space-y-2">
          {questions.map(q => editing === q.id ? (
            <QuestionForm key={q.id} initial={fromRow(q)} saving={savingQ} onSave={saveQuestion} onCancel={() => setEditing(null)} />
          ) : (
            <div key={q.id} className="flex items-start gap-3 border border-black/5 rounded-2xl p-3">
              <span className="text-xs font-black text-gray-400 w-6 shrink-0 pt-0.5">{q.question_number}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm line-clamp-2">{q.question_text}</p>
                <p className="text-[11px] text-gray-400 mt-1">Answer {q.correct_answer}{q.topic ? ` · ${q.topic}` : ''}{q.is_preview ? ' · preview' : ''}</p>
              </div>
              <button onClick={() => setEditing(q.id)} className="p-1.5 text-gray-400 hover:text-gray-800" aria-label="Edit question"><Pencil size={14} /></button>
              <button onClick={() => deleteQuestion(q)} className="p-1.5 text-gray-400 hover:text-rose-600" aria-label="Delete question"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </Card>

      {canDeleteBank && (
        <button onClick={deleteBank} className="text-sm text-rose-600 hover:underline flex items-center gap-1.5"><Trash2 size={14} /> Delete this bank</button>
      )}
    </div>
  );
}
