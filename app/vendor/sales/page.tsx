'use client';
import { useEffect, useState } from 'react';
import { Receipt, TrendingUp, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/client-api';
import { formatNaira } from '@/lib/paystack';
import { Card, Spinner, StatCard } from '@/components/vendor/ui';
import RevenueChart from '@/components/vendor/RevenueChart';

const RANGES = [{ v: '7', l: '7 days' }, { v: '30', l: '30 days' }, { v: '90', l: '90 days' }, { v: 'all', l: 'All time' }];

export default function VendorSalesPage() {
  const [range, setRange] = useState('30');
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    setData(null);
    api(`/api/vendor/sales?days=${range}`).then(setData).catch(e => { toast.error(e.message); setData({ summary: { count: 0, gross: 0, share: 0 }, daily: [], sales: [] }); });
  }, [range]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">Sales</h1>
          <p className="text-sm text-gray-500">What students bought and what you earned</p>
        </div>
        <div className="flex bg-white rounded-xl border border-black/5 p-1">
          {RANGES.map(r => (
            <button key={r.v} onClick={() => setRange(r.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${range === r.v ? 'bg-green-600 text-white' : 'text-gray-500'}`}>{r.l}</button>
          ))}
        </div>
      </div>

      {!data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Sales" value={String(data.summary.count)} icon={ShoppingBag} color="text-amber-600" />
            <StatCard label="Gross" value={formatNaira(data.summary.gross)} icon={Receipt} color="text-gray-600" />
            <StatCard label="Your 70%" value={formatNaira(data.summary.share)} icon={TrendingUp} />
          </div>
          {range !== 'all' && <Card><RevenueChart data={data.daily} /></Card>}
          <Card>
            <h2 className="font-black mb-3">Transactions</h2>
            {data.sales.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No sales in this period</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase text-gray-400"><th className="pb-2">Date</th><th className="pb-2">Question bank</th><th className="pb-2 text-right">Paid</th><th className="pb-2 text-right">You earned</th></tr></thead>
                  <tbody className="divide-y divide-black/5">
                    {data.sales.map((s: any) => (
                      <tr key={s.id}>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-gray-500">{new Date(s.purchased_at).toLocaleDateString()}</td>
                        <td className="py-2.5 pr-3 font-medium">{s.bank_title}</td>
                        <td className="py-2.5 text-right whitespace-nowrap">{formatNaira(s.amount_paid)}</td>
                        <td className="py-2.5 text-right whitespace-nowrap font-bold text-green-600">{formatNaira(s.vendor_share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.sales.length >= 200 && <p className="text-[11px] text-gray-400 mt-2">Showing the latest 200 sales.</p>}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-3">Buyer details are private and not shown to vendors.</p>
          </Card>
        </>
      )}
    </div>
  );
}
