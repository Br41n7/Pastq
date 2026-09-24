'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Search, Filter, Star, BookOpen, GraduationCap, ShoppingCart } from 'lucide-react';
import { QuestionBank } from '@/types';
import { formatNaira } from '@/lib/paystack';
import { EXAM_TYPES, SUBJECTS, ASSESSMENT_TYPES, UNIVERSITY_LEVELS, SEMESTERS } from '@/lib/utils';

function BrowseContent() {
  const searchParams = useSearchParams();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState(searchParams.get('exam') || '');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState(searchParams.get('level') || '');
  const [assessmentFilter, setAssessmentFilter] = useState(searchParams.get('assessment') || '');
  const [universityFilter, setUniversityFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [accessFilter, setAccessFilter] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase
        .from('question_banks')
        .select('*, vendor:vendor_id(full_name, school)')
        .eq('status', 'live')
        .order('total_sales', { ascending: false });

      if (examFilter) q = q.eq('exam_type', examFilter);
      if (subjectFilter) q = q.eq('subject', subjectFilter);
      if (levelFilter) q = q.eq('level', levelFilter);
      if (assessmentFilter) q = q.eq('assessment_type', assessmentFilter);
      if (universityFilter) q = q.ilike('university', `%${universityFilter}%`);
      if (courseFilter) q = q.ilike('course_code', `%${courseFilter}%`);
      if (accessFilter) q = q.eq('access_type', accessFilter);
      if (search) q = q.or(`title.ilike.%${search}%,subject.ilike.%${search}%,course_code.ilike.%${search}%,course_title.ilike.%${search}%,university.ilike.%${search}%,department.ilike.%${search}%`);

      const { data } = await q.limit(40);
      setBanks((data as any[]) || []);
      setLoading(false);
    }
    load();
  }, [search, examFilter, subjectFilter, levelFilter, assessmentFilter, universityFilter, courseFilter, accessFilter]);

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="bg-white border-b border-black/8 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
            <GraduationCap size={15} className="text-white" />
          </div>
          <span className="font-black">PastQ</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/vendor/dashboard" className="text-sm text-gray-500 hover:text-gray-700">Sell Questions</Link>
          <Link href="/auth/login" className="text-sm font-semibold text-green-600">Sign In</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black">Browse Question Banks</h1>
          <p className="text-gray-500 text-sm mt-1">Real past questions compiled by verified teachers and tutors</p>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search course code, course, university, department..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm bg-white" />
          </div>
          <select value={examFilter} onChange={e => setExamFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm bg-white">
            <option value="">All Exam Types</option>
            {EXAM_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm bg-white">
            <option value="">All Subjects</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm bg-white">
            <option value="">All Levels</option>
            {UNIVERSITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={assessmentFilter} onChange={e => setAssessmentFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm bg-white">
            <option value="">Test / Exam</option>
            {ASSESSMENT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <input value={universityFilter} onChange={e => setUniversityFilter(e.target.value)}
            placeholder="University (e.g. Federal University of Health Sciences Ila-Orangun)"
            className="px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm bg-white" />
          <input value={courseFilter} onChange={e => setCourseFilter(e.target.value)}
            placeholder="Course code (e.g. ANA 201)"
            className="px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm bg-white" />
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            ['','All'],
            ['free','Free'],
            ['paid','Paid'],
            ['preview_paid','Preview + Paid'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setAccessFilter(value)}
              className={`px-3 py-2 rounded-xl text-xs font-bold ${accessFilter === value ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Quick filters */}
        <div className="flex gap-2 flex-wrap">
          {EXAM_TYPES.slice(0, 6).map(e => (
            <button key={e} onClick={() => setExamFilter(examFilter === e ? '' : e)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${examFilter === e ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-500'}`}>
              {e}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded mb-3 w-3/4" />
                <div className="h-3 bg-gray-100 rounded mb-2 w-1/2" />
                <div className="h-8 bg-gray-100 rounded mt-4" />
              </div>
            ))}
          </div>
        ) : banks.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No question banks found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banks.map(bank => <BankCard key={bank.id} bank={bank} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function BankCard({ bank }: { bank: QuestionBank & { vendor?: any } }) {
  return (
    <Link href={`/bank/${bank.id}`} className="block bg-white rounded-3xl p-5 border border-black/5 hover:border-green-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">{bank.exam_type}</span>
        {bank.rating > 0 && (
          <div className="flex items-center gap-1">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold">{bank.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <h3 className="font-bold text-sm mb-1 group-hover:text-green-600 transition-colors">{bank.title}</h3>
      <p className="text-xs font-semibold text-gray-500">{bank.course_code || bank.subject}{bank.course_title ? ` · ${bank.course_title}` : ''}</p>
      {bank.university && <p className="text-xs text-gray-400 mt-1">{bank.university}</p>}
      {bank.level && <p className="text-xs text-gray-400">{bank.level}{bank.semester ? ` · ${bank.semester}` : ''}</p>}
      {bank.assessment_type && <span className="inline-block mt-1 mr-1 text-[10px] uppercase font-bold text-indigo-600">{bank.assessment_type}</span>}
      {bank.access_type === 'free' && <span className="inline-block mt-1 text-[10px] uppercase font-black text-green-700">FREE</span>}
      {bank.access_type === 'preview_paid' && <span className="inline-block mt-1 text-[10px] uppercase font-black text-amber-700">PREVIEW</span>}
      {bank.year_start && (
        <p className="text-xs text-gray-400">{bank.year_start}{bank.year_end && bank.year_end !== bank.year_start ? ` – ${bank.year_end}` : ''}</p>
      )}

      <div className="flex items-center gap-2 mt-1">
        <BookOpen size={12} className="text-gray-400" />
        <span className="text-xs text-gray-400">{bank.question_count} questions</span>
        <span className="text-gray-200">·</span>
        <span className="text-xs text-gray-400">{bank.total_sales} sold</span>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/5">
        <div>
          <p className="font-black text-green-600 text-lg">{bank.access_type === 'free' ? 'FREE' : formatNaira(bank.price)}</p>
          <p className="text-[10px] text-gray-400">by {bank.vendor?.full_name}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-green-600 group-hover:bg-green-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all">
          <ShoppingCart size={12} /> Buy
        </div>
      </div>
    </Link>
  );
}

export default function BrowsePage() {
  return <Suspense><BrowseContent /></Suspense>;
}
