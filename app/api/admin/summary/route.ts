import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;

  const count = async (table: string, f: (q: any) => any) => {
    const { count } = await f(supabaseAdmin.from(table).select('id', { count: 'exact', head: true }));
    return count ?? 0;
  };

  const [openReports, reviewingReports, pendingBanks, liveBanks, pendingPayouts, processingPayouts, vendors, suspended] = await Promise.all([
    count('content_reports', q => q.eq('status', 'open')),
    count('content_reports', q => q.eq('status', 'reviewing')),
    count('question_banks', q => q.eq('status', 'pending')),
    count('question_banks', q => q.eq('status', 'live')),
    count('payout_requests', q => q.eq('status', 'pending')),
    count('payout_requests', q => q.eq('status', 'processing')),
    count('profiles', q => q.eq('role', 'vendor')),
    count('profiles', q => q.eq('role', 'vendor').eq('vendor_status', 'suspended')),
  ]);

  const { data: owed } = await supabaseAdmin
    .from('payout_requests').select('amount').in('status', ['pending', 'processing']);

  return NextResponse.json({
    openReports, reviewingReports, pendingBanks, liveBanks, pendingPayouts, processingPayouts, vendors, suspended,
    payoutsOwed: (owed ?? []).reduce((a, r) => a + Number(r.amount), 0),
  });
}
