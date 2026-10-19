import { supabase } from '@/lib/supabase';

/** Small fetch wrapper for our own /api routes: throws Error(message) on failure. */
export async function api<T = any>(url: string, init?: RequestInit, retried = false): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });

  // Session cookie went stale (e.g. page left open): refresh once and retry before giving up.
  if (res.status === 401 && !retried) {
    const { error } = await supabase.auth.refreshSession();
    if (!error) return api<T>(url, init, true);
    if (typeof window !== 'undefined') {
      window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new Error('Your session expired. Please sign in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export const send = <T = any>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown) =>
  api<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
