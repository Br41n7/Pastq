import os, uuid, pytest, requests
BASE=os.getenv('PASTQ_BASE_URL','').rstrip('/')
BANK=os.getenv('PASTQ_TEST_BANK_ID','')
UNPURCHASED=os.getenv('PASTQ_TEST_UNPURCHASED_BANK_ID','')

def api(path, method='get', **kw):
    if not BASE: pytest.skip('Set PASTQ_BASE_URL to staging')
    return requests.request(method, BASE+path, timeout=15, allow_redirects=False, **kw)

def test_no_answer_leak():
    if not BANK: pytest.skip('Set PASTQ_TEST_BANK_ID')
    for q in ('','?full=true','?include_answers=true','?preview=false','?access=full','?purchased=true'):
        r=api(f'/api/banks/{BANK}/questions{q}')
        if r.ok:
            body=str(r.json()).lower()
            assert 'correct_answer' not in body
            assert 'explanation' not in body

def test_fake_payment_reference_rejected():
    r=api('/api/paystack/verify','post',json={'reference':'pastq-test-'+uuid.uuid4().hex,'bank_id':BANK or 'invalid'})
    assert r.status_code in (400,401,403,404,405)

def test_client_amount_not_trusted():
    if not BANK: pytest.skip('Set PASTQ_TEST_BANK_ID')
    r=api('/api/paystack/initialize','post',json={'bank_id':BANK,'amount':1,'price':1,'currency':'NGN'})
    assert r.status_code in (400,401,403,404,405)

def test_unpurchased_bank_cannot_be_upgraded_by_query():
    if not UNPURCHASED: pytest.skip('Set PASTQ_TEST_UNPURCHASED_BANK_ID')
    for q in ('?purchased=true','?is_paid=true','?preview=false','?role=admin'):
        r=api(f'/api/banks/{UNPURCHASED}/questions{q}')
        if r.ok: assert 'correct_answer' not in str(r.json()).lower()

def test_fake_vendor_admin_fields_rejected():
    r=api('/api/vendor/banks','post',json={'status':'live','role':'admin','approved':True,'total_sales':999999999})
    assert r.status_code in (400,401,403,404,405)
