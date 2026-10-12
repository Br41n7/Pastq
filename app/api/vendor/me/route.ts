import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireVendor } from '@/lib/api-guard';
import { VENDOR_TERMS_VERSION } from '@/lib/vendor-terms';

// Private vendor data (balances, payout account) is served here rather than read
// from the browser, because the profiles table is publicly readable.
export async function GET(req: NextRequest) {
  const g = await requireVendor(req, { requireTerms: false, requireActive: false });
  if (!g.ok) return g.res;

  const [{ data: extra }, { data: account }, { data: suspension }] = await Promise.all([
    supabaseAdmin.from('profiles').select('school,phone,bio,avatar_url,created_at').eq('id', g.userId).single(),
    supabaseAdmin.from('vendor_payout_accounts').select('bank_name,account_number,account_name').eq('vendor_id', g.userId).maybeSingle(),
    g.profile.vendor_status === 'suspended'
      ? supabaseAdmin.from('admin_actions').select('details,created_at').eq('target_id', g.userId)
          .eq('action', 'vendor_suspend').order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    profile: { ...g.profile, ...(extra || {}) },
    termsVersion: VENDOR_TERMS_VERSION,
    termsCurrent: g.profile.vendor_terms_version === VENDOR_TERMS_VERSION && !!g.profile.vendor_terms_accepted_at,
    payoutAccount: account ?? null,
    suspensionReason: (suspension as any)?.details?.reason ?? null,
  });
}
