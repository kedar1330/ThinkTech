# StyleMe — Software Requirements Specification (SRS)

> Part of the StyleMe documentation baseline. Functional requirements: [FRD.md](FRD.md). Release scope: [MVP.md](MVP.md). Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Introduction

### 1.1 Purpose
This document defines StyleMe's system context, design principles, non-functional requirements, constraints and external interfaces. Functional requirements are in [FRD.md](FRD.md) and are not repeated here.

### 1.2 Scope
StyleMe is a web application (Next.js web app, Express API, MongoDB Atlas) for personal styling with a shortlist and budget totals on prices the user enters, later extended with verified real products. Stage 1 is the first real release; there is no demo release.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Look | A complete outfit suggestion made of slots (top, bottom, footwear, accessory …) |
| Look specification | The attributes a slot calls for: category, colour, fabric, fit, silhouette, etc. |
| Style knowledge base | Founder-reviewed palettes, styling/fit rules, fabric rules and outfit templates, stored as versioned files |
| Self-reported signal | An appearance value the user entered (skin-tone range, undertone, proportions); no confidence |
| Estimate | A model's value with confidence (deferred photo analysis only) |
| Verified real product | A real listing recorded from a permitted source, with provenance evidence ([DATABASE.md](DATABASE.md) §4.5) |
| Fixture | Synthetic test data, `isFixture: true`, never in production |
| Product layer | Products, matching, verified-price budgets and quality evidence; Stage 3, gated by retailer access |
| User-entered item | An item and price the user records in their shortlist; never verified by StyleMe (D-77 = B) |
| Freshness | Fresh, stale or expired, derived from the verification time and source method (D-50) |
| Search phrase | Generic text describing a slot's look specification, with no link, price or availability |

---

## 2. Overall Description

### 2.1 System context

```
User (browser) ──HTTPS──► Next.js web (Vercel, planned) ──server-side──► Express API (Render, planned) ──► MongoDB Atlas (planned)
                                                                   │
                                     account deletion, restore ───┤──► Tombstone store (separate; D-85)
                                     public launch (HC-2) ────────┤──► Transactional email provider (D-84)
                                     optional, time-limited ──────┤──► AI provider (wording only; off by default)
                                     Stage 2, optional ───────────┤──► Weather provider (D-60)
                                     scripts, product layer ──────┘──► Authorised retailer source (none approved)
```

Platforms marked "planned" are not configured: no hosting account, plan or credential exists until the hosting checkpoint HC-1 (D-81). Until then everything runs locally and in CI.

### 2.2 Components

| Component | Role |
|---|---|
| `apps/web` | UI, first-party session cookie and Google OAuth round trip, server-side API calls |
| `apps/api` | REST API, business logic, persistence, integrations, scripts |
| `packages/contracts` | Shared Zod schemas and types |
| `apps/api/src/style-rules` | The style knowledge base |
| MongoDB Atlas | One database per environment (D-78) |

### 2.3 Design principles

1. The core is deterministic. No core feature depends on an external AI service, retailer or weather provider.
2. Never present unverified information as verified. Label every piece of data with its class (FR-DATA-01).
3. When an optional enhancement fails, the core result is returned without it, with a machine-readable warning (e.g. `AI_ENHANCEMENT_SKIPPED`) and a log entry; the user's request does not fail.
4. Collect the minimum personal data; let users delete it.
5. Keep infrastructure simple; add components only for a concrete need.

---

## 3. Functional Requirements

See [FRD.md](FRD.md). Stage assignments are in FRD §2.

---

## 4. Non-Functional Requirements

### 4.1 Reliability and correctness

| ID | Requirement |
|---|---|
| NFR-REL-01 | Look generation, ranking, explanations, size notes, budgets, eligibility and quality verdicts are deterministic code. |
| NFR-REL-02 | Budget calculation is pure code. AI cannot set, invent or change prices. |
| NFR-REL-03 | All AI output is parsed, Zod-validated and business-validated before use. For the optional wording step, invalid output is discarded and the template text is used. AI-required deferred features return a clear error. |
| NFR-REL-04 | An optional enhancement failing never blocks the core result. A core failure returns a clear error, never a fake answer. |
| NFR-REL-05 | No product, price, availability, rating, review, quality claim, retailer approval or purchase link is ever fabricated or shown from test data. Missing values are `null` and shown as "Not available". |
| NFR-REL-06 | Every displayed verified price carries its verification time, and expired prices are never used in recommendations (product layer). User-entered prices carry no verification time; they carry the "entered by you — not verified by StyleMe" label instead. |
| NFR-REL-07 | Suitability for the user and evidenced quality always outrank any commercial consideration: ranking and quality are independent of affiliate status, which is never an input. Commission data is not stored. |
| NFR-REL-08 | Fixtures never exist in production. The production API refuses to start if any document has `isFixture: true`; ingestion rejects fixtures; seed scripts refuse to run in production. |
| NFR-REL-09 | Styling rules are soft and never forbid. Only `approved` records are loaded, and the linter must pass before release. |
| NFR-REL-10 | Explanations reflect only the rules and attributes actually used (FR-LOOK-12). |
| NFR-REL-11 | Totals are never presented as checkout prices, are labelled with their price basis, and never combine user-entered and verified prices. User-entered items, prices and totals are labelled "not verified by StyleMe". |
| NFR-REL-12 | No confidence is invented. Self-reported values carry none; confirmation never changes a model's confidence. |
| NFR-REL-13 | No accuracy, relevance or performance figure is claimed without an actual test result. Thresholds are "proposed" until measured. |
| NFR-REL-14 | Exact body measurements are never claimed without calibration. |

### 4.2 Availability and graceful degradation

| ID | Requirement |
|---|---|
| NFR-AVL-01 | Stage 1 works fully with no AI provider configured. |
| NFR-AVL-02 | AI provider quota exhaustion, timeouts and errors are handled: the wording step falls back to templates; AI-required deferred features return `AI_UNAVAILABLE`. |
| NFR-AVL-03 | `GET /health` is available without authentication for platform health checks and uptime monitoring. |
| NFR-AVL-04 | A retailer outage or sync failure never breaks the app; stored data ages to stale and expired, and an alert is raised (product layer). |
| NFR-AVL-05 | Weather unavailability never blocks recommendations; manual entry or continuing without weather is offered (Stage 2). |
| NFR-AVL-06 | No published uptime commitment until availability has been measured on the production plan (D-68). |

### 4.3 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | Proposed target, to be measured on the production plan: p95 under 2 s for `POST /v1/recommendations` without AI (D-68). |
| NFR-PERF-02 | The optional AI wording step has a short timeout; on timeout the template text is returned. |
| NFR-PERF-03 | The style knowledge base is loaded, validated and indexed once at startup, not per request. Generation latency is measured with a 150-palette, 150-template library (T-38). |
| NFR-PERF-04 | No retailer is called during a user request; product data is stored and timestamped (product layer). |
| NFR-PERF-05 | Retailer sync respects documented rate limits (e.g. Flipkart: 20 calls/second) and never stores expiring signed feed URLs. |
| NFR-PERF-06 | AI wording is cached in `aiCache` (D-13). Weather is cached per city or rounded location for about an hour (Stage 2). |
| NFR-PERF-07 | Only explanation references are sent to the AI step, never the knowledge base or catalogue. |

### 4.4 Security and privacy

Summary only; full detail in [SECURITY.md](SECURITY.md).

| ID | Requirement |
|---|---|
| NFR-SEC-01 | HTTPS for web and API in staging and production. |
| NFR-SEC-02 | argon2id password hashing; generic responses for login, registration and reset requests. |
| NFR-SEC-20 | Sessions are revocable server-side: every API request checks the session record, `tokenVersion` and `isActive`; logout deletes the session record; password change and reset revoke all sessions (D-07, D-83). The session cookie is `HttpOnly`, `Secure` in staging and production, `SameSite=Lax` and host-only; state-changing requests check `Origin` ([SECURITY.md](SECURITY.md) §1). |
| NFR-SEC-21 | Reset tokens never reach logs, analytics, `Referer` headers or third parties: URL fragment only, removed on load, `Referrer-Policy: no-referrer`, no third-party resources on the reset page ([SECURITY.md](SECURITY.md) §1.1). |
| NFR-SEC-03 | Authorization on every protected route; all user data isolated to its owner. |
| NFR-SEC-04 | Zod validation of every request and every AI output. |
| NFR-SEC-05 | Secrets are server-side, per environment, never in Git, images or logs; no `NEXT_PUBLIC_` secrets. |
| NFR-SEC-06 | Rate limits on authentication, verification and reset codes, account changes, account deletion, recommendations, feedback and shortlist writes (D-38); login lockout after 3 wrong passwords and code lockout after 3 wrong codes (D-89, D-90). |
| NFR-SEC-07 | CORS restricted to each environment's web origin; Helmet headers. |
| NFR-SEC-08 | Error responses never expose internals. |
| NFR-SEC-09 | Separate databases and least-privilege credentials per environment (D-78). |
| NFR-SEC-10 | Personal photographs, measurements and unnecessary personal information are never sent to external AI providers, unless a future explicit founder decision, a privacy review and user consent authorise the specific processing (AI rule 16). |
| NFR-SEC-11 | Data minimisation: optional fields are collected only when a released feature uses them (measurements with size charts, location with weather). |
| NFR-SEC-12 | Users can delete individual data items and their whole account; deletion is immediate in the live database (FR-AUTH-09), and account deletions survive a backup restore through tombstone replay (D-85). |
| NFR-SEC-13 | Precise location is never stored (Stage 2). |
| NFR-SEC-14 | Retailer links are restricted to the retailer's domains; retailer content is untrusted and escaped (product layer). |
| NFR-SEC-15 | Retailer data is collected only through permitted methods; no scraping. |
| NFR-SEC-16 | Review evidence contains no reviewer personal data (D-49). |
| NFR-SEC-17 | Logs exclude passwords, tokens, signals, measurements, photos, precise location and full request bodies. |
| NFR-SEC-18 | The server never fetches, previews or follows user-entered URLs. |
| NFR-SEC-19 | Password reset tokens have at least 128 bits of randomness, are stored only as hashes, are single-use and short-lived, are never logged, get generic responses and are rate-limited; a reset or password change revokes all tokens (D-83). |

### 4.5 Scalability

| ID | Requirement |
|---|---|
| NFR-SCL-01 | Styling scales through reusable rules and dynamic generation, not hand-written combinations. Product requirement: at least 100 palettes and at least 100 templates (planning range 100–150), 8–12 categories (D-57); the system supports at least 150 of each without code changes (FR-STY-10). |
| NFR-SCL-02 | The product catalogue starts small and grows only as curation or sync can keep it verified; long-term target 500–1,000 listings. StyleMe never mirrors whole retailer catalogues. |
| NFR-SCL-03 | The API is stateless; no files on the API host's filesystem. |
| NFR-SCL-04 | Redis and BullMQ are added only for a concrete need. |
| NFR-SCL-05 | A modular monorepo; no microservices, Kubernetes, separate Python service or database per module. |
| NFR-SCL-06 | *Specified (D-110).* The shared catalogue (styles, palettes, templates, rules, illustrations) is served from in-memory indexes built from published MongoDB records, so request cost depends on the matching subset, not catalogue size; list endpoints paginate and load progressively (12 – 20 palettes, 3 – 5 recommended styles first). |

### 4.6 Maintainability

| ID | Requirement |
|---|---|
| NFR-MNT-01 | pnpm workspace with `apps/web`, `apps/api` and `packages/contracts`; shared contracts. |
| NFR-MNT-02 | Backend pattern: route → auth → validation → controller → service → model / integration. |
| NFR-MNT-03 | External services only through `apps/api/src/integrations/`. |
| NFR-MNT-04 | TypeScript throughout; typecheck, lint and the style-rule linter pass in CI. |
| NFR-MNT-05 | Endpoints versioned under `/v1`. |
| NFR-MNT-06 | The style knowledge base is versioned in the repository and changed only through reviewed pull requests. *Revised by D-110 / D-120: once the admin panel edits the MongoDB catalogue, every change is validated by the same schemas and linter, versioned, audited, and published only after founder approval.* |
| NFR-MNT-07 | Database changes use versioned, backward-compatible migrations (D-79). |

### 4.7 Usability

| ID | Requirement |
|---|---|
| NFR-USE-01 | The UI works at mobile (375 px) and desktop widths. |
| NFR-USE-02 | Every piece of data shows its class label (user-provided, verified, derived, estimated, unavailable). |
| NFR-USE-03 | Explanations use inclusive, non-judgemental language. |
| NFR-USE-04 | When information is missing or uncertain (size, product, weather), the UI says so and lets the user decide. |
| NFR-USE-05 | Each optional data field explains why it is asked for. |
| NFR-USE-06 | Affiliate relationships are disclosed next to tracked links (D-46). Quality verdicts show confidence, reasons and warnings (product layer). |
| NFR-USE-07 | *Specified (D-109).* Feature pages are responsive on desktop, tablet and mobile (collapsible filters, touch-friendly cards), keep the top navigation visible, use skeletons, per-section Retry and honest empty states, respect reduced motion, give every image meaningful alt text and every swatch a text label, and never communicate suitability by colour alone. |

### 4.8 Deployment and operations

| ID | Requirement |
|---|---|
| NFR-OPS-01 | Separate local, CI, staging and production environments (D-78). |
| NFR-OPS-02 | The API is containerised (multi-stage Docker, repository-root context), listens on `PORT`, binds `0.0.0.0`. |
| NFR-OPS-03 | Planned platforms: web on Vercel, API on Render, data on MongoDB Atlas (D-40). Accounts, plan tiers and costs are decided at HC-1 (D-81); known free-tier constraints are in [DEPLOYMENT.md](DEPLOYMENT.md) §9.1. |
| NFR-OPS-04 | Backups with a tested restore; rollback by redeploying the previous version (D-79). A restore never serves users until deletion tombstones have been replayed and verified; until then the system stays in maintenance mode (D-85). |
| NFR-OPS-05 | Structured logs, `/health`, external uptime monitoring with alerts (D-69). |

### 4.9 Operating cost

| ID | Requirement |
|---|---|
| NFR-COST-01 | Stage 1 needs no paid third-party data or AI API. |
| NFR-COST-02 | AI calls are made only where they measurably improve results, with minimal input, and cached. |
| NFR-COST-03 | Before any paid or limited service (hosting tier, AI, weather, email, retailer) is relied on, its current pricing, limits and data-use terms are checked and recorded. No free commercial access is assumed: as checked on 2026-10-10, Vercel Hobby and Open-Meteo's free API are non-commercial only ([DEPLOYMENT.md](DEPLOYMENT.md) §9.1). |

---

## 5. Constraints

| Constraint | Detail |
|---|---|
| Technology stack | [ARCHITECTURE.md](ARCHITECTURE.md) §2 |
| Retailer data | No retailer access exists. Product features stay disabled until a source is authorised (D-43 … D-45) |
| Legal | Public launch and the product layer need a qualified legal review (D-74). India's DPDP Rules, 2025 phase in; notice and consent obligations (Rule 3 and most others) are reported by secondary sources to start 18 months after publication, around 13–14 May 2027. These dates and whether and how the Rules apply to StyleMe are provisional until the qualified legal review (D-74) confirms them (not legal advice) |
| Weather licence | No provider selected; Open-Meteo's free tier is non-commercial only (D-60) |
| Content | Styling content needs founder review. Founder hours pace Stage 1 (C1) and especially Stage 2 (C2, 100+ palettes and templates) ([ImplementationPlan.md](ImplementationPlan.md) §5.2) |
| Hosting | Accounts, plans and costs are postponed to the hosting checkpoint (D-81); until then development runs locally and in CI |
| Public access | Closed beta until every public-launch blocker in [ImplementationPlan.md](ImplementationPlan.md) §11 is met, including D-74 recorded complete and self-service email reset working (D-63, D-84) |
| Measurements | No calibration; no claimed body measurements |
| Estimates | Early estimates only ([ImplementationPlan.md](ImplementationPlan.md) §5.1) |

---

## 6. External Interfaces

| Interface | Purpose | Stage | Status |
|---|---|---|---|
| MongoDB Atlas (Mongoose) | Persistent data | 1 | Deferred to the hosting checkpoint (D-81); local MongoDB until then |
| GitHub Actions | CI | 1 | Uses the existing repository |
| Vercel, Render | Hosting | 1 | Deferred to the hosting checkpoint (D-81) |
| Gemini API | Optional explanation wording | 1 (optional, off) | Not needed |
| Authorised retailer source (e.g. Flipkart Affiliate API) | Verified products | Product layer | No access approved |
| User-entered links | Outbound links on shortlist items; never fetched by the server | 1 | — |
| Transactional email provider | Self-service password reset emails | Public launch | Not chosen; decided at HC-2 (D-84) |
| Retailer listing pages | Outbound links | Product layer | — |
| Weather provider | Conditions and city search | 2 | Not selected (D-60) |
| Cloudinary, MediaPipe, PDFKit, Groq | Deferred features | D-76 | Not used |
| Hugging Face / Qwen / Leffa | Original try-on design | Future | Not approved (D-48) |

API contract: [API.md](API.md). Data model: [DATABASE.md](DATABASE.md). AI behaviour: [AI.md](AI.md).

---

## 7. Definition of Done

UI + API + validation + database + error handling + authorization + tests + documentation. See [ImplementationPlan.md](ImplementationPlan.md) §11.

---

## 8. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-13, D-17, D-38, D-43 … D-51, D-60, D-68, D-69, D-74, D-57, D-63, D-77, D-78, D-79, D-80, D-81, D-109, D-110, D-120.
