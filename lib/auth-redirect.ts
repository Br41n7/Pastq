export type Role = 'student' | 'vendor' | 'admin';

/** Where each role lands after signing in / signing up. */
export const homeForRole = (role?: string | null) =>
  role === 'admin' ? '/admin' : role === 'vendor' ? '/vendor/dashboard' : '/browse';

/** Only allow same-site relative paths as post-login targets (blocks open redirects). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}
