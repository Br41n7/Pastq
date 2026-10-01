import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/api-guard';
import { VENDOR_TERMS_VERSION } from '@/lib/vendor-terms';

export async function GET(req: NextRequest) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;

  const search = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80).replace(/[%,()]/g, '');
  let q = supabaseAdmin
    .from('profiles')
    .select('id,full_name,email,school,vendor_status,vendor_terms_version,vendor_terms_accepted_at,total_earnings,total_paid_out,pending_payout,created_at')
    .eq('role', 'vendor')
    .order('created_at', { ascending: false })
    .limit(200);
  if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

  const { data: vendors, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not load vendors' }, { status: 500 });

  const ids = (vendors ?? []).map(v => v.id);
  const stats: Record<string, { banks: number; live: number; sales: number; reports: number }> = {};
  ids.forEach(id => (stats[id] = { banks: 0, live: 0, sales: 0, reports: 0 }));

  if (ids.length) {
    const { data: banks } = await supabaseAdmin
      .from('question_banks').select('id,vendor_id,status,total_sales').in('vendor_id', ids);
    const owner = new Map((banks ?? []).map(b => [b.id, b.vendor_id]));
    (banks ?? []).forEach(b => {
      const s = stats[b.vendor_id]; s.banks++; s.sales += b.total_sales || 0; if (b.status === 'live') s.live++;
    });
    if (owner.size) {
      const { data: reports } = await supabaseAdmin
        .from('content_reports').select('bank_id').in('bank_id', [...owner.keys()]).in('status', ['open', 'reviewing']);
      (reports ?? []).forEach(r => { const v = owner.get(r.bank_id); if (v) stats[v].reports++; });
    }
  }

  return NextResponse.json({
    termsVersion: VENDOR_TERMS_VERSION,
    vendors: (vendors ?? []).map(v => ({ ...v, ...stats[v.id] })),
  });
}
