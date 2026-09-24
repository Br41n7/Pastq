'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { QuestionBank, Question, Purchase } from '@/types';
import { formatNaira } from '@/lib/paystack';
import { Lock, CheckCircle2, BookOpen, Star, ShoppingCart, Zap, ArrowLeft, Loader2, Flag, ExternalLink, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BankDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bankId = params.id as string;

  const [bank, setBank] = useState<QuestionBank & { vendor?: any } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('wrong_answer');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: bankData } = await supabase
        .from('question_banks')
        .select('*, vendor:vendor_id(full_name, school, avatar_url)')
        .eq('id', bankId).single();
      setBank(bankData as any);

      // Question content is served through the server-side entitlement endpoint.
      // Never query the questions table directly from the browser: its rows contain
      // correct answers and explanations.
      const questionsRes = await fetch(`/api/banks/${encodeURIComponent(bankId)}/questions`, { cache: 'no-store' });
      if (questionsRes.ok) {
        const questionsData = await questionsRes.json();
        setQuestions(questionsData.questions || []);
        if (questionsData.entitled && user) {
          setPurchase({ bank_id: bankId } as Purchase);
        }
      }
      setLoading(false);
    }
    load();
  }, [bankId]);

  const handlePurchase = async () => {
    if (!user) { router.push('/auth/login'); return; }
    setPaying(true);

    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_id: bankId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment initialization failed');

      if (data.alreadyPurchased) {
        router.refresh();
        return;
      }

      if (!data.authorization_url) throw new Error('Payment initialization failed');
      window.location.href = data.authorization_url;
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
      setPaying(false);
    }
  };

  const submitReport = async () => {
    if (!user) { router.push('/auth/login'); return; }
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id,
      bank_id: bankId,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });
    if (error) {
      toast.error(error.message || 'Could not submit report');
      return;
    }
    toast.success('Report submitted. Thanks for helping keep PastQ accurate.');
    setReportOpen(false);
    setReportDetails('');
  };

  const handleImportToAkili = () => {
    // PastQ remains the source/content marketplace. Akili owns timed exams,
    // explanations, performance analytics and study workflows.
    const url = `/akili?bank_id=${encodeURIComponent(bankId)}`;
    window.location.href = url;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-green-600" />
    </div>
  );

  if (!bank) return <div className="p-8 text-center">Bank not found</div>;

  const isPurchased = !!purchase || bank.access_type === 'free';

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Link href="/browse" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Back to Browse
        </Link>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">{bank.exam_type}</span>
                <span className="text-xs text-gray-400">{bank.subject}</span>
              </div>
              <h1 className="text-2xl font-black mb-2">{bank.title}</h1>
              <div className="flex flex-wrap gap-2 mb-3">
                {bank.course_code && <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">{bank.course_code}</span>}
                {bank.level && <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{bank.level}</span>}
                {bank.assessment_type && <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full uppercase">{bank.assessment_type}</span>}
                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                  bank.access_type === 'free' ? 'bg-green-50 text-green-700' :
                  bank.access_type === 'preview_paid' ? 'bg-orange-50 text-orange-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {bank.access_type === 'free' ? 'FREE' : bank.access_type === 'preview_paid' ? 'PREVIEW + PAID' : 'PAID'}
                </span>
              </div>
              {bank.course_title && <p className="font-semibold text-sm text-gray-700 mb-1">{bank.course_title}</p>}
              {bank.university && <p className="text-xs text-gray-400 mb-1">{bank.university}{bank.department ? ` · ${bank.department}` : ''}</p>}
              {bank.academic_session && <p className="text-xs text-gray-400 mb-3">{bank.academic_session}{bank.semester ? ` · ${bank.semester}` : ''}</p>}
              {bank.description && <p className="text-gray-500 text-sm mb-4">{bank.description}</p>}

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  ['Questions', bank.question_count],
                  ['Years', bank.year_start ? `${bank.year_start}–${bank.year_end || bank.year_start}` : 'Multiple'],
                  ['Sales', bank.total_sales],
                ].map(([label, val]) => (
                  <div key={label as string} className="bg-gray-50 rounded-2xl p-3">
                    <p className="font-black text-lg">{val}</p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                ))}
              </div>

              {bank.vendor && (
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-black/5">
                  <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center font-bold text-green-700 text-sm">
                    {bank.vendor.full_name?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{bank.vendor.full_name}</p>
                    <p className="text-xs text-gray-400">{bank.vendor.school || 'Verified Vendor'}</p>
                  </div>
                  {bank.rating > 0 && (
                    <div className="ml-auto flex items-center gap-1">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      <span className="font-bold text-sm">{bank.rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({bank.rating_count})</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview / Full Questions */}
            <div className="bg-white rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-lg">
                  {isPurchased ? `All ${questions.length} Questions` : `Preview (${questions.length} of ${bank.question_count})`}
                </h2>
                {!isPurchased && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Lock size={12} /> {bank.question_count - questions.length} locked
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={q.id} className="border border-black/5 rounded-2xl p-4">
                    <p className="font-semibold text-sm mb-2">
                      {q.year ? `${q.year} ` : ''}{q.question_number}. {q.question_text}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['A','B','C','D','E'] as const).map(opt => {
                        const text = q[`option_${opt.toLowerCase()}` as keyof Question] as string;
                        if (!text) return null;
                        const isCorrect = isPurchased && opt === q.correct_answer;
                        return (
                          <div key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${isCorrect ? 'bg-green-50 border border-green-300 font-semibold text-green-700' : 'bg-gray-50'}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isCorrect ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>{opt}</span>
                            {text}
                            {isCorrect && <CheckCircle2 size={12} className="ml-auto text-green-600" />}
                          </div>
                        );
                      })}
                    </div>
                    {isPurchased && q.explanation && (
                      <p className="text-xs text-indigo-600 mt-2 pl-1">💡 {q.explanation}</p>
                    )}
                  </div>
                ))}

                {!isPurchased && (
                  <div className="text-center py-8 bg-gradient-to-b from-transparent to-gray-50 rounded-2xl">
                    <Lock size={24} className="mx-auto text-gray-300 mb-2" />
                    <p className="font-semibold text-sm text-gray-500">{bank.question_count - questions.length} more questions locked</p>
                    <p className="text-xs text-gray-400 mt-1">Purchase to unlock all questions + answers + explanations</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isPurchased && (
            <div className="bg-white rounded-3xl p-6 border border-green-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-green-600 uppercase tracking-wide">Ready to study?</p>
                  <h3 className="font-black mt-1">Take this into Akili</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    PastQ provides the question bank. Akili handles timed exams, AI explanations,
                    performance tracking and personalized revision.
                  </p>
                </div>
                <button onClick={handleImportToAkili}
                  className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap">
                  Open in Akili <ExternalLink size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Purchase card */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 sticky top-24">
              <p className="text-3xl font-black text-green-600">{bank.access_type === 'free' ? 'FREE' : formatNaira(bank.price)}</p>
              <p className="text-xs text-gray-400 mt-1">{bank.access_type === 'free' ? 'No payment required' : 'One-time payment'}</p>

              <div className="space-y-2 my-5">
                {[
                  `${bank.question_count} questions{bank.access_type === 'preview_paid' && bank.preview_count ? ` · ${bank.preview_count} free preview` : ''} with answers`,
                  'Detailed explanations',
                  'AI topic frequency analysis',
                  'Import to Akili for AI study',
                  'Lifetime access',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={15} className="text-green-600 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              {isPurchased ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 p-3 rounded-2xl text-sm font-semibold">
                    <CheckCircle2 size={16} /> {bank.access_type === 'free' ? 'Free access' : 'Already purchased'}
                  </div>
                  <button onClick={handleImportToAkili}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                    <Zap size={16} /> {bank.access_type === 'free' ? 'Open in Akili' : 'Import to Akili'}
                  </button>
                </div>
              ) : (
                <button onClick={handlePurchase} disabled={paying}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                  {paying ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><ShoppingCart size={16} /> {bank.access_type === 'preview_paid' ? 'Unlock Full Bank' : 'Buy Full Bank'}</>}
                </button>
              )}

              {bank.access_type !== 'free' && <p className="text-center text-xs text-gray-400 mt-3">Secured by Paystack 🔒</p>}
              <button onClick={() => setReportOpen(true)} className="w-full mt-3 text-xs text-gray-400 hover:text-rose-600 flex items-center justify-center gap-1.5">
                <Flag size={12} /> Report a problem
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
