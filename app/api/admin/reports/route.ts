import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/api-guard';

const QUESTION_FIELDS =
  'id,bank_id,question_number,year,question_text,option_a,option_b,option_c,option_d,option_e,correct_answer,explanation,topic,difficulty,is_preview';

export async function GET(req: NextRequest) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;

  const status = req.nextUrl.searchParams.get('status') || 'open';
  let q = supabaseAdmin.from('content_reports').select('*').order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') q = q.eq('status', status);
  const { data: reports, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not load reports' }, { status: 500 });
  if (!reports?.length) return NextResponse.json({ reports: [] });

  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])];
  const [{ data: banks }, { data: questions }, { data: reporters }] = await Promise.all([
    supabaseAdmin.from('question_banks').select('id,title,status,vendor_id,total_sales').in('id', uniq(reports.map(r => r.bank_id))),
    supabaseAdmin.from('questions').select(QUESTION_FIELDS).in('id', uniq(reports.map(r => r.question_id))),
    supabaseAdmin.from('profiles').select('id,full_name,email').in('id', uniq(reports.map(r => r.reporter_id))),
  ]);
  const { data: vendors } = await supabaseAdmin
    .from('profiles').select('id,full_name,vendor_status').in('id', uniq((banks ?? []).map(b => b.vendor_id)));

  const bankBy = new Map((banks ?? []).map(b => [b.id, b]));
  const qBy = new Map((questions ?? []).map(x => [x.id, x]));
  const repBy = new Map((reporters ?? []).map(x => [x.id, x]));
  const venBy = new Map((vendors ?? []).map(x => [x.id, x]));

  return NextResponse.json({
    reports: reports.map(r => {
      const bank = bankBy.get(r.bank_id) || null;
      return {
        ...r,
        bank,
        question: r.question_id ? qBy.get(r.question_id) || null : null,
        reporter: repBy.get(r.reporter_id) || null,
        vendor: bank ? venBy.get(bank.vendor_id) || null : null,
      };
    }),
  });
}
