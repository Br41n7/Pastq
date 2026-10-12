"""Applies the full migration chain to a throw-away embedded Postgres (Supabase auth/roles mocked) and
checks RLS, triggers and payout functions.   pip install pgserver psycopg[binary]   &&   python tests/security/db/test_v3_migration.py"""
import pgserver, psycopg, re, sys, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
srv = pgserver.get_server(Path(__file__).parent / '.pgdata', cleanup_mode='delete')
conn = psycopg.connect(srv.get_uri(), autocommit=True)
cur = conn.cursor()
print(cur.execute("select version()").fetchone()[0][:40])

# ---- Minimal Supabase mock -------------------------------------------------
cur.execute("""
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE TABLE storage.buckets (id text primary key, name text, public boolean);
CREATE TABLE storage.objects (id uuid default gen_random_uuid(), name text, bucket_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(n text) RETURNS text[] LANGUAGE sql AS $$ select string_to_array(n,'/') $$;
CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ select gen_random_uuid() $$;
""")

def run_file(name, patch=None):
    sql = (ROOT / name).read_text()
    sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
    sql = sql.replace('CREATE POLICY "purchases_read_own" ON purchases', 'DROP POLICY IF EXISTS "purchases_read_own" ON purchases;\nCREATE POLICY "purchases_read_own" ON purchases') if name=='supabase-vendor-access-model.sql' else sql
    cur.execute(sql)
    print("applied", name)

for f in ['supabase-schema.sql', 'supabase-mvp-product-migration.sql', 'supabase-vendor-access-model.sql', 'supabase-security-hardening-v2.sql']:
    run_file(f)
cur.execute("GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role")
cur.execute("GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role")
cur.execute("GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role")

run_file('supabase-vendor-admin-v3.sql')
run_file('supabase-vendor-admin-v3.sql')   # idempotency: must re-run cleanly
cur.execute("GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role")

# ---- helpers ------------------------------------------------------------------
results = []
def check(name, ok, detail=''):
    results.append(ok); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))

def as_user(uid, sql, params=None, role='authenticated'):
    """Run sql as a Supabase user; returns (rows|None, error|None). Always rolled back to a savepoint-free state."""
    cur.execute('BEGIN')
    try:
        cur.execute(f"SET LOCAL ROLE {role}")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true)", (str(uid) if uid else '',))
        cur.execute(sql, params)
        rows = cur.fetchall() if cur.description else None
        cur.execute('COMMIT')
        return rows, None
    except Exception as e:
        cur.execute('ROLLBACK')
        return None, str(e).splitlines()[0]

def su(sql, params=None):
    cur.execute(sql, params)
    return cur.fetchall() if cur.description else None

def mkuser(email):
    uid = su("insert into auth.users(email, raw_user_meta_data) values (%s, %s::jsonb) returning id", (email, '{"full_name":"%s"}' % email.split('@')[0]))[0][0]
    return uid

S, V, V2, A = (mkuser(e) for e in ['student@x.com', 'vendor@x.com', 'vendor2@x.com', 'admin@x.com'])
su("update profiles set role='admin' where id=%s", (A,))   # SQL editor path: auth.uid() is null

# ---- 1. profile escalation -----------------------------------------------------
_, e = as_user(S, "update profiles set role='admin' where id=%s", (S,))
check('student cannot self-promote to admin', e and 'Role can only be changed' in e, e)
_, e = as_user(S, "update profiles set role='vendor', school='UNILAG' where id=%s", (S,))
check('student CAN self-select vendor role at signup', e is None, e)
_, e = as_user(V, "update profiles set role='vendor' where id=%s", (V,)); assert e is None
_, e = as_user(V2, "update profiles set role='vendor' where id=%s", (V2,)); assert e is None
_, e = as_user(V, "update profiles set pending_payout=99999999 where id=%s", (V,))
check('vendor cannot edit own balance', e and 'Protected profile fields' in e, e)
_, e = as_user(V, "update profiles set vendor_terms_accepted_at=now() where id=%s", (V,))
check('vendor cannot self-stamp agreement acceptance', e and 'Protected profile fields' in e, e)
_, e = as_user(V, "update profiles set full_name='Vee', bio='hello', phone='0803' where id=%s", (V,))
check('vendor can edit name/bio/phone', e is None, e)

# ---- 2. agreement gate on uploads -----------------------------------------------
bank_sql = "insert into question_banks(vendor_id,title,subject,exam_type,access_type,price,status) values (%s,'B1','Math','WAEC','paid',50000,%s) returning id"
_, e = as_user(V, bank_sql, (V, 'pending'))
check('vendor cannot create a bank before accepting agreement', e and 'row-level security' in e, e)
su("update profiles set vendor_terms_version='v1', vendor_terms_accepted_at=now() where id in (%s,%s)", (V, V2))   # what /api/vendor/agreement does
rows, e = as_user(V, bank_sql, (V, 'live'))
check('vendor cannot insert a bank as live', e and 'row-level security' in e, e)
rows, e = as_user(V, bank_sql, (V, 'pending'))
check('vendor can insert a pending bank after agreement', e is None, e)
bank = rows[0][0]

# ---- 3. question counting + re-review ------------------------------------------
for i in range(1, 6):
    _, e = as_user(V, "insert into questions(bank_id,vendor_id,question_number,question_text,option_a,option_b,correct_answer) values (%s,%s,%s,'q','a','b','A')", (bank, V, i))
    assert e is None, e
check('question_count auto-synced on insert', su("select question_count from question_banks where id=%s", (bank,))[0][0] == 5)
_, e = as_user(V2, "insert into questions(bank_id,vendor_id,question_number,question_text,option_a,option_b,correct_answer) values (%s,%s,9,'x','a','b','A')", (bank, V2))
check("vendor cannot add questions to another vendor's bank", e and 'row-level security' in e, e)
_, e = as_user(V, "update question_banks set status='live' where id=%s", (bank,))
check('vendor cannot approve own bank', e and 'Protected question-bank fields' in e, e)
_, e = as_user(V, "update question_banks set moderation_note='all good' where id=%s", (bank,))
check('vendor cannot forge moderation note', e and 'Protected question-bank fields' in e, e)
su("update question_banks set status='live' where id=%s", (bank,))   # admin API (service role)
qid = su("select id from questions where bank_id=%s limit 1", (bank,))[0][0]
su("update questions set explanation='admin fix' where id=%s", (qid,))
check('admin/service edit does NOT unpublish a live bank', su("select status from question_banks where id=%s", (bank,))[0][0] == 'live')
_, e = as_user(V, "update questions set explanation='vendor edit' where id=%s", (qid,))
check('vendor edit of a live bank sends it back to pending', e is None and su("select status from question_banks where id=%s", (bank,))[0][0] == 'pending', e)
su("update question_banks set status='live' where id=%s", (bank,))
su("update purchases set paystack_status='pending' where false")

# ---- 4. purchases, earnings trigger still works ---------------------------------
su("insert into purchases(user_id,bank_id,amount_paid,paystack_reference) values (%s,%s,50000,'ref1')", (S, bank))
su("update purchases set paystack_status='success' where paystack_reference='ref1'")
pp = su("select pending_payout,total_earnings from profiles where id=%s", (V,))[0]
check('purchase trigger credits vendor 70%', float(pp[0]) == 35000.0, pp)
_, e = as_user(V, "delete from question_banks where id=%s returning id", (bank,))
check('vendor cannot delete a live/sold bank', e is None and su("select count(*) from question_banks where id=%s", (bank,))[0][0] == 1)
su("update question_banks set status='rejected' where id=%s", (bank,))
rows, e = as_user(V, "delete from question_banks where id=%s returning id", (bank,))
check('vendor cannot delete a taken-down bank that has sales (would wipe purchases)', not rows and su("select count(*) from purchases")[0][0] == 1, (rows, e))

# ---- 5. payouts --------------------------------------------------------------
su("update profiles set pending_payout=500000, total_earnings=500000 where id=%s", (V,))
_, e = as_user(V, "insert into payout_requests(vendor_id,amount,bank_name,account_number,account_name,status) values (%s,1000,'B','0123456789','N','paid')", (V,))
check('vendor cannot insert payout rows directly', e and 'row-level security' in e, e)
_, e = as_user(V, "select request_payout(%s, 200000, 'GTB','0123456789','Vee')", (V,))
check('authenticated role cannot call request_payout RPC', e and 'permission denied' in e, e)

def svc(sql, params=None):
    return as_user(None, sql, params, role='service_role')
rows, e = svc("select request_payout(%s, 50000, 'GTB','0123456789','Vee')", (V,))
check('below-minimum payout rejected', e and 'below_minimum' in e, e)
rows, e = svc("select request_payout(%s, 900000, 'GTB','0123456789','Vee')", (V,))
check('over-balance payout rejected', e and 'insufficient_balance' in e, e)
rows, e = svc("select request_payout(%s, 200000, 'GTB','0123456789','Vee')", (V,))
pid = rows[0][0] if rows else None
check('valid payout accepted', e is None and bool(pid), e)
check('balance reserved immediately', float(su("select pending_payout from profiles where id=%s", (V,))[0][0]) == 300000.0)
rows, e = svc("select request_payout(%s, 100000, 'GTB','0123456789','Vee')", (V,))
check('second open request blocked', e and 'open_request_exists' in e, e)
_, e = svc("select process_payout(%s,'processing','')", (pid,)); check('mark processing', e is None, e)
_, e = svc("select process_payout(%s,'rejected','bad details')", (pid,)); check('reject releases reserve', e is None and float(su("select pending_payout from profiles where id=%s", (V,))[0][0]) == 500000.0, e)
_, e = svc("select process_payout(%s,'paid','')", (pid,)); check('cannot re-process a closed request', e and 'already_final' in e, e)
rows, e = svc("select request_payout(%s, 200000, 'GTB','0123456789','Vee')", (V,)); pid2 = rows[0][0]
_, e = svc("select process_payout(%s,'paid','ref 123')", (pid2,))
pr = su("select pending_payout,total_paid_out from profiles where id=%s", (V,))[0]
check('paid: total_paid_out up, reserve stays deducted', e is None and float(pr[0]) == 300000.0 and float(pr[1]) == 200000.0, pr)
su("update profiles set vendor_status='suspended' where id=%s", (V,))
rows, e = svc("select request_payout(%s, 100000, 'GTB','0123456789','Vee')", (V,))
check('suspended vendor cannot withdraw', e and 'vendor_suspended' in e, e)
_, e = as_user(V, bank_sql, (V, 'pending'))
check('suspended vendor cannot upload', e and 'row-level security' in e, e)
su("update profiles set vendor_status='active' where id=%s", (V,))

# ---- 6. payout account privacy --------------------------------------------------
_, e = as_user(V, "insert into vendor_payout_accounts values (%s,'GTB','123','Vee')", (V,))
check('payout account must be 10 digits', e and 'check' in e.lower(), e)
_, e = as_user(V, "insert into vendor_payout_accounts values (%s,'GTB','0123456789','Vee')", (V,)); check('vendor saves own payout account', e is None, e)
rows, _ = as_user(V2, "select * from vendor_payout_accounts"); check("other vendor cannot read someone's payout account", rows == [])
rows, _ = as_user(None, "select * from vendor_payout_accounts", role='anon'); check('anon cannot read payout accounts', rows == [])
rows, _ = as_user(V2, "select * from vendor_agreements"); check("other vendor cannot read someone's agreement", rows == [])
rows, _ = as_user(V2, "select * from admin_actions"); check('admin_actions not readable by users', rows == [])

# ---- 7. reports ------------------------------------------------------------------
rows, e = as_user(S, "insert into content_reports(reporter_id,bank_id,question_id,reason,details) values (%s,%s,%s,'wrong_answer','A is wrong') returning id", (S, bank, qid))
check('student can file a question-level report', e is None, e)
_, e = as_user(S, "insert into content_reports(reporter_id,bank_id,reason,details) values (%s,%s,'other',repeat('x',1001))", (S, bank))
check('report details capped at 1000 chars', e and 'details_len' in e, e)
rows, _ = as_user(V, "select * from content_reports"); check('vendor cannot read reports directly (no reporter identity leak)', rows == [])

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
