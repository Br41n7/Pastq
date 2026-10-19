import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps the Supabase session fresh on every request.
 * Without this, an expired access token is only refreshed inside whichever route
 * handler runs first, while the browser client refreshes the same refresh token in
 * parallel; the rotated tokens collide and later API calls (e.g. signing the vendor
 * agreement) come back "Not authenticated". Here the refresh happens once, before the
 * route runs, and the new cookies are written to both the request and the response.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  await supabase.auth.getUser(); // triggers refresh if needed; no redirects here
  return response;
}

export const config = {
  matcher: ['/api/:path*', '/vendor/:path*', '/admin/:path*', '/auth/:path*'],
};
