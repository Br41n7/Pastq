/** Small fetch wrapper for our own /api routes: throws Error(message) on failure. */
export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export const send = <T = any>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown) =>
  api<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
