'use client';
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { inputCls } from '@/components/vendor/ui';

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 space-y-4`} role="dialog" aria-label={title}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lg">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Confirmation dialog with an optional/required reason the vendor may see. */
export function ReasonDialog({ title, description, required = false, confirmLabel, danger = false, placeholder = 'Reason / note', onClose, onConfirm }: {
  title: string; description?: string; required?: boolean; confirmLabel: string; danger?: boolean; placeholder?: string;
  onClose: () => void; onConfirm: (note: string) => Promise<void> | void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = !required || note.trim().length >= 3;
  return (
    <Modal title={title} onClose={onClose}>
      {description && <p className="text-sm text-gray-600">{description}</p>}
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={500} placeholder={`${placeholder}${required ? ' (required)' : ' (optional)'}`} className={inputCls} autoFocus />
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Cancel</button>
        <button disabled={!ok || busy} onClick={async () => { setBusy(true); try { await onConfirm(note.trim()); } finally { setBusy(false); } }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-green-600 hover:bg-green-700'}`}>
          {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { v: T; l: string; n?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar bg-white rounded-xl border border-black/5 p-1 w-fit max-w-full">
      {tabs.map(t => (
        <button key={t.v} onClick={() => onChange(t.v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${value === t.v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
          {t.l}{t.n ? <span className="ml-1.5 bg-rose-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{t.n}</span> : null}
        </button>
      ))}
    </div>
  );
}

export const REASON_LABEL: Record<string, string> = {
  wrong_answer: 'Wrong answer', typo: 'Typo', duplicate: 'Duplicate', wrong_course: 'Wrong course', wrong_year: 'Wrong year',
  copyright: 'Copyright', misleading: 'Misleading', other: 'Other',
};

export function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'red' | 'amber' | 'green' | 'blue' }) {
  const t = { gray: 'bg-gray-100 text-gray-600', red: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600', green: 'bg-green-50 text-green-600', blue: 'bg-blue-50 text-blue-600' }[tone];
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${t}`}>{children}</span>;
}

export function QuestionPreview({ q }: { q: any }) {
  return (
    <div className="border border-black/5 rounded-2xl p-3 bg-gray-50/60">
      <p className="text-sm font-semibold">{q.year ? `${q.year} · ` : ''}Q{q.question_number}. {q.question_text}</p>
      <div className="grid sm:grid-cols-2 gap-1.5 mt-2">
        {(['a', 'b', 'c', 'd', 'e'] as const).map(o => q[`option_${o}`] ? (
          <div key={o} className={`text-xs px-2.5 py-1.5 rounded-lg ${q.correct_answer === o.toUpperCase() ? 'bg-green-100 text-green-800 font-semibold' : 'bg-white'}`}>
            <b>{o.toUpperCase()}.</b> {q[`option_${o}`]}
          </div>
        ) : null)}
      </div>
      {q.explanation && <p className="text-xs text-indigo-600 mt-2">💡 {q.explanation}</p>}
    </div>
  );
}
