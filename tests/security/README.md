# PastQ security abuse tests

Use a staging deployment only.

```bash
pip install pytest requests
PASTQ_BASE_URL=https://staging.example.com pytest -q tests/security/test_authorization_abuse.py
python tests/security/static_audit.py
```

The suite checks price tampering, fake payment references, access-flag tampering, answer leakage, and vendor privilege escalation.

`test_vendor_admin_abuse.py` covers the v3 vendor/admin API (anonymous → 401, student → 403).
Database-level checks (RLS, triggers, payout functions) are in `tests/security/db/` — see its README.
