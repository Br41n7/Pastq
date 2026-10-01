import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin, logAdminAction, isUuid, cleanText } from '@/lib/api-guard';
import { resolveReports } from '@/lib/admin-reports';

const Q_FIELDS =
  'id,bank_id,question_number,year,question_text,option_a,option_b,option_c,option_d,option_e,correct_answer,explanation,topic,difficulty,is_preview';
const OPTION_KEYS = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'] as const;

function validate(fields: any) {
  const out: Record<string, unknown> = {};
  const errors: string[] = [];
  if (fields.question_text !== undefined) {
    const t = cleanText(fields.question_text, 2000);
    if (!t) errors.push('Question text cannot be empty'); else out.question_text = t;
  }
  for (const k of OPTION_KEYS) {
    if (fields[k] !== undefined) out[k] = cleanText(fields[k], 500) || null;
  }
  if (fields.correct_answer !== undefined) {
    const a = String(fields.correct_answer).toUpperCase();
    if (!['A', 'B', 'C', 'D', 'E'].includes(a)) errors.push('Correct answer must be A–E'); else out.correct_answer = a;
  }
  if (fields.explanation !== undefined) out.explanation = cleanText(fields.explanation, 2000) || null;
  if (fields.topic !== undefined) out.topic = cleanText(fields.topic, 100) || null;
  if (fields.difficulty !== undefined) {
    if (!['easy', 'medium', 'hard'].includes(fields.difficulty)) errors.push('Invalid difficulty'); else out.difficulty = fields.difficulty;
  }
  if (fields.year !== undefined) {
    if (fields.year === null || fields.year === '') out.year = null;
    else {
      const y = parseInt(fields.year, 10);
      if (!Number.isInteger(y) || y < 1950 || y > 2100) errors.push('Invalid year'); else out.year = y;
    }
  }
  if (fields.is_preview !== undefined) out.is_preview = !!fields.is_preview;
  return { out, errors };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { out, errors } = validate(body.fields || {});
  if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 400 });
  if (!Object.keys(out).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data: before } = await supabaseAdmin.from('questions').select(Q_FIELDS).eq('id', id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  // The correct answer must point at an option that actually exists.
  const merged: any = { ...before, ...out };
  const key = `option_${String(merged.correct_answer).toLowerCase()}`;
  if (!merged[key]) {
    return NextResponse.json({ error: `Option ${merged.correct_answer} is empty, so it cannot be the correct answer` }, { status: 400 });
  }
  if (!merged.option_a || !merged.option_b) {
    return NextResponse.json({ error: 'Options A and B are required' }, { status: 400 });
  }

  // Service-role edit: does not send a live bank back to review (only vendor edits do).
  const { error } = await supabaseAdmin.from('questions').update(out).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not update question' }, { status: 500 });

  const note = cleanText(body.note, 500);
  if (body.resolve_reports !== false) {
    await resolveReports({ questionId: id }, { status: 'resolved', resolution: 'fixed', note, adminId: g.userId });
  }

  const changed = Object.fromEntries(Object.keys(out).map(k => [k, { from: (before as any)[k], to: out[k] }]));
  await logAdminAction(g.userId, 'question_adjust', 'question', id, { bank_id: before.bank_id, changed, note });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (!g.ok) return g.res;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const note = cleanText(body.note, 500);

  const { data: q } = await supabaseAdmin.from('questions').select('id,bank_id,question_number,question_text').eq('id', id).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  // Close linked reports first: deleting the question nulls their question_id.
  await resolveReports({ questionId: id }, { status: 'resolved', resolution: 'removed', note, adminId: g.userId });

  const { error } = await supabaseAdmin.from('questions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete question' }, { status: 500 });

  await logAdminAction(g.userId, 'question_delete', 'question', id, {
    bank_id: q.bank_id, question_number: q.question_number, text: q.question_text.slice(0, 200), note,
  });
  return NextResponse.json({ ok: true });
}
