import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import crypto from 'node:crypto';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { bank_id } = await req.json();
    if (!bank_id || typeof bank_id !== 'string') {
      return NextResponse.json({ error: 'Missing bank_id' }, { status: 400 });
    }

    const { data: bank, error: bankError } = await supabaseAdmin
      .from('question_banks')
      .select('id, vendor_id, title, price, access_type, status')
      .eq('id', bank_id)
      .eq('status', 'live')
      .single();

    if (bankError || !bank) {
      return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
    }

    if (bank.access_type === 'free' || Number(bank.price) === 0) {
      return NextResponse.json({ error: 'This question bank is free' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('purchases')
      .select('id, paystack_status')
      .eq('user_id', user.id)
      .eq('bank_id', bank.id)
      .eq('paystack_status', 'success')
      .maybeSingle();

    if (existing) return NextResponse.json({ alreadyPurchased: true });

    const amount = Number(bank.price);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid bank price' }, { status: 500 });
    }

    // The server owns both the amount and the payment reference.
    // Never trust price/reference values supplied by the browser.
    const reference = `pastq_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    const { error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .insert({
        user_id: user.id,
        bank_id: bank.id,
        amount_paid: amount,
        paystack_reference: reference,
        paystack_status: 'pending',
      });

    if (purchaseError) {
      console.error('[Paystack Init] purchase insert failed:', purchaseError);
      return NextResponse.json({ error: 'Could not create payment record' }, { status: 500 });
    }

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount,
        reference,
        metadata: { bank_id: bank.id, user_id: user.id },
        callback_url: `${new URL('/api/paystack/verify', req.url).toString()}`,
      }),
      cache: 'no-store',
    });

    const data = await res.json();
    if (!res.ok || !data.status || !data.data?.authorization_url) {
      await supabaseAdmin.from('purchases')
        .update({ paystack_status: 'failed' })
        .eq('paystack_reference', reference);
      throw new Error(data.message || 'Paystack initialization failed');
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference,
    });
  } catch (err: any) {
    console.error('[Paystack Init]', err.message);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
