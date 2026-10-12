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

## Vendor Payout Flow (v3 — reserve on request)
1. Vendor saves a payout bank account in **Vendor → Settings**.
2. Vendor requests a withdrawal in **Vendor → Payouts** (min ₦1,000, one open request at a time).
   The amount is **reserved immediately** (`profiles.pending_payout` is decremented) by the SQL function `request_payout`.
3. Admin sees the request in **Admin → Payouts**, transfers the money by bank/Paystack, then marks it **paid**
   (`total_paid_out` += amount) — or **rejects** it with a reason (the reserved amount returns to the vendor).
4. Every step is atomic in SQL (`request_payout`, `process_payout`) and is written to `admin_actions`.

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


## Vendor dashboard & admin moderation (v3)

Run `supabase-vendor-admin-v3.sql` **after** all earlier migrations (it is idempotent), then make yourself the first admin:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';
```

### Vendor area — `/vendor/*`
| Page | What it does |
| --- | --- |
| Agreement gate | Copyright & permission declarations + typed signature. Recorded in `vendor_agreements` (version, IP, user agent, timestamp). Until accepted, vendors cannot upload, edit, or withdraw — enforced by RLS (`is_active_vendor()`), not just the UI. Bump `VENDOR_TERMS_VERSION` in `lib/vendor-terms.ts` to force re-acceptance. |
| `/vendor/dashboard` | Balances, 30-day earnings chart, recent sales, banks needing attention (reports / admin notes). |
| `/vendor/banks`, `/vendor/banks/[id]` | Manage banks: edit details/pricing, add/edit/delete questions, delete unsold drafts. Editing a **live** bank sends it back to review. |
| `/vendor/upload` | Existing upload flow (now behind the agreement gate). |
| `/vendor/sales` | 7/30/90-day/all-time sales, chart, transactions (buyers are anonymised). |
| `/vendor/payouts` | Withdraw earnings, history. |
| `/vendor/settings` | Profile, payout account, copy of the accepted agreement. |

### Admin area — `/admin/*`
| Page | What it does |
| --- | --- |
| `/admin/reports` | Reported questions/banks. **Approve** (keep, dismiss report), **Adjust** (edit the question), **Delete** question, or **Take down** the bank. |
| `/admin/banks`, `/admin/banks/[id]` | Approval queue; approve / reject / send back; review and fix every question. Hard delete only if the bank has no purchases. |
| `/admin/vendors` | Agreement status and stats; **suspend** (unpublishes live banks, blocks uploads & withdrawals, shows reason) / **reinstate**. |
| `/admin/payouts` | Process withdrawal requests (processing → paid / rejected). |

Students can now report an individual question from the bank page (“Report this question”), as well as the whole bank.

### Security notes
- All `/api/admin/*` routes re-check `role = 'admin'` from the database on every call; `/api/vendor/*` routes check vendor role, active status, and agreement.
- Mutating API routes reject cross-origin browser requests.
- Every admin action is logged in `admin_actions` (service-role only).
- v3 also closes gaps in the earlier policies: users could update their own `role`/balances, insert banks as `live`, insert/mark payout rows themselves, and delete sold banks (cascading purchase records).
