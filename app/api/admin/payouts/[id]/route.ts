import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin, logAdminAction, isUuid, cleanText } from '@/lib/api-guard';

const ERRORS: Record<string, [string, number]> = {
  not_found: ['Payout request not found', 404],
  already_final: ['This request is already paid or rejected', 409],
  invalid_transition: ['This request is already being processed', 409],
  invalid_status: ['Unknown status', 400],
};

// action: 'processing' | 'paid' | 'rejected'. Balance changes happen atomically in SQL.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { action, note } = await req.json().catch(() => ({}));
  const cleanNote = cleanText(note, 500);
  if (action === 'rejected' && !cleanNote) {
    return NextResponse.json({ error: 'Give a reason — the vendor will see it' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.rpc('process_payout', { p_id: id, p_status: action, p_note: cleanNote });
  if (error) {
    const key = Object.keys(ERRORS).find(k => error.message.includes(k));
    if (key) return NextResponse.json({ error: ERRORS[key][0] }, { status: ERRORS[key][1] });
    console.error('[process_payout]', error.message);
    return NextResponse.json({ error: 'Could not update payout' }, { status: 500 });
  }

  await logAdminAction(g.userId, `payout_${action}`, 'payout', id, { note: cleanNote });
  return NextResponse.json({ ok: true });
}
