# DB-level tests for v3

Uses an embedded Postgres (`pgserver`) with a minimal mock of Supabase (`auth.uid()`, roles, storage stubs).

```bash
pip install pgserver "psycopg[binary]"
python tests/security/db/test_v3_migration.py
```

Note: the harness patches one line of `supabase-vendor-access-model.sql` in memory
(`purchases_read_own` already exists on a fresh install of the current schema).
