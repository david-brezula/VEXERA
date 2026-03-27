# VEXERA — Product Bible

**Version:** 2.0 | March 2026
**Status:** Living document — single source of truth for product decisions

---

# Part 1: Vision & Strategy

## 1.1 Mission

Replace legacy desktop accounting software in Slovakia with a modern, AI-powered cloud platform that makes accounting effortless for businesses and efficient for accountants.

**In one sentence:** VEXERA is the cloud accounting platform that Slovak businesses switch to when they're done fighting with Pohoda.

## 1.2 Market Thesis

The Slovak accounting software market is dominated by desktop-era products built in the 2000s. They work, but they share the same fundamental problems:

| Problem | Impact |
|---------|--------|
| Desktop-only or weak cloud | No mobile access, no real-time collaboration, manual backups |
| Manual data entry | Accountants spend 60-80% of time on data entry, not advisory work |
| No automation | Every document, every bank statement, every categorization is manual |
| Separate tools for everything | Email for communication, Excel for reporting, WhatsApp for document exchange |
| Complex, dated UX | Training new employees takes weeks, not hours |
| Per-license pricing | Expensive to scale, punishes growth |

These are not small inconveniences — they are structural limitations of desktop software that cannot be solved with incremental updates. They require a fundamentally different architecture.

**Our bet:** The first cloud-native, AI-automated accounting platform built specifically for Slovak legislation will capture the market as businesses and accounting firms modernize.

## 1.3 Competitive Landscape

### Legacy players

| Software | Users | Model | Strengths | Weaknesses |
|----------|-------|-------|-----------|------------|
| **Pohoda** | Market leader (20+ years) | Desktop + network licenses | Feature-complete, trusted, legislative updates | Desktop-only, no automation, dated UX, no collaboration |
| **Money S3** | ~20,000 businesses | Desktop + licenses per PC | Payroll module, e-shop integration, inventory | Desktop-only, complex pricing, per-PC licenses |
| **KROS** | Strong in construction | Desktop | Industry-specific (Alfa Plus for construction) | Narrow focus, desktop-only |
| **Omega** | Accounting firms | Desktop | Powerful for professionals | Steep learning curve, no client portal |

### Cloud competitors (limited)

| Software | Market | Strengths | Weaknesses |
|----------|--------|-----------|------------|
| **iDoklad** | SK/CZ invoicing | Simple invoicing, mobile-friendly | Invoicing only — not full accounting |
| **SuperFaktura** | SK/CZ invoicing | Good UX, API | Invoicing only — not full accounting |
| **Billdu** | Global invoicing | Modern, mobile-first | Generic, no Slovak accounting compliance |

### Gap in the market

**No one offers cloud-native, full accounting with AI automation for Slovakia.** The invoicing tools are too simple. The accounting tools are stuck on desktop. VEXERA fills this gap.

## 1.4 Target Segments

### Primary: Slovak businesses (revenue driver)

| Segment | Size | Current pain | VEXERA value |
|---------|------|-------------|-------------|
| **Freelancers (SZCO)** | ~500,000 in SK | Use Excel or nothing, depend entirely on accountant | Self-service invoicing, automatic tax estimates, simple document upload |
| **Small companies (s.r.o.)** | ~200,000 in SK | Forced to buy Pohoda/Money for basic accounting | Full accounting without desktop software, real-time financials |
| **Medium companies** | ~15,000 in SK | Multiple tools stitched together | Single platform: invoicing + documents + bank + ledger + reporting |

### Secondary: Accounting firms (distribution channel + revenue)

| Segment | Size | Current pain | VEXERA value |
|---------|------|-------------|-------------|
| **Small firms (5-50 clients)** | ~3,000 in SK | Overwhelmed by manual document processing | AI automation, client portal, capacity dashboard |
| **Mid firms (50-200 clients)** | ~500 in SK | Can't scale without hiring | Each accountant handles 2x clients |

**Strategy:** Businesses are the primary product and revenue source. Accounting firms get their own dashboard and tools — they bring their clients with them, creating a distribution flywheel.

## 1.5 Pricing Model

**Per-seat pricing with organization tiers.**

| Tier | Target | Price/seat/month | Includes |
|------|--------|-----------------|----------|
| **Starter** | Solo freelancers | 9 EUR | 1 seat, 100 invoices/month, 1 GB storage, basic reports |
| **Business** | Small companies | 19 EUR | Unlimited invoices, 10 GB storage, bank reconciliation, full reports, VAT returns |
| **Professional** | Growing companies | 29 EUR | Everything in Business + API access, custom rules, advanced analytics, priority support |
| **Accounting Firm** | Accountant portal | 39 EUR/accountant | Multi-client dashboard, bulk operations, client onboarding, capacity metrics |

**Additional:**
- Storage overage: 2 EUR/GB/month
- SMS notifications: pay-per-use
- OCR processing: included in all tiers (fair use policy)

**Why per-seat:** Scales naturally with company growth. Simple to understand. Doesn't punish high-volume businesses (unlike per-invoice pricing).

## 1.6 Go-to-Market

### Phase 1: Beta with friendly businesses (Month 1-3)

- 10-20 businesses from personal network
- Free access in exchange for feedback
- Focus on freelancers and small s.r.o. (simplest use case)
- Goal: validate core workflow, find critical bugs

### Phase 2: Public launch for businesses (Month 3-6)

- Launch Starter and Business tiers
- Content marketing: "Prečo sme odišli z Pohody" (Why we left Pohoda) series
- SEO: target "účtovný program online", "fakturačný program", "účtovníctvo v cloude"
- Integration with iDoklad/SuperFaktura for data import (migration path)

### Phase 3: Accounting firm launch (Month 6-9)

- Launch Accounting Firm tier
- Direct outreach to accounting firms
- "Bring your clients" program — firm gets discount when clients join
- Conference presence (Slovak accounting events)

### Phase 4: Growth (Month 9+)

- PSD2/Open Banking for automatic bank sync
- Microsoft 365 integration
- Mobile app
- CZ market expansion (similar legislation)

---

# Part 2: Product Architecture

## 2.1 Current State Assessment

### What's built and working

| Area | Status | Notes |
|------|--------|-------|
| **Auth & multi-tenancy** | Production-ready | Supabase Auth, httpOnly JWT, RLS on all 35 tables |
| **Invoicing** | Production-ready | Full CRUD, PDF, QR codes, recurring, Peppol, partial payments |
| **Document processing** | Production-ready | Upload, OCR (Google Vision), duplicate detection, smart categorization |
| **Bank reconciliation** | Production-ready | CSV/MT940 import, VS matching, recurring pattern detection |
| **Rules engine** | Production-ready | IF-THEN with AND/OR, 10 operators, test mode |
| **Ledger** | Production-ready | Journal entries, chart of accounts, fiscal periods, trial balance |
| **VAT returns** | Production-ready | Quarterly by rate (23/19/5), KV DPH XML export |
| **Tax calculations** | Production-ready | Freelancer tax with 2026 legislation, progressive brackets, insurance |
| **Reporting** | Production-ready | Dashboard, cashflow forecast, category breakdown, P&L by client/project |
| **Team management** | Production-ready | Invitations, roles (owner/admin/member), accountant access |
| **Onboarding** | Production-ready | Role-based wizard (freelancer/company/accounting firm) |
| **AI chat** | Beta | Claude-powered assistant with org context |
| **Email integration** | Beta | Gmail OAuth, auto-poll attachments |
| **Export** | Beta | KV DPH, DP DPH, Peppol UBL, Excel/CSV, PDF reports |
| **Contacts & Products** | Production-ready | Directory, ICO lookup, product catalog |

### What's missing for production

| Gap | Severity | Description |
|-----|----------|-------------|
| **No payroll** | HIGH | Slovak businesses need payroll. Legacy competitors all have it. |
| **No asset depreciation** | HIGH | Fixed asset register with Slovak depreciation methods |
| **No PSD2 bank sync** | HIGH | Manual CSV import is friction. Auto-sync is table stakes for cloud. |
| **No Stripe billing** | CRITICAL | Can't charge customers without payment processing |
| **No monitoring/alerting** | CRITICAL | No error tracking, no performance monitoring, no uptime alerts |
| **No rate limiting** | HIGH | API endpoints unprotected against abuse |
| **No automated testing** | HIGH | Only tenant isolation tests exist. Need E2E for critical flows. |
| **No data backup strategy** | CRITICAL | Supabase handles backups but no verified restore process |
| **No GDPR compliance docs** | HIGH | Privacy policy, data processing agreements, right to delete |
| **No mobile app** | MEDIUM | Responsive web works, but native app improves document upload |
| **No Microsoft 365** | MEDIUM | Only Gmail. Many Slovak businesses use Outlook. |
| **No import from legacy** | HIGH | Need Pohoda/Money import wizard for migration |

## 2.2 Target Architecture

```
                    [CDN / Vercel Edge]
                           |
                    [Next.js App Router]
                    /        |        \
            [Server         [API        [Server
           Components]     Routes]     Actions]
                \           |           /
                 [Supabase PostgreSQL]
                 [RLS + 56 migrations]
                    /       |       \
            [S3 Storage]  [Edge      [External APIs]
            (documents)   Functions]  (Gmail, Google Vision,
                          (OCR,       Stripe, PSD2, eDane)
                           cron)
```

### Key architectural decisions

1. **Supabase over self-hosted Postgres** — managed service, built-in auth, RLS, Edge Functions, real-time. Trade-off: vendor lock-in, but acceptable for speed to market.

2. **Server Actions over REST for mutations** — type-safe, no API boilerplate, progressive enhancement. REST only for external integrations (webhooks, OAuth callbacks, file upload).

3. **Feature-slice architecture** — each feature is self-contained (service, actions, hooks, components). No cross-feature imports except through shared/.

4. **Per-seat multi-tenancy** — single database, RLS isolation. Not per-schema or per-database. Scales to thousands of orgs without operational overhead.

5. **AES-256-GCM for secrets** — OAuth tokens encrypted at rest. Encryption key in environment variable, not in code.

## 2.3 Data Model

35 tables across these domains:

| Domain | Tables | Purpose |
|--------|--------|---------|
| **Identity** | profiles, organizations, organization_members, invitations, accountant_clients, subscriptions | Who, what org, what role |
| **Invoicing** | invoices, invoice_items, invoice_payments, contacts, products, recurring_invoice_templates | Revenue and expenses |
| **Documents** | documents, document_corrections | File storage and OCR |
| **Banking** | bank_accounts, bank_transactions, recurring_patterns | Bank data and reconciliation |
| **Accounting** | chart_of_accounts, journal_entries, ledger_entries, fiscal_periods, organization_ledger_settings | Double-entry ledger |
| **Tax** | vat_returns | VAT compliance |
| **Automation** | rules, rule_applications, job_queue | Rules engine and async jobs |
| **Communication** | email_connections, email_imports, notifications, chat_sessions, chat_messages | Email, notifications, AI |
| **Analytics** | analytics_events, tags, entity_tags, audit_logs | Tracking and tagging |
| **Export** | export_jobs | Async export queue |

## 2.4 Security Model

| Layer | Protection |
|-------|-----------|
| **Network** | HTTPS everywhere, Vercel Edge, Supabase TLS |
| **Auth** | httpOnly JWT cookies, automatic refresh, CSRF nonce on OAuth |
| **Authorization** | RLS on all 35 tables, org membership verified in every API route |
| **Data** | AES-256-GCM encrypted OAuth tokens, S3 presigned URLs (15 min expiry) |
| **Input** | Zod validation on all API inputs, file type/size restrictions |
| **Audit** | Immutable audit_logs table (INSERT only), comprehensive action logging |
| **Headers** | CSP, X-Frame-Options: DENY, nosniff, strict referrer |

---

# Part 3: Production Roadmap

## Phase 1: Production Hardening (Month 1-2)

**Goal:** Make what exists bulletproof. No new features.

| Task | Priority | Effort |
|------|----------|--------|
| Set up error tracking (Sentry) | CRITICAL | 1 day |
| Set up uptime monitoring (Better Uptime / Checkly) | CRITICAL | 1 day |
| Add rate limiting middleware (Upstash Redis) | CRITICAL | 2 days |
| Implement Stripe billing integration | CRITICAL | 5 days |
| Sanitize all error responses (no DB details in client errors) | HIGH | 2 days |
| Add E2E tests for critical flows (register, create invoice, upload doc, bank import) | HIGH | 5 days |
| Set up CI/CD pipeline (GitHub Actions: lint, type-check, test, deploy) | HIGH | 2 days |
| Create data backup verification process | HIGH | 1 day |
| Add request logging and performance metrics | MEDIUM | 2 days |
| Load test core endpoints (invoices, documents, bank import) | MEDIUM | 2 days |
| Security audit: penetration test critical endpoints | HIGH | 3 days |

**Exit criteria:** Zero unhandled errors in 48-hour soak test. All critical flows have E2E tests passing. Stripe billing works end to end.

## Phase 2: Feature Completion (Month 2-4)

**Goal:** Close the gaps that prevent businesses from fully switching from legacy software.

| Task | Priority | Effort |
|------|----------|--------|
| **Data import wizard** — import from Pohoda XML/CSV, Money S3 format | CRITICAL | 10 days |
| **PSD2 / Open Banking** — automatic bank account sync (Tatra, SLSP, CSOB, mBank) | HIGH | 15 days |
| **Asset depreciation module** — fixed asset register, Slovak depreciation methods | HIGH | 10 days |
| **Payroll module (basic)** — employee records, monthly payroll calculation, pay slips | HIGH | 20 days |
| **Microsoft 365 email integration** — same flow as Gmail, Outlook OAuth | MEDIUM | 5 days |
| **Direct eDane filing** — submit VAT returns directly to Slovak Financial Administration | MEDIUM | 10 days |
| **Advanced audit trail** — export audit log as PDF for external auditors | LOW | 3 days |
| **Multi-language** — add Czech language (first step toward CZ expansion) | LOW | 5 days |

**Exit criteria:** A business currently on Pohoda can migrate all their data and run 100% on VEXERA without any workarounds.

## Phase 3: Launch Preparation (Month 4-6)

**Goal:** Ready for paying customers.

| Task | Priority | Effort |
|------|----------|--------|
| GDPR compliance: privacy policy, DPA, data export/delete | CRITICAL | 5 days |
| Terms of service and commercial terms | CRITICAL | 3 days |
| Legal review of tax calculations by certified accountant | CRITICAL | External |
| Onboarding tutorial / product tour | HIGH | 3 days |
| Help center / knowledge base | HIGH | 5 days |
| Landing page and marketing site | HIGH | 5 days |
| Beta program with 10-20 friendly businesses | HIGH | Ongoing |
| App performance optimization (Core Web Vitals) | MEDIUM | 3 days |
| Localization review (Slovak language quality) | MEDIUM | 2 days |
| Customer support workflow (Intercom / Crisp) | MEDIUM | 2 days |

**Exit criteria:** Legal review passed. 10+ beta users running for 30+ days without critical issues. Billing works. Support channel active.

## Phase 4: Post-Launch Growth (Month 6+)

| Feature | Purpose |
|---------|---------|
| Mobile app (React Native) | Better document upload experience, push notifications |
| Accounting firm marketplace | Businesses find accountants, accountants find clients |
| AI-powered bookkeeping | Automatic journal entry suggestions from documents |
| Predictive cashflow | ML-based forecasting beyond pattern detection |
| API for third-party integrations | E-commerce platforms, CRM systems |
| CZ market expansion | Similar legislation, Czech language |
| White-label for accounting firms | Firm's branding on client-facing portal |

---

# Part 4: Compliance & Legal

## 4.1 Slovak Tax Law Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| VAT rates (23%, 19%, 5%, 0%) | Implemented | Updated for 2025 legislation |
| KV DPH (VAT control statement) XML | Implemented | Exportable XML |
| DP DPH (VAT return) XML | Implemented | Exportable XML |
| Income tax calculation (SZCO) | Implemented | 2026 legislation, flat expenses, progressive brackets |
| Corporate tax (15% / 21%) | Implemented | Two-bracket system at 49,790 EUR threshold |
| Social and health insurance | Implemented | Monthly calculation with min/max floors |
| Nezdanitelna cast zakladu dane | Implemented | Full calculation with income-based reduction |
| Double-entry bookkeeping | Implemented | Slovak chart of accounts (ucctovna osnova) |
| Invoice requirements (zakon 222/2004) | Implemented | All mandatory fields, sequential numbering |
| Peppol e-invoicing (EU directive) | Implemented | UBL import and export |
| Audit trail | Implemented | Immutable audit_logs table |
| Data retention | Implemented | Configurable retention policies |

## 4.2 Required before launch

| Item | Status | Action needed |
|------|--------|---------------|
| Review by certified Slovak accountant | NOT DONE | Engage external reviewer |
| GDPR privacy policy | NOT DONE | Draft and legal review |
| Data processing agreement (DPA) template | NOT DONE | For B2B customers |
| Terms of service | NOT DONE | Draft and legal review |
| Data export/deletion (GDPR Art. 17) | PARTIALLY | Archive feature exists, need full deletion |
| Cookie consent | NOT DONE | Only httpOnly session cookies, but need banner |

## 4.3 Data Protection

| Measure | Implementation |
|---------|----------------|
| Data isolation | RLS on all tables, organization-scoped |
| Encryption at rest | Supabase managed encryption + AES-256-GCM for OAuth tokens |
| Encryption in transit | TLS everywhere |
| Access logging | audit_logs table, immutable |
| Data residency | EU (Supabase EU region + AWS eu-central-1) |
| Backup | Supabase daily backups (cloud plan) |
| Right to erasure | Archive service exists, full deletion flow needed |

---

# Appendix A: Key Metrics to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Monthly Active Organizations | 100 by Month 6 | analytics_events |
| Invoice volume / month | 10,000 by Month 6 | invoices table count |
| Document auto-process rate | > 70% | documents where status went auto_processed |
| Bank reconciliation match rate | > 80% | matched / total transactions |
| Time to first invoice | < 10 minutes | onboarding → first invoice timestamp |
| Churn rate | < 5% monthly | Stripe subscription data |
| NPS | > 40 | In-app survey |
| Uptime | > 99.9% | Monitoring service |
| P95 response time | < 500ms | Performance monitoring |

---

# Appendix B: Technology Decisions Log

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|------------------------|-----------|
| Database | Supabase (managed Postgres) | Self-hosted Postgres, PlanetScale | Built-in auth, RLS, Edge Functions, real-time. Speed to market. |
| Framework | Next.js App Router | Remix, SvelteKit | React ecosystem, Vercel deployment, Server Components |
| Styling | Tailwind + shadcn/ui | Material UI, Chakra | Customizable, no runtime overhead, great DX |
| State | TanStack Query | Redux, Zustand | Server state management, caching, optimistic updates |
| File storage | AWS S3 | Supabase Storage, Cloudflare R2 | Presigned URLs, proven at scale, S3-compatible API |
| Email | Resend | SendGrid, Postmark | Developer-friendly, React email templates, good deliverability |
| OCR | Google Vision | AWS Textract, Azure Form Recognizer | Best accuracy for European documents, competitive pricing |
| Monorepo | pnpm + Turborepo | Nx, Lerna | Fast, simple, good Next.js integration |
| PDF | React-PDF | Puppeteer, wkhtmltopdf | Server-side rendering, type-safe, no headless browser needed |

---

*This document is the single source of truth for VEXERA product decisions. All other documents (PROJECT.md, sprint plans, etc.) are subordinate to this one. When in conflict, this document wins.*
