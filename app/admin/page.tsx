'use client';
import Link from 'next/link';
import { Flag, BookOpen, Users, Wallet, ChevronRight } from 'lucide-react';
import { formatNaira } from '@/lib/paystack';
import { useAdmin } from '@/components/admin/AdminProvider';
import { Card } from '@/components/vendor/ui';

export default function AdminOverview() {
  const { summary: s } = useAdmin();
  const items = [
    { href: '/admin/reports', icon: Flag, title: 'Reported content', main: s.openReports, sub: `${s.reviewingReports} under review`, cls: 'text-rose-600 bg-rose-50', cta: 'Review reports' },
    { href: '/admin/banks', icon: BookOpen, title: 'Banks awaiting approval', main: s.pendingBanks, sub: `${s.liveBanks} live`, cls: 'text-amber-600 bg-amber-50', cta: 'Review banks' },
    { href: '/admin/payouts', icon: Wallet, title: 'Withdrawal requests', main: s.pendingPayouts, sub: `${s.processingPayouts} processing · ${formatNaira(s.payoutsOwed)} owed`, cls: 'text-indigo-600 bg-indigo-50', cta: 'Process payouts' },
    { href: '/admin/vendors', icon: Users, title: 'Vendors', main: s.vendors, sub: `${s.suspended} suspended`, cls: 'text-green-600 bg-green-50', cta: 'Manage vendors' },
  ];
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-black">Admin dashboard</h1><p className="text-sm text-gray-500">Moderate content, vendors and withdrawals</p></div>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map(i => (
          <Link key={i.href} href={i.href}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${i.cls}`}><i.icon size={18} /></div>
              <p className="text-3xl font-black">{i.main}</p>
              <p className="font-semibold text-sm">{i.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{i.sub}</p>
              <p className="text-sm text-green-600 font-semibold mt-3 flex items-center gap-1">{i.cta} <ChevronRight size={14} /></p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
