# VEXERA — Claude Code Configuration

> Standalone cloud accounting platform replacing legacy Slovak accounting software (Pohoda, Money S3, KROS). Read `PROJECT.md` for full build status and architecture.

## Project Essentials

- **Repo:** `github.com/david-brezula/VEXERA`
- **Framework:** Next.js (App Router, React 19), TypeScript 5 strict
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Database:** Supabase (PostgreSQL) with RLS on all tables
- **Auth:** Supabase Auth (httpOnly JWT cookies)
- **State:** TanStack Query (React Query)
- **Forms:** React Hook Form + Zod v4
- **File storage:** AWS S3 (presigned URLs)
- **Monorepo:** pnpm workspaces + Turborepo

## Monorepo Structure

```
apps/web/src/
  app/(auth)/             # /login, /register (no sidebar)
  app/(dashboard)/        # All protected pages (sidebar + header)
  app/api/                # API routes (REST endpoints + webhooks)
  features/               # Feature-slice architecture (primary code location)
    auth/                 # Auth logic
    bank/                 # Bank import, reconciliation
    contacts/             # Contact management
    documents/            # Document upload, OCR, duplicate detection, storage
    export/               # Export adapters (Pohoda, Money S3, CSV)
    invoices/             # Invoice CRUD, PDF, recurring, payments
    ledger/               # Double-entry accounting
    notifications/        # Gmail integration, email service
    onboarding/           # 5-step onboarding wizard
    products/             # Product catalog
    reports/              # Dashboard, VAT, cashflow, analytics
    rules/                # IF-THEN rules engine, categorization
    settings/             # Org settings, archive
  shared/                 # Cross-cutting concerns
    components/ui/        # shadcn/ui base components
    components/charts/    # Reusable chart components
    hooks/                # Shared React hooks
    lib/                  # api-utils, query-keys
    services/             # audit, legislative, queue, tags
  lib/                    # Low-level utilities
    crypto.ts             # AES-256-GCM encrypt/decrypt
    env.ts                # Validated env vars (Zod)
    s3/                   # S3 client + key generation
    supabase/             # Supabase client/server/middleware
  providers/              # SupabaseProvider, QueryProvider, OrganizationProvider
packages/types/           # @vexera/types — shared TS types + DB types
packages/utils/           # @vexera/utils — formatEur, VAT math, tax calculations
supabase/migrations/      # SQL migration files
supabase/functions/       # Edge Functions (poll-gmail)
tests/security/           # Tenant isolation tests
docs/                     # Architecture, Database, Development, Auth docs
```

## Build & Test

```bash
# Always run from monorepo root
pnpm dev                    # Start dev server (Turbopack)
pnpm type-check             # TypeScript check (preferred over build during dev)
pnpm lint                   # ESLint across all packages
pnpm --filter @vexera/web <command>  # Run for web app only

# Database
supabase db push            # Apply unapplied migrations
supabase gen types typescript --project-id <ref> > packages/types/src/database.types.ts

# Clean cache
rm -rf apps/web/.next && pnpm dev
```

## Behavioral Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files

## Coding Rules

1. **tenant_id is sacred** — every DB query filtered by `organization_id` from JWT, never from request body. RLS is the last-line defense.
2. **No sync heavy operations** — OCR, email polling, bank import, export = async. Return `202 Accepted` + `job_id`.
3. **Type everything** — all new types go in `packages/types/src/`. Import from `@vexera/types`. No `any`.
4. **Zod on all API inputs** — validate with Zod at the API boundary. See `lib/validations/`.
5. **Audit log every key action** — use `auditLog.record()` for document/bank/export/rule operations.
6. **Pluggable export adapters** — `ExportAdapter` interface. Never inline format logic.
7. **Keep files under 500 lines.**

## Known Quirks

- `packages/types/src/database.types.ts` has placeholder `Relationships: []` — Supabase join queries return `never`. Use explicit return type + `as unknown as T` cast. Real fix: `pnpm db:generate-types`.
- `@hookform/resolvers` v5 + Zod v4 + `useForm<T>` — use `zodResolver(schema) as unknown as Resolver<T>`.
- Zod v4: use `error:` option (not `invalid_type_error`).
- `react-day-picker` v9: use `Chevron` with `orientation` prop (no `IconLeft`/`IconRight`).
- Never use `.select()` on INSERT when SELECT policy requires membership that doesn't exist yet.
- Always run pnpm from monorepo root with `--filter @vexera/web`.

## Security Rules

- NEVER hardcode API keys, secrets, or credentials in source files
- NEVER commit .env files or any file containing secrets
- Always validate user input at system boundaries
- Always sanitize file paths to prevent directory traversal
- Gmail OAuth refresh tokens must be AES-256 encrypted, never plaintext

## RuFlo V3 — Agent Orchestration

### Config

- **Topology**: hierarchical-mesh
- **Max Agents**: 15
- **Memory**: hybrid with HNSW indexing

### Swarm Rules

- ALWAYS use `run_in_background: true` for all agent Task calls
- ALWAYS put ALL agent Task calls in ONE message for parallel execution
- After spawning, STOP — do NOT add more tool calls or check status
- When agent results arrive, review ALL results before proceeding

### CLI Quick Reference

```bash
npx @claude-flow/cli@latest doctor --fix       # Diagnostics
npx @claude-flow/cli@latest swarm init --v3-mode
npx @claude-flow/cli@latest memory search --query "..."
npx @claude-flow/cli@latest daemon start
```

## Support

- RuFlo docs: https://github.com/ruvnet/ruflo
- RuFlo issues: https://github.com/ruvnet/ruflo/issues
