'use client';
import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { send } from '@/lib/client-api';
import { inputCls } from '@/components/vendor/ui';
import { Modal } from './ui';

export default function QuestionEditorModal({ question, onClose, onSaved }: { question: any; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    question_text: question.question_text || '', option_a: question.option_a || '', option_b: question.option_b || '', option_c: question.option_c || '',
    option_d: question.option_d || '', option_e: question.option_e || '', correct_answer: question.correct_answer || 'A',
    explanation: question.explanation || '', topic: question.topic || '', difficulty: question.difficulty || 'medium', year: question.year ? String(question.year) : '',
  });
  const [note, setNote] = useState('');
  const [resolve, setResolve] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setV(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      await send(`/api/admin/questions/${question.id}`, 'PATCH', { fields: { ...v, year: v.year || null }, note, resolve_reports: resolve });
      toast.success('Question updated');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Adjust question ${question.question_number}`} onClose={onClose} wide>
      <textarea value={v.question_text} onChange={set('question_text')} rows={3} className={inputCls} placeholder="Question text" />
      <div className="grid sm:grid-cols-2 gap-2">
        {(['a', 'b', 'c', 'd', 'e'] as const).map(o => (
          <input key={o} value={(v as any)[`option_${o}`]} onChange={set(`option_${o}`)} placeholder={`Option ${o.toUpperCase()}`} className={inputCls} />
        ))}
        <select value={v.correct_answer} onChange={set('correct_answer')} className={inputCls}>
          {['A', 'B', 'C', 'D', 'E'].map(a => <option key={a} value={a}>Correct answer: {a}</option>)}
        </select>
      </div>
      <textarea value={v.explanation} onChange={set('explanation')} rows={2} className={inputCls} placeholder="Explanation" />
      <div className="grid grid-cols-3 gap-2">
        <input value={v.topic} onChange={set('topic')} placeholder="Topic" className={inputCls} />
        <select value={v.difficulty} onChange={set('difficulty')} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
        <input value={v.year} onChange={set('year')} placeholder="Year" inputMode="numeric" className={inputCls} />
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Note for the record (optional)" className={inputCls} />
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={resolve} onChange={e => setResolve(e.target.checked)} className="accent-green-600" />
        Mark open reports on this question as resolved
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancel</button>
        <button onClick={save} disabled={busy} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save changes
        </button>
      </div>
    </Modal>
  );
}
