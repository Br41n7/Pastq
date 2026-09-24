# PastQ — Africa's Past Questions Marketplace

Buy and sell compiled past questions for WAEC, JAMB, NECO, KCSE and more.

## Stack
- Next.js 15 (App Router) + TypeScript
- Supabase (Auth + PostgreSQL + Storage)
- Paystack (payments)
- Tailwind CSS

## Setup

### 1. Supabase
1. Create a new project at supabase.com
2. Run `supabase-schema.sql` in Supabase SQL Editor
3. Go to Storage → create bucket named `question-banks` (private)

### 2. Paystack
1. Create account at paystack.com
2. Get your Secret Key and Public Key from Settings → API Keys
3. Set callback URL in Paystack dashboard to: `https://your-domain.com/api/paystack/verify`

### 3. Environment Variables
```bash
cp .env.example .env.local
# Fill in all values
```

### 4. Install & Run
```bash
npm install
npm run dev     # development (port 3001)
npm run build   # production build
npm start       # production server
```

## Deploy to Vercel
1. Push to GitHub
2. Import repo in Vercel
3. Add all env vars from `.env.example`
4. Deploy

## Integration with Akili
PastQ and Akili share the **same Supabase project**.
- Same `question_banks`, `purchases`, `profiles` tables
- When a student purchases a bank on PastQ, they can import it to Akili
- Import URL: `https://akili.study/import?bank={bank_id}&ref={paystack_reference}`

## Vendor Payout Flow
1. Vendor requests payout via dashboard (bank name + account number)
2. Admin receives request in Supabase `payout_requests` table
3. Admin manually transfers via bank or Paystack dashboard
4. Admin updates request status to `paid` in Supabase
5. Vendor `total_paid_out` is updated, `pending_payout` decremented

70% vendor / 30% platform split — handled automatically via DB trigger.


## MVP product retouch

Run `supabase-mvp-product-migration.sql` after the hardened security migration.

The current MVP now supports:
- university / faculty / department / programme / level / semester metadata
- course code and course title
- test/exam/quiz/assignment classification
- course-aware search and filters
- free previews
- online practice mode after purchase
- score + weak-topic feedback
- practice attempt history
- content reporting
- safe public vendor profile view

The product intentionally does not claim live user/sales statistics on the landing
page until real production data exists.


## Product boundary: PastQ vs Akili

PastQ is the content marketplace and access layer:
- university/course discovery
- question-bank previews
- buying and selling
- moderation/reporting
- payment and entitlement
- question provenance and metadata

Akili is the learning layer:
- timed exams
- practice sessions
- scoring and performance analytics
- weak-topic detection
- AI explanations
- personalized revision and study plans

PastQ should not duplicate Akili's learning engine. A purchased PastQ bank can be handed off to Akili using its bank ID / question IDs.


## Vendor-selected access model

Each vendor chooses how a question bank is distributed:

- `free` — students can access the bank without payment.
- `paid` — students purchase the full bank.
- `preview_paid` — students receive a limited preview and purchase the full bank.

PastQ enforces the platform rules and entitlement model, but does not force one commercial model on contributors.

Existing purchasers retain their purchase entitlement if a vendor later changes the bank's access model.

## Question-content security boundary

Question rows are no longer readable directly from the browser. This is intentional because each row contains sensitive fields such as `correct_answer` and `explanation`.

All student content access goes through `GET /api/banks/[id]/questions`:
- free banks: authenticated or anonymous users can receive the full bank;
- paid/preview-paid banks: anonymous or unpaid users receive only preview questions and safe fields;
- successful purchasers receive the full question payload;
- `correct_answer` and `explanation` are never included in public preview responses.

Browser clients also cannot insert/update/delete purchase records. Successful purchase state is created by the server-side Paystack verification flow.

## Security hardening v2

- Payment initialization derives price and reference on the server from `question_banks`.
- Paystack verification checks the stored amount, reference, currency, and optional metadata bindings.
- Browser clients cannot create/update/delete `purchases`.
- Vendors no longer have a blanket `question_banks FOR ALL` policy.
- Marketplace/system fields such as `status`, `total_sales`, ratings and question count are protected from vendor updates.
- Changes to a live bank's commercial/content configuration return it to `pending` review.
