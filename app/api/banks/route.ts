import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const exam = req.nextUrl.searchParams.get('exam');
  const subject = req.nextUrl.searchParams.get('subject');
  const search = req.nextUrl.searchParams.get('q');

  let query = supabaseAdmin
    .from('question_banks')
    .select('*, vendor:vendor_id(full_name, school)')
    .eq('status', 'live')
    .order('total_sales', { ascending: false })
    .limit(40);

  if (exam) query = query.eq('exam_type', exam);
  if (subject) query = query.eq('subject', subject);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
