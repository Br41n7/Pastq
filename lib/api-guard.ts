import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server';

export type GuardedProfile = {
  id: string;
  full_name: string;
  email: string;
  role: 'student' | 'vendor' | 'admin';
  vendor_status: 'active' | 'suspended';
  vendor_terms_version: string | null;
  vendor_terms_accepted_at: string | null;
  total_earnings: number;
  total_paid_out: number;
  pending_payout: number;
};

type Guard =
  | { ok: true; userId: string; profile: GuardedProfile }
  | { ok: false; res: NextResponse };

const fail = (error: string, status: number): Guard => ({
  ok: false,
  res: NextResponse.json({ error }, { status }),
});

/** Cookie-authenticated mutating requests must come from our own origin. */
export function sameOrigin(req: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients (tests) – still need a valid session
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

async function loadSession(req: NextRequest): Promise<Guard> {
  if (!sameOrigin(req)) return fail('Cross-origin request blocked', 403);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Not authenticated', 401);

  // Role always comes from the database — never from client-supplied data.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id,full_name,email,role,vendor_status,vendor_terms_version,vendor_terms_accepted_at,total_earnings,total_paid_out,pending_payout')
    .eq('id', user.id)
    .single();
  if (!profile) return fail('Profile not found', 403);
  return { ok: true, userId: user.id, profile: profile as GuardedProfile };
}

export async function requireAdmin(req: NextRequest): Promise<Guard> {
  const g = await loadSession(req);
  if (!g.ok) return g;
  if (g.profile.role !== 'admin') return fail('Admin access required', 403);
  return g;
}

export async function requireVendor(
  req: NextRequest,
  opts: { requireTerms?: boolean; requireActive?: boolean } = {}
): Promise<Guard> {
  const { requireTerms = true, requireActive = true } = opts;
  const g = await loadSession(req);
  if (!g.ok) return g;
  if (g.profile.role !== 'vendor') return fail('Vendor access required', 403);
  if (requireActive && g.profile.vendor_status !== 'active') return fail('Your vendor account is suspended', 403);
  if (requireTerms && !g.profile.vendor_terms_accepted_at) return fail('Accept the vendor agreement first', 403);
  return g;
}

export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>
) {
  const { error } = await supabaseAdmin
    .from('admin_actions')
    .insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId, details: details ?? null });
  if (error) console.error('[admin_actions] log failed:', error.message);
}

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const cleanText = (v: unknown, max = 500) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';
