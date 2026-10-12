import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin, logAdminAction, isUuid, cleanText } from '@/lib/api-guard';
import { resolveReports } from '@/lib/admin-reports';

const QUESTION_FIELDS =
  'id,bank_id,question_number,year,question_text,option_a,option_b,option_c,option_d,option_e,correct_answer,explanation,topic,difficulty,is_preview';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { data: bank } = await supabaseAdmin.from('question_banks').select('*').eq('id', id).maybeSingle();
  if (!bank) return NextResponse.json({ error: 'Bank not found' }, { status: 404 });

  const [{ data: vendor }, { data: questions }, { data: reports }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name,email,vendor_status,vendor_terms_version,vendor_terms_accepted_at').eq('id', bank.vendor_id).single(),
    supabaseAdmin.from('questions').select(QUESTION_FIELDS).eq('bank_id', id).order('question_number'),
    supabaseAdmin.from('content_reports').select('id,question_id,reason,details,status,created_at').eq('bank_id', id).in('status', ['open', 'reviewing']),
  ]);
  return NextResponse.json({ bank, vendor, questions: questions ?? [], reports: reports ?? [] });
}

// action: 'approve' → live | 'reject' → rejected (takedown) | 'unpublish' → pending (send back for fixes)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { action, note } = await req.json().catch(() => ({}));
  const cleanNote = cleanText(note, 500);
  if (!['approve', 'reject', 'unpublish'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  if (action !== 'approve' && !cleanNote) {
    return NextResponse.json({ error: 'A reason is required so the vendor knows what to fix' }, { status: 400 });
  }

  const { data: bank } = await supabaseAdmin.from('question_banks').select('id,status,vendor_id,question_count').eq('id', id).maybeSingle();
  if (!bank) return NextResponse.json({ error: 'Bank not found' }, { status: 404 });

  if (action === 'approve') {
    const { data: vendor } = await supabaseAdmin.from('profiles').select('vendor_status').eq('id', bank.vendor_id).single();
    if (vendor?.vendor_status === 'suspended') {
      return NextResponse.json({ error: 'The vendor is suspended. Reinstate them before approving their banks.' }, { status: 409 });
    }
    if (!bank.question_count) {
      return NextResponse.json({ error: 'This bank has no questions' }, { status: 409 });
    }
  }

  const status = action === 'approve' ? 'live' : action === 'reject' ? 'rejected' : 'pending';
  const { error } = await supabaseAdmin.from('question_banks').update({
    status,
    moderation_note: action === 'approve' ? (cleanNote || null) : cleanNote,
    moderated_by: g.userId,
    moderated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not update bank' }, { status: 500 });

  if (action === 'reject') {
    await resolveReports({ bankId: id }, { status: 'resolved', resolution: 'bank_taken_down', note: cleanNote, adminId: g.userId });
  }

  await logAdminAction(g.userId, `bank_${action}`, 'bank', id, { from: bank.status, to: status, note: cleanNote });
  return NextResponse.json({ ok: true, status });
}

// Hard delete is only allowed when nothing was ever sold: deleting a sold bank would
// cascade-delete purchase records and every buyer's access. Use "reject" to take it down.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { data: bank } = await supabaseAdmin.from('question_banks').select('id,title,vendor_id,total_sales').eq('id', id).maybeSingle();
  if (!bank) return NextResponse.json({ error: 'Bank not found' }, { status: 404 });

  const { count } = await supabaseAdmin.from('purchases').select('id', { count: 'exact', head: true }).eq('bank_id', id);
  if ((bank.total_sales ?? 0) > 0 || (count ?? 0) > 0) {
    return NextResponse.json({
      error: 'This bank has purchases, so it cannot be permanently deleted. Take it down (Reject) instead.',
    }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from('question_banks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete bank' }, { status: 500 });

  await logAdminAction(g.userId, 'bank_delete', 'bank', id, { title: bank.title, vendor_id: bank.vendor_id });
  return NextResponse.json({ ok: true });
}
