# Sprint 7: Smart Automation — Design

**Goal:** Enhance VEXERA's automation capabilities by improving existing infrastructure (rule engine, OCR, auto-categorization, chat) and adding recurring pattern detection for bank transactions.

**Approach:** Feature-by-feature vertical slices, ordered by dependency complexity.

---

## Feature 1: Rule Engine Improvements

**Current state:** IF-THEN rules with single conditions, priority-based execution, full CRUD UI (85% complete).

### Changes

1. **OR logic** — Add `logic_operator` field (`"AND" | "OR"`) to rule conditions. Currently conditions are implicitly AND. The evaluation function checks all conditions; with OR, it short-circuits on first match.

2. **Dropdown values** — For conditions like `category = X`, show a dropdown of existing categories/accounts instead of free text input. Fetch options from `chart_of_accounts` and existing distinct values.

3. **Test/dry-run mode** — New "Test Rule" button on the rule edit form. Calls a server action that runs the rule's conditions against existing transactions (limit 100) without applying actions. Returns matched transactions displayed in a preview table: description, amount, date, and what action would apply.

### Schema changes

Add `logic_operator TEXT DEFAULT 'AND'` to the rules conditions structure (migration).

---

## Feature 2: OCR Structured Extraction UI

**Current state:** OCR uploads document, runs Google Cloud Vision, parses Slovak invoice fields via regex, stores raw JSON. UI shows raw extracted data (90% backend complete).

### Changes

1. **Structured extraction view** — Replace raw JSON display with a form showing extracted fields in labeled inputs: supplier name, ICO, DIC, IC DPH, invoice number, issue date, due date, total amount, VAT amount, line items. Each field is editable.

2. **Confidence indicators** — Show field-level confidence (green/yellow/red) based on extraction reliability. Fields the regex matched cleanly = green, partial matches = yellow, missing = red (empty, user fills manually).

3. **Quick accept flow** — "Accept & Create Invoice" button creates a received invoice directly from the extraction view. Maps extracted fields to invoice creation payload, creates invoice + items in one action.

4. **Edit in full form flow** — "Edit in Full Form" button navigates to the invoice creation form with all extracted fields pre-filled via sessionStorage.

### Schema changes

None — extraction data already stored in documents table.

### Implementation

- New component `OcrExtractionReview` — editable form with confidence indicators
- Server action `createInvoiceFromOcrAction` — handles quick-accept path
- Both flows (accept / edit in full form) available from the extraction view

---

## Feature 3: Auto-Categorization Suggestions

**Current state:** Multi-factor ML scoring (supplier history, amount patterns, text matching, temporal factors) exists in backend. Correction recording exists. No UI feedback loop (70% complete).

### Changes

1. **Suggestion display** — When viewing an uncategorized transaction or creating a new ledger entry, show top 3 category suggestions with confidence scores. Rendered as clickable chips: "Office Supplies (87%)", "Software (62%)", "Travel (41%)".

2. **Accept/reject flow** — Clicking a suggestion applies it. A small "x" dismisses it. Both actions feed back to the ML scoring via the existing correction recording API, improving future suggestions.

3. **Integration points:**
   - Bank transaction detail view — show suggestions for unmatched transactions
   - Ledger entry form — show suggestions below the category dropdown
   - Bulk categorization — on the transactions list, uncategorized rows show the top suggestion inline with a one-click accept button

### Schema changes

None — existing `categorization_corrections` table handles feedback.

### Implementation

- New `CategorySuggestions` client component — takes transaction context (amount, description, supplier), calls server action wrapping existing scoring service, renders suggestion chips
- Reused across all three integration points

---

## Feature 4: Recurring Pattern Detection

**Current state:** Bank transactions with basic CRUD and matching. No pattern detection logic (65% complete).

### Changes

1. **Detection algorithm** — Server-side function that analyzes bank transactions to find patterns:
   - Groups transactions by counterparty (name/IBAN)
   - Within each group, checks for regular intervals (weekly/monthly/quarterly) with tolerance (+/- 3 days)
   - Checks for consistent amounts (exact match or within 5% variance)
   - Minimum 3 occurrences to qualify as a pattern
   - Returns detected patterns with: counterparty, amount (avg), frequency, confidence score, last occurrence, matched transaction IDs

2. **Notification badge** — Badge on the Bank Transactions page nav item and a section header: "3 recurring patterns detected". Links to a patterns review panel.

3. **Patterns review list** — Shows each detected pattern as a card: counterparty name, average amount, detected frequency, number of matches, last occurrence date. Each card has:
   - "Create Recurring Template" button — pre-fills recurring invoice template form
   - "Dismiss" button — ignores the pattern permanently

4. **Dismiss persistence** — Store dismissed patterns in a `dismissed_recurring_patterns JSONB DEFAULT '[]'` column on organizations, keyed by counterparty+amount hash.

### Schema changes

New migration: add `dismissed_recurring_patterns JSONB DEFAULT '[]'` to `organizations` table.

---

## Feature 5: Chat/AI Assistant UI

**Current state:** Claude integration with org context building, session management (`chat_sessions` + `chat_messages` tables), system prompt construction with org data. No UI (80% backend complete).

### Changes

1. **Chat page** — New page at `/chat` with full-height layout: scrollable message list + input bar at bottom. Messages rendered as bubbles (user right, assistant left) with markdown rendering.

2. **Context injection** — Each message sent to Claude includes automatic context:
   - Organization summary (name, active invoices count, outstanding AR/AP totals)
   - If user navigated from a specific page, include that entity's data
   - Recent transactions summary
   - Uses existing `buildOrgContext()` from the chat service

3. **Session management** — Sidebar panel showing past chat sessions. "New chat" button creates fresh session. Sessions auto-titled based on first message (via Claude summary).

4. **Suggested prompts** — Empty state shows clickable starter prompts: "What's my outstanding receivables?", "Summarize this month's expenses", "Which invoices are overdue?", "Show my top customers by revenue".

5. **Streaming** — Use Claude's streaming API for real-time response rendering. Show typing indicator while waiting.

### Schema changes

None — `chat_sessions` and `chat_messages` tables already exist.

### Implementation

- New route `app/(dashboard)/chat/page.tsx` (server component wrapper)
- `ChatInterface` client component — handles messages, input, streaming
- Server actions for session CRUD and message sending
- Sidebar nav link addition

---

## Implementation Order

1. Rule engine improvements (independent, well-scoped)
2. OCR structured extraction UI (independent, backend ready)
3. Auto-categorization suggestions (depends on existing ML scoring)
4. Recurring pattern detection (new algorithm + UI)
5. Chat/AI assistant (most complex, benefits from other features being done)

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Features in scope | All 5 |
| Chat integration level | Context-aware (B) — no autonomous actions |
| OCR post-extraction flow | Both: quick accept + edit in full form (C) |
| Pattern detection surfacing | Passive notification badge (A) |
| Rule engine dry-run detail | Match preview with transaction list (B) |
| Architecture approach | Feature-by-feature vertical slices (1) |
