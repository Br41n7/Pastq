'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, TrendingUp, Wallet, CheckCircle2, BookOpen, ShoppingBag, AlertTriangle, ChevronRight } from 'lucide-react';
import { formatNaira } from '@/lib/paystack';
import { api } from '@/lib/client-api';
import { useVendor } from '@/components/vendor/VendorProvider';
import { BankStatusBadge, Card, Spinner, StatCard } from '@/components/vendor/ui';
import RevenueChart from '@/components/vendor/RevenueChart';

export default function VendorOverview() {
  const { me } = useVendor();
  const [banks, setBanks] = useState<any[] | null>(null);
  const [sales, setSales] = useState<any | null>(null);

  useEffect(() => {
    api('/api/vendor/banks').then(d => setBanks(d.banks)).catch(() => setBanks([]));
    api('/api/vendor/sales?days=30').then(setSales).catch(() => setSales({ summary: { count: 0, gross: 0, share: 0 }, daily: [], sales: [] }));
  }, []);

  if (!banks || !sales) return <Spinner />;

  const p = me.profile;
  const attention = banks.filter(b => b.status === 'rejected' || b.open_reports > 0 || (b.status === 'pending' && b.moderation_note));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Welcome, {p.full_name.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 text-sm">Your banks, sales and earnings at a glance</p>
        </div>
        <Link href="/vendor/upload" className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap">
          <Plus size={15} /> Upload
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total earnings" value={formatNaira(p.total_earnings)} icon={TrendingUp} />
        <StatCard label="Available to withdraw" value={formatNaira(p.pending_payout)} icon={Wallet} color="text-indigo-600" />
        <StatCard label="Total paid out" value={formatNaira(p.total_paid_out)} icon={CheckCircle2} color="text-gray-600" />
        <StatCard label="Live banks" value={String(banks.filter(b => b.status === 'live').length)} icon={BookOpen} color="text-amber-600"
          hint={`${banks.length} total`} />
      </div>

      {attention.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-700 mb-3"><AlertTriangle size={16} /> Needs your attention</div>
          <div className="space-y-2">
            {attention.map(b => (
              <Link key={b.id} href={`/vendor/banks/${b.id}`} className="flex items-center justify-between gap-3 bg-white rounded-2xl p-3 hover:shadow-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{b.title}</p>
                  <p className="text-xs text-gray-500">
                    {b.open_reports > 0 && `${b.open_reports} open report${b.open_reports > 1 ? 's' : ''}`}
                    {b.open_reports > 0 && b.moderation_note && ' · '}
                    {b.moderation_note && `Admin note: ${b.moderation_note}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0"><BankStatusBadge status={b.status} /><ChevronRight size={14} className="text-gray-300" /></div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-end justify-between mb-2">
          <div>
            <h2 className="font-black text-lg">Last 30 days</h2>
            <p className="text-xs text-gray-400">{sales.summary.count} sale{sales.summary.count === 1 ? '' : 's'} · {formatNaira(sales.summary.share)} earned</p>
          </div>
          <Link href="/vendor/sales" className="text-sm text-green-600 font-semibold hover:underline">All sales</Link>
        </div>
        <RevenueChart data={sales.daily} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-lg">Recent sales</h2>
          <ShoppingBag size={16} className="text-gray-300" />
        </div>
        {sales.sales.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No sales in the last 30 days</p>
        ) : (
          <div className="divide-y divide-black/5">
            {sales.sales.slice(0, 5).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{s.bank_title}</p>
                  <p className="text-xs text-gray-400">{new Date(s.purchased_at).toLocaleString()}</p>
                </div>
                <p className="text-sm font-black text-green-600 shrink-0">+{formatNaira(s.vendor_share)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
