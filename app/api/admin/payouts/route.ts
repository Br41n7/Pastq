import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;

  const status = req.nextUrl.searchParams.get('status') || 'pending';
  let q = supabaseAdmin.from('payout_requests').select('*').order('requested_at', { ascending: false }).limit(200);
  if (status !== 'all') q = q.eq('status', status);
  const { data: payouts, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not load payouts' }, { status: 500 });

  const ids = [...new Set((payouts ?? []).map(p => p.vendor_id))];
  const { data: vendors } = ids.length
    ? await supabaseAdmin.from('profiles').select('id,full_name,email,vendor_status,total_earnings,total_paid_out,pending_payout').in('id', ids)
    : { data: [] as any[] };
  const venBy = new Map((vendors ?? []).map((v: any) => [v.id, v]));

  return NextResponse.json({ payouts: (payouts ?? []).map(p => ({ ...p, vendor: venBy.get(p.vendor_id) || null })) });
}
