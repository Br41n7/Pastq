import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireVendor } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const g = await requireVendor(req, { requireTerms: false, requireActive: false });
  if (!g.ok) return g.res;

  const { data: banks, error } = await supabaseAdmin
    .from('question_banks')
    .select('id,title,subject,exam_type,course_code,access_type,price,preview_count,question_count,status,total_sales,rating,rating_count,moderation_note,created_at,updated_at')
    .eq('vendor_id', g.userId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load banks' }, { status: 500 });

  const ids = (banks ?? []).map(b => b.id);
  const revenue: Record<string, number> = {};
  const openReports: Record<string, number> = {};

  if (ids.length) {
    const [{ data: sales }, { data: reports }] = await Promise.all([
      supabaseAdmin.from('purchases').select('bank_id,amount_paid,vendor_share').in('bank_id', ids).eq('paystack_status', 'success'),
      supabaseAdmin.from('content_reports').select('bank_id').in('bank_id', ids).in('status', ['open', 'reviewing']),
    ]);
    (sales ?? []).forEach(s => {
      revenue[s.bank_id] = (revenue[s.bank_id] || 0) + Number(s.vendor_share ?? Number(s.amount_paid) * 0.7);
    });
    (reports ?? []).forEach(r => { openReports[r.bank_id] = (openReports[r.bank_id] || 0) + 1; });
  }

  return NextResponse.json({
    banks: (banks ?? []).map(b => ({ ...b, revenue: revenue[b.id] || 0, open_reports: openReports[b.id] || 0 })),
  });
}
