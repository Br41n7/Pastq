import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireVendor } from '@/lib/api-guard';
import {
  ALLOWED_MIME, MAX_IMAGE_BASE64_CHARS, SCAN_PROMPT, SCAN_SCHEMA,
  monthStartUTC, sanitizeScan, scanLimit,
} from '@/lib/scan';

export const runtime = 'nodejs';
export const maxDuration = 60;

const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function usedThisMonth(vendorId: string) {
  const { count } = await supabaseAdmin
    .from('vendor_scan_log')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
    .gte('created_at', monthStartUTC().toISOString());
  return count ?? 0;
}

const quota = (used: number) => {
  const limit = scanLimit();
  return { limit, used: Math.min(used, limit), remaining: Math.max(0, limit - used) };
};

/** Remaining free scans for the signed-in vendor. */
export async function GET(req: NextRequest) {
  const g = await requireVendor(req);
  if (!g.ok) return g.res;
  return NextResponse.json({ quota: quota(await usedThisMonth(g.userId)) });
}

/** One photographed page in, extracted questions (without answers) out. Costs one scan. */
export async function POST(req: NextRequest) {
  const g = await requireVendor(req);
  if (!g.ok) return g.res;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Scanning is not set up yet. Please add questions manually.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const mime = typeof body?.mimeType === 'string' ? body.mimeType : '';
  let data = typeof body?.image === 'string' ? body.image : '';
  data = data.replace(/^data:[^,]*,/, '');
  if (!(ALLOWED_MIME as readonly string[]).includes(mime) || !data || !/^[A-Za-z0-9+/=\s]+$/.test(data)) {
    return NextResponse.json({ error: 'Upload a JPG, PNG or WebP photo of the page.' }, { status: 400 });
  }
  if (data.length > MAX_IMAGE_BASE64_CHARS) {
    return NextResponse.json({ error: 'That image is too large. Try a smaller photo.' }, { status: 413 });
  }

  // Reserve first (atomic), so parallel requests cannot go over the monthly cap.
  const limit = scanLimit();
  const { data: reserved, error: rErr } = await supabaseAdmin.rpc('reserve_scan', { p_vendor: g.userId, p_limit: limit });
  if (rErr) {
    console.error('[scan] reserve failed:', rErr.message);
    return NextResponse.json({ error: 'Could not start the scan. Please try again.' }, { status: 500 });
  }
  const row = Array.isArray(reserved) ? reserved[0] : reserved;
  if (!row?.scan_id) {
    return NextResponse.json(
      { error: `You have used all ${limit} free scans for this month. They reset on the 1st.`, quota: quota(row?.used ?? limit) },
      { status: 429 }
    );
  }
  const scanId: string = row.scan_id;
  const refund = async () => { await supabaseAdmin.rpc('release_scan', { p_scan: scanId }); };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 50_000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL())}:generateContent`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: SCAN_PROMPT }, { inline_data: { mime_type: mime, data } }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 16384,
            responseMimeType: 'application/json',
            responseSchema: SCAN_SCHEMA,
          },
        }),
      }
    ).finally(() => clearTimeout(timer));

    if (!res.ok) {
      console.error('[scan] gemini status', res.status);
      await refund();
      return NextResponse.json({ error: 'The scanner is busy or unavailable. You were not charged; please try again.' }, { status: 502 });
    }

    const json = await res.json();
    const cand = json?.candidates?.[0];
    const text: string | undefined = cand?.content?.parts?.map((p: any) => p?.text ?? '').join('');
    if (!text || cand?.finishReason === 'SAFETY' || cand?.finishReason === 'MAX_TOKENS') {
      console.error('[scan] unusable response, finishReason:', cand?.finishReason);
      await refund();
      return NextResponse.json({ error: 'Could not read that page. You were not charged; try a clearer photo.' }, { status: 502 });
    }

    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch {
      await refund();
      return NextResponse.json({ error: 'Could not read that page. You were not charged; try a clearer photo.' }, { status: 502 });
    }

    const questions = sanitizeScan(parsed);
    return NextResponse.json({ questions, quota: quota(await usedThisMonth(g.userId)) });
  } catch (e: any) {
    console.error('[scan] failed:', e?.name === 'AbortError' ? 'timeout' : e?.message);
    await refund();
    return NextResponse.json({ error: 'The scan took too long. You were not charged; please try again.' }, { status: 504 });
  }
}
