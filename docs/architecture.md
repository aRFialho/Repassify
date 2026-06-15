# Repassify Architecture

## C4 summary

Users access `apps/web`, which calls `apps/api` over HTTPS. The API uses direct SQL through `packages/db` and wraps tenant scoped operations in `withTenant`, setting `app.tenant_id` in the same database transaction. Workers consume import, reconciliation and export jobs and reuse the same domain code from `packages/core`.

## Main modules

- Auth and RBAC: access token, rotating refresh token, MFA setup/challenge, Google OIDC start/callback, sessions and audit events.
- Companies and users: CNPJ validation, company profile, role permissions, invites and membership status.
- Imports: idempotent `import_batches` by file hash, preview before confirm and raw record storage.
- Payout Center: expected vs received values, issue severity, audit/dispute/reprocess/lock actions.
- Fees: spreadsheet/API reported fees are the primary evidence; contract/manual rules are fallback; reference seed tables are informational estimates and always preserve review flags.
- Rules Engine: no-code JSONB rules, simulation, activation, versioning and execution logs.
- Agent and help: every screen has `function_id`, functional card and contextual agent entry point.

## Data isolation

Every business table has `tenant_id`. PostgreSQL Row-Level Security uses:

```sql
tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
```

The API never trusts `tenant_id` sent by clients. It resolves membership, picks the active tenant and sets the tenant setting inside the transaction.
