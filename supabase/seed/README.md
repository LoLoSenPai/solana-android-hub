# Database fixtures

`fixture.sql` and `advance-v2.sql` are local-only development fixtures. Only
`fixture.sql` is part of the automatic local reset configured in
`supabase/config.toml`.

`staging-fixture.sql` is a manual, non-promotable catalogue fixture for the
staging environment. It is deliberately excluded from automatic seeding and
fails closed unless the SQL session first runs:

```sql
set hub.seed_environment = 'staging';
```

Never run the staging fixture against a production database. Its consent and
authority evidence are deterministic test values, not real publisher proofs.
