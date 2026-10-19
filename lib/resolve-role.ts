import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/auth-redirect';

/**
 * Reads the user's role from the profiles table (source of truth).
 * Self-heals accounts that signed up as vendors but were left as 'student'
 * (the old signup flow wrote the role client-side, which silently failed
 * whenever there was no session yet, e.g. email confirmation enabled).
 * The DB only permits student -> vendor for self-service, never admin.
 */
export async function resolveRole(user: User): Promise<Role> {
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  let role: Role = (p?.role as Role) || 'student';

  if (role === 'student' && user.user_metadata?.role === 'vendor') {
    const { data: healed } = await supabase
      .from('profiles').update({ role: 'vendor' }).eq('id', user.id).select('role').maybeSingle();
    if (healed?.role === 'vendor') role = 'vendor';
  }
  return role;
}
