import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin, logAdminAction, isUuid, cleanText } from '@/lib/api-guard';

// action: 'suspend' (reason required) | 'reinstate'
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (id === g.userId) return NextResponse.json({ error: 'You cannot change your own account' }, { status: 400 });

  const { action, reason } = await req.json().catch(() => ({}));
  const cleanReason = cleanText(reason, 500);

  const { data: vendor } = await supabaseAdmin.from('profiles').select('id,role,vendor_status').eq('id', id).maybeSingle();
  if (!vendor || vendor.role !== 'vendor') return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

  if (action === 'suspend') {
    if (!cleanReason) return NextResponse.json({ error: 'Give a reason — the vendor will see it' }, { status: 400 });
    await supabaseAdmin.from('profiles').update({ vendor_status: 'suspended' }).eq('id', id);
    // Take their live banks off the marketplace until an admin re-approves them.
    const { data: pulled } = await supabaseAdmin.from('question_banks')
      .update({ status: 'pending', moderation_note: 'Vendor account suspended', moderated_by: g.userId, moderated_at: new Date().toISOString() })
      .eq('vendor_id', id).eq('status', 'live').select('id');
    await logAdminAction(g.userId, 'vendor_suspend', 'vendor', id, { reason: cleanReason, banks_unpublished: pulled?.length ?? 0 });
    return NextResponse.json({ ok: true, banksUnpublished: pulled?.length ?? 0 });
  }

  if (action === 'reinstate') {
    await supabaseAdmin.from('profiles').update({ vendor_status: 'active' }).eq('id', id);
    await logAdminAction(g.userId, 'vendor_reinstate', 'vendor', id, { note: cleanReason });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
