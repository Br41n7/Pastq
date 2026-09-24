'use client';
import Link from 'next/link';
import { BookOpen, TrendingUp, Shield, Zap, ChevronRight, GraduationCap, Target, Search, BarChart3 } from 'lucide-react';

const EXAM_TYPES = ['WAEC', 'JAMB', 'NECO', 'KCSE', 'WASSCE', 'POST-UTME'];
const STATS = [
  { label: 'Free previews', value: 'Try before you buy', icon: Search },
  { label: 'Online practice', value: 'Practice in your browser', icon: Target },
  { label: 'Performance', value: 'See weak topics', icon: BarChart3 },
  { label: 'Secure payments', value: 'Paystack protected', icon: Shield },
];
const FEATURES = [
  { icon: BookOpen, title: 'Find your exact course', desc: 'Browse by university, department, level, semester and course code — not just a generic subject.' },
  { icon: Target, title: 'Buy with confidence', desc: 'Preview real questions before you buy, with clear course, level and assessment information.' },
  { icon: TrendingUp, title: 'Take learning further with Akili', desc: 'Purchased question banks can be opened in Akili for timed exams, AI explanations and personalized revision.' },
  { icon: Shield, title: 'Moderated question banks', desc: 'Submissions are reviewed before they become part of the marketplace, with reporting for bad content.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="bg-white border-b border-black/8 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <span className="font-black text-lg">PastQ</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link href="/browse" className="hover:text-green-600">Browse</Link>
          <Link href="/auth/signup?role=vendor" className="hover:text-green-600">Sell Questions</Link>
          <Link href="/auth/login" className="hover:text-green-600">Sign in</Link>
        </div>
        <Link href="/auth/signup" className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
          Get Started Free
        </Link>
      </nav>

      {/* Hero */}
      <section className="bg-white px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-semibold">
            🇳🇬 Built for African students
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight">
            The smarter way to<br />
            <span className="text-green-600">ace your exams</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Find university past questions by course, practice them online,
            and discover the topics you actually need to revise.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/browse" className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all inline-flex items-center gap-2">
              Find My Course <ChevronRight size={20} />
            </Link>
            <Link href="/auth/signup?role=vendor" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-8 py-4 rounded-2xl font-bold text-lg transition-all">
              Sell Your Questions →
            </Link>
          </div>

          <div className="flex flex-wrap gap-2 justify-center pt-4">
            {['100 Level','200 Level','300 Level','400 Level','Test','Exam'].map(item => (
              <Link key={item} href={`/browse?level=${encodeURIComponent(item)}`} className="px-4 py-2 bg-gray-100 hover:bg-green-50 hover:text-green-700 rounded-full text-sm font-semibold transition-all">
                {item}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-green-600 px-6 py-12">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
          {STATS.map(s => (
            <div key={s.label}>
              <s.icon size={22} className="mx-auto mb-2 text-green-200" />
              <p className="text-lg font-black">{s.value}</p>
              <p className="text-green-200 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-12">Not just a PDF. A complete study system.</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="p-6 bg-[#F8F8F8] rounded-3xl flex gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                  <f.icon size={22} className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{f.title}</h3>
                  <p className="text-gray-500 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 bg-[#F8F8F8]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-10">From course code to better preparation</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              ['01','Find your course','Search ANA 201, PHY 203, your department or level.'],
              ['02','Preview quality','Try free preview questions before spending money.'],
              ['03','Purchase securely','Get legitimate access to the question bank after payment.'],
              ['04','Study with Akili','Move your purchased questions into Akili for intelligent learning.'],
            ].map(([n,t,d]) => (
              <div key={n} className="bg-white rounded-3xl p-5 border border-black/5">
                <p className="text-green-600 font-black text-sm">{n}</p>
                <h3 className="font-bold mt-3">{t}</h3>
                <p className="text-sm text-gray-500 mt-2">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vendor CTA */}
      <section className="px-6 py-20 bg-[#0A0A0A] text-white text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-4xl font-black">Got compiled past questions?</h2>
          <p className="text-gray-400 text-lg">
            Turn your hard work into income. Vendors earn 70% of every sale.
            You compile once — earn every time a student buys.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[['Upload', 'Your compiled questions'], ['Set Price', 'You decide the value'], ['Earn 70%', 'Every single sale']].map(([title, sub]) => (
              <div key={title} className="bg-white/8 rounded-2xl p-4">
                <p className="font-black text-lg text-green-400">{title}</p>
                <p className="text-gray-400 text-xs mt-1">{sub}</p>
              </div>
            ))}
          </div>
          <Link href="/auth/signup?role=vendor" className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black px-8 py-4 rounded-2xl font-black text-lg transition-all">
            Start Selling Today <ChevronRight size={20} />
          </Link>
        </div>
      </section>

      {/* Akili Integration CTA */}
      <section className="px-6 py-16 bg-indigo-50 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Zap size={22} className="text-white" />
          </div>
          <h2 className="text-2xl font-black">Questions + AI Study Platform</h2>
          <p className="text-gray-500">
            Import any question bank directly into <strong>Akili</strong> — our AI study platform — and let AI build a complete structured course from it. One click, full study system.
          </p>
          <a href={process.env.NEXT_PUBLIC_AKILI_URL || 'https://akili.study'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all">
            Open Akili <ChevronRight size={16} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-black/8 px-6 py-8 text-center text-sm text-gray-400">
        <p>© {new Date().getFullYear()} PastQ. Built for African students.</p>
        <div className="flex gap-4 justify-center mt-2">
          <Link href="/browse" className="hover:text-gray-700">Browse</Link>
          <Link href="/auth/signup?role=vendor" className="hover:text-gray-700">Become a Vendor</Link>
          <Link href="mailto:support@pastq.co" className="hover:text-gray-700">Support</Link>
        </div>
      </footer>
    </div>
  );
}
