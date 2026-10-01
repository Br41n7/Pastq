import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireVendor } from '@/lib/api-guard';
import { MIN_PAYOUT_KOBO } from '@/lib/vendor-terms';

export async function GET(req: NextRequest) {
  const g = await requireVendor(req, { requireTerms: false, requireActive: false });
  if (!g.ok) return g.res;

  const [{ data: payouts }, { data: account }, { data: bal }] = await Promise.all([
    supabaseAdmin.from('payout_requests').select('*').eq('vendor_id', g.userId).order('requested_at', { ascending: false }).limit(100),
    supabaseAdmin.from('vendor_payout_accounts').select('bank_name,account_number,account_name').eq('vendor_id', g.userId).maybeSingle(),
    supabaseAdmin.from('profiles').select('total_earnings,total_paid_out,pending_payout').eq('id', g.userId).single(),
  ]);

  return NextResponse.json({ payouts: payouts ?? [], account: account ?? null, balance: bal, minimum: MIN_PAYOUT_KOBO });
}

const RPC_ERRORS: Record<string, [string, number]> = {
  below_minimum: ['Minimum withdrawal is ₦1,000', 400],
  insufficient_balance: ['Amount is more than your available balance', 400],
  open_request_exists: ['You already have a withdrawal being processed. Wait for it to finish first.', 409],
  vendor_suspended: ['Your vendor account is suspended', 403],
  terms_not_accepted: ['Accept the vendor agreement first', 403],
  not_vendor: ['Vendor access required', 403],
};

export async function POST(req: NextRequest) {
  const g = await requireVendor(req); // must be active + agreement accepted
  if (!g.ok) return g.res;

  const body = await req.json().catch(() => ({}));
  const naira = Number(body.amount_naira);
  if (!Number.isFinite(naira) || naira <= 0) {
    return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 });
  }
  const kobo = Math.round(naira * 100);

  const { data: account } = await supabaseAdmin
    .from('vendor_payout_accounts').select('bank_name,account_number,account_name').eq('vendor_id', g.userId).maybeSingle();
  if (!account) {
    return NextResponse.json({ error: 'Add your payout bank account in Settings first' }, { status: 400 });
  }

  const { data: id, error } = await supabaseAdmin.rpc('request_payout', {
    p_vendor: g.userId,
    p_amount: kobo,
    p_bank: account.bank_name,
    p_account: account.account_number,
    p_name: account.account_name,
  });

  if (error) {
    const key = Object.keys(RPC_ERRORS).find(k => error.message.includes(k));
    if (key) return NextResponse.json({ error: RPC_ERRORS[key][0] }, { status: RPC_ERRORS[key][1] });
    console.error('[request_payout]', error.message);
    return NextResponse.json({ error: 'Could not submit withdrawal' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}
