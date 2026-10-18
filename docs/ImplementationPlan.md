# StyleMe — Implementation Plan

> Part of the StyleMe documentation baseline: [BRD](BRD.md) · [MVP](MVP.md) · [FRD](FRD.md) · [SRS](SRS.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [API](API.md) · [AI](AI.md) · [SECURITY](SECURITY.md) · [TESTING](TESTING.md) · [DEPLOYMENT](DEPLOYMENT.md) · [CONTRIBUTING](CONTRIBUTING.md) · product blueprint `StyleMe APP.txt`.
>
> This plan describes how the real product is built, in what order, and what has to be true before each part is released. Section 8 is the **single decision register** for the whole project.

---

## 1. How to Use This Plan

- **There is no demo release.** Every release is a real product used by real people. Nothing invented, illustrative or test-only is ever shown to users as real (FR-DATA-02).
- **Stages** are product releases (§3). **Milestones** (S1.1 … S1.7, S1.B, PL.1 … PL.4, S2.1 … S2.2) are the vertical slices that build them; **checkpoints** are where the founder decides: HC-1 hosting (D-81), HC-2 public-launch preparation (email provider D-84, legal-review reminder D-74).
- Each milestone lists: objective, includes / excludes, prerequisites, work by area, security, tests, Definition of Done and measurable acceptance. Acceptance IDs (AC-xx) are defined in [MVP.md](MVP.md) §5.
- Blockers are marked **release blocker** (the stage can't be released without it) or **feature blocker** (only a later feature waits for it).
- Estimates are early estimates, not measured velocity. Expect an error of ±30–50%, and recalibrate after S1.4. Calendar durations are in §5.1.
- No dates, credentials, approvals or retailer access are assumed. Anything not yet granted is marked Blocked or Pending in §8.
- **Development milestones are not product scope.** Some milestones use small, temporary inputs (for example the C0 development seed in §5.2) to build and test the engine. Release scope is defined only by the stage release gates and [MVP.md](MVP.md) §5.
- **Decisions are raised when they are needed**, not earlier. §4.5 lists each open decision and the point at which the founder is asked. Nothing is assumed approved before then.

**Working rules for every milestone** ([CONTRIBUTING.md](CONTRIBUTING.md)):
1. Issue → `feature/*` branch → contracts first (`packages/contracts`) → implementation → tests → pull request → CI → review → merge.
2. Backend pattern: route → authentication → validation → controller → service → model / integration → response envelope.
3. Every milestone writes the tests for its own features. S1.6 adds cross-cutting hardening; it doesn't replace earlier tests.
4. A feature is complete only with UI, API, validation, database, error handling, authorization, tests and updated docs (§11).

**Repository starting point.** The monorepo folders exist on `main` with placeholder files. Every existing code and configuration file is empty (0 bytes) — including `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`, `docker-compose.yml`, `render.yaml`, `.github/workflows/ci.yml`, `apps/api/Dockerfile`, `README.md` and the `packages/contracts/src/*.ts` files. Folders named in these documents that don't exist yet (for example `apps/api/src/style-rules/`, `apps/api/tests/fixtures/`, `apps/api/scripts/migrations/`, `e2e/`) are created by the milestone that needs them. The documents in `docs/` are the baseline. No application code exists yet.

---

## 2. Product Baseline

**Stage 1 is a personal styling product.** A user creates an account and a profile (sizes per category, fit, colours, styles, occasions and optional self-reported appearance signals), asks for looks for an occasion, and gets complete, explained, deterministic look suggestions with colour palettes, alternatives, size notes and search phrases. Looks can be saved, revisited, rated and deleted. The account and all its data can be deleted.

**Why this is a real product without retailer data.** Its value — "what should I wear for this occasion, in colours and cuts that work for me, and why" — doesn't depend on any retailer. It doesn't need any external service that StyleMe lacks access to, so it can be built and released on its own merits.

**Shortlist and budget on the user's own prices (D-77 = B, approved).** Users can attach items they found elsewhere to look slots, with a name, an optional link, a price they enter and an optional note. The budget engine totals those prices against the user's budget. Every such item, price and total is labelled as entered by the user and not verified by StyleMe. No retailer permission is needed, because StyleMe only stores and adds up the user's own notes.

**What Stage 1 does not have, and why.** Verified real products, retailer-sourced prices, stock, reviews, quality evidence and retailer listings need an authorised data source. StyleMe has none today (§4). They are the product layer (§6), released in Stage 3 once a source is authorised.

**Core does not depend on external AI.** Generation, ranking, explanations, size notes and budgets are code. The optional AI wording step is off by default, and its failure never affects the result (D-67).

---

## 3. Stages

| Stage | Contents | Release blockers | Status |
|---|---|---|---|
| **Stage 1 — Personal Styling** (first real release) | Accounts, profile, self-reported signals, style knowledge base, deterministic looks, palettes, alternatives, size notes, search phrases, saved looks, feedback, account deletion; shortlist of user-found items with budget totals on user-entered prices (D-77 = B) | Stage 1 content set C1 approved (§5.2, D-57, D-62); hosting checkpoint HC-1 (D-81). Public launch additionally: legal review (D-74) and self-service email password reset (HC-2, D-84) — closed beta until then | Planned |
| **Product layer** | Verified real products from an authorised source, matching, verified-price budgets, quality evidence, comparison where permitted | An authorised source (D-43 … D-45); legal review (D-74); disclosures (D-46) | Built on fixtures any time; released in Stage 3 |
| **Stage 2 — Expanded Styling** | The full styling library (content set C2: at least 100 palettes, at least 100 outfit templates, comprehensive rules); optional weather | C2 complete and approved (§5.2); weather only if its provider terms are verified (D-60) | Content requirement approved; weather approved, provider pending |
| **Stage 3 — Authorised Shopping** | Product layer release; more retailers as access is granted | As for the product layer | Blocked on retailer access |
| **Deferred** | 3D avatar, Design Studio, sketch-to-design, chatbot, tailor PDF (photo analysis moved to Stage 1 by D-103) | Stage assignment (D-76) | Pending founder decision |
| **Future** | Photo-based or generative virtual try-on | D-48 | Pending founder decision |
| **Feature specifications (D-109)** | Discover My Style, My Colour Palette (incl. saving and custom palettes), Outfit Categories (shared style catalogue with croquis illustrations), Saved Outfits, Shop My Look (UI and outfit assembly; products need an authorised source), **2D illustrative Virtual Try-On** (D-119) and the **Admin Panel** (D-120) — built into Stage 1 in the order of D-109 | Each feature's acceptance criteria ([MVP.md](MVP.md) §5.6); product data D-43 … D-45; Gemini full-body photo analysis needs the privacy review (D-122, D-74) | Approved (D-117 = a and D-122 = b, 2026-10-18) |

### 3.1 Dependency graph

```
S1.1 Foundation ─► S1.2 Accounts ─► S1.3 Profile & signals ─┐
                                                              ├─► S1.4 Look engine (first vertical slice) ─► S1.5 Look experience
C0 development seed (temporary) ─────────────────────────────┘                                                    │
                                                                                                                   ▼
                                  S1.B Shortlist & budget on user-entered prices (after S1.5) ───► HC-1 Hosting checkpoint (ask founder)
                                                                                                                   │
                                                                                         S1.6 Hardening & evaluation
                                                                                                                   │
                                                          S1.7 Production launch (closed beta) ◄──┘
                                                                │
                                                          HC-2 Public-launch checkpoint (email provider D-84; D-74 complete) ─► public launch

Content programme (founder, in parallel):  C0 development seed (temporary) ─► C1 Stage 1 release set ─► C2 full library (≥ 100 palettes, ≥ 100 templates)

Product layer (any time after S1.4, on fixtures):  PL.1 Data model & ingestion ─► PL.2 Matching & budget ─► PL.3 Quality & UI ─► PL.4 Release (needs authorised source)
Stage 2 (after S1.7):  S2.1 Full content library C2 (release gate)   S2.2 Weather (needs D-60)
```

---

## 4. External Dependencies and Data Sources

### 4.1 Dependency summary

| Dependency | Needed for | Status | Blocks |
|---|---|---|---|
| MongoDB Atlas, Vercel and Render accounts and plans | Staging and production (from HC-1) | **Postponed by the founder.** Not needed for S1.1 … S1.5 or S1.B, which run locally and in CI. At HC-1 the founder is asked, with options and current costs (D-81) | Needed for S1.6 latency and restore checks and S1.7; not a blocker before HC-1 |
| Founder styling content and review | All stages | Not started | C0 seed needed for S1.4 (temporary); C1 release set blocks S1.7; full library C2 blocks the Stage 2 release (§5.2) |
| Qualified legal review (privacy notice, terms, disclosures) | Public launch, product layer | Not arranged (D-74) | Blocks public launch only. Development and the closed beta proceed |
| Style illustration assets with clear licences | Stage 1 (optional) | None selected (D-65) | Not a blocker: swatches are the fallback |
| Gemini API | Optional AI wording | Not needed; off by default | Nothing |
| Authorised retailer data source | Product layer | None (D-43 … D-45) | Release blocker for the product layer only |
| Weather provider | Stage 2 weather | Not chosen (D-60) | Feature blocker for S2.2 only |
| Transactional email provider | Self-service password reset at public launch (FR-AUTH-13) | Not chosen; decided at HC-2 (D-84) | Blocks public launch only; not needed for the closed beta |

### 4.2 Evaluation of product data sources (no access is assumed)

| Source | What is publicly documented | StyleMe access | Notes |
|---|---|---|---|
| Flipkart Affiliate API | An API for approved affiliates with product search and feeds (prices, stock, images, sizes, colours, product URLs carrying the affiliate ID, seller ratings). Documented limit 20 calls/s; feed URLs expire after 10 h | **None approved** | Terms say use must be "solely in conjunction with Flipkart's platform", restrict use on "similar or competitive" platforms, mention derivative works (scope unclear) and restrict use of Flipkart's name and trademarks (e.g. "You shall not use the name or trademarks of Flipkart in Your advertising"). Comparison, caching and AI processing must be confirmed in writing (D-44) |
| Meesho | No public product API found | **None** | Terms not yet retrieved (D-45) |
| Amazon.in | The Product Advertising API is being replaced by the Creators API for Associates | **None** | Eligibility and terms not verified for StyleMe |
| Myntra, Ajio and others | No public product API verified | **None** | Not evaluated |
| Brand or partner feeds | Need a direct agreement | **None** | Possible later route |
| Permitted manual curation | A person records listing facts from a retailer's site | Depends on each retailer's terms | Needs the terms review and legal review (D-74). Scale is limited by curator time (estimate 10–15 min per listing including evidence, unmeasured) |
| User-entered items (Stage 1, D-77 = B) | The user records their own finds and prices | No retailer permission needed for the user's own notes | Always labelled as entered by the user and not verified by StyleMe |
| Scraping or third-party scraping services | — | **Excluded** | Not used under any decision |

### 4.3 What can be built now and what needs approval

| Can be built now | Needs approval before release |
|---|---|
| All of Stage 1 | Public launch: legal review (D-74) |
| Stage 1 shortlist (S1.B) | — (covered by the Stage 1 legal review) |
| Product layer code: models, validation, ingestion scripts, matching, budget engine, quality service, UI — all tested on fixtures behind `PRODUCT_LAYER_ENABLED=false` | Any real product data: an authorised source, its recorded permissions, legal review, disclosures |
| A Flipkart integration module against the documented API shape, tested on mocks | Calls to the real API: approved affiliate access and written confirmation of the D-44 permissions |
| Weather integration interface with a manual-entry fallback | Calls to a provider: D-60 |

A proposed integration is never labelled "available" in the product, the docs or the UI until its retailer's status is `active` in the registry.

### 4.4 Behaviour when a source is rejected, delayed, limited or down

| Situation | Behaviour |
|---|---|
| Retailer rejects access | The retailer stays `disabled` (level D). Stage 1 is unaffected. The product layer waits for another authorised source |
| Approval is delayed | Stage 1 releases with the shortlist on user-entered prices. Product-layer code stays behind its flag, tested on fixtures |
| Rate limits | The sync script throttles below the documented limit and backs off on 429s. A partial sync keeps existing data, which ages normally |
| Source outage | No retailer is called on the user's request path. Data ages fresh → stale → expired; expired products aren't recommended; an alert is raised |
| Terms change or access is revoked | The retailer is set to `disabled`; its products are deactivated; saved looks show "No longer available" |
| No eligible product for a slot | The slot is shown without a product, with its search phrase (FR-MATCH-05). Never a fixture or a poorer match |

### 4.5 Decision checkpoints

Open decisions are raised with the founder only when the work reaches the point below, with the available options (and costs where relevant). Until then nothing is assumed: no accounts, paid plans, credentials, approvals or feature go-aheads.

| Decision | Raised when | What is presented | Until then |
|---|---|---|---|
| D-81 Hosting accounts and plans | HC-1, after S1.5 and S1.B, before anything needs a deployed environment | Options per service (Atlas, Vercel, Render), current plan limits and prices checked at that time, what each choice means for backups, sleep, commercial use and cost | Development runs locally and in CI only; nothing is deployed |
| D-84 Email provider (and SMS provider, D-92) | HC-1 — moved earlier because email verification (D-89) is required before anyone can use the closed beta | Provider options, current prices, terms, data handling, sender-domain setup, and whether link and open tracking can be turned off | Locally, messages go to the git-ignored dev outbox; staging and production refuse to start without SMTP settings. Phone verification reports "not available" |
| Google OAuth client (D-88) | HC-1, with hosting (needs the production web origin) | Google Cloud project, OAuth consent screen and branding, authorised redirect URI | Google buttons show "not available yet"; email sign-up works |
| D-74 Legal review | Before public launch: the implementer reminds the founder when S1.7 is ready, again at HC-2, and at every later release that would widen access | What the review covers (privacy notice, terms, DPDP readiness, disclosures) | Closed beta for invited users only; public sign-up stays disabled (D-63) |
| D-60 Weather provider | Start of S2.2 | Providers whose commercial terms, pricing and data handling have been checked | Weather not built against any provider |
| D-76 Stage of deferred features | When Stage 1 beta evaluation is complete and planning moves beyond Stage 2 | The option set in the D-76 register entry, with Stage 1 findings | None of the deferred features is built or approved |
| D-48 Virtual try-on | Only if photo-based or generative try-on is proposed for planning | The options in the D-48 register entry | Only the 2D illustrative try-on (D-119) is built |
| D-122 Gemini for full-body photos (approved as option b) | Before any full-body photo is sent to Gemini outside mocks, together with the D-74 legal review | The privacy-review scope, Google's current paid-tier terms (no training on content, retention), the consent copy and the accuracy evaluation | Manual and measurement paths only; the integration runs against mocks behind a disabled flag; no photo leaves StyleMe |
| D-121 Admin MFA | HC-1, with the email provider | Emailed step-up code or TOTP | Normal login, short admin sessions, confirmation dialogs |
| D-43 … D-45 Retailer access | When a retailer responds, or before Stage 3 planning | The retailer's actual terms and what they permit | Product layer stays behind its flag |
| D-71 Business KPIs | Before the closed beta ends | Candidate measures and how they'd be collected | Release judged by acceptance criteria only |

---

## 5. Stage 1 — Personal Styling

**Objective:** release a usable personal styling product to real users, honest about what it does and doesn't know.

**Includes:** FR-AUTH, FR-PROF, FR-SIG, FR-STY, FR-LOOK, FR-PAL, FR-OUT, FR-SIZE-01 … 04, FR-DATA, FR-X, FR-LIST, and FR-BUD on user-entered prices (D-77 = B).
**Excludes:** verified products, retailer-sourced prices, stock, reviews and quality evidence (product layer, Stage 3), weather, photo analysis, avatar, Design Studio, sketch, chatbot, tailor PDF, try-on.

### S1.1 — Foundation
- **Objective:** a monorepo that builds and tests an empty API and web app locally and in CI. No hosting accounts are needed.
- **Prerequisites:** the existing GitHub repository; D-01, D-02, D-78.
- **Work:** pnpm workspace; TypeScript configs; ESLint and Prettier; `packages/contracts` skeleton; Express app with the response envelope, error handler, request IDs, Helmet, CORS and `/health`; Next.js app shell with Tailwind and shadcn/ui; config loader with `APP_ENV`; local database setup (a local MongoDB instance, or `mongodb-memory-server` for tests); `.gitignore` (currently empty; must ignore `.env` and build output); Dockerfile, `docker-compose.yml` and `render.yaml` written and built locally but not deployed or connected to any hosting account (D-81); GitHub Actions (install, typecheck, lint, test, build); `.env.example`.
- **Security:** no secrets in the repository; per-environment credentials.
- **Tests:** envelope and error-handler unit tests; `/health` API test; CI runs on every pull request.
- **DoD / acceptance:** CI green; web and API run locally; `/health` passes locally and in CI; the Docker image builds. No deployment.
- **Estimate:** 2–3 developer-days.

### S1.2 — Accounts
- **Objective:** register, verify, log in, log out, recover, manage and delete the account (revised 2026-10-12 by D-87 … D-94).
- **Prerequisites:** S1.1; D-04 … D-07, D-87 … D-94.
- **Work (revision of 2026-10-12, implemented):** first-party session cookie replacing Auth.js (D-06); registration with city, optional phone and recorded consent (D-87); email verification by code and link with resend limits and lockouts in one `authChallenges` collection (D-89); Google sign-up and login with server-side ID-token verification and safe linking (D-88); login lockout (D-90); Remember Me (D-91); self-service reset by link or code; password change by emailed code and email change with re-authentication (D-93); optional phone with SMS verification behind a provider boundary (D-92); deletion by emailed code and confirmation (D-94); server-authoritative onboarding (`GET /v1/onboarding`); SMTP email boundary with a local dev outbox; migration `001-auth-onboarding`. **Original work:** `users` model; argon2id; JWT with `tokenVersion`; auth middleware; BFF calls; login and register pages; protected layout; `DELETE /v1/account` with password re-entry and cascading deletion; closed-beta registration (invite allow-list, `PUBLIC_SIGNUP_ENABLED=false`, FR-AUTH-10) with generic refusal messages; `sessions` model, session check in the auth middleware and `POST /v1/auth/logout` (D-07); Auth.js cookie settings (`HttpOnly`, `Secure` outside local, `SameSite=Lax`, host-only) and `Origin` checks on state-changing Next.js requests; password change (FR-AUTH-11); `passwordResetTokens` model, reset-confirm endpoint, reset page (`(auth)/reset-password`, token read from the URL fragment, `Referrer-Policy: no-referrer`, no third-party resources) and the admin reset-code script (FR-AUTH-12); the self-service request endpoint built behind `PASSWORD_RESET_EMAIL_ENABLED=false` with a mocked email sender (FR-AUTH-13); deletion tombstone written before account data is deleted, to a separate tombstone store (locally a separate database, D-85), and the reconciliation script that completes a deletion that failed partway; rate limits.
- **Security:** generic login errors; token never in browser JavaScript; rate limits per D-38.
- **Tests:** T-01 … T-06, T-36 (auth part), T-37, T-39 … T-42, T-44, T-46 … T-49 (T-47 and T-48 at configuration level here; their browser-level checks run with the Playwright suite in S1.6).
- **DoD / acceptance:** AC-01, AC-02, AC-21, AC-23, AC-25 (AC-24 is verified at HC-2).
- **Estimate:** included in the 5–7 days for S1.2 + S1.3.

### S1.3 — Profile and self-reported signals
- **Objective:** a profile the generator can use, with optional signals the user controls.
- **Prerequisites:** S1.2; D-09, D-54, D-72.
- **Work:** `profiles` and `appearanceProfiles` models; `GET/PUT /v1/profile`; `GET/PUT /v1/appearance`; dashboard; profile form with per-field explanations; category sizes and fit; signals section with "Use in recommendations" toggle and clear buttons.
- **Security:** data isolation; signals excluded from logs and from any outbound call.
- **Tests:** T-07 … T-11.
- **DoD / acceptance:** AC-03, AC-04.
- **Estimate:** 5–7 developer-days for S1.2 + S1.3 together.

### S1.4 — Look engine (first end-to-end vertical slice)
- **Objective:** a user requests looks for an occasion and sees real, rule-based looks in the UI.
- **Prerequisites:** S1.3; the **C0 development seed** (§5.2): at least 6 approved palettes, 6 templates and the rules they reference. C0 is a temporary development input to build and test the engine. It is **not** a release target or product scope.
- **Work:** knowledge-base Zod schemas, loader and linter (CI and startup), including a stable `slotId` on every template slot, unique within the template (FR-STY-12); generator (templates → palettes → rules → look specs) with precedence, defaults, conflicts, insufficient matches and diversity; `POST /v1/recommendations`; `outfits` model with 7-day TTL; results page with slots, swatches and explanation.
- **AI:** none.
- **Tests:** generator, palette, rule and linter unit tests; T-12 … T-19, T-24, T-28; T-38 (scale test on a synthetic 150-palette, 150-template fixture library).
- **DoD / acceptance:** AC-05 … AC-08 on the C0 seed (re-verified on content set C1 in S1.6, which is what counts for release); AC-22 (scale) on the synthetic library.
- **Estimate:** knowledge-base tooling 1.5–2.5 days; generator 4–6 days. **Recalibrate all remaining estimates after this milestone.**

### S1.5 — Look experience
- **Objective:** everything a user needs to understand, explore, adjust and keep looks.
- **Prerequisites:** S1.4.
- **Work:** explanation builder with references and the inclusive-language check; alternatives (3–5, never padded); palette view (`GET /v1/style/palettes`, suggested and all); size notes; search phrases with copy; style illustrations where licensed (D-65), else labelled swatches; save, list, open, delete and feedback endpoints and UI; regenerate after changing preferences; optional AI wording module behind `AI_WORDING_ENABLED=false`, with validation and fallback.
- **AI:** optional wording only; input restricted to references (AI rule 16).
- **Tests:** T-20 … T-23, T-25 … T-27, T-31 … T-34.
- **DoD / acceptance:** AC-11 … AC-14. The explanation checks behind AC-09 (T-21, T-22) are built here; AC-09 itself is measured on the evaluation set in S1.6.
- **Estimate:** explanations, size notes and search phrases 1.5–2.5 days; saved looks and feedback 1–2 days; web UI across S1.2 … S1.5 4–6 days.

### S1.B — Shortlist and budget on user-entered prices (D-77 = B)
- **Objective:** users can attach items they found elsewhere to look slots and see a total based on their own prices, clearly labelled as not verified by StyleMe.
- **Prerequisites:** S1.5 (saved looks).
- **Work:** `shortlistItems` model referencing `{outfitId, slotId}`; `/v1/shortlist` endpoints; budget engine (pure functions) on user-entered prices, including partial pricing; per-look price summary on `GET /v1/outfits/:id`; budget field in the profile; shortlist UI on saved looks with the labels in [FRD.md](FRD.md) FR-LIST-02.
- **Security:** https-only links, never fetched; `rel="noopener noreferrer nofollow"`.
- **Tests:** B-01 … B-10; budget engine unit tests.
- **DoD / acceptance:** AC-B1 … AC-B4.
- **Estimate:** 2–4 developer-days.

### HC-1 — Hosting checkpoint (founder decision D-81)
- **Objective:** get the founder's decision on hosting before anything is deployed.
- **When:** after S1.5 and S1.B, because S1.6 needs a staging environment (latency on the chosen plan) and S1.7 needs production plus a restore test into staging.
- **What happens:** the implementer stops and presents, for MongoDB Atlas, Vercel and Render: the plan options, their current limits and prices (checked at that time, NFR-COST-03), and what each choice means for StyleMe — for example backups (D-79), idle sleep, commercial-use terms and staging cost, and where the deletion tombstone store will live outside the main database's restore scope (D-85) ([DEPLOYMENT.md](DEPLOYMENT.md) §9). The founder chooses; the founder creates or authorises the accounts and supplies credentials.
- **Nothing is assumed** before this point: no accounts, paid plans or credentials.
- **DoD:** D-81 recorded; staging environment created per the founder's choice.

### S1.6 — Hardening and evaluation
- **Objective:** prove the product is correct, safe and good enough to release.
- **Prerequisites:** S1.5, S1.B and HC-1; the Stage 1 release content set **C1** approved (§5.2).
- **Work:** fixture safeguards (startup check, script guards); security checklist items; privacy notice and per-field notices in the UI; evaluation set of 25–30 synthetic profiles and its harness; founder relevance review; Playwright smoke flow at both viewports; latency measurement (AC-18) on the plan chosen for production — in staging if staging runs on the same plan, otherwise on the production service in S1.7 before any beta user is invited.
- **Tests:** T-29, T-30, T-35, T-36; evaluation set ([TESTING.md](TESTING.md) §6) on content set C1; coverage report; E2E (§7).
- **DoD / acceptance:** AC-09, AC-10, AC-15 … AC-18.
- **Estimate:** security and privacy 1.5–2.5 days; tests and evaluation harness 3–4 days.

### S1.7 — Production launch
- **Objective:** a monitored, recoverable production service, released as a **closed beta** for invited users.
- **Prerequisites:** S1.6; production environment per D-81.
- **Public launch gate:** the service stays a closed beta (`PUBLIC_SIGNUP_ENABLED=false`, invite allow-list) until D-74 is recorded as complete. When S1.7 is ready, the implementer **reminds the founder to arrange and complete the legal review**. Public sign-up is never enabled while D-74 is open, nor before self-service email password reset works (HC-2, AC-24).
- **Work:** production secrets; production database with no fixtures; tombstone store (D-85); maintenance mode; migrations runner; backups per D-79 and a restore test into staging that includes deletion replay and verification ([DEPLOYMENT.md](DEPLOYMENT.md) §6); uptime monitoring; rollback rehearsal in staging; release checklist ([DEPLOYMENT.md](DEPLOYMENT.md) §8).
- **Tests:** T-43, T-45 (restore replay and maintenance mode, in staging).
- **DoD / acceptance:** AC-19, AC-18 if not already measured in S1.6, and every Stage 1 closed-beta acceptance criterion in [MVP.md](MVP.md) §5.1 and §5.2 (AC-20 and AC-24 are public-launch criteria, checked at HC-2).
- **Estimate:** 2–3.5 developer-days (the "Deployment and operations" row in §5.1).

### HC-2 — Public-launch checkpoint (founder decision D-84; D-74)
- **When:** once the closed beta is running and the founder wants to prepare public launch. Not before.
- **What happens:** the implementer reminds the founder about the legal review (D-74) and confirms the email provider chosen at HC-1 (D-84) is ready for public volumes. D-86 is already decided (verification required, D-89).
- **Work after the decision:** confirm reset, verification and notice emails work in production with link and open tracking off; verify AC-24.
- **Public launch** (`PUBLIC_SIGNUP_ENABLED=true`) only when every public-launch blocker in §11 is met.
- **Estimate:** 1–2 developer-days after the provider is chosen (not included in the closed-beta total).

### 5.1 Stage 1 estimate

| Work | Developer-days (estimate) |
|---|---|
| S1.1 Foundation and CI | 2–3 |
| S1.2 + S1.3 Accounts (including closed-beta invites, revocable sessions and logout, password change and admin-assisted recovery), profile, signals | 5–7 |
| Knowledge-base tooling | 1.5–2.5 |
| Generator | 4–6 |
| Explanations, size notes, search phrases, palettes | 1.5–2.5 |
| Saved looks and feedback | 1–2 |
| Web UI | 4–6 |
| Security and privacy | 1.5–2.5 |
| Tests and evaluation harness | 3–4 |
| Deployment and operations (including tombstone store, restore replay and maintenance mode) | 2–3.5 |
| Shortlist and budget on user-entered prices (S1.B) | 2–4 |
| Review rework, bug fixing and release fixes across milestones | 3–5 |
| **Stage 1 closed-beta total** | **about 31–49** |
| Public-launch addition at HC-2: self-service email reset | +1–2 |
| Product layer (Stage 3, not Stage 1; see §6) | +10–18, plus curation or integration time |

**Founder content** is planned and estimated in §5.2.

Assumptions: one full-time developer familiar with Next.js, Express and MongoDB; the founder writes and reviews content in parallel; AI wording not built unless the evaluation set justifies it.

**Not included:** time spent waiting for founder decisions (HC-1, HC-2), for account creation, or for the legal review (D-74); fixes requested by beta users after launch.

**Calendar view (estimate, not a commitment).** At 5 developer-days per week, the closed-beta work is about 6–10 weeks, and up to about 15 weeks if the estimate is 50% low. The release date is the later of: (a) that development path, (b) content set C1 approved (founder, about 3–9 weeks at 15–20 hours per week, §5.2, started at S1.1), plus (c) the founder's lead time for the HC-1 hosting decision and account set-up. Public launch additionally waits for the legal review (D-74), whose duration is unknown, and HC-2 (1–2 developer-days after the email provider is chosen). Stage 2 is paced by content set C2: about 10–40 further weeks of founder time after C1, so roughly 13–49 weeks of content work from the start, at 15–20 hours per week. No dates are set until the developer's and founder's availability is known.

### 5.2 Content programme (D-57, D-62)

**Product requirement:** at least **100 colour palettes** and at least **100 outfit templates** (planning range 100–150 each), 8–12 categories, and a comprehensive styling-rule library (FR-STY-09). The architecture and data model support this size without code changes (FR-STY-10). Content is built in three sets; only C1 and C2 are release scope.

| Set | Contents | Purpose | Gate |
|---|---|---|---|
| **C0 — development seed** (temporary) | ≥ 6 palettes, ≥ 6 templates, the rules they reference | Build and test the engine in S1.4. **Not** product scope; replaced by C1 | S1.4 start |
| **C1 — Stage 1 release set** | 12–20 palettes, about 20 templates covering the Stage 1 occasions and categories for every department offered, and rules covering every FR-STY-09 area | The closed-beta release | S1.6 start; release blocker for S1.7 |
| **C2 — full library** (product requirement) | ≥ 100 palettes, ≥ 100 templates, 8–12 categories, comprehensive rules | The complete styling product | **Release blocker for Stage 2** |

**Creation and validation process (every batch):**
1. **Plan the batch** from the coverage report (FR-STY-11): which occasion × style × department cells, categories, undertone affinities and contrast levels are thin or empty, and what feedback and the evaluation set show.
2. **Draft** records with rationale, limitations, tags and coordination rules ([CONTRIBUTING.md](CONTRIBUTING.md) §6). Drafts can be prepared by any contributor; approval is the founder's (D-62).
3. **Automated validation:** schema, linter (contradictions, duplicates, unknown references, judgemental language), coverage report, and the scale test.
4. **Evaluation:** run the evaluation set; add profiles for any new occasion, style or department. For C2 the set grows so that every supported occasion × department combination has at least one profile (estimate 60–100 profiles).
5. **Founder review and approval;** only approved records ship.
6. **Release gate check:** C1 for Stage 1, C2 for Stage 2 — counts met, coverage report with no empty supported cell, linter clean, evaluation target met or gaps documented (AC-10, AC-C1 … AC-C3).

**Estimates (founder hours, unmeasured):**

| Set | Work | Hours |
|---|---|---|
| C0 | 6 palettes at 1–2 h (6–12 h); 6 templates at 1–1.5 h (6–9 h); the rules they reference, assumed 6–10 at 0.5–1 h (3–10 h) | about 15–31 (counts toward C1) |
| C1 | 12–20 palettes at 1–2 h (12–40 h); about 20 templates at 1–1.5 h (20–30 h); starter rules at 0.5–1 h each (15–50 h); evaluation set (5–10 h); illustration clearance if used (0–10 h) | about 52–140 in total |
| C2 (additional to C1) | enough palettes to reach at least 100 (80–88 more, depending on C1's 12–20) and at most the 150 planning maximum (130–138 more: 138 if C1 has 12, 130 if C1 has 20), at 1–2 h each (80–276 h); 80–130 more templates at 1–1.5 h (80–195 h); 40–100 more rules at 0.5–1 h (20–100 h); evaluation-set growth (10–20 h) | about 190–590 |

At 15–20 founder hours per week, C1 is roughly 3–9 weeks and C2 roughly 10–40 weeks more. All figures are unmeasured estimates. C2 is therefore the pacing item for Stage 2 and is planned from the start, not after Stage 1. If the pace needs to rise, more contributors can draft records; founder approval remains required.

---

## 6. Product Layer

**Objective:** show verified real products for look slots, with honest prices, availability, quality evidence and budgets.

**Includes:** FR-SIZE-05 … 07, FR-PROD, FR-MATCH, FR-BUD (verified prices), FR-QUAL. **Excludes:** cart, checkout, payments, price-drop alerts, click-out tracking, live price checks on the request path, scraping.

| Milestone | Work | Tests | Estimate |
|---|---|---|---|
| **PL.1 Data model and ingestion** | `retailers`, `products`, `reviewEvidence` models; provenance validation ([DATABASE.md](DATABASE.md) §4.5); curation template and import script; integration module per approved source, mocked until approval; freshness computation; link-check script | P-05, P-06, P-14, P-15 | 3–5 |
| **PL.2 Matching and budget** | Eligibility, matching, ranking (affiliate-neutral), look match; budget engine on verified prices; alternatives endpoint | P-07 … P-13, P-19 | 3–5 |
| **PL.3 Quality and UI** | Quality service with thresholds as proposals; product browse and detail pages; slot product cards with "Price as of", disclosure and labels; saved-look re-check; size charts and optional measurements where permitted | P-01 … P-04, P-16 … P-18 | 4–8 |
| **PL.4 Release** | Retailer permissions recorded; starting catalogue curated or synced; monitoring alerts; disclosures reviewed | Release checklist | Curation time per listing |

- **Can start:** any time after S1.4, on fixtures, behind `PRODUCT_LAYER_ENABLED=false`.
- **Release blockers:** an authorised source with recorded permissions (D-43 … D-45), D-74 legal review, D-46 disclosures, D-50/D-51 for that source.
- **Acceptance:** AC-P1 … AC-P9 ([MVP.md](MVP.md) §5.3).

---

## 7. Stage 2 — Expanded Styling

### S2.1 Full content library (C2)
- Complete content set C2 (§5.2): at least 100 palettes and at least 100 outfit templates, 8–12 categories including Dresses (D-57), and the comprehensive rule library (FR-STY-09), guided by the coverage report, evaluation and beta feedback (FR-STY-08). Hindi disclosure text if the product layer is live.
- **Release blocker for Stage 2.**
- **Acceptance:** AC-C1 … AC-C3 ([MVP.md](MVP.md) §5.5); evaluation set re-run with no regression on AC-07 … AC-10.

### S2.2 Optional weather
- FR-WX-01 … 09; provider adapter after D-60; manual entry fallback; city-only storage.
- **Release blocker:** D-60 (provider terms, pricing and data handling verified). Open-Meteo's free tier is documented as non-commercial only, so it can't be assumed for a commercial product.
- **Tests:** W-01 … W-08. **Acceptance:** AC-W1 … AC-W3. **Estimate:** 3–5 developer-days once a provider is chosen.

---

## 8. Decision Register (single source of truth)

This is the only place where decisions are tracked. Other documents point here.

**Statuses (exactly four):** **Approved** (decided by the founder, or a documented default for a non-critical question, with rationale) · **Deferred** (decided at a named checkpoint or when its stage starts) · **Pending Founder Decision** · **Blocked** (waits on a retailer, provider or legal reviewer). Entries that were withdrawn or replaced stay in the register for traceability, with status Approved and the replacement named in the resolution.

Founder decisions are final unless there is a genuine contradiction, legal blocker or material risk. "Default" marks a choice made without a specific founder instruction; it can be changed later through the normal workflow. Proposed numeric thresholds are calibrated on the evaluation set; calibration is a task, not an open decision.

### 8.1 Foundation and engineering (D-01 … D-42)

| ID | Decision | Resolution | Status | Stage |
|---|---|---|---|---|
| D-01 | Node.js and pnpm versions | Default: current Node.js Active LTS and pnpm 10, pinned (`engines`, `packageManager`, `.nvmrc`). Rationale: supported, reproducible | Approved | 1 |
| D-02 | Test frameworks | Default: Vitest, Supertest, `mongodb-memory-server`, Testing Library. Rationale: TypeScript-native, no shared test database | Approved | 1 |
| D-03 | Schemas and error codes | Default: Zod contracts in `packages/contracts`, written at the start of each milestone. Codes and HTTP mapping as in [API.md](API.md) §4 | Approved | 1 |
| D-04 | Password hashing | Default: argon2id with OWASP-recommended parameters | Approved | 1 |
| D-05 | API access token | Default, revised 2026-10-12 (D-91): JWT (HS256, `AUTH_ACCESS_TOKEN_SECRET`) carrying `tokenVersion`, the session ID and the Remember Me flag; it expires with its session — 30 days with Remember Me, otherwise 24 hours. When the API rejects a token as expired or revoked, the web app clears the cookie and the user logs in again | Approved | 1 |
| D-06 | Token storage | Default, revised 2026-10-12: Auth.js is replaced by a first-party `HttpOnly` cookie set by the Next.js server (`__Host-styleme_session` over HTTPS), because Auth.js cannot vary the cookie lifetime per session (Remember Me, D-91). The token is forwarded by the Next.js server and never reaches browser JavaScript or browser storage | Approved | 1 |
| D-07 | Logout and revocation | Default, revised 2026-10-10 and 2026-10-12: each login creates a server-side session record (`sessions`) whose ID the token carries, and every API request checks it. Logout ends **only the current session** (`POST /v1/auth/logout` deletes that record, then the cookie is cleared); other devices stay signed in. Password change ends every other session; password reset, account linking that discards a pre-registered password (D-88), account deletion and the admin script end all sessions and increment `tokenVersion` ([SECURITY.md](SECURITY.md) §1) | Approved | 1 |
| D-08 | Product data source | Replaced: decided through D-43 … D-45 and D-58 | Approved | — |
| D-09 | Allowed values (department, styles, occasions, preferences, signals) | Default: enums in `packages/contracts`, short inclusive lists with "prefer not to say" where relevant, expandable without migration. Age range and height are not collected in Stage 1, because no Stage 1 feature uses them (FR-PROF-04). **Revised 2026-10-18 by D-102 and D-104:** height, body measurements, the `oversized` fit, body-shape cards and an optional age group are added (new vocabulary IDs still need founder approval, D-62) | Approved | 1 |
| D-10 | Image upload approach | Stage 1 has no user uploads. Decide with photo analysis. **Revised 2026-10-18 by D-103:** optional face and full-body uploads with consent, preview, crop and quality checks; storage provider D-107 | Approved | 1 |
| D-11 | Photo storage privacy and retention | Decide with photo analysis, within D-49 and AI rule 16. **Revised 2026-10-18 by D-103:** the user chooses to keep photos or delete them after analysis; revoking retention deletes them immediately; private object storage (D-107) | Approved | 1 |
| D-12 | AI models and fallback | Default: no AI provider needed in Stage 1. If AI wording is enabled, the lowest-cost current Gemini model that passes the evaluation set; on failure, template text (no second provider for wording). Before enabling, current pricing, limits and data-use terms are checked and recorded (NFR-COST-03); as checked on 2026-10-10, Google's pricing page states that free-tier content is used to improve Google's products and paid-tier content is not. The wording input contains no personal data (AI rule 16), but the tier is chosen with that in mind | Approved | 1 |
| D-13 | aiCache key and expiry | Default: SHA-256 of request type + model + normalised input; 7 days; TTL index | Approved | 1 |
| D-14 | MediaPipe browser/server split | Decide with photo analysis; prefer in-browser processing. **2026-10-18:** photo analysis is approved (D-103); face analysis on device or StyleMe's servers, full-body analysis may use Gemini under D-122. The exact split is decided when the photo-analysis work starts | Deferred | Start of photo-analysis work |
| D-15 | Monk mapping and thresholds | Decide with photo analysis (approved, D-103); thresholds calibrated and founder-reviewed before confidence labels are shown | Deferred | Start of photo-analysis work |
| D-16 | Indexes | Default: as in [DATABASE.md](DATABASE.md) §8 | Approved | 1 |
| D-17 | Logging | Default: structured JSON (e.g. pino) to stdout; no passwords, tokens, signals, measurements, photos or precise location | Approved | 1 |
| D-18 | Pagination | Default: `page` and `limit` (20, maximum 50) | Approved | 1 |
| D-19 | Ranking | Default: weighted sum of approved rule effects and preference matches in the precedence order of FR-LOOK-08, with diversity de-duplication; weights tuned on the evaluation set; affiliate status never an input | Approved | 1 |
| D-20 | Atlas access | Default: least-privilege users and strong credentials per environment (D-78); IP access lists where the host supports fixed addresses, otherwise documented as a risk | Approved | 1 |
| D-21 | Git conventions | Default: `feature/*` and `fix/*` branches with pull requests into `main`; Conventional Commits; CI required; no `develop` branch until a release cadence needs it | Approved | 1 |
| D-22 | Look structure | `outfits.slots[]` with look specification, alternatives and an optional product snapshot ([DATABASE.md](DATABASE.md) §3.4) | Approved | 1 |
| D-23 | Suggested vs saved looks | Default: each look is an `outfits` document, `status: "suggested"` with a 7-day expiry; save sets `saved` and removes the expiry; feedback on the same document; endpoints under `/v1/outfits/:id` | Approved | 1 |
| D-24 … D-26 | Try-on provider order, results collection, sync vs async | With try-on | Deferred | Future (D-48) |
| D-27, D-28 | Avatar model source and proportions | With the 3D avatar; never used for sizing | Deferred | D-76 |
| D-29 … D-31 | Design attributes, preview, `designs` fields | With the Design Studio | Deferred | D-76 |
| D-32 | Design generation provider | With sketch-to-design; must respect AI rules 16–17 | Deferred | D-76 |
| D-33 | Chat conversation model | With the chatbot | Deferred | D-76 |
| D-34, D-35 | Tailor instructions and PDF delivery | With the tailor PDF | Deferred | D-76 |
| D-36 | E2E tooling | Default: Playwright smoke flow at 375×812 and 1280×800 | Approved | 1 |
| D-37 | CORS | Default: each environment's web origin only | Approved | 1 |
| D-38 | Rate limits | Default: login 5/min per IP; register 3/min per IP; logout 30/min per user; account deletion 3/hour per user; recommendations 20/min per user; feedback 60/min per user; shortlist writes 30/min per user; password change 5/hour per user; reset confirm 10/hour per IP; reset request 3/hour per email and 10/hour per IP. In-memory store until Redis is justified: limits are per API instance and reset on restart, so they hold as stated only while a single API instance runs; if HC-1 chooses more than one instance, a shared store is needed (raised at HC-1) | Approved | 1 |
| D-39 | AI in CI | Default: provider calls stubbed; no real keys | Approved | 1 |
| D-40 | Deployment configuration | Default: Vercel (previews → staging API, `main` → production), `render.yaml` for the API, Docker Compose runs the API only; no `NEXT_PUBLIC_` secrets | Approved | 1 |
| D-41 | Rollback | Replaced: merged into D-79 | Approved | — |
| D-42 | CI from the start | Default: typecheck, lint, test and build from S1.1 | Approved | 1 |

### 8.2 Product, data, styling and operations (D-43 … D-85)

| ID | Decision | Resolution | Status | Stage |
|---|---|---|---|---|
| D-43 | Launch retailers | Flipkart and Meesho are the intended retailers. **Neither has approved StyleMe.** Production starts with one retailer whose permitted integration is verified. Integrations stay disabled until then | Blocked | Product layer |
| D-44 | Flipkart permissions | Confirm in writing: data and image access, price and availability display, caching and refresh, affiliate-link rules, name and logo, cross-retailer comparison, commercial use, AI processing and derivative use, field meanings ([BRD.md](BRD.md) §7) | Blocked | Product layer |
| D-45 | Meesho permissions | Same checklist; terms not yet retrieved | Blocked | Product layer |
| D-46 | Disclosure wording | **Affiliate link:** "Affiliate link — this link contains a retailer tracking code, and StyleMe may earn a commission if you buy. This never affects which products we recommend." **Sponsored placement:** none planned; if ever added, labelled "Sponsored" and kept separate. **Recommendation disclosure (product layer):** "Recommendations are based on your preferences and occasion and on the verified products available to StyleMe. Retailers do not pay for placement. Prices and availability are as of the time shown; the retailer's page is final." Monetisation off by default. Legal review is D-74 | Approved | Product layer |
| D-47 | Retailer image licensing | Only as each retailer's terms permit; no copying, editing or AI processing without explicit permission | Deferred | Product layer |
| D-48 | Virtual try-on and AI rule 16 | **Question:** whether, and how, generative try-on can be built given AI rule 16 (no personal photos to external AI providers unless a future explicit decision, privacy review and user consent authorise the specific processing). **Why it matters:** the original hosted-provider design (Leffa / Hugging Face / Qwen) does not meet the rule. **Options:** (a) keep try-on out of scope indefinitely; (b) evaluate self-hosted processing later, subject to privacy, security, feasibility and cost review; (c) authorise a specific external processing arrangement after a privacy review and with user consent. **Conditions any option needs:** image rights, retailer permission for AI processing, deletion controls, accuracy, cost and latency. Not needed for Stages 1–3. **Raised only if try-on is proposed (§4.5);** not built or approved meanwhile | Pending Founder Decision | Future |
| D-49 | Evidence, retention, privacy | As in [SECURITY.md](SECURITY.md) §6. Out-of-app deletion requests handled within 30 days (default) | Approved | 1 / product layer |
| D-50 | Freshness | Follows provider terms. Starting thresholds: API data stale after 24 h, expired after 72 h; manually verified data stale after 7 days, expired after 14 days | Deferred | Product layer |
| D-51 | Refresh schedule | Per provider, from its terms and limits | Deferred | Product layer |
| D-52 | Quality checks and thresholds | Recommendation checks in [TESTING.md](TESTING.md) §5–§6; proposed relevance target ≥ 80%; product-quality thresholds are proposals until calibrated; no measured claims until tested | Approved | 1 / product layer |
| D-53 | Alternatives | 3–5 when enough suitable options exist; fewer with a message; never padded | Approved | 1 |
| D-54 | Size model | Category-specific sizes per [FRD.md](FRD.md) §4.8; charts only where permitted; body shape never sets size | Approved | 1 |
| D-55 | Budget price | Stage 1: the price the user entered, labelled "Price entered by you — not verified by StyleMe". Product layer: the verified unconditional selling price, with MRP and known shipping shown separately. Always labelled with its basis; never a checkout price | Approved | 1 / product layer |
| D-56 | AI review-text classification | Not in scope | Approved | — |
| D-57 | Styling content requirement | **Founder requirement:** at least 100 colour palettes and at least 100 outfit templates (planning range 100–150), 8–12 categories and a comprehensive rule library (FR-STY-09), completed and approved before the Stage 2 release (content set C2). Stage 1 releases with content set C1 (12–20 palettes, about 20 templates, rules covering every FR-STY-09 area). The C0 seed (≥ 6 palettes, ≥ 6 templates) is a temporary development input only. Architecture and data model support the full size (FR-STY-10). Rules are soft and expandable. Occasion is the only required request input. Dresses joins in Stage 2 | Approved | 1 / 2 |
| D-58 | Catalogue | No demo catalogue. The product layer starts with a small set of verified listings that curation or sync can keep current; long-term target 500–1,000 human-reviewed listings | Approved | Product layer |
| D-59 | Try-on fallback | Authorised product image, generic moodboard or text description; never an implied success | Approved | Future |
| D-60 | Weather provider | Weather is approved for Stage 2. The provider is chosen only after commercial terms, pricing and data handling are verified. Comfort bands in FR-WX-04 are starting points | Deferred | 2 |
| D-61 | Staged plan and estimates | Stages and estimates in §3, §5.1 and §5.2 (Stage 1 closed beta about 31–49 developer-days, including review rework and bug fixing, plus 1–2 at HC-2; founder content about 52–140 hours for C1 and about 190–590 more for C2); recalibrated after S1.4 | Approved | — |
| D-62 | Styling-content ownership | The founder reviews and approves all styling content ([CONTRIBUTING.md](CONTRIBUTING.md) §6) | Approved | 1 |
| D-63 | Stage 1 scope | As in [MVP.md](MVP.md) §3. **Founder decision:** until D-74 is complete, StyleMe runs only as a closed beta for invited users who receive the privacy notice. Enforced in the product: registration requires an invite on an admin-managed allow-list, and `PUBLIC_SIGNUP_ENABLED` stays `false` (FR-AUTH-10). Development is not blocked by D-74 | Approved | 1 |
| D-64 | Illustrative prices | Withdrawn: no illustrative or example prices are shown anywhere | Approved | — |
| D-65 | Style illustration assets | Re-scoped from demo assets: style illustrations of garment types (not products) from team-made, CC0, CC BY with attribution, licensed-in-writing or code-generated sources, or AI illustration tools whose terms allow it. Labelled "Style illustration — not a product". No retailer, scraped or unclear-licence images. Without a cleared asset, a labelled colour swatch is used | Approved | 1 |
| D-66 | New folders | Default: `apps/api/src/style-rules/` in Stage 1; `integrations/retailers/` with the product layer; `integrations/weather/` in Stage 2. **Revised 2026-10-18 by D-110:** the runtime catalogue lives in MongoDB; `style-rules/` keeps the schemas, linter, coverage report and the review/seed files | Approved | 1 |
| D-67 | Optional AI wording | Default: off; enabled only if the evaluation set shows clearer explanations without loss of accuracy; prompts versioned with IDs | Approved | 1 |
| D-68 | Performance targets | Default (proposed, to measure): p95 under 2 s for `POST /v1/recommendations` without AI on the production plan. No uptime commitment published until measured | Approved | 1 |
| D-69 | Monitoring | Default: platform logs, `/health`, external uptime check with email alerts; sync-failure alerts with the product layer | Approved | 1 |
| D-70 | Test coverage | Default: no global gate; ≥ 80% line coverage for the generator, rule loader and budget engine | Approved | 1 |
| D-71 | Business KPIs | Stage 1 release is judged by the acceptance criteria and the evaluation set. Usage KPIs (e.g. returning users, saved looks per user, "love it" rate) are defined before the closed beta ends | Deferred | 1 |
| D-72 | `appearanceProfiles` per user | Default: one document per user, updated in place | Approved | 1 |
| D-73 | Roles | Default: `user` and `admin`; no admin UI; content and catalogue changes via pull requests and scripts. **Revised 2026-10-18 by D-120:** an admin panel with `super_admin` and `content_admin` roles | Approved | 1 |
| D-74 | Legal review | A qualified reviewer checks the privacy notice, terms, DPDP readiness, disclosures and retailer terms. **Blocks public launch and the product layer; never treated as complete until recorded here.** **How completion is recorded:** the founder updates this entry with the reviewer (person or firm and qualification), the review date, the scope (documents and features reviewed, and whether the product layer is included), the outcome, and the list of required changes with each one marked done and linked to its change; only then does the status become Approved. Until then all legal conclusions in these documents, including DPDP applicability and dates, are provisional. The implementer reminds the founder to arrange it when S1.7 is ready (§4.5). Does not block development or the closed beta | Blocked | 1 / product layer |
| D-75 | Demo vs production deployment boundary | Replaced by D-78. There is no demo release | Approved | — |
| D-76 | Stage of deferred features | **Question:** when (if at all) do photo-based appearance analysis, the 3D avatar, Design Studio, sketch-to-design, the chatbot and the tailor PDF get built, and in what order? **Why it matters:** only weather is approved for Stage 2; the deferred features differ greatly in privacy risk (photo analysis), external-AI dependency (chatbot, sketch) and effort. **Facts that bear on it:** photo analysis needs a privacy design satisfying AI rule 16; chatbot and sketch-to-design require an AI provider and fail without one; Design Studio and tailor PDF don't need AI; the avatar is independent of sizing. **Options:** decide after Stage 1 evaluation and user feedback; or fix an order then; or drop some features from the vision. Not needed for Stage 1. **Raised at the checkpoint in §4.5, not before;** none of these features is built or approved meanwhile. **Narrowed 2026-10-18:** photo-based appearance analysis and body measurements are decided by D-102 and D-103 (Stage 1); D-76 now covers the 3D avatar, Design Studio, sketch-to-design, the chatbot and the tailor PDF | Pending Founder Decision | After Stage 1 |
| D-77 | Stage 1 product and budget scope | **Option B, chosen by the founder on 2026-10-10.** Stage 1 includes the styling core plus an optional shortlist: users add items they found themselves (name, optional https link, price they enter, optional note), optionally attached to a look slot, and the budget engine totals the entered prices against their budget. Items, prices and totals are always labelled as entered by the user and not verified by StyleMe. StyleMe never fetches links, checks prices, or claims stock, reviews or quality for them. No retailer approval is needed for this. Verified products, retailer integrations and retailer-sourced prices remain the product layer (Stage 3), subject to D-43 … D-46 and D-74. Options A (no shortlist) and C (delay launch for an authorised source) were not chosen | Approved | 1 |
| D-78 | Environments and test data | Default: separate local, CI (`mongodb-memory-server`), staging and production databases and secrets; fixtures only outside production; production startup check; seed scripts refuse production; staging access-protected ([DEPLOYMENT.md](DEPLOYMENT.md) §2). Rationale: preview deployments run unreviewed code and must never reach production data | Approved | 1 |
| D-79 | Migrations, backups, rollback, recovery | Default: versioned backward-compatible migrations; Atlas backups if the tier includes them, otherwise scheduled `mongodump` (weekly and before migrations), backup retention period confirmed by the founder at HC-1 (30 days proposed); restore tested in staging before the Stage 1 closed-beta release; every restore goes into an isolated database and replays deletion tombstones before serving users (D-85); rollback by redeploying the previous version ([DEPLOYMENT.md](DEPLOYMENT.md) §6) | Approved | 1 |
| D-80 | Shortlist limits and behaviour | Default: name ≤ 120 characters, note ≤ 300, URL ≤ 2,048 and https only, price > 0 and ≤ ₹10,00,000 (INR only); at most one attached item per look slot (`{outfitId, slotId}`, D-82), unattached items unrestricted within the limit of 200 items per user; no edit endpoint (delete and re-add); deleting a look detaches its items. Rationale: bounded storage and abuse surface without limiting normal use; easy to change later | Approved | 1 |
| D-81 | Hosting accounts and plans | **Postponed by the founder.** MongoDB Atlas, Vercel and Render accounts, plan tiers, costs and credentials are decided at the hosting checkpoint HC-1 (§5), when the founder is presented with options and current costs. Until then nothing is deployed and no account, paid plan or credential is assumed | Deferred | 1 (HC-1) |
| D-82 | Slot identity | **Founder decision.** Every template slot has a stable, template-defined `slotId` (e.g. `top`, `accessory-1`, `accessory-2`), unique within the template; `slot` stays the category/type. Generated and saved looks keep each slot's `slotId`. Shortlist items reference `{outfitId, slotId}` with a unique index; the linter rejects duplicate `slotId`s within a template | Approved | 1 |
| D-83 | Password change and recovery | **Founder decision, revised by the founder 2026-10-12 (D-89, D-93).** Password change is confirmed with a 6-digit code emailed to the account address (no current password). Forgotten passwords are reset self-service by an emailed link (15 minutes) or code (5 minutes); a reset ends all sessions and does not log the user in. The admin-assisted reset code (FR-AUTH-12, 60 minutes) remains for support cases. Every token is random, stored only as a hash, single-use and rate-limited, and a new one invalidates earlier unused ones | Approved | 1 |
| D-84 | Transactional email provider | **Still deferred, but needed earlier than planned:** email verification at registration (D-89) means the closed beta cannot open without a working email provider. The integration boundary is built (SMTP via `SMTP_URL` and `EMAIL_FROM`; staging and production refuse to start without them; local development writes messages to a git-ignored dev outbox). Provider, account, sender domain and costs are chosen by the founder — now at HC-1 rather than HC-2 | Deferred | 1 (HC-1) |
| D-85 | Deletion tombstones and restore replay | **Founder decision.** Every account deletion first writes a minimal tombstone to a store outside the main database's restore scope; if that write fails, nothing is deleted. Tombstone contents: internal `userId`, keyed hash (HMAC-SHA-256) of the normalised email, `deletedAt`, `source`, `expiresAt` — no name, plain email or IP. Retention: the backup retention period plus 7 days (37 days while backup retention is the proposed 30). Every restore goes into an isolated database while production is in maintenance mode; all unexpired tombstones are replayed and verified there; users are served again only when verification passes. Any failure keeps StyleMe unavailable ([DEPLOYMENT.md](DEPLOYMENT.md) §6). The store's location is chosen at HC-1 (D-81) | Approved | 1 |
| D-86 | Email ownership at sign-up | **Resolved by the founder 2026-10-12:** option (a), extended to the closed beta. Every email registration is verified by a code or link before the account can log in (D-89); Google sign-ups rely on Google's verified-email claim (D-88) | Approved | 1 |

### 8.3 Authentication, onboarding and design (D-87 … D-95)

Founder decisions of 2026-10-12 ("Final Authentication, Onboarding, UI/UX and Implementation Instructions").

| ID | Decision | Resolution | Status | Stage |
|---|---|---|---|---|
| D-87 | Registration and password policy | **Founder decision.** Fields: full name, email, password and confirmation, city (required, from a searchable list of Indian cities), mobile number (optional), Terms of Service and Privacy Policy acceptance (required; versions and time recorded), marketing email (separate, optional, off by default), Remember Me (off by default). Password: at least 8 characters with an upper-case letter, a lower-case letter, a number and a special character, shown as a live checklist without a strength label; show/hide on both fields. Duplicate email → "already registered" with a Log in link. Non-sensitive fields are kept as a local draft for 24 hours; passwords and consent never are | Approved | 1 |
| D-88 | Google sign-up and login | **Founder decision.** Authorization-code flow with PKCE, `state` and `nonce` on the Next.js server; the API verifies the ID token's signature, issuer, audience and nonce and requires `email_verified`. Google's verified email replaces StyleMe's email verification. Sign-up with an email that already has an account is refused (log in instead); login with Google links an existing account automatically — never on a client-supplied email alone. Linking to an **unverified** account discards its pre-registered password and sessions (takeover protection). Google sign-ups create a StyleMe password first, then give city and phone during onboarding. Closed-beta invites (D-63) still apply | Approved | 1 |
| D-89 | Verification and reset codes and links | **Founder decision.** Email verification: 6-digit code valid 5 minutes and link valid 30 minutes, sent together. Reset: link 15 minutes or code 5 minutes. Codes are entered in six boxes with paste support and an explicit Verify button. Resend: 30-second cooldown, at most 5 resends per hour. 3 wrong codes lock that code for 30 minutes. The registering browser can correct its email during verification; anyone can request a new verification email by address (generic response). An unknown email on "forgot password" shows "Email not registered" with a Sign up link (accepted enumeration trade-off, rate-limited). Codes are stored as keyed hashes, link tokens as SHA-256 hashes | Approved | 1 |
| D-90 | Login lockout | **Founder decision.** 3 wrong passwords lock the account for 30 minutes (even for the right password), in addition to per-IP rate limits; a successful password reset clears the lock. Accepted risk: someone who knows an email address can keep that account locked; mitigated by the IP limits and reset | Approved | 1 |
| D-91 | Sessions and Remember Me | **Founder decision.** Without Remember Me the cookie ends when the browser closes and the server stops accepting the session after 24 hours; with Remember Me the cookie and session last 30 days. Logout ends the current session only | Approved | 1 |
| D-92 | Phone number | **Founder decision.** Optional; Indian mobile numbers only; verified by a 6-digit SMS code; never used for login. No SMS provider is integrated yet: locally codes go to the dev outbox, elsewhere phone verification reports "not available" and the account works fully without it. The provider is chosen with D-84 | Approved | 1 |
| D-93 | Password change and email change | **Founder decision.** Password change: emailed code and a new password under D-87; other sessions end, this browser continues; a notice is emailed. Email change: current password, then a code or link sent to the new address; the old address stays active until then and is notified afterwards. No two-factor authentication in Stage 1 | Approved | 1 |
| D-94 | Account deletion, onboarding and dashboard | **Founder decision.** Deletion needs an emailed code and an explicit confirmation, and is immediate and permanent (tombstones, D-85). Onboarding is server-authoritative: Registration → Verify → Style Profile → Appearance (optional, skippable) → Personalized Home; login resumes at the next incomplete step. Dashboard sections not built yet are labelled "Coming soon" and open a description page only | Approved | 1 |
| D-95 | Admin account and roles | **Founder decision (2026-10-13).** Only `user` accounts can register (email or Google); a `role` in the request is rejected. The admin is seeded by `pnpm seed` (`scripts/seed.ts`) from `SEED_ADMIN_*` environment variables, never from source code. The seeded admin is verified, needs no invite, skips onboarding and logs in directly with email and password; Google sign-in is refused for admin accounts. Seeding is idempotent, replaces the password only with `--reset-password` (which ends all sessions), and never promotes an existing user (`pnpm admin set-role` stays the deliberate route). It holds no fixture data, so D-78's production refusal for seed scripts does not apply to it. Lockout, rate limits and sessions apply to admins as to users | Approved | 1 |

### 8.4 Styling vocabulary (D-96 … D-101)

Founder decisions of 2026-10-16 from the styling-vocabulary audit (issue #30). Items marked *unverified* rely on the workflow PDF, which was not available during the audit. They will be checked when it is.

| ID | Decision | Resolution | Status | Stage |
|---|---|---|---|---|
| D-96 | Wear type | **Founder decision.** A separate `wearType` vocabulary — `indian`, `fusion`, `western` — kept apart from `styles`. The styles `traditional` and `fusion` stay; the content guide prevents tagging the same idea twice. Every template has a `wearType`. Users may choose wear types in a look request, which acts as a **hard filter** for that request, and may save preferred wear types in the profile, which is a **soft ranking preference** that never overrides the request (FR-LOOK-01, FR-LOOK-08, FR-PROF-02). Choosing none means all three | Approved | 1 |
| D-97 | Categories and garment types | **Founder decision.** **8 broad categories**, each holding garment types:<br>• Stage 1: tops, bottoms, ethnic tops, ethnic sets & drapes, layers, footwear, accessories<br>• Stage 2: dresses<br>The existing garment IDs (`t_shirt`, `shirt`, `jeans`, `trousers`, `kurta`, `kurti`, `lehenga`, `saree`, `shoes`, `accessory`, `dress`) are kept unchanged and become garment types. New garment types:<br>• churidar, salwar, palazzo, dhoti<br>• sherwani, anarkali<br>• jacket/blazer, Nehru jacket/bandhgala, shrug/cardigan, dupatta/stole (the new `layers` category)<br>• juttis, kolhapuris, heels, sneakers, loafers, sandals, formal shoes<br>• jewellery, bag, belt, watch<br>**Each garment type carries its size group, using the existing groups only:**<br>• churidar, salwar, palazzo and belt → bottoms<br>• dhoti, dupatta/stole, jewellery, bag and watch → free size<br>• sherwani and anarkali → ethnic tops<br>• jacket, Nehru jacket and shrug → tops<br>• footwear → shoes<br>The category count stays within FR-STY-06 (8–12). Exact IDs and labels are set when implemented. The PDF "category → garment type" wording is *unverified* | Approved | 1 (dresses 2) |
| D-98 | Formality | **Founder decision.** A slot attribute `formality` — `casual`, `smart`, `formal`, `festive` — usable in rule effects, so the formality-consistency rule (FR-STY-09) can be expressed | Approved | 1 |
| D-99 | Colours, fabrics and techniques | **Founder decision.** "100+" in D-57 means **palettes** (and templates), not individual colours; D-57 is unchanged. The colour vocabulary grows from 39 to about 60–80 colours in approved batches, Indian fashion colours first (e.g. wine, rani pink, peacock blue, saffron, off-white). One approved batch adds:<br>• fabrics: brocade/banarasi, organza, net, muslin, tissue<br>• techniques, as patterns: chikankari, zari/zardozi, leheriya, kalamkari, mirror work<br>Done before C1; not needed for C0. New IDs only; none are renamed. Whether the PDF also asks for 100+ colours is *unverified* | Approved | 1 |
| D-100 | Coverage report extension | **Founder decision.** The coverage report (FR-STY-11) also counts templates per category, per garment type and per wear type × department, listing empty and thin cells | Approved | 1 |
| D-101 | Kids department | **Founder decision.** No kids department in Stage 1. Adding one later needs a privacy and legal review (DPDP rules for minors, D-74), a kids size system and founder approval. The PDF mention is *unverified* | Approved | — |

### 8.5 My Profile and Home (D-102 … D-108)

Requirements answered on 2026-10-18 for My Profile ([FRD.md](FRD.md) §4.3a, FR-MYP) and Home ([FRD.md](FRD.md) §4.1b, FR-HOME). First recorded as Pending Founder Decision because several reverse earlier founder decisions. **Approved by the founder on 2026-10-18 (D-102 … D-106).** The earlier entries they revise are marked in place. The schema code (`packages/contracts/src/my-profile.ts`, `photos.ts`; `userPhotos`, `appearanceAnalyses` and optional `profiles` fields in `apps/api/src/models/index.ts`) stays unreachable from any endpoint until the issues that build these features are taken; photo upload, age group and photo analysis keep their release gates (privacy review, D-74, accuracy evaluation, storage deletion).

| ID | Decision | Resolution | Status | Stage |
|---|---|---|---|---|
| D-102 | My Profile structure and body measurements | **Founder decision (2026-10-18):** section-based My Profile with per-section save, Save all, unsaved-change warning, last-updated dates, summary and Reset preferences (FR-MYP-01, -02, -16); manual body measurements (essential + detailed, cm/in, stored in cm) required only for fit-based recommendations (FR-MYP-07, -13); manual body-shape cards incl. "Not sure"; fit options adding **Oversized** plus a default fit; per-category budgets; custom occasions; city optional for completion; completion % weighted to core sections (FR-MYP-14). Storage: extend `profiles` (it is the `user_profiles` of the request) — no second profile collection. **Revises:** FR-PROF-04 (height), FR-SIZE-06 (no measurements before size charts), D-76 (measurements part), FR-ONB-05 completeness items (city), D-09 vocabulary (fit `oversized`, D-62 approval for new IDs and body-shape card names). Enables the measurement-based body-shape classification of D-112. **Sub-questions settled:** the department option "Show me everything" stays (department `any` sees both sections, D-111); size recommendations still wait for reliable size charts (product layer) | Approved | 1 |
| D-103 | Photo analysis: face and full body | **Founder decision (2026-10-18):** two separate optional uploads — face (skin tone, undertone) and full body (front/side/back; body shape) — with consent per kind before the first analysis, revocable (user chooses to keep or delete existing results), preview/crop/retake, quality checks, High/Medium/Low confidence for photo-only results, user review and correction, retention choice (keep, or delete after analysis; revoking retention deletes photos immediately), separate deletion of photos, results and measurements (FR-MYP-04 … -11). Processing on device where feasible, otherwise StyleMe's own servers; **face photos never go to an external AI provider; full-body photos may be analysed by Gemini only under the conditions of D-122 (option b)**. Images in private object storage (provider D-107); metadata in `userPhotos`, results history in `appearanceAnalyses`, confirmed values stay in `appearanceProfiles`. All body-shape illustrations and default models wear a plain white shirt and plain white pants; never unclothed. **Revises:** D-76 (photo analysis), D-10, D-11, D-14, D-15, FR-SIG-04. **Release gates:** privacy review and D-74 coverage before launch; accuracy evaluation before confidence labels are shown; account deletion also deletes stored photo objects | Approved | 1 (behind release gates) |
| D-104 | Optional age group | **Founder decision (2026-10-18):** optional age group (Under 18, 18–24, 25–34, 35–44, 45+), no date of birth, purpose explained; admin sees aggregated counts only. Under-18 users allowed with protections for minors. **Revises:** FR-PROF-04, D-09. **Release gate:** India's DPDP Act treats under-18s as children, with parental-consent and tracking restrictions; the legal review (D-74) must confirm how under-18 users may be served (compare D-101 for a kids department) before this field ships | Approved | 1 (behind release gate) |
| D-105 | Personal data export | **Founder decision (2026-10-18):** users download their profile information and measurements as JSON and PDF (FR-MYP-17). Resolves [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #8. A PDF library is a new dependency (CONTRIBUTING §12), chosen in the PR that builds the export | Approved | 1 |
| D-106 | Home dashboard redesign | **Founder decision (2026-10-18):** FR-HOME-01 … 18 — two-row desktop header with search, notification bell and account icon; mobile ☰ menu; hero with a personalised look; outfit carousel with quick view; eight feature cards with images and accurate availability; recent activity, continue links, quick actions; completion chart; skeletons and per-section retry; light/dark/system theme. No `home` collection: data comes from existing collections; only persistent user actions are stored — new `notifications` and `userActivity` collections (approved; created with the Home issue, added to `USER_OWNED_COLLECTIONS` in that PR) and a theme preference. **Revises:** FR-UI-03 (single-row nav with "More"), D-94 Home content (profile summary replaced by a styles-and-occasions summary). Search over products only once authorised data exists (D-43 … D-46) | Approved | 1 |
| D-107 | Private object storage for photos | Provider, region, encryption, signed-URL lifetime and costs are chosen with hosting at HC-1; D-103 is approved (2026-10-18), so this is now needed before photo upload ships. External services only through `src/integrations/` | Deferred | HC-1 (D-81) |
| D-108 | Feedback as a preference signal | The Home requirements say recommendations improve from **saved profile preferences only**; [FRD.md](FRD.md) FR-OUT-04 and PROJECT_OVERVIEW §9 treat "love it" / "not for me" as a permitted preference signal. **Question:** may feedback influence ranking? Options: (a) profile preferences only — feedback is stored but not used for ranking; (b) feedback as a soft signal that never overrides explicit preferences. **Resolved 2026-10-18 by D-115: option (b)**, from the feature specifications (My Colour Palette, Outfit Categories, Discover My Style, Shop My Look and Saved Outfits all specify it). FR-HOME-14 is aligned (D-106 approved) | Approved | 1 |

### 8.6 Feature specifications (D-109 … D-128)

Founder feature specifications of 2026-10-18 for **My Colour Palette** (58 answers), **Outfit Categories** (98), **Discover My Style** (98 + 65), **Shop My Look** (114), **Virtual Try-On** (66), **Saved Outfits** (94) and the **Admin Panel** (32), consolidated into [FRD.md](FRD.md) §4.17 – §4.24. Where an answer revises an earlier decision, the entry names it. Two genuine conflicts (D-117, D-122) were decided by the founder on 2026-10-18; everything is Approved. Product data stays blocked on retailer access (D-43 … D-45) exactly as the Shop My Look answers require.

| ID | Decision | Resolution | Status | Stage |
|---|---|---|---|---|
| D-109 | Feature specifications adopted | **Founder decision.** The seven features are specified in FRD §4.17 – §4.24 (FR-DMS, FR-PAL-04 …, FR-OCAT, FR-SHOP, FR-VTO, FR-SAVE, FR-ADM, FR-CONN). Order of work: shared catalogue and engine → Discover My Style, Outfit Categories, My Colour Palette → Saved Outfits → Shop My Look (shortlist first; products when authorised) → 2D Virtual Try-On → Admin Panel ([DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) M10 – M14). **A feature is complete only when every advertised action works end to end;** an unsupported action is hidden or labelled "Not available yet", never simulated. Design Studio and Style Assistant stay deferred (D-76): the specifications define only their hand-off points, which show "Not available yet" until those features exist. All feature pages require login (Outfit Categories Q63) and keep the top navigation visible | Approved | 1 |
| D-110 | Shared styling catalogue in MongoDB | **Founder decision** (Outfit Categories: "one MongoDB database with shared category collections"; Admin Panel Q15 – Q17). **Revises D-66** (location of the knowledge base). Runtime source of truth: shared MongoDB collections — `catalogueCategories`, `garmentAttributes`, `clothingStyles`, `palettes`, `outfitTemplates`, `stylingRules`, `fabricRules`, `illustrations` ([DATABASE.md](DATABASE.md) §4a). The JSON files in `apps/api/src/style-rules/data/` stay the founder-review and seed format until admin editing ships: an import script upserts approved records by stable ID and version, validated by the **same** Zod schemas and linter (no second definition). The engine builds its in-memory indexes from published records at startup and after each publish, so FR-STY-10 performance is unchanged and the engine (#33) is written against a library interface that does not care where records come from. Users never get copies — they reference records by ID (D-116) | Approved | 1 |
| D-111 | Clothing-style hierarchy | **Founder decision.** Women / Men → clothing group (tops; bottoms; dresses and one-pieces; Indian ethnic; fusion and Indo-western; outerwear and layering; traditional menswear; complete outfits and co-ords; sleepwear and loungewear) → category → subcategory → garment attribute → **style** (one reusable record, e.g. *Women → Tops → Necklines → V-neck*). Each style has structured attributes, illustrations, suitability-rule references, goals, occasions, related and alternative styles, and optional try-on support. Attribute **values** are vocabulary IDs (D-09); new values (collars, sleeve designs, rise, leg shape, skirt shapes …) are added to the vocabulary with founder approval (D-62) before any style uses them. Men's coverage reaches the same depth as women's after the women's core is complete (Outfit Categories Q14). Department `any` in a profile sees both sections. Groups and categories are data (admin-arranged), not code enums | Approved | 1 |
| D-112 | Body-shape reference sets | **Founder decision.** Women: hourglass, pear (triangle), inverted triangle, rectangle, apple (oval). Men: rectangle, triangle, inverted triangle, oval. Plus **Not sure**, never forced. Flexible styling references, never restrictions or judgements (FR-STY-05); each maps to an existing proportion descriptor so self-reported signals keep working (`BODY_SHAPES` in `packages/contracts/src/catalogue.ts`). Further shapes need founder approval. Body shape is **one factor** alongside measurements, proportions, goals, fit and comfort; measured proportions take precedence when sufficient (Discover My Style Q6). Measurement-based classification uses deterministic, versioned ratio rules whose thresholds are calibrated and founder-reviewed before release. Body-shape input comes from My Profile (manual choice, measurements or confirmed analysis — D-102, D-103) | Approved | 1 |
| D-113 | Illustration system and image rights | **Founder decision, extends D-65.** Primary visual language: **artistic editorial croquis** — elongated figures, expressive pencil/ink strokes, subtle watercolour — plus garment-only technical drawings; curated licensed photographs only where they add real-world context. Every figure is clothed, by default in a **plain white shirt and plain white pants**; never unclothed. Reusable base figures per body shape with extra views only where they explain suitability; annotated guide lines allowed, never labelling a body good or bad. Diversity across body shapes, heights, sizes, ages, skin tones (never the focus of fit advice), women's and men's, Indian, fusion and western. Each asset records source, creator, licence, attribution, allowed usage and verification; **publication is refused without verified rights** (enforced in the `illustrations` model). Shared assets ship as versioned static files under the web app's public assets in the first release, moving to object storage at HC-1 only if size requires (D-107). Missing art never breaks a page: an honest placeholder or swatch is shown | Approved | 1 |
| D-114 | What "Recommended for you" contains | **Founder decision** (Outfit Categories Q45 revised, Q53). The personalised section shows **only** styles and palettes that meet the user's suitability requirements (body shape and proportions, goals, colouring, preferences, fit and comfort); when none qualifies, it names the criteria that would need to change and offers the closest suitable alternatives. Browsing and search over the full catalogue remain open to everyone, and rules stay soft (FR-STY-04): nothing is hidden from browsing because of a body shape. Initial recommendations: 3 – 5 styles (Outfit Categories Q41); palettes: 12 – 20 cards then Load more | Approved | 1 |
| D-115 | Feedback and personalisation controls | **Founder decision; resolves D-108 as option (b).** Explicit likes and "Not for me" (with optional fixed reasons), saves and dislikes are **soft** ranking signals that never override explicit profile preferences or the current request. One dislike lowers priority but never bans a style; feedback can be undone; personalisation can be paused or reset; the user controls whether feedback affects future recommendations. Browsing and temporary filters never change the profile; permanent changes need an explicit action (Discover My Style Q30, Q79). Equally suitable results are diversified to avoid repetition. Stored in `userFeedback` (looks keep `outfits.feedback`) and `profiles.personalization` | Approved | 1 |
| D-116 | One shared save system | **Founder decision** (Saved Outfits Q19, Q44 – Q49). One `savedItems` collection with item types (style, outfit, design, shopping look, product, try-on look, palette), source feature, a reference to the shared record (never a copy), user-editable name and notes, customisation, a permitted snapshot, the original recommendation explanation and the inspiration source. Duplicate saves are detected by an identity key; an intentional variation is a separate item; customising a look never overwrites the original (Save as New Look, Duplicate). Named collections, many-to-many; Favourites is a flag, not a copy. Private by default; owner-only access enforced by the API | Approved | 1 |
| D-117 | Where saved palettes appear | **Conflict between two specifications.** My Colour Palette Q35 says saved palettes are accessible **only in My Colour Palette**; Saved Outfits Q2 and Q20 add a **Palettes** section to Saved Outfits. Options were (a) My Colour Palette only; (b) both views over the same saved records. **Founder decision 2026-10-18: option (a).** Saved palettes (`savedItems` with type `palette`) appear only in My Colour Palette; Saved Outfits has no Palettes tab and its lists exclude palette items | Approved | 1 |
| D-118 | Sharing | **Founder decision.** No sharing of palettes, saved items or collections in the first release (My Colour Palette Q34 overrides the "share" in Q30; Saved Outfits Q50, Q93). Copying a HEX code is not sharing and is supported | Approved | 1 |
| D-119 | Virtual Try-On, first version: 2D illustrative | **Founder decision; narrows D-48.** A 2D, illustration-based try-on: layered SVG garments on reusable, clothed 2D model illustrations (default plain white shirt and plain white pants), a small set of body-shape variants and supported skin-tone shades, programmatic recolouring, compatibility rules and fixed layer order, Undo / Reset, save to Saved Outfits as a configuration. **No photos, no camera, no external AI, no fabric physics, no 3D**; always labelled "Illustrative 2D preview — not an exact representation of fit or drape". Rendering is in the browser; the API stores only configurations. D-48 stays Pending for photo-based or generative try-on, and issue #65's serverless-GPU approach is not part of this version | Approved | 1 |
| D-120 | Admin panel | **Founder decision; revises D-73** (no admin UI) **and FR-AUTH-08** (status changed only by scripts). A protected admin area inside the existing web app (`/admin`) using `/v1/admin/*` on the existing API — never direct database access from the browser. Admin status: `users.role = admin` (D-95) plus an `adminAccounts` record with role `super_admin` or `content_admin`; one Super Admin initially (the seeded admin); Content Admin designed but not provisioned. Server-side permission checks on every route (`ADMIN_ROLE_PERMISSIONS`); least privilege — no profiles, measurements, photos or try-on images in admin screens; suspension and reactivation through the API (revokes sessions); deletion only through the existing deletion workflow; no password viewing or resets. Every administrative action goes to `adminAuditLogs` (sanitised, 1-year retention). **Reconciled with D-62:** only the Super Admin (the founder) records approval of styling content; a Content Admin edits drafts and publishes records that are already approved. Seven screens: Dashboard, Users, Fashion Catalogue, Colour Palettes, Shop Products, Try-On Monitoring, Admin Activity. Out of scope: approval hierarchies, report builders, settings consoles, schema or algorithm editing, AI controls, bulk user operations | Approved | 1 |
| D-121 | Multi-factor authentication for the Super Admin | Requested as "preferably" (Admin Q22); D-93 has no two-factor authentication in Stage 1. Decided with the email provider at HC-1 (an emailed step-up code for sensitive admin actions, or TOTP). Until then: normal login, lockout, rate limits, short admin sessions (no Remember Me for admin routes) and confirmation dialogs | Deferred | 1 (HC-1) |
| D-122 | External AI (Gemini) for full-body photo analysis | **Conflict.** Outfit Categories asks for body-shape analysis "using the Gemini API"; AI rule 16 forbids sending personal photos to an external AI provider unless a founder decision, a **privacy review** and user consent authorise that specific processing; the D-103 proposal described on-device or own-server analysis only; Shop My Look Q40 and Discover My Style Q44, Q59 say not to send personal data to external AI without approval and safeguards. Options were (a) keep on-device or own-server analysis only; (b) authorise Gemini for full-body photos only. **Founder decision 2026-10-18: option (b)** — this is the founder decision rule 16 requires, for this processing only. Gemini may analyse **full-body photos only** (never face photos, measurements, appearance signals or other personal data), through `src/integrations/ai/`, with per-use consent, a paid tier whose terms exclude training on content, no provider retention, EXIF and other metadata stripped, results reviewed and corrected by the user, and a deterministic fallback (manual choice, measurements). **Release gate:** the privacy review (D-74) is recorded and Google's current terms are checked before any real photo is sent; until then the module runs against mocks behind a disabled flag | Approved | 1 (behind release gate) |
| D-123 | Natural-language style search | **Default.** "Tops that make my legs look longer" (Outfit Categories Q54): a deterministic parser maps phrases to catalogue attributes and goals first. Optional AI interpretation (Gemini, D-12) may turn **the query text only** into structured filters, validated by Zod against the vocabulary; off by default, enabled only if the evaluation shows a benefit; any failure falls back to the parser. No profile data, photos or measurements are sent; queries are not stored or logged | Approved | 1 |
| D-124 | Shop My Look structure | **Founder decision.** Individual garments and complete looks; filters (category, occasion, budget, size, colour, style, fit), INR default, best-match sort then price; outfit assembly with per-item replacement and a total of known verified prices (partial totals labelled); category-specific sizes; budgets per outfit and per garment; temporary outfit selection kept for the session only; saved looks keep product references, variant, size and a dated price snapshot shown as historical; "Not interested" feedback and "Report an issue". **Product data:** only authorised sources (D-43 … D-45 remain Blocked); without one, the page says live shopping results are unavailable and offers styling alternatives and the user's own shortlist (D-77 = B). Commission never affects ranking (D-46) | Approved | 1 (UI) / product layer (data) |
| D-125 | Admin analytics | **Default.** Aggregates only: daily counters per feature and metric (`usageDailyStats`, no user ID), registrations from `users.createdAt`, active users from a day-granular `users.lastActiveAt`, catalogue counts, empty-result and failure counts. Groups smaller than 10 are shown as "fewer than 10". Age-group statistics only if D-104 is approved, and never per user | Approved | 1 |
| D-126 | Remembered filters | **Default.** Temporary filters live in the URL and the browser (per device), never in the profile, with Clear all; returning users see their recent filters with an easy reset (My Colour Palette Q27, Discover My Style Q24). Remembered shopping values (sizes, budget, colours) come only from what the user saved in My Profile | Approved | 1 |
| D-127 | Cross-feature hand-offs | **Founder decision** (Discover My Style Q89 – Q98; Shop My Look Q91 – Q113). Features pass **stable IDs** (style, palette, colour HEX, template, look, saved item, product) and only relevant settings through documented URL contracts, never copies of records. Precedence when inputs conflict: (1) the user's explicit choice in the current action, (2) current filters, (3) context from the originating feature, (4) saved profile preferences, (5) general recommendations. Inherited filters are visible and removable; Back returns to the originating screen with its state; actions appear only when the destination supports them. The top navigation keeps its nine sections; actions open screens or panels inside a feature, never new main tabs | Approved | 1 |
| D-128 | Try-on monitoring without try-on jobs | **Default.** The 2D try-on renders in the browser, so there are no server-side try-on jobs and no `tryOnJobs` collection. The admin Try-On Monitoring screen shows aggregate try-on usage, saves and unsupported-combination counts (D-125) and catalogue coverage (styles without layer assets or model variants). Job monitoring with a 24-hour TTL is added only if a server-side try-on is approved under D-48 | Approved | 1 |

**Pending Founder Decision:** D-48, D-76 — neither blocks Stage 1; raised at their checkpoints (§4.5). (D-102 … D-106, D-117 and D-122 were decided on 2026-10-18.)
**Deferred to a checkpoint:** D-107 photo object storage (HC-1; needed before photo upload ships), D-14 and D-15 (start of photo-analysis work), D-81 hosting and D-84 email provider (HC-1; email is now needed before the closed beta), D-121 admin MFA (HC-1), D-60 weather provider (S2.2), D-71 KPIs (before the beta ends).
**Blocked on external parties:** D-43, D-44, D-45 (product layer only), D-74 (Stage 1 public launch and the product layer).

---

## 9. Deferred and Future Work

| Item | Trigger or gate |
|---|---|
| 3D avatar, Design Studio, sketch-to-design, chatbot, tailor PDF | D-76 |
| Releasing photo analysis to users (built under D-103) | Privacy review and D-74 coverage; accuracy evaluation before confidence labels; storage deletion wired into account deletion; D-107 storage at HC-1 |
| Photo-based or generative virtual try-on (the 2D illustrative try-on is approved, D-119) | D-48 |
| Sending full-body photos to Gemini (approved, D-122) | Privacy review (D-74) recorded; paid tier with no training and no retention confirmed |
| Admin MFA | D-121 (HC-1) |
| Redis, BullMQ | A concrete need: rate-limit sharing across instances, long-running jobs |
| Additional retailers (e.g. Amazon.in, Myntra, Ajio) | Verified, authorised access |
| Saving a look with swapped alternatives | After the product layer |
| Shipping cost in totals | Reliable shipping data |
| Automated customer-photo comparison, AI review classification | Image rights and evidence access; curator tagging not scaling |
| Separately published `packages/contracts` | Only if the API must deploy from its own repository |

**Out of scope:** cart, checkout, payments, order handling, scraping, price-drop alerts, click-out tracking, live price checks on the request path, microservices, Kubernetes, a separate Python service, photorealistic avatar reconstruction, and exact body measurements without calibration.

---

## 10. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Founder content capacity paces Stage 1 and especially Stage 2 (C2: about 190–590 more hours) | C2 planned from the start (§5.2); coverage report directs effort; more contributors may draft while the founder approves; Stage 2 waits for C2 rather than shipping a smaller library |
| Generator quality or speed degrades as the library grows to 100+ | Scale test from S1.4 (T-38, AC-22); evaluation set grows with content; coverage report |
| Looks feel generic without products | Strong explanations, palettes, alternatives and search phrases; the user's own shortlist and budget totals (D-77 = B); evaluation-set review |
| Users mistake their own entries for verified data | "Not verified by StyleMe" labels on every user-entered item, price and total; no retailer names or logos derived from links; B-01, AC-B1 |
| No authorised retailer source arrives | Stage 1 doesn't depend on one; product layer stays behind its flag; no unpermitted data |
| Retailer terms restrict comparison, caching or AI use | Written confirmation before release (D-44); comparison only where permitted |
| Test data reaching users | D-78 safeguards; T-29, T-30 |
| Personal data risk before legal review | Closed beta until D-74 (D-63); data minimisation; deletion |
| AI provider cost, outage or misuse | No AI on the core path; optional wording off by default; references only |
| Judgemental styling content | Soft rules; inclusive-language check; founder review |
| Hosting free tiers sleep, restrict commercial use or lack backups (verified 2026-10-10: Vercel Hobby is for non-commercial personal use only; Render free services sleep after 15 minutes idle; Atlas free clusters have no backups — [DEPLOYMENT.md](DEPLOYMENT.md) §9.1) | Options and current costs presented to the founder at HC-1 (D-81); latency measured on the chosen plan (AC-18) |
| Estimates prove optimistic | Recalibrate after S1.4; vertical slices keep a releasable path |
| Data loss | Backups and a tested restore (D-79) |
| A restore brings back accounts deleted after the backup | Tombstones outside the restore scope, replayed and verified before users are served; maintenance mode until then (D-85) |
| Account takeover through password recovery | Admin-assisted reset only after verifying the request through a channel tied to the account; reset codes single-use, short-lived, hashed, never logged; all tokens revoked on reset (D-83) |
| Email provider not chosen when public launch is wanted | Raised at HC-2 (D-84); public launch waits for AC-24 |
| A copied session cookie stays usable after logout | Server-side session records checked on every request; logout deletes the record (D-07, T-46) |
| Account enumeration or email squatting at public sign-up | Generic responses and rate limits; invite-only during the closed beta; email verification decided at HC-2 (D-86) |
| Rate limits are per instance (in-memory, D-38) | Valid while one API instance runs; revisit at HC-1 if scaling out |

---

## 11. Definition of Done

**Per feature:** UI, API, validation, database, error handling, authorization, tests and documentation (including any D-xx changes) — not just a working UI.

**Stage 1 closed-beta release:**
- [ ] Every Stage 1 closed-beta acceptance criterion in [MVP.md](MVP.md) §5.1 and §5.2 is met and recorded (AC-20 and AC-24 are for public launch).
- [ ] Security checklist ([SECURITY.md](SECURITY.md) §11) and release checklist ([DEPLOYMENT.md](DEPLOYMENT.md) §8) complete.
- [ ] Content set C1 approved (§5.2).
- [ ] D-81 and D-84 decided at HC-1; production deployed per that decision with a working email provider (verification is required to use the beta).
- [ ] Closed beta only (D-63) until D-74 is recorded complete; the founder has been reminded to arrange the legal review.

**Stage 1 public launch — the exact blockers.** `PUBLIC_SIGNUP_ENABLED` is set to `true` only when all of these are recorded:
1. D-74 legal review recorded complete in §8, in the way that entry describes, with every required change done (AC-20).
2. D-84 decided (now at HC-1), self-service email reset and email verification live in production, and AC-24 passing there.
3. Google sign-in either configured in production (D-88) or its buttons still showing "not available yet".
4. Every closed-beta criterion still passing on the production release (MVP.md §5.1, §5.2).

The founder records items 1–3 in the register and the implementer records the AC-20, AC-24 and regression results in the release checklist ([DEPLOYMENT.md](DEPLOYMENT.md) §8). Nothing else in these documents can be read as legal approval.

**Stage 2 release:** content set C2 complete and approved (AC-C1 … AC-C3); weather only if D-60 is decided (AC-W1 … AC-W3).

**Product layer release:** AC-P1 … AC-P9 met; permissions recorded; D-74 and D-46 complete.
