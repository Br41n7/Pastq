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
