'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { EXAM_TYPES, SUBJECTS, UNIVERSITY_LEVELS, SEMESTERS, ASSESSMENT_TYPES, ACCESS_TYPES, cn } from '@/lib/utils';
import { toKobo } from '@/lib/paystack';
import { Upload, Plus, Trash2, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ManualQuestion {
  question_number: number;
  year: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  topic: string;
  is_preview: boolean;
}

const emptyQ = (num: number): ManualQuestion => ({
  question_number: num, year: '', question_text: '', option_a: '', option_b: '',
  option_c: '', option_d: '', correct_answer: 'A', explanation: '', topic: '', is_preview: num <= 3,
});

export default function VendorUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'info' | 'questions' | 'review'>('info');
  const [submitting, setSubmitting] = useState(false);

  const [info, setInfo] = useState({
    title: '', description: '', subject: '', exam_type: '',
    university: '', faculty: '', department: '', programme: '',
    level: '', semester: '', course_code: '', course_title: '',
    assessment_type: 'exam', academic_session: '',
    access_type: 'paid',
    year_start: '', year_end: '', school: '', country: 'Nigeria',
    price_naira: '', preview_count: '5',
  });

  const [questions, setQuestions] = useState<ManualQuestion[]>([emptyQ(1), emptyQ(2), emptyQ(3)]);

  const setI = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setInfo(p => ({ ...p, [key]: e.target.value }));

  const addQuestion = () => setQuestions(p => [...p, emptyQ(p.length + 1)]);
  const removeQuestion = (i: number) => setQuestions(p => p.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, question_number: idx + 1 })));
  const updateQ = (i: number, key: string, val: string | boolean) =>
    setQuestions(p => p.map((q, idx) => idx === i ? { ...q, [key]: val } : q));

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    if (!info.title || !info.subject || !info.exam_type || !info.university || !info.course_code || !info.course_title || (info.access_type !== 'free' && (!info.price_naira || parseFloat(info.price_naira) <= 0))) {
      toast.error('Fill all required fields including university, course code and course title'); return;
    }
    if (questions.length < 5) { toast.error('Minimum 5 questions required'); return; }
    const incomplete = questions.find(q => !q.question_text || !q.option_a || !q.option_b || !q.correct_answer);
    if (incomplete) { toast.error(`Question ${incomplete.question_number} is incomplete`); return; }

    setSubmitting(true);
    try {
      // Create question bank
      const { data: bank, error: bankError } = await supabase.from('question_banks').insert({
        vendor_id: user.id,
        title: info.title,
        description: info.description,
        subject: info.subject,
        exam_type: info.exam_type,
        year_start: info.year_start ? parseInt(info.year_start) : null,
        year_end: info.year_end ? parseInt(info.year_end) : null,
        school: info.school,
        country: info.country,
        university: info.university,
        faculty: info.faculty,
        department: info.department,
        programme: info.programme,
        level: info.level,
        semester: info.semester,
        course_code: info.course_code.toUpperCase(),
        course_title: info.course_title,
        assessment_type: info.assessment_type,
        academic_session: info.academic_session,
        access_type: info.access_type,
        preview_count: info.access_type === 'preview_paid' ? Math.max(0, parseInt(info.preview_count || '5', 10)) : 0,
        price: info.access_type === 'free' ? 0 : toKobo(parseFloat(info.price_naira)),
        question_count: questions.length,
        status: 'pending',
      }).select().single();

      if (bankError || !bank) throw bankError || new Error('Failed to create bank');

      // Insert questions in batches
      const toInsert = questions.map(q => ({
        bank_id: bank.id,
        vendor_id: user.id,
        question_number: q.question_number,
        year: q.year ? parseInt(q.year) : null,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        topic: q.topic,
        is_preview: q.is_preview,
      }));

      const { error: qError } = await supabase.from('questions').insert(toInsert);
      if (qError) throw qError;

      toast.success('Question bank submitted for review! We\'ll notify you within 24 hours.');
      router.push('/vendor/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/vendor/dashboard" className="p-2 hover:bg-white rounded-xl transition-all">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-black">Upload Question Bank</h1>
            <p className="text-xs text-gray-400">Questions go live after our 24-hour review</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {(['info', 'questions', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-black',
                step === s ? 'bg-green-600 text-white' : i < ['info','questions','review'].indexOf(step) ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400')}>
                {i < ['info','questions','review'].indexOf(step) ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={cn('text-sm font-semibold capitalize', step === s ? 'text-gray-900' : 'text-gray-400')}>{s}</span>
              {i < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Step 1: Bank Info */}
        {step === 'info' && (
          <div className="bg-white rounded-3xl p-6 space-y-4">
            <h2 className="font-black">Bank Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-bold block mb-1">Title *</label>
                <input value={info.title} onChange={setI('title')} required placeholder="e.g. WAEC Mathematics 2015-2024 Compiled"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Subject *</label>
                <select value={info.subject} onChange={setI('subject')} required
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500">
                  <option value="">Select Subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Exam Type *</label>
                <select value={info.exam_type} onChange={setI('exam_type')} required
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500">
                  <option value="">Select Exam</option>
                  {EXAM_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold block mb-1">University *</label>
                <input value={info.university} onChange={setI('university')} placeholder="e.g. Federal University of Health Sciences Ila-Orangun"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Faculty</label>
                <input value={info.faculty} onChange={setI('faculty')} placeholder="Faculty of Allied Health Sciences"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Department</label>
                <input value={info.department} onChange={setI('department')} placeholder="Prosthetics & Orthotics"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Programme</label>
                <input value={info.programme} onChange={setI('programme')} placeholder="BSc Prosthetics & Orthotics"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Level</label>
                <select value={info.level} onChange={setI('level')}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500">
                  <option value="">Select Level</option>
                  {UNIVERSITY_LEVELS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Semester</label>
                <select value={info.semester} onChange={setI('semester')}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500">
                  <option value="">Select Semester</option>
                  {SEMESTERS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Course Code *</label>
                <input value={info.course_code} onChange={setI('course_code')} placeholder="ANA 201"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm uppercase focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Course Title *</label>
                <input value={info.course_title} onChange={setI('course_title')} placeholder="Human Anatomy"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Assessment *</label>
                <select value={info.assessment_type} onChange={setI('assessment_type')}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500">
                  {ASSESSMENT_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Academic Session</label>
                <input value={info.academic_session} onChange={setI('academic_session')} placeholder="2025/2026"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold block mb-2">Student access *</label>
                <div className="grid md:grid-cols-3 gap-2">
                  {[
                    ['free', 'Free', 'Anyone can access the bank.'],
                    ['paid', 'Paid', 'Students purchase the full bank.'],
                    ['preview_paid', 'Preview + Paid', 'Show a limited preview, then charge for the full bank.'],
                  ].map(([value, label, description]) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => setInfo(prev => ({ ...prev, access_type: value }))}
                      className={`text-left rounded-2xl border p-4 transition-all ${
                        info.access_type === value
                          ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <p className="text-sm font-black">{label}</p>
                      <p className="text-xs text-gray-500 mt-1">{description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {info.access_type === 'preview_paid' && (
                <div>
                  <label className="text-xs font-bold block mb-1">Free preview questions</label>
                  <input
                    type="number"
                    min="1"
                    value={info.preview_count}
                    onChange={setI('preview_count')}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-bold block mb-1">Year From</label>
                <input type="number" value={info.year_start} onChange={setI('year_start')} placeholder="2015" min="1990" max={new Date().getFullYear()}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Year To</label>
                <input type="number" value={info.year_end} onChange={setI('year_end')} placeholder="2024" min="1990" max={new Date().getFullYear()}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">School / Source</label>
                <input value={info.school} onChange={setI('school')} placeholder="e.g. WAEC Official or School Name"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Country</label>
                <select value={info.country} onChange={setI('country')}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500">
                  {['Nigeria','Ghana','Kenya','South Africa','Other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Price (₦) {info.access_type === "free" ? "(free)" : "*"}</label>
                <input type="number" value={info.price_naira} onChange={setI('price_naira')} required min="100" step="50" placeholder={info.access_type === "free" ? "0 (free)" : "500"}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
                <p className="text-[10px] text-gray-400 mt-1">You earn 70% → ₦{info.price_naira ? (parseFloat(info.price_naira) * 0.7).toFixed(0) : '0'} per sale</p>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Free Preview Questions</label>
                <input type="number" value={info.preview_count} onChange={setI('preview_count')} min="3" max="10"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-green-500" />
                <p className="text-[10px] text-gray-400 mt-1">Visible before purchase (min 3)</p>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold block mb-1">Description</label>
                <textarea value={info.description} onChange={setI('description') as any} rows={3}
                  placeholder="Describe what's included — years covered, topics, school, etc."
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-green-500" />
              </div>
            </div>
            <button onClick={() => setStep('questions')} disabled={!info.title || !info.subject || !info.exam_type || !info.university || !info.course_code || !info.course_title || (info.access_type !== 'free' && !info.price_naira)}
              className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm">
              Next: Add Questions →
            </button>
          </div>
        )}

        {/* Step 2: Questions */}
        {step === 'questions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black">Add Questions ({questions.length})</h2>
                <p className="text-xs text-gray-400">First {info.preview_count} will be marked as free preview</p>
              </div>
              <button onClick={addQuestion} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold">
                <Plus size={15} /> Add Question
              </button>
            </div>

            {questions.map((q, i) => (
              <div key={i} className={cn('bg-white rounded-3xl p-5 border', q.is_preview ? 'border-green-200' : 'border-black/5')}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black">{q.question_number}</span>
                    {q.is_preview && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">FREE PREVIEW</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={q.is_preview} onChange={e => updateQ(i, 'is_preview', e.target.checked)} className="accent-green-600" />
                      Preview
                    </label>
                    {questions.length > 3 && (
                      <button onClick={() => removeQuestion(i)} className="p-1.5 text-gray-300 hover:text-rose-500 transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="w-20">
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">Year</label>
                      <input type="number" value={q.year} onChange={e => updateQ(i, 'year', e.target.value)} placeholder="2022"
                        className="w-full px-2 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-green-500" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">Topic</label>
                      <input value={q.topic} onChange={e => updateQ(i, 'topic', e.target.value)} placeholder="e.g. Photosynthesis"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-green-500" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">Question *</label>
                    <textarea value={q.question_text} onChange={e => updateQ(i, 'question_text', e.target.value)} rows={2} required
                      placeholder="Type the question here..."
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs resize-none focus:outline-none focus:border-green-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(['a','b','c','d'] as const).map(opt => (
                      <div key={opt}>
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">Option {opt.toUpperCase()}{opt === 'a' || opt === 'b' ? ' *' : ''}</label>
                        <input value={q[`option_${opt}` as keyof ManualQuestion] as string}
                          onChange={e => updateQ(i, `option_${opt}`, e.target.value)}
                          required={opt === 'a' || opt === 'b'}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-green-500" />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">Correct Answer *</label>
                      <select value={q.correct_answer} onChange={e => updateQ(i, 'correct_answer', e.target.value)}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-green-500">
                        {['A','B','C','D'].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 block mb-1">Explanation (recommended)</label>
                      <input value={q.explanation} onChange={e => updateQ(i, 'explanation', e.target.value)}
                        placeholder="Why is this the correct answer?"
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <button onClick={() => setStep('info')} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm font-bold transition-all">
                ← Back
              </button>
              <button onClick={() => setStep('review')} disabled={questions.length < 5}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm">
                Review & Submit →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 space-y-4">
              <h2 className="font-black">Review Before Submitting</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Title', info.title], ['Subject', info.subject],
                  ['Exam Type', info.exam_type], ['Price', `₦${info.price_naira}`],
                  ['Questions', questions.length], ['Preview Questions', info.preview_count],
                  ['Year Range', info.year_start ? `${info.year_start}–${info.year_end || 'present'}` : '—'],
                  ['Your Earnings', `₦${(parseFloat(info.price_naira || '0') * 0.7).toFixed(0)} per sale`],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl">
              <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                Your question bank will be reviewed within 24 hours before going live.
                We check for quality, accuracy, and completeness.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('questions')} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm font-bold">
                ← Edit
              </button>
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
