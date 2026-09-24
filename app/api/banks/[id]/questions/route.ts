import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';

const PUBLIC_FIELDS = 'id,bank_id,question_number,year,question_text,option_a,option_b,option_c,option_d,option_e,topic,difficulty,is_preview';
const FULL_FIELDS = `${PUBLIC_FIELDS},correct_answer,explanation`;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bankId } = await params;
  if (!bankId) return NextResponse.json({ error: 'Missing bank id' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: bank, error: bankError } = await supabaseAdmin
    .from('question_banks')
    .select('id,status,access_type,preview_count,question_count,vendor_id')
    .eq('id', bankId)
    .single();

  if (bankError || !bank || bank.status !== 'live') {
    return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
  }

  let entitled = bank.access_type === 'free';
  if (user) {
    const { data: purchase } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('bank_id', bankId)
      .eq('paystack_status', 'success')
      .maybeSingle();
    entitled = entitled || !!purchase;
  }

  // Full question payload is only returned to an entitled user.
  // Public/unauthorized responses deliberately omit correct_answer and explanation.
  if (entitled) {
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select(FULL_FIELDS)
      .eq('bank_id', bankId)
      .order('question_number');
    if (error) return NextResponse.json({ error: 'Could not load questions' }, { status: 500 });
    return NextResponse.json({ questions: data ?? [], entitled: true });
  }

  const { data, error } = await supabaseAdmin
    .from('questions')
    .select(PUBLIC_FIELDS)
    .eq('bank_id', bankId)
    .eq('is_preview', true)
    .order('question_number')
    .limit(Math.max(0, bank.preview_count ?? 0));

  if (error) return NextResponse.json({ error: 'Could not load preview' }, { status: 500 });
  return NextResponse.json({ questions: data ?? [], entitled: false });
}
