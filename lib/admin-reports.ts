import { supabaseAdmin } from '@/lib/supabase-server';

type Resolution = 'fixed' | 'removed' | 'bank_taken_down' | 'no_action';

/** Close open/reviewing reports matching a filter and stamp who handled them. */
export async function resolveReports(
  filter: { questionId?: string; bankId?: string; reportId?: string },
  opts: { status: 'resolved' | 'dismissed'; resolution: Resolution; note?: string; adminId: string }
) {
  let q = supabaseAdmin
    .from('content_reports')
    .update({
      status: opts.status,
      resolution: opts.resolution,
      admin_note: opts.note || null,
      reviewed_by: opts.adminId,
      reviewed_at: new Date().toISOString(),
    })
    .in('status', ['open', 'reviewing']);
  if (filter.reportId) q = q.eq('id', filter.reportId);
  if (filter.questionId) q = q.eq('question_id', filter.questionId);
  if (filter.bankId) q = q.eq('bank_id', filter.bankId);
  const { error } = await q;
  if (error) console.error('[resolveReports]', error.message);
  return !error;
}
