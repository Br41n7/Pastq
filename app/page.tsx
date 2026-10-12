'use client';
import Link from 'next/link';
import {
  BookOpen, TrendingUp, Shield, Zap, ChevronRight, GraduationCap,
  Target, Search, BarChart3, CheckCircle2, Star, Sparkles,
  ArrowRight, Award, Lock, Users, Layers
} from 'lucide-react';
const FEATURED_COURSES = [
  { code: 'ANA 201', title: 'Human Anatomy I', category: 'University' },
  { code: 'PHY 101', title: 'General Physics I', category: 'University' },
  { code: 'CHM 101', title: 'General Chemistry I', category: 'University' },
  { code: 'GST 111', title: 'Communication in English', category: 'University' },
  { code: 'MTH 201', title: 'Mathematical Methods', category: 'University' },
  { code: 'WAEC Maths', title: 'Mathematics (SSCE)', category: 'SSCE' },
  { code: 'JAMB UTME', title: 'Use of English & Physics', category: 'National' },
];

const STATS = [
  { label: 'Free Question Previews', value: '100% Free', icon: Search },
  { label: 'Verified Marketplace', value: 'Top Tutors', icon: Award },
  { label: 'Interactive AI Study', value: 'Akili Enabled', icon: Zap },
  { label: 'Secured Payments', value: 'Paystack 🔒', icon: Shield },
];

const FEATURES = [
  {
    icon: Search,
    title: 'Precision Course Search',
    desc: 'Search by exact course code (e.g., ANA 201), university name, department, level, or semester.',
    tag: 'Smart Search',
  },
  {
    icon: Target,
    title: 'Free Question Previews',
    desc: 'Inspect real questions and answer keys before spending a dime. Zero surprises, maximum clarity.',
    tag: 'Quality First',
  },
  {
    icon: Zap,
    title: 'Instant Import to Akili AI',
    desc: 'Take your purchased question bank straight into Akili for timed mock exams, AI explanations, and topic mastery.',
    tag: 'AI Powered',
  },
  {
    icon: Shield,
    title: 'Verified Vendor Quality',
    desc: 'Every submission is vetted by our team. Community reporting keeps content accurate and up to date.',
    tag: 'Trusted Quality',
  },
];

const STEPS = [
  { num: '01', title: 'Search Your Course', desc: 'Type your university or course code like ANA 201, PHY 101, or WAEC.' },
  { num: '02', title: 'Preview Questions', desc: 'Check free sample questions and verified answers before purchasing.' },
  { num: '03', title: 'Unlock Full Bank', desc: 'Pay once with Paystack for lifetime access to full questions & explanations.' },
  { num: '04', title: 'Master with Akili', desc: 'One-click import into Akili to practice timed exams and review weak areas.' },
];

export default function LandingPage() {
  const { user } = useNavUser();
  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white text-xs font-bold py-2.5 px-4 text-center flex items-center justify-center gap-2">
        <Sparkles size={14} className="animate-pulse shrink-0" />
        <span>PastQ Marketplace + Akili AI Study Platform — The complete exam preparation ecosystem</span>
        <Link href="/browse" className="underline font-extrabold hover:text-emerald-100 ml-1 inline-flex items-center gap-0.5">
          Explore Now <ChevronRight size={12} />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 sticky top-0 z-50 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
              <GraduationCap size={20} />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-slate-900">PastQ</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full tracking-wider">Marketplace</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <Link href="/browse" className="hover:text-emerald-600 transition-colors">Browse Courses</Link>
            <Link href="/vendor/dashboard" className="hover:text-emerald-600 transition-colors">Sell Questions</Link>
            <Link href="/auth/login" className="hover:text-emerald-600 transition-colors">Sign In</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="md:hidden text-sm font-semibold text-slate-700 hover:text-emerald-600">Sign In</Link>
            <Link href="/auth/signup" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all active:scale-[0.98]">
              Get Started Free
            </Link>
          </div>
        </div>
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
          <NavActions />
        </div>
        {user.status === 'in' ? (
          <Link href={user.role === 'admin' ? '/admin' : user.role === 'vendor' ? '/vendor/dashboard' : '/browse'} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
            {user.role === 'student' ? 'Browse questions' : 'Dashboard'}
          </Link>
        ) : (
          <Link href="/auth/signup" className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
            Get Started Free
          </Link>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-emerald-50/50 via-white to-slate-50/50 border-b border-slate-200/60">
        {/* Glow decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-tr from-emerald-300/30 to-teal-200/20 blur-3xl -z-10 rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-emerald-100/80 border border-emerald-200/80 text-emerald-800 px-4 py-2 rounded-full text-xs font-bold tracking-wide shadow-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            🇳🇬 Africa's Premier Past Questions Marketplace
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1]">
            Find your exact course.<br />
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 bg-clip-text text-transparent">
              Ace your exams with confidence.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Search legitimate university and national past questions by course code, level, and semester. Preview questions before you buy, then practice them in Akili.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
            <Link href="/browse" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black text-base shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 inline-flex items-center justify-center gap-2.5">
              Browse Question Banks <ArrowRight size={18} />
            </Link>
            <Link href="/vendor/dashboard" className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 px-8 py-4 rounded-2xl font-bold text-base shadow-sm hover:shadow transition-all inline-flex items-center justify-center gap-2">
              Become a Vendor <ChevronRight size={18} className="text-slate-400" />
            </Link>
          </div>

          {/* Quick Search Chips */}
          <div className="pt-6 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Popular Course Searches</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto">
              {FEATURED_COURSES.map(c => (
                <Link
                  key={c.code}
                  href={`/browse?q=${encodeURIComponent(c.code)}`}
                  className="inline-flex items-center gap-2 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-2xs transition-all hover:scale-[1.02]"
                >
                  <span className="font-extrabold text-emerald-600">{c.code}</span>
                  <span className="text-slate-400">· {c.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Stats Section */}
      <section className="bg-emerald-900 text-white py-12 px-6 border-b border-emerald-800">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label} className="p-3 space-y-1">
              <s.icon size={24} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-xl font-black tracking-tight text-white">{s.value}</p>
              <p className="text-xs text-emerald-200/80 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              Why PastQ Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Not just static PDFs. A complete exam engine.
            </h2>
            <p className="text-slate-500 text-sm sm:text-base">
              Built specifically for university courses, departmental tests, semester exams, and national assessments.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-emerald-300 rounded-3xl p-7 transition-all duration-300 shadow-2xs hover:shadow-xl group space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300 shadow-xs">
                    <f.icon size={22} />
                  </div>
                  <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                    {f.tag}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{f.title}</h3>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/80">
              Simple 4-Step Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              From course code to better grades
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Start practicing in minutes with instant access to verified answer keys.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(s => (
              <div key={s.num} className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 relative space-y-4 hover:border-emerald-500/50 transition-all">
                <span className="text-3xl font-black text-emerald-400">{s.num}</span>
                <div>
                  <h3 className="font-extrabold text-white text-base">{s.title}</h3>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vendor Callout Banner */}
      <section className="py-20 px-6 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-1.5 rounded-full text-xs font-bold">
            <Award size={14} /> For Tutors, High Performers & Vendors
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Have compiled past questions?<br />
            <span className="text-emerald-400">Earn 70% revenue on every sale.</span>
          </h2>

          <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Turn your study notes and question banks into passive income. Compile once, sell forever to thousands of students across Africa.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-2 text-left">
            {[
              ['1. Upload Bank', 'Add questions with options & answers.'],
              ['2. Set Your Price', 'Choose free, paid, or preview+paid.'],
              ['3. Earn 70%', 'Direct payouts to your bank account.'],
            ].map(([title, desc]) => (
              <div key={title} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="font-extrabold text-emerald-300 text-sm">{title}</p>
                <p className="text-slate-300 text-xs mt-1">{desc}</p>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <Link href="/vendor/dashboard" className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-8 py-4 rounded-2xl text-base shadow-xl transition-all hover:scale-[1.02]">
              Become a Vendor Today <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Akili AI Integration Banner */}
      <section className="py-16 px-6 bg-indigo-900 text-white">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="w-12 h-12 bg-indigo-500/30 border border-indigo-400/40 rounded-2xl flex items-center justify-center mx-auto text-indigo-300">
            <Zap size={24} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Powered by Akili AI Platform
          </h2>
          <p className="text-indigo-200 text-sm max-w-xl mx-auto leading-relaxed">
            Import any purchased question bank into Akili to create AI structured study schedules, topic frequency analytics, and simulated timed exams.
          </p>
          <a
            href={process.env.NEXT_PUBLIC_AKILI_URL || 'https://akili.study'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-indigo-950 hover:bg-indigo-50 px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all"
          >
            Learn More About Akili <ChevronRight size={16} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 px-6 text-slate-500 text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
              P
            </div>
            <span className="font-extrabold text-slate-900 text-base">PastQ</span>
            <span className="text-xs text-slate-400">© {new Date().getFullYear()} PastQ. Built for African students.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-600">
            <Link href="/browse" className="hover:text-emerald-600">Browse Courses</Link>
            <Link href="/vendor/dashboard" className="hover:text-emerald-600">Vendor Portal</Link>
            <Link href="/auth/login" className="hover:text-emerald-600">Sign In</Link>
            <a href="mailto:support@pastq.co" className="hover:text-emerald-600">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
