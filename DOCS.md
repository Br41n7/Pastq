# PastQ — Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [User Roles](#user-roles)
5. [Payment Flow](#payment-flow)
6. [Vendor Payout System](#vendor-payout-system)
7. [API Reference](#api-reference)
8. [Row Level Security](#row-level-security)
9. [Deployment Guide](#deployment-guide)
10. [Environment Variables](#environment-variables)
11. [Integration with Akili](#integration-with-akili)

---

## Overview

PastQ is a marketplace where educators, tutors, and students
sell compiled past examination questions for African exam systems
(WAEC, JAMB, NECO, KCSE, WASSCE, etc.).

**Core value proposition:**
- Vendors compile past questions once → earn 70% on every sale forever
- Students buy a question bank → one click imports it into Akili → AI builds a full course
- Platform earns 30% of every transaction, handles no physical goods

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   VERCEL                         │
│                                                  │
│  Next.js 15 App (PastQ)                         │
│  ├── /app          → pages (App Router)          │
│  ├── /app/api      → server-side API routes      │
│  └── /components   → shared UI components        │
└─────────────────────────┬────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │      SUPABASE         │
              │                       │
              │  Auth (email/password)│
              │  PostgreSQL (all data)│
              │  Storage (PDF files)  │
              │  Row Level Security   │
              └───────────────────────┘
                          │
              ┌───────────▼───────────┐
              │      PAYSTACK         │
              │                       │
              │  Payment initialize   │
              │  Payment verify       │
              │  Nigerian cards, bank │
              │  transfer, USSD       │
              └───────────────────────┘
```

**Important:** PastQ and Akili share a single Supabase project.
They are two separate Next.js apps (two Vercel deployments) but
one database. This is how "import to Akili" works without an
external API between the two apps.

---

## Database Schema

### Core Tables

**profiles**
Extends Supabase Auth. Auto-created on signup via trigger.
```sql
id            UUID (FK → auth.users)
full_name     TEXT
email         TEXT
role          TEXT  -- 'student' | 'vendor' | 'admin'
school        TEXT
phone         TEXT
total_earnings    NUMERIC  -- lifetime vendor earnings (kobo)
total_paid_out    NUMERIC  -- manually paid so far (kobo)
pending_payout    NUMERIC  -- owed but not yet paid (kobo)
```

**question_banks**
A listing in the marketplace.
```sql
id            UUID
vendor_id     UUID (FK → profiles)
title         TEXT
subject       TEXT
exam_type     TEXT  -- WAEC | JAMB | NECO | KCSE | WASSCE | BECE | UTME | POST-UTME | OTHER
year_start    INTEGER
year_end      INTEGER
price         NUMERIC  -- stored in KOBO (₦500 = 50000 kobo)
status        TEXT  -- pending | approved | live | rejected
total_sales   INTEGER
rating        NUMERIC
```

**questions**
Individual questions inside a bank.
```sql
id                UUID
bank_id           UUID (FK → question_banks)
question_number   INTEGER
year              INTEGER
question_text     TEXT
option_a/b/c/d/e  TEXT
correct_answer    TEXT  -- 'A' | 'B' | 'C' | 'D' | 'E'
explanation       TEXT
topic             TEXT
is_preview        BOOLEAN  -- visible without purchase
```

**purchases**
Records every completed payment.
```sql
id                   UUID
user_id              UUID (FK → profiles)
bank_id              UUID (FK → question_banks)
amount_paid          NUMERIC  -- in kobo
paystack_reference   TEXT UNIQUE
paystack_status      TEXT  -- pending | success | failed
vendor_share         NUMERIC  -- 70% of amount_paid
platform_share       NUMERIC  -- 30% of amount_paid
imported_to_akili    BOOLEAN
akili_project_id     UUID  -- set when student imports to Akili
```

**payout_requests**
Vendor requests manual bank transfer.
```sql
id              UUID
vendor_id       UUID
amount          NUMERIC  -- in kobo
bank_name       TEXT
account_number  TEXT
account_name    TEXT
status          TEXT  -- pending | processing | paid | rejected
admin_note      TEXT
```

---

## User Roles

### Student
- Browses question banks
- Purchases banks via Paystack
- Views purchased questions with answers
- Imports purchased banks to Akili

### Vendor
- Uploads question banks (manual question entry)
- Sets their own price
- Views earnings dashboard
- Requests manual payout

### Admin (managed directly in Supabase)
- Reviews submitted question banks → change status from `pending` to `live`
- Processes payout requests → mark as `paid` in `payout_requests` table
- Monitors transactions

**No admin UI is built for MVP** — all admin actions happen directly
in the Supabase dashboard. This is intentional for MVP speed.

**How to approve a question bank:**
1. Supabase Dashboard → Table Editor → question_banks
2. Find the row, change `status` from `pending` to `live`
3. Save

**How to process a payout:**
1. Supabase Dashboard → Table Editor → payout_requests
2. Find the pending request, note the bank details
3. Transfer via your bank or Paystack manually
4. Update row: status → `paid`, add admin_note with transfer reference
5. Update profiles table: subtract `amount` from `pending_payout`,
   add `amount` to `total_paid_out` for the vendor

---

## Payment Flow

```
Student clicks "Buy Now"
        ↓
POST /api/paystack/initialize
  - Records purchase row with status: 'pending'
  - Calls Paystack API with amount + email + reference
  - Returns authorization_url
        ↓
Browser redirects to Paystack payment page
(Student pays with card, bank transfer, or USSD)
        ↓
Paystack redirects to:
GET /api/paystack/verify?ref={reference}
        ↓
Server calls Paystack verify endpoint
  - If success: updates purchase → status: 'success'
  - DB trigger fires automatically:
      → vendor earnings updated (70%)
      → platform share recorded (30%)
      → question_banks.total_sales incremented
  - Redirects to /bank/{id}?success=1
        ↓
Student can now see all questions + answers
and the "Import to Akili" button appears
```

**All amounts are stored in kobo** (1 naira = 100 kobo).
Paystack requires kobo. `formatNaira(kobo)` converts for display.
`toKobo(naira)` converts for Paystack.

---

## Vendor Payout System

**This is entirely manual for MVP.**

### How vendors get paid:
1. Vendor earns 70% on each sale → auto-updated by DB trigger
2. `pending_payout` field grows with each sale
3. Vendor submits payout request from dashboard:
   - Amount to withdraw
   - Bank name, account number, account name
4. Request appears in Supabase `payout_requests` table
5. You (admin) manually transfer within 3 business days
6. Update `payout_requests.status` → `paid`
7. Manually update vendor's `pending_payout` and `total_paid_out`

**Minimum payout:** ₦1,000 (enforced in frontend form)

**Why manual?** Paystack's bulk transfer API requires additional
KYC/compliance setup. For MVP this is fine — do it manually until
you have enough volume to justify automation (~50+ payouts/month).

---

## API Reference

### POST /api/paystack/initialize
Initializes a Paystack payment session.
**Auth required:** Yes (Supabase session)

Request:
```json
{
  "email": "student@gmail.com",
  "amount": 50000,
  "reference": "PQ_1234567890_ABC",
  "metadata": { "bank_id": "uuid", "user_id": "uuid" },
  "callback_url": "https://pastq.co/api/paystack/verify?ref=PQ_..."
}
```
Response:
```json
{
  "authorization_url": "https://checkout.paystack.com/...",
  "access_code": "...",
  "reference": "PQ_..."
}
```

### GET /api/paystack/verify
Called by Paystack after payment. Verifies and updates DB.
**Auth required:** No (called by Paystack redirect)

Query params: `ref=PQ_1234567890_ABC`
Redirects to: `/bank/{id}?success=1` or `/browse?error=payment_failed`

### GET /api/banks
Returns live question banks with optional filters.
**Auth required:** No

Query params: `exam`, `subject`, `q` (search)

---

## Row Level Security

Every table has RLS enabled. Key policies:

**Questions visibility:**
- `is_preview = true` → visible to everyone (no auth)
- Full questions → only users with a successful purchase for that bank

**Question banks:**
- Vendors can CRUD their own banks
- Students can only SELECT banks where `status = 'live'`

**Purchases:**
- Users can only see their own purchases

This means even if someone guesses a question UUID, they cannot
query it without a matching purchase record.

---

## Deployment Guide

### Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your: Project URL, Anon Key, Service Role Key
3. Go to SQL Editor → New Query
4. Paste the full contents of `supabase-schema.sql` → Run
5. Go to Storage → Create bucket:
   - Name: `question-banks`
   - Public: OFF (private)
6. Go to Authentication → Email → Enable "Confirm email"
   (optional for MVP — can disable to reduce friction)

### Step 2 — Paystack Setup

1. Create account at [paystack.com](https://paystack.com)
2. Complete business verification (required for live payments)
3. Dashboard → Settings → API Keys
4. Copy Secret Key (starts with `sk_live_` or `sk_test_`)
5. Copy Public Key (starts with `pk_live_` or `pk_test_`)
6. Set up webhook (optional for MVP — we use redirect-based verify)

**For testing:** Use `sk_test_` and `pk_test_` keys.
Test card: `4084 0840 8408 4081`, CVV: `408`, Expiry: any future date

### Step 3 — Vercel Deployment

1. Push PastQ to its own GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the PastQ GitHub repo
4. Framework: Next.js (auto-detected)
5. Add Environment Variables (see next section)
6. Click Deploy
7. Note your Vercel URL (e.g. `https://pastq.vercel.app`)

### Step 4 — Post-deployment

1. Update Paystack callback URL to your real Vercel URL
2. Test a full purchase flow with test keys
3. Switch to live Paystack keys when ready

---

## Environment Variables

```bash
# .env.local (never commit this file)

# Supabase — from Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # SECRET — server only

# Paystack — from Dashboard → Settings → API Keys
PAYSTACK_SECRET_KEY=sk_live_xxx    # or sk_test_xxx for testing
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxx

# Akili URL — for the "Import to Akili" button
NEXT_PUBLIC_AKILI_URL=https://akili.vercel.app
```

---

## Integration with Akili

The "Import to Akili" button on the bank detail page redirects to:
```
https://{AKILI_URL}/import?bank={bank_id}&ref={paystack_reference}
```

Akili verifies the purchase by querying the shared Supabase database.
No API key exchange needed — same DB, same RLS rules.

If the student doesn't have an Akili account, they're prompted to
create one at `/auth/signup?bank={id}&ref={ref}` which pre-fills
the import context and redirects back after signup.
