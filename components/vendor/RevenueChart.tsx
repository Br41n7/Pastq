'use client';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function RevenueChart({ data }: { data: { date: string; revenue: number; sales: number }[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-10">No sales in this period</p>;
  const rows = data.map(d => ({ ...d, naira: d.revenue / 100, label: d.date.slice(5) }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(22,163,74,0.08)' }}
            formatter={(v: any, _n: any, p: any) => [`₦${Number(v).toLocaleString()} · ${p.payload.sales} sale(s)`, 'Your earnings']}
            labelFormatter={(l: any) => `Day ${l}`}
          />
          <Bar dataKey="naira" fill="#16a34a" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
