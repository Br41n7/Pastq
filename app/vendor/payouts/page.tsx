'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, AlertCircle, Loader2, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, send } from '@/lib/client-api';
import { formatNaira } from '@/lib/paystack';
import { useVendor } from '@/components/vendor/VendorProvider';
import { Card, PAYOUT_STATUS, Spinner, StatCard, inputCls } from '@/components/vendor/ui';
import { VENDOR_SHARE_PERCENT } from '@/lib/vendor-terms';

export default function VendorPayoutsPage() {
  const { reload } = useVendor();
  const [data, setData] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/api/vendor/payouts').then(setData).catch(e => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  const bal = data.balance;
  const available = Number(bal.pending_payout);
  const open = data.payouts.find((p: any) => ['pending', 'processing'].includes(p.status));
  const min = data.minimum / 100;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await send('/api/vendor/payouts', 'POST', { amount_naira: parseFloat(amount) });
      toast.success("Withdrawal requested. We'll pay it within 3 business days.");
      setAmount('');
      await Promise.all([load(), reload()]);
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Payouts</h1>
        <p className="text-sm text-gray-500">Withdraw your earnings to your bank account</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Available" value={formatNaira(available)} icon={Wallet} color="text-indigo-600" />
        <StatCard label="Total earned" value={formatNaira(bal.total_earnings)} icon={Wallet} />
        <StatCard label="Paid out" value={formatNaira(bal.total_paid_out)} icon={Wallet} color="text-gray-600" />
      </div>

      <Card className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">You earn <b>{VENDOR_SHARE_PERCENT}%</b> of every sale. Minimum withdrawal is <b>₦{min.toLocaleString()}</b>. Requests are paid by bank transfer within 3 business days, and the amount is set aside from your balance as soon as you request it.</p>
        </div>

        {!data.account ? (
          <div className="text-sm text-center py-4">
            <Landmark size={22} className="mx-auto text-gray-300 mb-2" />
            Add your bank account before withdrawing. <Link href="/vendor/settings" className="text-green-600 font-semibold">Go to Settings</Link>
          </div>
        ) : open ? (
          <p className="text-sm text-gray-600 text-center py-2">You have a withdrawal of <b>{formatNaira(open.amount)}</b> being processed. You can request another once it is finished.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
              Paying to <b>{data.account.account_name}</b> · {data.account.bank_name} · {data.account.account_number}{' '}
              <Link href="/vendor/settings" className="text-green-600 font-semibold">Change</Link>
            </div>
            <div className="flex gap-2">
              <input type="number" required min={min} max={available / 100} step="1" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={`Amount in ₦ (max ${(available / 100).toLocaleString()})`} className={inputCls} />
              <button type="button" onClick={() => setAmount(String(Math.floor(available / 100)))} className="px-3 text-xs font-bold text-green-600 whitespace-nowrap">Max</button>
            </div>
            <button disabled={busy || available < data.minimum} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white py-3 rounded-2xl text-sm font-bold">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />} Request withdrawal
            </button>
            {available < data.minimum && <p className="text-xs text-gray-400 text-center">You need at least ₦{min.toLocaleString()} available to withdraw.</p>}
          </form>
        )}
      </Card>

      <Card>
        <h2 className="font-black mb-3">History</h2>
        {data.payouts.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No withdrawals yet</p> : (
          <div className="space-y-2">
            {data.payouts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="min-w-0">
                  <p className="font-bold text-sm">{formatNaira(p.amount)}</p>
                  <p className="text-xs text-gray-400">{p.bank_name} · {p.account_number} · {new Date(p.requested_at).toLocaleDateString()}</p>
                  {p.admin_note && <p className="text-xs text-gray-600 mt-0.5">Note: {p.admin_note}</p>}
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${PAYOUT_STATUS[p.status]?.cls}`}>{PAYOUT_STATUS[p.status]?.label}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
