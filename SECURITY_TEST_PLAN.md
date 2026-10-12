# PastQ MVP Security Test Plan

## Authorization
- Anonymous users cannot obtain full paid-bank questions.
- Unpaid users receive preview only for preview-paid banks.
- Purchasers receive full content.
- User A cannot use User B's entitlement.
- Vendor A cannot modify Vendor B's bank.
- Vendors cannot set admin-controlled approval/status fields.

## Payment integrity
- Checkout accepts a bank identifier, not a client-trusted amount.
- Server derives price from the database.
- Payment reference is server-generated.
- Verification checks reference, amount, currency, user, and bank.
- Replayed successful references are idempotent.
- Fake references never create entitlements.

## Content exposure
- Preview responses omit `correct_answer` and `explanation`.
- Direct Supabase reads cannot bypass RLS/API authorization.
- Guessing another bank ID cannot reveal paid content.
- Client query parameters cannot upgrade access or expand preview count.

## Vendor model
- Free => price 0.
- Paid/preview-paid => positive price.
- Preview count is bounded server-side.
- Existing purchasers retain entitlement after access-model changes.

## Vendor & admin (v3)
- Unauthenticated calls to `/api/admin/*` and `/api/vendor/*` return 401.
- A student/vendor session gets 403 from every `/api/admin/*` route.
- A vendor who has not accepted the agreement cannot insert banks/questions or request payouts.
- A suspended vendor cannot upload or withdraw; their live banks are unpublished.
- Vendors cannot change `role`, balances, `vendor_status`, agreement fields, bank `status`, or `moderation_note`.
- Vendors cannot insert/update `payout_requests`; withdrawals go through `request_payout` (service role only).
- Withdrawal reserves balance; rejecting a payout releases it; a closed payout cannot be re-processed.
- Banks with purchases cannot be hard-deleted by vendors or admins (use takedown).
- Buyer identity never appears in vendor sales responses.
