"""Anonymous access checks for the v3 vendor/admin API. Staging only.

    PASTQ_BASE_URL=https://staging.example.com pytest -q tests/security/test_vendor_admin_abuse.py

Optional (role checks): set PASTQ_STUDENT_COOKIE to a logged-in *student* session
cookie header value; every admin route must then answer 403.
"""
import os
import pytest
import requests

BASE = os.environ.get("PASTQ_BASE_URL", "http://localhost:3001").rstrip("/")
UUID = "00000000-0000-0000-0000-000000000000"

ADMIN = [
    ("GET", "/api/admin/summary"), ("GET", "/api/admin/reports"), ("GET", "/api/admin/banks"),
    ("GET", f"/api/admin/banks/{UUID}"), ("GET", "/api/admin/vendors"), ("GET", "/api/admin/payouts"),
    ("PATCH", f"/api/admin/reports/{UUID}"), ("PATCH", f"/api/admin/banks/{UUID}"),
    ("DELETE", f"/api/admin/banks/{UUID}"), ("PATCH", f"/api/admin/questions/{UUID}"),
    ("DELETE", f"/api/admin/questions/{UUID}"), ("PATCH", f"/api/admin/vendors/{UUID}"),
    ("PATCH", f"/api/admin/payouts/{UUID}"),
]
VENDOR = [
    ("GET", "/api/vendor/me"), ("GET", "/api/vendor/banks"), ("GET", "/api/vendor/sales"),
    ("GET", "/api/vendor/payouts"), ("POST", "/api/vendor/payouts"), ("POST", "/api/vendor/agreement"),
]


@pytest.mark.parametrize("method,path", ADMIN + VENDOR)
def test_anonymous_is_rejected(method, path):
    r = requests.request(method, BASE + path, json={}, timeout=15)
    assert r.status_code == 401, f"{method} {path} -> {r.status_code}"


@pytest.mark.skipif(not os.environ.get("PASTQ_STUDENT_COOKIE"), reason="no student session provided")
@pytest.mark.parametrize("method,path", ADMIN)
def test_student_cannot_use_admin_api(method, path):
    r = requests.request(method, BASE + path, json={}, headers={"Cookie": os.environ["PASTQ_STUDENT_COOKIE"]}, timeout=15)
    assert r.status_code == 403, f"{method} {path} -> {r.status_code}"
