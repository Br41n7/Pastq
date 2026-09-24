import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref') || req.nextUrl.searchParams.get('reference');
  if (!ref || ref.length > 100) return NextResponse.redirect(new URL('/browse?error=missing_ref', req.url));

  try {
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .select('id, bank_id, user_id, amount_paid, paystack_status')
      .eq('paystack_reference', ref)
      .maybeSingle();

    if (purchaseError || !purchase) {
      return NextResponse.redirect(new URL('/browse?error=invalid_reference', req.url));
    }

    // Idempotent: a successful purchase must never be processed twice.
    if (purchase.paystack_status === 'success') {
      return NextResponse.redirect(new URL(`/bank/${purchase.bank_id}?success=1`, req.url));
    }

    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      cache: 'no-store',
    });
    const data = await res.json();

    const transaction = data.data;
    const valid = Boolean(
      res.ok &&
      data.status &&
      transaction?.status === 'success' &&
      transaction?.reference === ref &&
      Number(transaction?.amount) === Number(purchase.amount_paid) &&
      transaction?.currency === 'NGN'
    );

    if (!valid) {
      await supabaseAdmin.from('purchases')
        .update({ paystack_status: 'failed' })
        .eq('id', purchase.id)
        .eq('paystack_status', 'pending');
      return NextResponse.redirect(new URL('/browse?error=payment_failed', req.url));
    }

    // Metadata is an additional binding check when Paystack returns it.
    const metadata = transaction.metadata;
    if (metadata?.bank_id && metadata.bank_id !== purchase.bank_id) {
      return NextResponse.redirect(new URL('/browse?error=payment_mismatch', req.url));
    }
    if (metadata?.user_id && metadata.user_id !== purchase.user_id) {
      return NextResponse.redirect(new URL('/browse?error=payment_mismatch', req.url));
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('purchases')
      .update({ paystack_status: 'success' })
      .eq('id', purchase.id)
      .eq('paystack_status', 'pending')
      .select('bank_id')
      .single();

    if (updateError || !updated) {
      console.error('[Paystack Verify] purchase update failed:', updateError);
      return NextResponse.redirect(new URL('/browse?error=db_error', req.url));
    }

    return NextResponse.redirect(new URL(`/bank/${updated.bank_id}?success=1`, req.url));
  } catch (err: any) {
    console.error('[Paystack Verify]', err.message);
    return NextResponse.redirect(new URL('/browse?error=server_error', req.url));
  }
}
