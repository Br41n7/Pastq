import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireVendor, cleanText } from '@/lib/api-guard';
import { VENDOR_DECLARATIONS, VENDOR_TERMS_VERSION } from '@/lib/vendor-terms';

export async function POST(req: NextRequest) {
  const g = await requireVendor(req, { requireTerms: false, requireActive: false });
  if (!g.ok) return g.res;
  if (g.profile.vendor_status === 'suspended') {
    return NextResponse.json({ error: 'Your vendor account is suspended' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const accepted: string[] = Array.isArray(body.declarations) ? body.declarations : [];
  const signedName = cleanText(body.signed_name, 120);

  if (body.version !== VENDOR_TERMS_VERSION) {
    return NextResponse.json({ error: 'The agreement was updated. Reload and review it again.' }, { status: 409 });
  }
  const missing = VENDOR_DECLARATIONS.filter(d => !accepted.includes(d.id));
  if (missing.length) {
    return NextResponse.json({ error: 'You must accept every declaration to continue' }, { status: 400 });
  }
  if (signedName.length < 3) {
    return NextResponse.json({ error: 'Type your full name to sign' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const { error } = await supabaseAdmin.from('vendor_agreements').insert({
    vendor_id: g.userId,
    version: VENDOR_TERMS_VERSION,
    declarations: VENDOR_DECLARATIONS.map(d => ({ id: d.id, text: d.label })),
    signed_name: signedName,
    ip_address: ip,
    user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
  });
  if (error) {
    console.error('[vendor agreement]', error.message);
    return NextResponse.json({ error: 'Could not record agreement' }, { status: 500 });
  }

  const { error: pErr } = await supabaseAdmin.from('profiles')
    .update({ vendor_terms_version: VENDOR_TERMS_VERSION, vendor_terms_accepted_at: new Date().toISOString() })
    .eq('id', g.userId);
  if (pErr) return NextResponse.json({ error: 'Could not save agreement' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
