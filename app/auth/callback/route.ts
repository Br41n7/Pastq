import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server';
import { homeForRole, safeNext } from '@/lib/auth-redirect';

// Email-confirmation landing: exchanges the code for a session, then sends the
// user to the right dashboard for their role.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/auth/login?error=confirm_failed', url.origin));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', url.origin));

  const { data: p } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  let role: string = p?.role || 'student';

  // Heal vendor signups whose role never got written (never promotes to admin).
  if (role === 'student' && user.user_metadata?.role === 'vendor') {
    const { error } = await supabaseAdmin.from('profiles').update({ role: 'vendor' }).eq('id', user.id);
    if (!error) role = 'vendor';
  }

  return NextResponse.redirect(new URL(next ?? homeForRole(role), url.origin));
}
