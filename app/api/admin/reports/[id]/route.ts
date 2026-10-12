import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin, logAdminAction, isUuid, cleanText } from '@/lib/api-guard';
import { resolveReports } from '@/lib/admin-reports';

// action: 'reviewing' | 'approve' (keep content as-is, dismiss the report)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { action, note } = await req.json().catch(() => ({}));
  const cleanNote = cleanText(note, 500);

  const { data: report } = await supabaseAdmin.from('content_reports').select('id,status').eq('id', id).maybeSingle();
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  if (['resolved', 'dismissed'].includes(report.status)) {
    return NextResponse.json({ error: 'This report is already closed' }, { status: 409 });
  }

  if (action === 'reviewing') {
    await supabaseAdmin.from('content_reports').update({ status: 'reviewing', reviewed_by: g.userId }).eq('id', id);
  } else if (action === 'approve') {
    await resolveReports({ reportId: id }, { status: 'dismissed', resolution: 'no_action', note: cleanNote, adminId: g.userId });
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  await logAdminAction(g.userId, `report_${action}`, 'report', id, { note: cleanNote });
  return NextResponse.json({ ok: true });
}
