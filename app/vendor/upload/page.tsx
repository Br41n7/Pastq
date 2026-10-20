'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useVendor } from '@/components/vendor/VendorProvider';
import { SUBJECTS, UNIVERSITY_LEVELS, SEMESTERS, ASSESSMENT_TYPES, cn } from '@/lib/utils';
import { SSCE_EXAMS, UNI_CATEGORIES, TRACK_LABEL, TRACK_BADGE, type BankTrack } from '@/lib/bank-track';
import { toKobo } from '@/lib/paystack';
import { api, send } from '@/lib/client-api';
import { compressImage } from '@/lib/image-compress';
import type { ScannedQuestion } from '@/lib/scan';
import { Plus, Trash2, Loader2, ArrowLeft, CheckCircle2, AlertCircle, GraduationCap, School, ScanLine, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface ManualQuestion {
  question_number: number; year: string; question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_answer: string; explanation: string; topic: string; is_preview: boolean;
  from_scan: boolean;               // came from a photo: the answer is deliberately left blank
  flag: 'figure' | 'unclear' | null; // needs the vendor's attention before submit
}

const emptyQ = (num: number): ManualQuestion => ({
  question_number: num, year: '', question_text: '', option_a: '', option_b: '',
  option_c: '', option_d: '', correct_answer: 'A', explanation: '', topic: '', is_preview: false,
  from_scan: false, flag: null,
});

const inputCls = 'w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500';
const Label = ({ children }: { children: React.ReactNode }) => <label className="text-xs font-bold block mb-1">{children}</label>;

export default function VendorUploadPage() {
  const router = useRouter();
  useVendor(); // layout already verified vendor role + terms on the server
  const [track, setTrack] = useState<BankTrack | null>(null);
  const [step, setStep] = useState<'info' | 'questions' | 'review'>('info');
  const [submitting, setSubmitting] = useState(false);

  // Pre-select the track when arriving from a dashboard shortcut (?type=university|ssce).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('type');
    if (t === 'university' || t === 'ssce') chooseTrack(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [info, setInfo] = useState({
    title: '', description: '', subject: '', exam_type: '',
    // university
    university: '', faculty: '', department: '', programme: '',
    level: '', semester: '', course_code: '', course_title: '',
    assessment_type: 'exam', academic_session: '',
    // ssce
    year_start: '', year_end: '', school: '', country: 'Nigeria',
    // commercial
    access_type: 'paid', price_naira: '', preview_count: '5',
  });
  const [questions, setQuestions] = useState<ManualQuestion[]>([emptyQ(1), emptyQ(2), emptyQ(3), emptyQ(4), emptyQ(5)]);

  // ── AI scan ──
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [quota, setQuota] = useState<{ limit: number; used: number; remaining: number } | null>(null);
  const [scanning, setScanning] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => { api('/api/vendor/scan').then(d => setQuota(d.quota)).catch(() => {}); }, []);

  const mergeScanned = (scanned: ScannedQuestion[]) => {
    if (scanned.length === 0) return;
    const n = Math.max(0, parseInt(info.preview_count || '0', 10));
    setQuestions(prev => {
      // Drop untouched placeholder rows so scanned questions don't sit after five empty cards.
      const kept = prev.filter(q => q.question_text || q.option_a || q.option_b || q.from_scan);
      const added: ManualQuestion[] = scanned.map((s, idx) => ({
        ...emptyQ(0),
        question_text: s.question_text, option_a: s.option_a, option_b: s.option_b, option_c: s.option_c, option_d: s.option_d,
        topic: s.topic, year: track === 'ssce' && s.year ? String(s.year) : '',
        correct_answer: '',            // the vendor must choose; we never guess answers
        is_preview: isPreview && kept.length + idx < n,
        from_scan: true, flag: s.flag,
      }));
      return [...kept, ...added].map((q, i) => ({ ...q, question_number: i + 1 }));
    });
  };

  const handleScanFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let list = Array.from(files);
    const remaining = quota?.remaining ?? list.length;
    if (remaining <= 0) { toast.error('No free scans left this month.'); return; }
    if (list.length > remaining) { toast(`Only ${remaining} free scan${remaining === 1 ? '' : 's'} left, so the first ${remaining} photo${remaining === 1 ? '' : 's'} will be scanned.`); list = list.slice(0, remaining); }

    let total = 0;
    setScanning({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        const { base64, mimeType } = await compressImage(list[i]);
        const res = await send<{ questions: ScannedQuestion[]; quota: typeof quota }>('/api/vendor/scan', 'POST', { image: base64, mimeType });
        mergeScanned(res.questions);
        total += res.questions.length;
        setQuota(res.quota);
        if (res.questions.length === 0) toast(`Page ${i + 1}: no multiple-choice questions found.`);
      } catch (e: any) {
        toast.error(`Page ${i + 1}: ${e.message}`);
        api('/api/vendor/scan').then(d => setQuota(d.quota)).catch(() => {});
        if (/free scans/i.test(e.message)) break;
      }
      setScanning({ done: i + 1, total: list.length });
    }
    setScanning(null);
    if (scanInputRef.current) scanInputRef.current.value = '';
    if (total > 0) toast.success(`Added ${total} question${total === 1 ? '' : 's'}. Choose the correct answer for each one.`);
  };

  const setI = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setInfo(p => ({ ...p, [key]: e.target.value }));

  function chooseTrack(t: BankTrack) {
    setTrack(t);
    setStep('info');
    setInfo(p => ({ ...p, exam_type: t === 'university' ? 'OTHER' : '', subject: '' }));
  }

  const isPostUtme = info.exam_type === 'POST-UTME';
  const isPreview = info.access_type === 'preview_paid';
  const isFree = info.access_type === 'free';

  /** Returns the first thing missing for the chosen track, or null when the form is valid. */
  const infoError = (): string | null => {
    if (!info.title.trim()) return 'Add a title';
    if (track === 'university') {
      if (!info.university.trim()) return 'Enter the university';
      if (isPostUtme) { if (!info.subject) return 'Select a subject'; }
      else if (!info.course_code.trim() || !info.course_title.trim()) return 'Enter the course code and course title';
    } else {
      if (!info.exam_type) return 'Select the exam (WAEC, NECO, JAMB...)';
      if (!info.subject) return 'Select a subject';
    }
    if (!isFree && (!info.price_naira || parseFloat(info.price_naira) <= 0)) return 'Enter a price';
    if (isPreview && (parseInt(info.preview_count || '0', 10) < 1)) return 'Preview count must be at least 1';
    return null;
  };

  const goToQuestions = () => {
    const err = infoError();
    if (err) { toast.error(err); return; }
    const n = Math.max(0, parseInt(info.preview_count || '0', 10));
    // Only preview+paid banks expose free questions; mark the first N by default.
    setQuestions(p => p.map((q, i) => ({ ...q, is_preview: isPreview ? i < n : false })));
    setStep('questions');
  };

  const addQuestion = () => setQuestions(p => [...p, emptyQ(p.length + 1)]);
  const removeQuestion = (i: number) => setQuestions(p => p.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, question_number: idx + 1 })));
  const updateQ = (i: number, key: string, val: string | boolean) =>
    setQuestions(p => p.map((q, idx) => idx === i ? { ...q, [key]: val } : q));

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login?next=/vendor/upload'); return; }
    const err = infoError();
    if (err) { toast.error(err); setStep('info'); return; }
    if (questions.length < 5) { toast.error('Minimum 5 questions required'); return; }
    const noAnswer = questions.find(q => !q.correct_answer);
    if (noAnswer) { toast.error(`Choose the correct answer for question ${noAnswer.question_number}`); setStep('questions'); return; }
    const incomplete = questions.find(q => !q.question_text || !q.option_a || !q.option_b);
    if (incomplete) { toast.error(`Question ${incomplete.question_number} is incomplete`); setStep('questions'); return; }
    const flagged = questions.find(q => q.flag);
    if (flagged) { toast.error(`Question ${flagged.question_number} still needs checking (see the yellow note)`); setStep('questions'); return; }
    if (isPreview && parseInt(info.preview_count, 10) >= questions.length) { toast.error('Preview count must be less than the number of questions'); return; }

    const uni = track === 'university';
    setSubmitting(true);
    try {
      const { data: bank, error: bankError } = await supabase.from('question_banks').insert({
        vendor_id: user.id,
        title: info.title.trim(),
        description: info.description,
        // University course banks have no secondary-school subject; use the course title.
        subject: uni && !isPostUtme ? info.course_title.trim() : info.subject,
        exam_type: info.exam_type,
        // SSCE-only
        year_start: !uni && info.year_start ? parseInt(info.year_start) : null,
        year_end: !uni && info.year_end ? parseInt(info.year_end) : null,
        school: !uni ? info.school : null,
        country: info.country,
        // University-only
        university: uni ? info.university.trim() : null,
        faculty: uni ? info.faculty || null : null,
        department: uni ? info.department || null : null,
        programme: uni ? info.programme || null : null,
        level: uni && !isPostUtme ? info.level || null : null,
        semester: uni && !isPostUtme ? info.semester || null : null,
        course_code: uni && !isPostUtme ? info.course_code.trim().toUpperCase() : null,
        course_title: uni && !isPostUtme ? info.course_title.trim() : null,
        assessment_type: uni && !isPostUtme ? info.assessment_type : 'exam',
        academic_session: uni ? info.academic_session || null : null,
        access_type: info.access_type,
        preview_count: isPreview ? Math.max(1, parseInt(info.preview_count || '5', 10)) : 0,
        price: isFree ? 0 : toKobo(parseFloat(info.price_naira)),
        question_count: questions.length,
        status: 'pending',
      }).select().single();
      if (bankError || !bank) throw bankError || new Error('Failed to create bank');

      const { error: qError } = await supabase.from('questions').insert(questions.map(q => ({
        bank_id: bank.id, vendor_id: user.id, question_number: q.question_number,
        year: !uni && q.year ? parseInt(q.year) : null,
        question_text: q.question_text, option_a: q.option_a, option_b: q.option_b,
        option_c: q.option_c, option_d: q.option_d, correct_answer: q.correct_answer,
        explanation: q.explanation, topic: q.topic, is_preview: isPreview ? q.is_preview : false,
      })));
      if (qError) throw qError;

      toast.success("Question bank submitted for review! We'll notify you within 24 hours.");
      router.push('/vendor/banks');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = ['info', 'questions', 'review'] as const;

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/vendor/dashboard" className="p-2 hover:bg-white rounded-xl transition-all"><ArrowLeft size={18} /></Link>
          <div className="flex-1">
            <h1 className="text-xl font-black">Upload Question Bank</h1>
            <p className="text-xs text-gray-400">Questions go live after our 24-hour review</p>
          </div>
          {track && (
            <div className="flex items-center gap-2">
              <span className={cn('text-[11px] font-black px-3 py-1 rounded-full', TRACK_BADGE[track])}>{TRACK_LABEL[track]}</span>
              <button onClick={() => setTrack(null)} className="text-xs text-gray-400 hover:text-gray-700 underline">Change</button>
            </div>
          )}
        </div>

        {/* Step 0: choose track */}
        {!track && (
          <div className="space-y-3">
            <h2 className="font-black">What are you uploading?</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <button onClick={() => chooseTrack('university')} className="text-left bg-white rounded-3xl p-6 border border-black/5 hover:border-indigo-400 hover:shadow-sm transition-all">
                <GraduationCap size={26} className="text-indigo-600 mb-3" />
                <p className="font-black">University questions</p>
                <p className="text-xs text-gray-500 mt-1">Course tests, quizzes and exams (by university, level, semester and course code), or a Post-UTME bank.</p>
              </button>
              <button onClick={() => chooseTrack('ssce')} className="text-left bg-white rounded-3xl p-6 border border-black/5 hover:border-amber-400 hover:shadow-sm transition-all">
                <School size={26} className="text-amber-600 mb-3" />
                <p className="font-black">SSCE questions</p>
                <p className="text-xs text-gray-500 mt-1">Secondary school and entrance past questions: WAEC, NECO, WASSCE, JAMB/UTME, BECE, KCSE (by subject and year).</p>
              </button>
            </div>
          </div>
        )}

        {track && (
          <div className="flex items-center gap-2">
            {steps.map((s, i) => {
              const done = i < steps.indexOf(step);
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-black',
                    step === s ? 'bg-green-600 text-white' : done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400')}>
                    {done ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <span className={cn('text-sm font-semibold capitalize', step === s ? 'text-gray-900' : 'text-gray-400')}>{s}</span>
                  {i < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 1: Bank info */}
        {track && step === 'info' && (
          <div className="bg-white rounded-3xl p-6 space-y-5">
            <h2 className="font-black">{track === 'university' ? 'University bank details' : 'SSCE bank details'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Title *</Label>
                <input value={info.title} onChange={setI('title')}
                  placeholder={track === 'university' ? 'e.g. ANA 201 Human Anatomy 2024/2025 Exam' : 'e.g. WAEC Mathematics 2015-2024 Compiled'} className={inputCls} />
              </div>

              {track === 'university' ? (
                <>
                  <div className="col-span-2">
                    <Label>Bank category *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {UNI_CATEGORIES.map(c => (
                        <button type="button" key={c.value} onClick={() => setInfo(p => ({ ...p, exam_type: c.value }))}
                          className={cn('text-left rounded-2xl border p-3 transition-all', info.exam_type === c.value ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300')}>
                          <p className="text-sm font-black">{c.label}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{c.hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label>University *</Label>
                    <input value={info.university} onChange={setI('university')} placeholder="e.g. Federal University of Health Sciences Ila-Orangun" className={inputCls} />
                  </div>
                  <div><Label>Faculty</Label><input value={info.faculty} onChange={setI('faculty')} placeholder="Faculty of Allied Health Sciences" className={inputCls} /></div>
                  <div><Label>Department</Label><input value={info.department} onChange={setI('department')} placeholder="Prosthetics & Orthotics" className={inputCls} /></div>
                  <div className="col-span-2"><Label>Programme</Label><input value={info.programme} onChange={setI('programme')} placeholder="BSc Prosthetics & Orthotics" className={inputCls} /></div>

                  {isPostUtme ? (
                    <div className="col-span-2">
                      <Label>Subject *</Label>
                      <select value={info.subject} onChange={setI('subject')} className={inputCls}>
                        <option value="">Select Subject</option>
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div><Label>Course Code *</Label><input value={info.course_code} onChange={setI('course_code')} placeholder="ANA 201" className={cn(inputCls, 'uppercase')} /></div>
                      <div><Label>Course Title *</Label><input value={info.course_title} onChange={setI('course_title')} placeholder="Human Anatomy" className={inputCls} /></div>
                      <div>
                        <Label>Level</Label>
                        <select value={info.level} onChange={setI('level')} className={inputCls}>
                          <option value="">Select Level</option>
                          {UNIVERSITY_LEVELS.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Semester</Label>
                        <select value={info.semester} onChange={setI('semester')} className={inputCls}>
                          <option value="">Select Semester</option>
                          {SEMESTERS.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Assessment *</Label>
                        <select value={info.assessment_type} onChange={setI('assessment_type')} className={inputCls}>
                          {ASSESSMENT_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  <div><Label>Academic Session</Label><input value={info.academic_session} onChange={setI('academic_session')} placeholder="2025/2026" className={inputCls} /></div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Exam *</Label>
                    <select value={info.exam_type} onChange={setI('exam_type')} className={inputCls}>
                      <option value="">Select Exam</option>
                      {SSCE_EXAMS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Subject *</Label>
                    <select value={info.subject} onChange={setI('subject')} className={inputCls}>
                      <option value="">Select Subject</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><Label>Year From</Label><input type="number" value={info.year_start} onChange={setI('year_start')} placeholder="2015" min="1990" max={new Date().getFullYear()} className={inputCls} /></div>
                  <div><Label>Year To</Label><input type="number" value={info.year_end} onChange={setI('year_end')} placeholder="2024" min="1990" max={new Date().getFullYear()} className={inputCls} /></div>
                  <div><Label>School / Source</Label><input value={info.school} onChange={setI('school')} placeholder="e.g. WAEC Official or School Name" className={inputCls} /></div>
                  <div>
                    <Label>Country</Label>
                    <select value={info.country} onChange={setI('country')} className={inputCls}>
                      {['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div className="col-span-2">
                <Label>Student access *</Label>
                <div className="grid md:grid-cols-3 gap-2">
                  {[
                    ['free', 'Free', 'Anyone can access the bank.'],
                    ['paid', 'Paid', 'Students purchase the full bank.'],
                    ['preview_paid', 'Preview + Paid', 'Show a limited preview, then charge for the full bank.'],
                  ].map(([value, label, description]) => (
                    <button type="button" key={value} onClick={() => setInfo(p => ({ ...p, access_type: value }))}
                      className={cn('text-left rounded-2xl border p-4 transition-all', info.access_type === value ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-200 hover:border-green-300')}>
                      <p className="text-sm font-black">{label}</p>
                      <p className="text-xs text-gray-500 mt-1">{description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {!isFree && (
                <div>
                  <Label>Price (₦) *</Label>
                  <input type="number" value={info.price_naira} onChange={setI('price_naira')} min="100" step="50" placeholder="500" className={inputCls} />
                  <p className="text-[10px] text-gray-400 mt-1">You earn 70% → ₦{info.price_naira ? (parseFloat(info.price_naira) * 0.7).toFixed(0) : '0'} per sale</p>
                </div>
              )}
              {isPreview && (
                <div>
                  <Label>Free preview questions</Label>
                  <input type="number" value={info.preview_count} onChange={setI('preview_count')} min="1" max="10" className={inputCls} />
                  <p className="text-[10px] text-gray-400 mt-1">Visible before purchase</p>
                </div>
              )}
              <div className="col-span-2">
                <Label>Description</Label>
                <textarea value={info.description} onChange={setI('description') as any} rows={3}
                  placeholder={track === 'university' ? 'Describe what is covered: topics, lecturer, session, etc.' : "Describe what's included: years covered, topics, etc."}
                  className={cn(inputCls, 'resize-none')} />
              </div>
            </div>
            <button onClick={goToQuestions} className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-sm">Next: Add Questions →</button>
          </div>
        )}

        {/* Step 2: Questions */}
        {track && step === 'questions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black">Add Questions ({questions.length})</h2>
                <p className="text-xs text-gray-400">{isPreview ? `First ${info.preview_count} are marked as free preview (you can change this)` : 'Minimum 5 questions'}</p>
              </div>
              <button onClick={addQuestion} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold"><Plus size={15} /> Add Question</button>
            </div>

            {/* AI scan */}
            <div className="bg-white rounded-3xl p-5 border border-indigo-100 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black flex items-center gap-2"><ScanLine size={18} className="text-indigo-600" /> Scan a paper</p>
                  <p className="text-xs text-gray-500 mt-1">Take a clear photo of each page. We read the questions and options for you. <strong>You choose the answers.</strong></p>
                </div>
                {quota && <span className="text-[11px] font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full whitespace-nowrap">{quota.remaining} of {quota.limit} free scans left</span>}
              </div>
              <input ref={scanInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                onChange={e => handleScanFiles(e.target.files)} />
              <button type="button" onClick={() => scanInputRef.current?.click()} disabled={!!scanning || quota?.remaining === 0}
                className="flex items-center justify-center gap-2 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold">
                {scanning ? <><Loader2 size={15} className="animate-spin" /> Scanning page {Math.min(scanning.done + 1, scanning.total)} of {scanning.total}…</> : <><ScanLine size={15} /> Choose photos</>}
              </button>
              {quota?.remaining === 0 && <p className="text-xs text-amber-700">You have used this month's free scans. They reset on the 1st; you can still type questions by hand.</p>}
              <p className="text-[11px] text-gray-400 flex items-start gap-1.5"><Info size={12} className="shrink-0 mt-0.5" /> Only scan papers you own or have permission to sell. Each photo uses one scan; check every question, because photos can be misread.</p>
            </div>

            {questions.map((q, i) => (
              <div key={i} className={cn('bg-white rounded-3xl p-5 border', q.flag ? 'border-amber-300' : isPreview && q.is_preview ? 'border-green-200' : 'border-black/5')}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black">{q.question_number}</span>
                    {isPreview && q.is_preview && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">FREE PREVIEW</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {isPreview && (
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={q.is_preview} onChange={e => updateQ(i, 'is_preview', e.target.checked)} className="accent-green-600" /> Preview
                      </label>
                    )}
                    {questions.length > 5 && (
                      <button onClick={() => removeQuestion(i)} className="p-1.5 text-gray-300 hover:text-rose-500 transition-all"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>

                {q.flag && (
                  <div className="mb-3 flex items-start justify-between gap-3 bg-amber-50 text-amber-800 rounded-2xl px-3 py-2 text-xs">
                    <p>{q.flag === 'figure'
                      ? 'This question refers to a diagram or figure we cannot attach yet. Rewrite it so it makes sense without the picture, or delete it.'
                      : 'Part of this question may be cut off or unclear. Compare it with the paper and fix any mistakes.'}</p>
                    <button type="button" onClick={() => updateQ(i, 'flag', null as any)} className="shrink-0 font-black underline">It's fine now</button>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {track === 'ssce' && (
                      <div className="w-20">
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">Year</label>
                        <input type="number" value={q.year} onChange={e => updateQ(i, 'year', e.target.value)} placeholder="2022"
                          className="w-full px-2 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-green-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">Topic</label>
                      <input value={q.topic} onChange={e => updateQ(i, 'topic', e.target.value)} placeholder={track === 'university' ? 'e.g. Upper limb' : 'e.g. Photosynthesis'}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-green-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">Question *</label>
                    <textarea value={q.question_text} onChange={e => updateQ(i, 'question_text', e.target.value)} rows={2} placeholder="Type the question here..."
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs resize-none focus:outline-none focus:border-green-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['a', 'b', 'c', 'd'] as const).map(opt => (
                      <div key={opt}>
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">Option {opt.toUpperCase()}{opt === 'a' || opt === 'b' ? ' *' : ''}</label>
                        <input value={q[`option_${opt}` as keyof ManualQuestion] as string} onChange={e => updateQ(i, `option_${opt}`, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-green-500" />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">Correct Answer *</label>
                      <select value={q.correct_answer} onChange={e => updateQ(i, 'correct_answer', e.target.value)}
                        className={cn('px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-green-500', q.correct_answer ? 'border-gray-200' : 'border-rose-300 bg-rose-50')}>
                        {!q.correct_answer && <option value="">Choose…</option>}
                        {['A', 'B', 'C', 'D'].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">Explanation (recommended)</label>
                      <input value={q.explanation} onChange={e => updateQ(i, 'explanation', e.target.value)} placeholder="Why is this the correct answer?"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <button onClick={() => setStep('info')} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm font-bold transition-all">← Back</button>
              <button onClick={() => setStep('review')} disabled={questions.length < 5 || questions.some(q => !q.correct_answer || q.flag)}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm">Review & Submit →</button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {track && step === 'review' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 space-y-4">
              <h2 className="font-black">Review Before Submitting</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {([
                  ['Type', TRACK_LABEL[track] + (track === 'university' ? (isPostUtme ? ' · Post-UTME' : ' · Course') : ` · ${info.exam_type}`)],
                  ['Title', info.title],
                  ...(track === 'university'
                    ? [['University', info.university], ...(isPostUtme ? [['Subject', info.subject]] : [['Course', `${info.course_code.toUpperCase()} · ${info.course_title}`], ['Level / Semester', [info.level, info.semester].filter(Boolean).join(' · ') || '—']])]
                    : [['Subject', info.subject], ['Year Range', info.year_start ? `${info.year_start}–${info.year_end || 'present'}` : '—']]),
                  ['Access', isFree ? 'Free' : isPreview ? `Preview (${info.preview_count}) + Paid` : 'Paid'],
                  ['Price', isFree ? 'Free' : `₦${info.price_naira}`],
                  ['Questions', questions.length],
                  ['Your Earnings', isFree ? '—' : `₦${(parseFloat(info.price_naira || '0') * 0.7).toFixed(0)} per sale`],
                ] as [string, string | number][]).map(([label, value]) => (
                  <div key={label}><p className="text-xs text-gray-400">{label}</p><p className="font-semibold">{value}</p></div>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl">
              <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">Your question bank will be reviewed within 24 hours before going live. We check for quality, accuracy, and completeness.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('questions')} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm font-bold">← Edit</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : '✓ Submit for Review'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
