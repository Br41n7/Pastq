import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireVendor } from '@/lib/api-guard';

const lagosDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

export async function GET(req: NextRequest) {
  const g = await requireVendor(req, { requireTerms: false, requireActive: false });
  if (!g.ok) return g.res;

  const daysParam = req.nextUrl.searchParams.get('days') || '30';
  const days = daysParam === 'all' ? null : Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365);

  const { data: banks } = await supabaseAdmin.from('question_banks').select('id,title').eq('vendor_id', g.userId);
  const titleById = new Map((banks ?? []).map(b => [b.id, b.title as string]));
  if (!titleById.size) {
    return NextResponse.json({ summary: { count: 0, gross: 0, share: 0 }, daily: [], sales: [] });
  }

  let q = supabaseAdmin
    .from('purchases')
    .select('id,bank_id,amount_paid,vendor_share,purchased_at')
    .in('bank_id', [...titleById.keys()])
    .eq('paystack_status', 'success')
    .order('purchased_at', { ascending: false })
    .limit(5000);
  if (days) q = q.gte('purchased_at', new Date(Date.now() - days * 86_400_000).toISOString());

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not load sales' }, { status: 500 });

  // Buyer identities are deliberately not returned to vendors.
  const sales = (data ?? []).map(s => ({
    id: s.id,
    bank_id: s.bank_id,
    bank_title: titleById.get(s.bank_id) || 'Deleted bank',
    amount_paid: Number(s.amount_paid),
    vendor_share: Number(s.vendor_share ?? Number(s.amount_paid) * 0.7),
    purchased_at: s.purchased_at,
  }));

  const byDay = new Map<string, { revenue: number; sales: number }>();
  if (days && days <= 90) {
    for (let i = days - 1; i >= 0; i--) byDay.set(lagosDay(new Date(Date.now() - i * 86_400_000)), { revenue: 0, sales: 0 });
  }
  sales.forEach(s => {
    const k = lagosDay(new Date(s.purchased_at));
    const cur = byDay.get(k) || { revenue: 0, sales: 0 };
    cur.revenue += s.vendor_share; cur.sales += 1;
    byDay.set(k, cur);
  });

  return NextResponse.json({
    summary: {
      count: sales.length,
      gross: sales.reduce((a, s) => a + s.amount_paid, 0),
      share: sales.reduce((a, s) => a + s.vendor_share, 0),
    },
    daily: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    sales: sales.slice(0, 200),
  });
}
