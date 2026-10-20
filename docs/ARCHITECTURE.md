# StyleMe — Architecture

> Part of the StyleMe documentation baseline. Requirements: [FRD.md](FRD.md), [SRS.md](SRS.md). Data: [DATABASE.md](DATABASE.md). API: [API.md](API.md). Environments: [DEPLOYMENT.md](DEPLOYMENT.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Architecture at a Glance

StyleMe is a pnpm monorepo with a Next.js web app, an Express API and a shared contracts package, backed by MongoDB Atlas. The core is deterministic. External services are optional enhancements or gated layers, and none is on the critical path of Stage 1.

```
Browser
  │  HTTPS
  ▼
Next.js (Vercel) ── first-party HttpOnly session cookie (D-06); Google OAuth (PKCE) route handlers
  │  server-side (BFF) call with access token
  ▼
Express API (Render, Docker)
  ├── Auth, profile, appearance signals, looks, saved looks        [Stage 1]
  ├── Look generator and style/palette matching (deterministic) ◄── in-memory index of the
  │      published shared catalogue in MongoDB (D-110); style-rules/ files = review and seed format  [Stage 1]
  ├── Saved items, collections, custom palettes, feedback (one save system, D-116)  [Stage 1, specified]
  ├── Admin API /v1/admin/* — RBAC, validation, audit log (D-120)  [Stage 1, specified]
  ├── Optional AI wording ──► Gemini (off by default; skipped on failure) [Stage 1, optional]
  ├── Shortlist + budget engine on user-entered prices              [Stage 1, D-77 = B]
  ├── Product layer: catalogue, matching, budget, quality ◄── ingestion scripts
  │      ◄── permitted retailer sources (approved API / feed / permitted curation)  [product layer]
  ├── Weather integration ──► provider chosen in Stage 2 (optional, off by default)  [Stage 2]
  ├── Email (SMTP boundary; dev outbox locally) ──► provider chosen at HC-1 (D-84)  [Stage 1, required]
  ├── SMS (dev outbox locally; no provider yet, D-92) · Google ID-token verification (JWKS, D-88)  [Stage 1]
  ├──► Tombstone store (separate, outside the main database's restore scope; API insert-only, D-85)  [Stage 1]
  ▼
MongoDB Atlas (separate database per environment)
```

Hosting platforms are planned (D-40); accounts, plans and costs are decided at the hosting checkpoint HC-1 (D-81). Until then everything runs locally and in CI.

**Feature specifications (D-109 … D-128).** The seven specified features add no new service or infrastructure:
- **Shared catalogue (D-110).** Categories, attribute values, clothing styles, palettes, templates, rules and illustrations are shared MongoDB collections with a draft → published → archived lifecycle. The API loads published records into the same in-memory indexes the generator already uses, and refreshes them after a publish (one API instance today; with several instances a short polling refresh is used — no message bus).
- **Illustrations (D-113).** Shared, non-personal SVG/WebP assets are versioned static files in the web app and referenced by `illustrations` records; object storage only if size requires it (D-107).
- **2D try-on (D-119).** Rendered in the browser from SVG layers; the API only serves catalogue metadata and stores configurations. No jobs, queues or GPUs.
- **Admin panel (D-120).** A route group `(admin)/admin/*` in the existing Next.js app, behind the same BFF and session cookie, calling `/v1/admin/*`. The API enforces roles and permissions on every request and writes `adminAuditLogs`. No separate app, database or direct database access.
- **Hand-offs (D-127).** Features link to each other with stable IDs in URL parameters; each page fetches what it needs from the owning endpoint.
  - *Shop this look* (#43): `/shop?outfitId=<lookId>`, optionally `&slotId=<slotId>` for one part (the `{ outfitId, slotId }` reference, D-82). Used by the Discover results and the saved-look page; built by `shopHref()` in `apps/web/lib/shop/look-shopper.ts`.

---

## 2. Technology Stack

| Layer | Technology | Stage |
|---|---|---|
| Monorepo | pnpm workspaces | 1 |
| Web | Next.js, TypeScript, Tailwind CSS, shadcn/ui, lucide-react icons, `next/font/local` with bundled Playfair Display and Inter (SIL OFL, `apps/web/app/fonts`), Zustand when needed | 1 |
| Auth | First-party session cookie and Google OAuth on the Next.js server; Express API sessions, argon2id, `jose` for Google ID tokens (D-06, D-88) | 1 |
| API | Node.js (Active LTS, D-01), Express, TypeScript | 1 |
| Database | MongoDB Atlas, Mongoose | 1 |
| Validation | Zod (shared in `packages/contracts`) | 1 |
| Testing | Vitest, Supertest, mongodb-memory-server, Testing Library, Playwright (D-02, D-36) | 1 |
| Container, CI, hosting | Docker (API), GitHub Actions, Vercel, Render | 1 |
| AI (optional wording) | Gemini, off by default (D-67) | 1, optional |
| Retailer integrations | Per approved source | Product layer |
| Weather | Provider chosen after terms are verified (D-60) | 2 |
| Transactional email | SMTP via Nodemailer; provider chosen at HC-1 (D-84). Verification, reset, notices | 1 |
| Cloudinary | Only when user or generated images are stored | Deferred |
| MediaPipe | Photo-based analysis | Deferred (D-76) |
| Three.js / React Three Fiber | 3D avatar | Deferred (D-76) |
| PDFKit | Tailor PDF | Deferred (D-76) |
| Groq | Fallback for AI-required deferred features | Deferred (D-76) |
| Hugging Face / Qwen / Leffa | Original try-on design; not approved | Future (D-48) |
| Redis, BullMQ | Only when a concrete need appears (rate-limit sharing across instances, long-running jobs) | When needed |

Nothing in the "Deferred", "Future" or "When needed" rows is installed or configured until its stage starts. Today Playwright, Zustand and any AI SDK are also not installed. Declared versions (Next.js 16.4, React 19.3, Tailwind 4.3, Express 5.3, Mongoose 9.11, Zod 4.6, TypeScript 5.9, Vitest 5, Node 24, pnpm 10.34) are listed in [SPECS.md](SPECS.md) §1.

---

## 3. Repository Structure

```
StyleMe/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (site)/            landing, about, terms, privacy, contact   [Stage 1]
│   │   │   ├── (auth)/            register, login, verify-email/*, forgot-password/*, reset-password, settings/email/confirm
│   │   │   ├── onboarding/        password (Google), style-profile, appearance
│   │   │   ├── (app)/             home, profile, settings, features/[slug] ("Coming soon"), dashboard → home
│   │   │   ├── api/oauth/google/  start, callback (route handlers)
│   │   │   ├── actions/           server actions (auth, account, onboarding, profile, appearance)
│   │   │   ├── outfits/                         [Stage 1, later milestone]
│   │   │   ├── products/                        [product layer]
│   │   │   ├── analyze/, avatar/, design/, chat/, tailor/   [deferred placeholders, D-76]
│   │   │   ├── tryon/                           [future placeholder, D-48]
│   │   │   ├── layout.tsx, page.tsx
│   │   ├── components/ (ui design system, site, auth, app, profile, …)
│   │   ├── lib/ (auth: cookies, session, google, draft; api; actions; brand images; features), public/images (licensed, CREDITS.md)
│   │   ├── next.config.ts
│   │   └── tests/
│   └── api/
│       ├── src/
│       │   ├── config/, routes/, middleware/, validators/, controllers/, services/, models/, utils/
│       │   ├── style-rules/           [Stage 1: palettes, rules, templates (D-66)]
│       │   ├── integrations/
│       │   │   ├── ai/                [optional wording; later AI features]
│       │   │   ├── retailers/         [product layer, one module per approved source]
│       │   │   ├── weather/           [Stage 2]
│       │   │   └── cloudinary/, mediapipe/, pdf/, tryon/   [deferred / future placeholders]
│       │   ├── jobs/                  [only when background jobs are needed]
│       │   ├── app.ts, server.ts
│       ├── src/services/messaging.ts, templates.ts, challenges.ts, google.ts   [email/SMS boundary, codes and links, Google]
│       ├── scripts/ (admin, migrate + migrations/, later ingestion and link checks)
│       ├── tests/ (incl. fixtures/)
│       └── Dockerfile
├── packages/contracts/src/ (auth, profile, profile-completeness, appearance, style-vocabulary, cities, common, envelope, outfit, palette, product, index; chat and design reserved and empty; to add: weather, …)
├── e2e/                               [Playwright]
├── docs/, infra/docker/, .github/workflows/ci.yml
├── docker-compose.yml, render.yaml, .env.example, pnpm-workspace.yaml
```

Placeholder folders for deferred and future modules stay empty until their stage is approved. Email and SMS live behind `src/services/messaging.ts` (SMTP or the local dev outbox) rather than an `integrations/email/` folder. Folders that don't exist yet (`integrations/retailers/`, `integrations/weather/`, `tests/evaluation/`, `e2e/`) are created by the milestone that needs them.

---

## 4. Responsibilities

| Part | Responsibility |
|---|---|
| `apps/web` | UI and design system, forms (server actions with `Origin` checks), navigation, the session and other credential cookies, Google OAuth round trip, server-side calls to the API, labels for data classes (FR-DATA-01) |
| `apps/api` | REST API, authorization, validation, business logic (look generator, budget engine on user-entered prices, later eligibility and quality), persistence, optional AI orchestration, ingestion scripts, rate limiting, logging |
| `packages/contracts` | Zod schemas and TypeScript types shared by web and API; the single definition of request and response shapes |

**Backend pattern:** route → authentication middleware → validation middleware → controller (HTTP only) → service (business logic) → model or integration → response. External services are reached only through `src/integrations/`.

---

## 5. Request and Authentication Flow

```
Register (server action) → POST /v1/auth/register → unverified user + hashed code/link → email
→ pending token kept in an HttpOnly cookie → /verify-email
→ code (six boxes, Verify) or link (#token) → API consumes the challenge → emailVerifiedAt set
→ same browser: session created → cookie set (Remember Me: 30 days, else browser session) → onboarding

Login → POST /v1/auth/login → lockout check → argon2id verify → verified email required
→ session record + JWT (tokenVersion, sid, rm) → cookie → redirect to the next onboarding step

Google → /api/oauth/google/start (state, PKCE, nonce cookie) → Google → /api/oauth/google/callback
→ code exchanged on the server → POST /v1/auth/google (API verifies the ID token) → create / link / log in

Every page render → Next.js server reads the cookie → GET /v1/auth/me (signature, expiry, isActive,
verified email, tokenVersion, session record) → page; 401 → cookie cleared → /login

Logout → POST /v1/auth/logout deletes this session only → cookie cleared
Password change (emailed code) → new hash, tokenVersion++, other sessions deleted → new session for this browser
Reset (link, or code → reset token; admin code for support) → POST /v1/auth/password-reset/confirm
→ consumed atomically → new hash, tokenVersion++, all sessions deleted, lockout cleared → /login
```

---

## 6. Look Generation (Stage 1)

```
POST /v1/recommendations
  → load profile + enabled self-reported signals
  → style-rules (approved only; validated and linted at startup)
  → templates → palettes → rules (precedence) → look specifications
  → diversity (combination signatures) → alternatives (3–5, never padded)
  → explanation from rule references
  → [product layer] eligibility → matching → ranking → look match
  → [optional] AI rewording (time-limited; any failure → template text)
  → store as suggested looks (7-day TTL) → response
```

- Everything before the optional AI step is deterministic and runs without network calls to third parties.
- The knowledge base is indexed in memory at startup by occasion, style, department and category, and is designed for at least 150 palettes and 150 templates without code changes (FR-STY-10, T-38).
- The full catalogue or knowledge base is never sent to an LLM. The optional AI step receives only explanation references.
- Missing data, conflicts and too few matches produce warnings and fewer looks, never errors ([FRD.md](FRD.md) FR-LOOK-09 … 11).

**Shortlist and budget (Stage 1).** `POST /v1/shortlist` validates and stores the user's item; StyleMe never fetches its link. `GET /v1/outfits/:id` loads the look's attached items and runs the budget engine (pure functions) to produce the price summary on read. Nothing here calls a third party.

---

## 7. Product Layer (Stage 3)

```
Permitted sources                              apps/api
Approved API / partner feed ──► integrations/retailers/<source> ──► sync script ─┐
Permitted manual curation ───► curation template ──► import + validation script ─┤
                                                                               ▼
                                                            products, retailers, reviewEvidence
                                                                               │
Request time: look spec → eligibility → matching → ranking (never affiliate) ─┘
              → budget engine (verified prices) → quality verdict → look match → response
```

- Retailer data is stored and timestamped. No retailer is called during a user request.
- A source outage only makes data age (fresh → stale → expired); it never breaks requests.
- Sync scheduling is per provider terms (D-51): an operator-run script first, then a scheduled job if needed.
- Every product passes the validation in [DATABASE.md](DATABASE.md) §4.5. Fixtures are rejected in production.

---

## 8. Environments

Local, CI, staging and production are separate, with separate databases and secrets. Staging and production hosting is set up only after the founder's hosting decision at the hosting checkpoint (D-81); until then development runs locally and in CI. Fixtures are never present in production, and staging never touches production data ([DEPLOYMENT.md](DEPLOYMENT.md) §2, D-78).

---

## 9. Deferred and Future Architecture

| Feature | Architecture when approved | Gate |
|---|---|---|
| Photo-based appearance analysis | Photo upload with consent → quality checks → MediaPipe in the browser or on StyleMe's servers → estimates with confidence → user confirmation. Photos deleted after analysis unless kept by choice | D-76, AI rule 16, privacy review |
| Chatbot | `POST /v1/chat` → minimised context → AI router (Gemini, Groq fallback) → Zod → response; AI failure → clear error | D-76 |
| Design Studio, sketch-to-design, tailor PDF | Zustand design state → `designs`; sketch → AI vision → Zod → user confirmation; PDFKit for PDFs | D-76; D-32 for the generation provider |
| 3D avatar | Three.js / React Three Fiber, GLB model, approximate proportions, never used for sizing | D-76 |
| Photo-based or generative virtual try-on | Not designed. The earlier hosted-provider design is superseded by AI rule 16. The approved 2D illustrative try-on (D-119) needs none of it | D-48 |
| Gemini full-body analysis (approved, D-122 = b) | `src/integrations/ai/` module against mocks behind a disabled flag until the privacy review; consented image only, no identifiers, Zod-validated output, user confirmation | D-122, privacy review |
| Admin MFA | Emailed step-up code or TOTP for sensitive admin actions | D-121 (HC-1) |
| Weather | Server-side provider call, cached about 1 hour, soft ranking only | Stage 2, D-60 |
| My Profile photos (approved, not built) | Face and full-body uploads → EXIF strip → private object storage via `src/integrations/storage/` (provider D-107) with metadata in `userPhotos`; analysis on device where feasible, else on StyleMe's servers; face photos never go to external AI, full-body photos may go to Gemini under D-122 after the privacy review; results in `appearanceAnalyses`, confirmed values in `appearanceProfiles` | D-103, D-107, D-122 |
| Home redesign (approved, not built) | Server components compose Home from existing collections, each section loaded and retried independently; `notifications`, `userActivity` for persistent actions; no `home` collection | D-106 |

---

## 10. Principles

- Keep deterministic logic deterministic; keep AI isolated and optional unless a feature truly requires it.
- Validate all input and all AI output.
- Never present unverified information as verified.
- Keep secrets server-side and environments separate.
- Share contracts between web and API.
- Add infrastructure only for a concrete, approved need.

**Not planned:** microservices, Kubernetes, a separate Python service, a database per module, complex event architecture, a marketplace (cart, checkout, payments), or complex recommendation ML.

---

## 11. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-01, D-02, D-05, D-06, D-19, D-36, D-40, D-48, D-51, D-60, D-66, D-67, D-76, D-77, D-78, D-107, D-110, D-113, D-119 … D-122, D-127.
