# Vexera

> Multi-tenant SaaS for invoice management, accounting, and ledger management — built for the Slovak/EU market.

---

## What is Vexera?

Vexera is a web application that helps Slovak businesses manage:

- **Invoices** — issue, receive, track, and close invoices
- **Documents** — upload and archive receipts, contracts, statements
- **Ledger** — double-entry accounting with the Slovak chart of accounts
- **Team access** — invite accountants and team members per organization

It is **multi-tenant**: one user can belong to multiple organizations and switch between them freely.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| State | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| File storage | AWS S3 (presigned URLs) |
| Monorepo | pnpm workspaces + Turborepo |
| Toasts | Sonner |
| Icons | Lucide React |

---

## Monorepo Structure

```
vexera/
├── apps/
│   └── web/                  # Next.js application (the main product)
│
├── packages/
│   ├── types/                # @vexera/types — shared TypeScript types
│   ├── utils/                # @vexera/utils — shared helpers (VAT, currency)
│   └── config/               # @vexera/config — shared tsconfig files
│
├── supabase/
│   ├── migrations/           # SQL migration files (run in order)
│   ├── functions/            # Supabase Edge Functions (Deno)
│   └── seed.sql              # Seed data (Slovak chart of accounts)
│
├── turbo.json                # Turborepo pipeline
└── pnpm-workspace.yaml       # Workspace definition
```

> **Tip for juniors:** The `packages/` folder contains code shared between multiple apps. If you're only working on the web app, you'll mostly live inside `apps/web/src/`.

---

## Quick Start

### 1. Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm`)
- A [Supabase](https://supabase.com) project (cloud)
- Supabase CLI (see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md))

### 2. Clone and install

```bash
git clone <repo-url>
cd vexera
pnpm install
```

### 3. Set up environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/web/.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

> Find these in your Supabase dashboard → Project Settings → API.

### 4. Apply database migrations

```bash
# Link the CLI to your Supabase project (only once)
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## First-Time User Flow

```
Register → Create organization → Dashboard
```

1. Go to `/register` — create an account
2. You'll be redirected to `/onboarding` — create your first organization (enter company name + ICO)
3. You land on the Dashboard — ready to use

---

## Key Commands

```bash
pnpm dev              # Start all apps in dev mode
pnpm build            # Build everything
pnpm type-check       # TypeScript check (no JS output)
pnpm lint             # Run ESLint

# Run only for the web app
cd apps/web
pnpm dev
pnpm type-check
```

---

## Documentation

| Document | What it covers |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, multi-tenancy |
| [Database](docs/DATABASE.md) | Schema, all tables, RLS (Row Level Security) |
| [Development](docs/DEVELOPMENT.md) | Local setup, adding features, code patterns |
| [Auth Flow](docs/AUTH_FLOW.md) | How login/register/sessions work |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | API routes only | Full DB access — never expose to browser |
| `AWS_REGION` | File uploads | S3 region (e.g. `eu-central-1`) |
| `AWS_ACCESS_KEY_ID` | File uploads | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | File uploads | AWS credentials |
| `AWS_S3_BUCKET_NAME` | File uploads | S3 bucket name |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL (default: `http://localhost:3000`) |

> Variables starting with `NEXT_PUBLIC_` are visible in the browser. Never put secrets in them.

---

## Project Status

Phase 0 (Scaffold) — complete:
- Authentication (login/register)
- Organization management + multi-tenant switching
- Database schema (16 migrations)
- Row Level Security policies
- File storage infrastructure (S3)
- Settings and member management scaffolds

Next phases will build invoice creation, document upload, and ledger entry flows.
