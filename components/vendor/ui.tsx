'use client';
import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export const BANK_STATUS = {
  pending: { label: 'Pending review', cls: 'text-amber-600 bg-amber-50', icon: Clock },
  approved: { label: 'Approved', cls: 'text-blue-600 bg-blue-50', icon: CheckCircle2 },
  live: { label: 'Live', cls: 'text-green-600 bg-green-50', icon: CheckCircle2 },
  rejected: { label: 'Taken down', cls: 'text-rose-600 bg-rose-50', icon: XCircle },
} as const;

export function BankStatusBadge({ status }: { status: string }) {
  const c = (BANK_STATUS as any)[status] || BANK_STATUS.pending;
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${c.cls}`}>
      <c.icon size={11} /> {c.label}
    </span>
  );
}

export const PAYOUT_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'text-amber-600 bg-amber-50' },
  processing: { label: 'Processing', cls: 'text-blue-600 bg-blue-50' },
  paid: { label: 'Paid', cls: 'text-green-600 bg-green-50' },
  rejected: { label: 'Rejected', cls: 'text-rose-600 bg-rose-50' },
};

export function StatCard({ label, value, icon: Icon, color = 'text-green-600', hint }: {
  label: string; value: string; icon: any; color?: string; hint?: string;
}) {
  return (
    <div className="bg-white rounded-3xl p-5 border border-black/5">
      <Icon size={18} className={`${color} mb-3`} />
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export function Spinner({ full = false }: { full?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${full ? 'min-h-[60vh]' : 'py-12'}`}>
      <Loader2 size={26} className="animate-spin text-green-600" />
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-3xl p-6 border border-black/5 ${className}`}>{children}</div>;
}

export const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-green-500';

export const NIGERIAN_BANKS = [
  'Access Bank', 'Citibank Nigeria', 'Ecobank Nigeria', 'Fidelity Bank', 'First Bank of Nigeria', 'First City Monument Bank (FCMB)',
  'Globus Bank', 'Guaranty Trust Bank (GTBank)', 'Keystone Bank', 'Kuda Bank', 'Moniepoint MFB', 'OPay', 'PalmPay',
  'Polaris Bank', 'Providus Bank', 'Stanbic IBTC Bank', 'Standard Chartered Bank', 'Sterling Bank', 'SunTrust Bank',
  'Union Bank', 'United Bank for Africa (UBA)', 'Unity Bank', 'Wema Bank', 'Zenith Bank',
];
