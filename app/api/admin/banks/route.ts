import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;

  const status = req.nextUrl.searchParams.get('status') || 'pending';
  const search = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80).replace(/[%,()]/g, '');

  let q = supabaseAdmin
    .from('question_banks')
    .select('id,title,subject,exam_type,university,course_code,access_type,price,question_count,status,total_sales,moderation_note,vendor_id,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (status !== 'all') q = q.eq('status', status);
  if (search) q = q.or(`title.ilike.%${search}%,course_code.ilike.%${search}%`);

  const { data: banks, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not load banks' }, { status: 500 });

  const vendorIds = [...new Set((banks ?? []).map(b => b.vendor_id))];
  const bankIds = (banks ?? []).map(b => b.id);
  const [{ data: vendors }, { data: reports }] = await Promise.all([
    vendorIds.length ? supabaseAdmin.from('profiles').select('id,full_name,vendor_status').in('id', vendorIds) : Promise.resolve({ data: [] as any[] }),
    bankIds.length ? supabaseAdmin.from('content_reports').select('bank_id').in('bank_id', bankIds).in('status', ['open', 'reviewing']) : Promise.resolve({ data: [] as any[] }),
  ]);
  const venBy = new Map((vendors ?? []).map((v: any) => [v.id, v]));
  const reportCount: Record<string, number> = {};
  (reports ?? []).forEach((r: any) => { reportCount[r.bank_id] = (reportCount[r.bank_id] || 0) + 1; });

  return NextResponse.json({
    banks: (banks ?? []).map(b => ({ ...b, vendor: venBy.get(b.vendor_id) || null, open_reports: reportCount[b.id] || 0 })),
  });
}
