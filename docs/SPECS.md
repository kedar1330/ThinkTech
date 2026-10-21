# StyleMe — Technical Specifications

> The technical specification of StyleMe as built and as planned: stack, conventions, modules, data, the styling knowledge base and engine, security, testing, deployment, technical acceptance criteria, traceability and open technical decisions. It **references** the canonical documents instead of repeating them:
>
> | Topic | Canonical document |
> |---|---|
> | Endpoints, envelopes, codes | [API.md](API.md) |
> | Collections, fields, indexes, retention | [DATABASE.md](DATABASE.md) |
> | Components, request flow, folders | [ARCHITECTURE.md](ARCHITECTURE.md) |
> | Non-functional requirements (NFR-xx) | [SRS.md](SRS.md) |
> | Functional requirements (FR-xx) | [FRD.md](FRD.md) |
> | Engine and AI rules | [AI.md](AI.md) |
> | Security and privacy | [SECURITY.md](SECURITY.md) |
> | Tests (T-xx) and acceptance (AC-xx) | [TESTING.md](TESTING.md), [MVP.md](MVP.md) |
> | Environments and operations | [DEPLOYMENT.md](DEPLOYMENT.md) |
> | Decisions (D-xx) | [ImplementationPlan.md](ImplementationPlan.md) §8 |
> | Screens and design system | [UI_DESIGN.md](UI_DESIGN.md) |
> | Tasks | [TODO.md](TODO.md) |
>
> **Verified 2026-10-18** against `main` at `5b65b5c` (and branch `feature/styling-foundation` at `c5e1621` where stated). Every "Implemented" row below was checked in the source; "Planned" means a contract or document exists but no running code.

**Implementation status labels:** **Implemented** (code on `main`, with tests) · **Partial** (some parts implemented; the rest listed) · **Contract only** (Zod schema in `packages/contracts`, no endpoint or model) · **Planned** (specified, not started) · **Proposed** (in an open issue awaiting approval) · **Deferred / Blocked** (waits for a named decision) · **Undecided** (no decision exists).

---

## 1. Technology stack (verified versions)

Versions are the ranges declared in each `package.json` on 2026-10-18. Exact resolved versions live in `pnpm-lock.yaml` (not reproduced here). Changing a version is a dependency change ([CONTRIBUTING.md](CONTRIBUTING.md) §12).

| Area | Technology | Declared version | Where |
|---|---|---|---|
| Runtime | Node.js | `>=24` (`engines`), `24` (`.nvmrc`) | root |
| Package manager | pnpm workspaces | `pnpm@10.34.6` (`packageManager`) | root, `pnpm-workspace.yaml` |
| Language | TypeScript | `5.9.3` (pinned) | all packages |
| Web framework | Next.js (App Router, Turbopack dev) | `16.4.0` (pinned) | `apps/web` |
| UI library | React, React DOM | `19.3.0` (pinned) | `apps/web` |
| Styling | Tailwind CSS (PostCSS plugin) | `^4.3.3` | `apps/web` |
| UI primitives | `@radix-ui/react-slot` `^1.4.0`, `@radix-ui/react-label` `^2.1.16`, `class-variance-authority` `^0.7.1`, `clsx`, `tailwind-merge` `^3.7.0` (shadcn/ui-style kit, `components.json`) | — | `apps/web/components/ui` |
| Icons | `lucide-react` | `^1.55.0` | `apps/web` |
| Fonts | Inter and Playfair Display, bundled with `next/font/local` (SIL OFL) | — | `apps/web/app/fonts` |
| API framework | Express | `^5.3.0` | `apps/api` |
| Database | MongoDB via Mongoose | `^9.11.1` | `apps/api` |
| Validation | Zod | `^4.6.5` | all packages |
| Security middleware | `helmet` `^8.3.0`, `cors` `^2.8.6`, `express-rate-limit` `^8.7.1` | — | `apps/api` |
| Auth crypto | `argon2` `^0.45.1` (argon2id), `jsonwebtoken` `^9.0.3` (HS256 access tokens), `jose` `^6.2.12` (Google ID-token verification) | — | `apps/api` |
| Email | `nodemailer` `^10.1.0` (SMTP boundary) | — | `apps/api/src/services/messaging.ts` |
| Logging | `pino` `^10.4.0`, `pino-http` `^11.0.0` | — | `apps/api/src/logger.ts`, `app.ts` |
| API build / dev | `tsup` `^8.5.1`, `tsx` `^4.23.15` | — | `apps/api` |
| Tests | Vitest `^5.0.3`; Supertest `^7.3.1`; `mongodb-memory-server` `^11.3.0`; Testing Library (React `^16.3.3`, DOM, user-event, jest-dom); jsdom `~30.1.1` | — | each package |
| Lint / format | ESLint `^10.12.0` + `typescript-eslint` `^8.71.1`, `@next/eslint-plugin-next` `16.4.0`, `eslint-plugin-react-hooks`; Prettier `^3.9.10` (single quotes, width 120, trailing commas) | — | root |
| CI | GitHub Actions | — | `.github/workflows/ci.yml` |
| Container | Docker (API image only); Docker Compose runs the API against local MongoDB | — | `apps/api/Dockerfile`, `docker-compose.yml` |
| Hosting definition | `render.yaml` (updated at HC-1: free tier, staging and production defined, D-81) | — | root |

**Not installed** (listed in planning documents only): Zustand, Gemini/any AI SDK, Cloudinary, MediaPipe, Three.js, PDFKit, Redis, BullMQ, any weather or retailer client. Their folders (`apps/api/src/integrations/*`, `apps/web/app/{analyze,avatar,chat,design,outfits,products,tailor,tryon}`, `apps/web/stores`) contain only `.gitkeep`.

## 2. Runtime requirements

| Requirement | Value | Source |
|---|---|---|
| Local database | MongoDB at `mongodb://127.0.0.1:27017` (tests use `mongodb-memory-server`) | [README.md](../README.md#prerequisites) |
| API config | `apps/api/.env`, parsed by Zod in `apps/api/src/config/env.ts`; invalid config stops the process and reports **names only** | `env.ts` |
| Web config | `apps/web/.env.local`; `BFF_SHARED_SECRET` identical in both files | [README.md](../README.md#local-setup) |
| Required API variables | `APP_ENV` (`local`/`staging`/`production`), `MONGODB_URI`, `TOMBSTONE_STORE_URI`, `TOMBSTONE_HMAC_KEY` (≥ 32), `AUTH_ACCESS_TOKEN_SECRET` (≥ 32), `BFF_SHARED_SECRET` (≥ 32), `WEB_ORIGIN` | `env.ts` |
| Optional API variables | `PORT` (4000), `PUBLIC_SIGNUP_ENABLED` (**default `true`**), `MAINTENANCE_MODE`, `SMTP_URL`, `EMAIL_FROM`, `SMS_PROVIDER` (`none` only), `DEV_OUTBOX_DIR`, `DEV_ECHO_MESSAGES` (local only), `GOOGLE_CLIENT_ID` | `env.ts` |
| Email | Without `SMTP_URL`: local writes to `.dev-outbox/`; staging and production refuse to start | `env.ts`, D-84 |
| Startup gate | The API validates, lints and indexes the style knowledge base before listening; **any lint issue (including `NOT_APPROVED` drafts) stops startup** (`api_start_failed`) | `apps/api/src/server.ts`, `style-rules/loader.ts` |

Ports: web `3000`, API `4000`. The API exposes `/health` and `/v1/*` only.

## 3. Conventions

### 3.1 Repository and code

* **Contracts first.** Every request and response shape is a Zod schema in `packages/contracts/src/<area>.ts`, exported from `index.ts`, and used by both apps. Apps never re-declare a schema (CLAUDE.md). *Known exception:* ID regexes and `slotIdSchema` exist in both `contracts/src/common.ts` and `api/src/style-rules/schemas.ts` ([TODO.md](TODO.md) TD-DOC-05).
* **Vocabulary IDs are stable**: never renamed or removed; values are stored as strings so additions need no migration (`style-vocabulary.ts` header).
* **TypeScript everywhere**, ESM (`"type": "module"`), strict Prettier formatting, Conventional Commits, one issue → one branch → one PR ([CONTRIBUTING.md](CONTRIBUTING.md) §10–§11).

### 3.2 Backend (`apps/api`)

| Rule | Detail |
|---|---|
| Pipeline | route → `authenticate` / `requirePasswordSet` → `validateBody(schema)` → controller (HTTP only) → service (logic) → model or `src/integrations/*` → envelope via `utils/respond.ts` |
| Wiring | Routes are mounted in `createApp()` (`src/app.ts`); dependencies arrive through `AppDeps` (`config`, `db`, `logger`, `emailSender`, optional `smsSender`, `googleVerifier`) so tests inject fakes |
| Envelope | `{ success: true, data, warnings? }` / `{ success: false, error: { code, message, retryAfterSeconds? } }`; codes in `ERROR_CODES` / `WARNING_CODES` (`contracts/src/envelope.ts`); details in [API.md](API.md) §1.1, §4 |
| Body size | `express.json({ limit: '16kb' })` |
| Request logging | method, path without query string, status and a generated `x-request-id`; never headers or bodies (D-17) |
| Maintenance | `MAINTENANCE_MODE=true` → every `/v1` route returns `503 SERVICE_UNAVAILABLE`; `/health` reports `maintenance` |
| Patterns to copy | `routes/appearance.routes.ts`, `controllers/appearance.controller.ts`, `services/appearance.service.ts`, `tests/api/appearance.test.ts` |

### 3.3 Frontend (`apps/web`)

| Rule | Detail |
|---|---|
| BFF only | The browser never calls the API. Server components, server actions and route handlers call `apiRequest()` in `lib/api/server.ts`, which sends `BFF_SHARED_SECRET` and the user's Bearer token |
| Session | First-party `HttpOnly` cookie set by the Next.js server (D-06); helpers in `lib/auth/session.ts` (`requireUser`, `requireOnboarded`, `requireStep`, `pathForStep`) |
| Server actions | State-changing actions call `isAllowedOrigin(...)` first (pattern: `app/actions/appearance.ts`) |
| Feature switch | `lib/features.ts`: a section with no `href` is "Coming soon" and renders `/features/[slug]`; setting `href` turns it on |
| Next.js 16 | Breaking changes vs. earlier versions; read `apps/web/AGENTS.md` and `node_modules/next/dist/docs/` before writing web code |
| Security headers | `next.config.ts`: `nosniff`, `Permissions-Policy` (camera, mic, geolocation off), `X-Frame-Options: DENY`, `strict-origin-when-cross-origin`; token pages get `no-referrer` and `no-store` |
| Design system | Tokens and components: [UI_DESIGN.md](UI_DESIGN.md) |

## 4. Module specifications

| # | Module | Status | Code | API | Data | Requirements | Owner |
|---|---|---|---|---|---|---|---|
| M-01 | Accounts and authentication | **Implemented** | `services/auth.service.ts`, `account.service.ts`, `challenges.ts`, `passwords.ts`, `sessions.ts`, `google.ts`, `messaging.ts`; `app/(auth)/**`, `components/auth/**` | [API.md](API.md) §3.1 (`/v1/auth/*`, `/v1/account/*`) | `users`, `pendingRegistrations`, `authChallenges`, `sessions`, `betaInvites` | FR-AUTH-01 … 19, D-83, D-86 … D-93, D-95 | Kedar |
| M-02 | Onboarding and profile completeness | **Implemented** | `services/onboarding.service.ts`; `app/onboarding/**`; `contracts/src/profile-completeness.ts` | `/v1/onboarding*` | `users.onboarding` | FR-ONB-01 … 03, 05; D-94 | Kedar |
| M-03 | Style profile | **Implemented** (except `preferredWearTypes`, which [API.md](API.md) and [DATABASE.md](DATABASE.md) specify but the contract does not yet accept — #63) | `services/profile.service.ts`; `/profile`; `components/profile/ProfileForm.tsx` | `GET/PUT /v1/profile` | `profiles` | FR-PROF-01 … 06, FR-SIZE-01 … 04 | Contract Shreya; UI Kedar |
| M-04 | Self-reported appearance signals | **Implemented** | `services/appearance.service.ts`; `AppearanceForm.tsx` | `GET/PUT /v1/appearance` | `appearanceProfiles` | FR-SIG-01 … 07 | Shreya |
| M-05 | Settings, account deletion, tombstones | **Implemented** | `services/account-deletion.ts`, `scripts/reconcile-tombstones.ts`; `/settings` | `DELETE /v1/account`, `/v1/account/*` | `deletionTombstones` (separate store) | D-85, D-94 | Kedar |
| M-06 | App shell and navigation | **Implemented** | `components/app/{AppShell,TopNav}.tsx`, `lib/features.ts` | — | — | FR-UI-01 … 04 | Kedar |
| M-07 | Style vocabulary | **Partial** — 8 occasions, 8 styles, 3 wear types, 6 slot types, 7 size groups, 11 categories (10 Stage 1 + dress Stage 2), 63 colours, 22 fabrics, 9 silhouettes, 3 fits, 8 necklines, 17 patterns (incl. 5 Indian techniques, D-99), coverage lists, Monk 1–10, 6 proportion descriptors. **Missing (D-97, D-98, #63 Part 1):** formality, 8 broad categories with garment types | `contracts/src/style-vocabulary.ts` | — | — | D-09, D-96 … D-101 | Shreya |
| M-08 | Style knowledge base tooling | **Implemented** (schemas, loader, linter, coverage, scale test) | `apps/api/src/style-rules/*`, `scripts/style-rules.ts` | — | Repository JSON, not MongoDB | FR-STY-01 … 12 | Shreya |
| M-09 | Styling content | **Partial** — C0 (8 palettes, 8 templates, 8 styling rules, 6 fabric rules) founder-approved by Shreya Sharma on 2026-10-19 (version 2), in the working tree (PR pending). C1 not started | `style-rules/data/*.json` | — | — | D-57, D-62 | Shreya (founder approves) |
| M-10 | Look engine and recommendations | **Implemented (#33, not yet merged)**; verified on fixtures and on approved C0. AI wording (#55) built, off by default (PR pending) | `contracts/src/outfit.ts`; `services/engine/*`, `services/recommendations.service.ts` | `POST /v1/recommendations` | `outfits` | FR-LOOK-01 … 15, -17 … -19 | Shreya (#33) |
| M-11 | Palettes | **Ranking and endpoint implemented (#33, not yet merged)**; UI not built | `contracts/src/palette.ts`; `services/engine/palettes.ts`, `services/palette.service.ts` | `GET /v1/style/palettes` | — | FR-PAL-01 … 03 | Shreya (ranking), Ankita (UI #39, #40) |
| M-12 | Saved looks and feedback | **Implemented (#41, #42)** | `outfit.ts` (`outfitDetailSchema`, `outfitFeedbackRequestSchema`, `FEEDBACK_REASONS`) | `/v1/outfits*` | `outfits` | FR-OUT-01 … 07 | Ankita (#41, #42) |
| M-13 | Shortlist and budget engine | **Contract only** | `contracts/src/product.ts` (`createShortlistItemRequestSchema`, `userShortlistItemSchema`, `userPriceSummarySchema`, `SHORTLIST_LIMITS`, `USER_ENTERED_LABELS`) | `/v1/shortlist*` (planned) | `shortlistItems` (planned; already in `USER_OWNED_COLLECTIONS`) | FR-LIST-01 … 07, FR-BUD-01 … 07, D-77, D-80, D-82 | Kedar (#37, #38, #43) |
| M-14 | Outfit Categories gallery | **Specified** (FRD §4.19, D-109 … D-114); not built | — | [API.md](API.md) §3.11 F1 – F7 | shared catalogue ([DATABASE.md](DATABASE.md) §4a) | FR-OCAT-01 … 26 | Johita |
| M-15 | Optional AI wording | **Implemented, off by default (#55, PR pending)**; enabling is a separate step (D-67) | `integrations/ai/wording-client.ts`, `integrations/ai/prompts/v1.ts`, `services/wording.service.ts` | Inside `POST /v1/recommendations` | `outfits.aiModel`, `outfits.aiPromptVersion`, `aiCache` (7-day TTL) | FR-LOOK-16, D-12, D-67 | Shreya |
| M-16 | Product layer (retailers, products, matching, quality) | **Blocked** (D-43 … D-46, D-74) | — | [API.md](API.md) §3.7 | `retailers`, `products`, `reviewEvidence` | FR-PROD, FR-MATCH, FR-QUAL | Kedar |
| M-17 | Weather | **Deferred** (Stage 2, D-60) | — | [API.md](API.md) §3.8 | — | FR-WX-01 … 09 | Shreya |
| M-18 | Design Studio, Style Assistant, photo analysis, avatar, tailor PDF | **Deferred** (D-76) | Empty folders; `contracts/src/design.ts`, `chat.ts` intentionally empty and not exported | [API.md](API.md) §3.9 | `designs`, `chatMessages` | FRD §4.16 | Kedar (Design Studio), Shreya (Assistant) |
| M-19 | Virtual Try-On | **2D illustrative version specified and approved (D-119), not built.** Photo-based or generative try-on: deferred (D-48; #58, #65) | `integrations/tryon/` (empty); SVG canvas in the web app (planned) | [API.md](API.md) §3.11 F7; §3.9 for photo-based | Configurations in `savedItems`; layers in `illustrations` | FR-VTO-01 … 15; FRD §4.16, AI rule 16 | Kedar |
| M-20 | My Profile extensions: sections, measurements, age group, face and body photo analysis, consent, retention, export | **Approved 2026-10-18 (D-102 … D-105), not built** — dormant schema only: contracts `my-profile.ts`, `photos.ts`; optional `profiles` fields; `appearanceProfiles.photoConsent`/`photoRetention`; `userPhotos`, `appearanceAnalyses` models (in `USER_OWNED_COLLECTIONS`). No endpoint, service or UI | `packages/contracts/src/{my-profile,photos}.ts`, `apps/api/src/models/index.ts` | [API.md](API.md) §3.9a (P1–P10, #27, #28) | [DATABASE.md](DATABASE.md) §3.2, §3.7, §3.8 | FR-MYP-01 … 19 | Shreya (data, contracts); UI owner to confirm |
| M-21 | Home dashboard redesign: two-row nav, search, notifications, carousel, recent activity, themes | **Approved 2026-10-18 (D-106)** — nothing built | — | [API.md](API.md) §3.9a (P11–P13) | `notifications`, `userActivity` (not created) | FR-HOME-01 … 18 | Kedar |
| M-22 | Shared styling catalogue in MongoDB: hierarchy, attribute values, clothing styles, knowledge-base records, illustrations with rights; suitability engine | **Specified (D-110 … D-114); models and contracts declared, unused** | `apps/api/src/models/catalogue.ts`; `packages/contracts/src/catalogue.ts` | [API.md](API.md) §3.11 F1 – F7 | [DATABASE.md](DATABASE.md) §4a | FR-OCAT-01 … 07, FR-DMS-04 … 05 | Shreya |
| M-23 | Discover My Style (as specified) | **Specified (D-109)**; not built | — | §3.11 F1 – F6, F12 – F23 | catalogue, `savedItems`, `userFeedback` | FR-DMS-01 … 17 | Johita |
| M-24 | My Colour Palette (full): saving, custom palettes, filters, detail, feedback | **Specified (D-109)**; models declared | `models/user-collections.ts` (`customPalettes`) | §3.11 F8 – F11 | `palettes`, `customPalettes`, `savedItems` | FR-PAL-04 … 30 | Ankita (UI), Shreya (ranking) |
| M-25 | Saved Outfits: one save system, collections, feedback, personalisation controls | **Specified (D-115, D-116)**; models declared | `models/user-collections.ts`; `contracts/src/saved-items.ts` | §3.11 F12 – F23 | `savedItems`, `savedCollections`, `userFeedback` | FR-SAVE-01 … 18 | Ankita |
| M-26 | Shop My Look (full): inherited context, outfit assembly, totals, reports | **Specified (D-124)**; UI not built; product data blocked (M-16) | — | §3.11 F24 – F27; §3.7 | `products` additions, `productReports`, `productImportRuns` (not created) | FR-SHOP-01 … 18 | Kedar |
| M-27 | Admin Panel: RBAC, dashboard, catalogue and palette editors, users, products, try-on monitoring, audit | **Specified (D-120, D-121, D-125, D-128)**; models and permission matrix declared | `models/user-collections.ts` (`adminAccounts`, `adminAuditLogs`), `models/catalogue.ts` (`usageDailyStats`); `contracts/src/admin.ts` | §3.11 F28 – F44 | [DATABASE.md](DATABASE.md) §4b | FR-ADM-01 … 12 | to confirm |
| M-28 | Cross-feature hand-offs and navigation | **Specified (D-127)** | — | URL contracts per feature | — | FR-CONN-01 … 09 | each feature owner |

## 5. APIs

The full endpoint list, request and response shapes, and error codes are in [API.md](API.md). Summary of implementation state on `main`:

| Group | Endpoints | State |
|---|---|---|
| Auth, account, onboarding | 29 routes under `/v1/auth`, `/v1/account`, `/v1/onboarding` (`apps/api/src/routes/auth.routes.ts`) | Implemented |
| Profile, appearance | `GET/PUT /v1/profile`, `GET/PUT /v1/appearance` | Implemented |
| Health | `GET /health` | Implemented |
| Palettes, recommendations, outfits, shortlist | [API.md](API.md) §3.4–§3.6 | Contract only (Zod schemas merged in #31) |
| Products, weather, deferred, future | [API.md](API.md) §3.7–§3.9 | Gated; no contract |
| Feature specifications: catalogue, palettes, saved items, feedback, shop, try-on, admin | [API.md](API.md) §3.11 (F1 – F44) | Specified; enums in `contracts/src/{catalogue,saved-items,admin}.ts`; no route |

Rate limits (D-38) are in-memory per API instance (`middleware/rate-limit.ts`); only the auth limits exist today.

## 6. Database models

Collections, fields, indexes and retention are specified in [DATABASE.md](DATABASE.md). Models registered in `apps/api/src/models/index.ts` today: `users`, `betaInvites`, `pendingRegistrations`, `authChallenges`, `sessions`, `appearanceProfiles`, `profiles`, `outfits` (#33; TTL on `expiresAt`) (main database) and `deletionTombstones` (separate tombstone connection). `migrations` is written by `scripts/migrate.ts` (one migration: `001-auth-onboarding`).

Also declared but unused (approved D-102 … D-104, not built yet): `userPhotos` and `appearanceAnalyses`, and optional My Profile fields on `profiles` and `appearanceProfiles` with `default: undefined` — existing documents are unchanged, so no migration is needed.

Also declared but unused (specified 2026-10-18, D-110 … D-125): shared catalogue models `catalogueCategories`, `garmentAttributes`, `clothingStyles`, `palettes`, `outfitTemplates`, `stylingRules`, `fabricRules`, `illustrations`, `usageDailyStats` (`models/catalogue.ts`, with database-level guards: styling content can't be published without founder approval, assets not without verified rights) and user/admin models `savedItems`, `savedCollections`, `customPalettes`, `userFeedback`, `adminAccounts`, `adminAuditLogs` (`models/user-collections.ts`); optional `users.lastActiveAt`, `users.suspension`, `profiles.stylingGoals`, `preferredStyleIds`, `avoidedStyleIds`, `personalization`. Tests: `apps/api/tests/api/catalogue-models.test.ts`.

`USER_OWNED_COLLECTIONS` (account deletion and tombstone replay) already lists the planned `outfits` and `shortlistItems`, the proposed `userPhotos` and `appearanceAnalyses`, the specified `savedItems`, `savedCollections`, `customPalettes`, `userFeedback`, `productReports` and `adminAccounts`, plus legacy `passwordResetTokens`. Photo files in object storage are not covered by this list: an upload endpoint must not ship until account deletion also deletes the stored objects. Any **new** user-owned collection — e.g. a feedback collection from #42 — must be added in the same PR (CLAUDE.md).

## 7. Styling knowledge base

| Aspect | Specification | Status |
|---|---|---|
| Storage | Versioned JSON in `apps/api/src/style-rules/data/` (`palettes.json`, `templates.json`, `styling-rules.json`, `fabric-rules.json`); not MongoDB (D-66) | Implemented |
| Record IDs | `PAL-nnn`, `OUT-nnn`, `STY-nnn`, `FAB-nnn` | Implemented |
| Common fields | `id`, `version`, `reviewStatus` (`draft` / `reviewed` / `approved` / `retired`), `reviewedBy` and `reviewedAt` (required when approved), `rationale`, `limitations`, `tags` (kebab-case, ≤ 20), `userAdjustable[]`, `isFixture` (test records only) | Implemented (`schemas.ts`) |
| Palette | `name`, `undertoneAffinity[]`, optional `skinToneRange` (Monk `a-b`), `neutrals[]`, `accents[]`, `combinations[]` (2–4 colours + contrast level), `prints[]`, `occasions[]` | Implemented |
| Template | `name`, `department`, `occasions[]`, `styles[]`, 2–8 `slots` (`slotId`, `slot`, `categoryOptions[]`, `optional`, `colorRole`, `constraints`), `compatiblePalettes[]`, `ruleRefs[]` | Implemented. **`wearType` (required by D-96) and slot `garmentType`/`formality` (D-97, D-98) not yet in the schema** |
| Styling rule types | silhouette, fit, neckline, sleeve, length, layering, proportion, print-scale, combination, coordination, occasion, preference, size, budget, alternatives | Implemented |
| Linter codes | `INVALID_SCHEMA`, `DUPLICATE_ID`, `DUPLICATE_RECORD`, `DUPLICATE_SLOT_ID`, `UNKNOWN_REFERENCE`, `CATEGORY_MISMATCH`, `CONTRADICTION`, `JUDGEMENTAL_LANGUAGE`, `NOT_APPROVED`, `FIXTURE_RECORD` | Implemented |
| Runtime | Only approved, lint-clean records load; any issue stops API startup | Implemented |
| Coverage report | `pnpm --filter @styleme/api style-rules coverage` (FR-STY-11); D-100 dimensions (per category, garment type, wear type × department) not yet added | Partial |
| Scale | Designed for ≥ 150 palettes and ≥ 150 templates without code changes; scale test T-38 on a synthetic fixture library | Implemented (test) |
| Content sets | C0 (≥ 6 + ≥ 6, temporary), C1 (12–20 palettes, ~20 templates; Stage 1 release), C2 (≥ 100 + ≥ 100; Stage 2 release) (D-57) | C0 approved 2026-10-19 (PR pending); C1, C2 not started |
| Approval | Founder only (D-62); checklist in [CONTRIBUTING.md](CONTRIBUTING.md) §6 | — |

**The knowledge base is not complete.** It holds the approved C0 seed (30 records); C1 and C2 are not started, and the coverage report shows 89 empty and 54 thin cells.

## 8. Deterministic recommendation engine

Specified in [AI.md](AI.md) §3 and [FRD.md](FRD.md) FR-LOOK; **implemented in #33 (not yet merged) and verified on fixtures and on the approved C0 library** — see "Implementation" below. The contract is fixed in `packages/contracts/src/outfit.ts`:

* **Request** `recommendationRequestSchema`: `occasion` (required), `style?`, `wearType?` (1–3 unique; a hard filter for that request, D-96), `paletteMode` (`suggested` default / `explore`). Strict: unknown fields rejected; no budget or product fields in Stage 1.
* **Pipeline (specified):** templates → palettes → rules → look specifications → diversity check; precedence hard constraints > explicit preferences > rules > signals (FR-LOOK-08, D-19); weighted sum of approved rule effects, weights tuned on the evaluation set; affiliate status never an input.
* **Response** `recommendationResponseSchema`: `recommendationId`, ≤ 5 `looks` (`MAX_LOOKS`), `defaultsApplied[]`, `conflicts[]`, optional `limitedBy`. Fewer looks is a success; never padded (`INSUFFICIENT_MATCHES`).
* **Look**: `templateId`, `paletteId`, unique `slotId`s, swatches, `searchPhrase`, `sizeNote`, `alternatives[]`, `explanation`, `explanationRefs` (rule IDs and attributes), `combinationSignature`, `aiModel` (`null` unless AI wording ran).
* **Persistence (specified):** each look is an `outfits` document, `status: suggested` with a 7-day expiry; saving removes the expiry (D-23).
* **Missing-data behaviour:** without a department, results are general and labelled "no department filter applied" (`departmentScope()`); signals are used only when `useInRecommendations` is on; measurements and photos are not inputs to the current engine; once My Profile is built (D-102, D-103) user-entered measurements and confirmed photo results become inputs, and size recommendations still wait for size charts (FR-SIZE-06).
* **Performance target:** p95 < 2 s without AI on the production plan — **proposed, not measured** (D-68).

**Implementation (#33).** `apps/api/src/services/engine/` holds pure functions (no I/O, clock, randomness or AI); `recommendations.service.ts` and `palette.service.ts` load the profile and, only while `useInRecommendations` is on, the signals, then call it.

| Step | File | Behaviour |
|---|---|---|
| Library | `library.ts` | The engine reads records only through the `StyleLibrary` interface (D-110); `style-rules/loader.ts` implements it today, the MongoDB catalogue later (TD-FS-CAT-02). `contentVersion` hashes every record's `id@version` |
| Inputs | `preferences.ts` | Resolves hard constraints, preferences, signals, `defaultsApplied` and `conflicts` (a colour both liked and disliked is disliked; a fabric both liked and avoided is avoided) |
| filterTemplates | `generate.ts` | Occasion, style, department (`departmentScope()`; categories outside the department are dropped per slot) and the request's `wearType` |
| fillSlots | `slots.ts` | Colours from the palette's role colours (explore: any non-disliked vocabulary colour), built around each usable palette combination; fabric, silhouette, fit, neckline, sleeve, length and pattern from slot constraints, preferences and rules; minimum sleeve and garment length are hard filters |
| applyRules, rank | `rules.ts`, `score.ts`, `generate.ts` | Slot attributes (category, slot type, colour, colour family, fabric, silhouette, fit, neckline, sleeve, length, pattern) are scored per slot; a look's palette-combination `contrast` is scored once per look (added 2026-10-19 so contrast rules such as STY-007 and STY-008 take effect; `necklineDepth` and `patternScale` are not evaluated yet). Scores are compared **tier by tier** — preferences, then rules (rule weights plus palette coordination), then signals (rules scoped to body proportions, undertone and skin-tone affinity) — so a lower tier never overrides a higher one (FR-LOOK-08). Within a tier, D-19's weighted sum applies. Ties break on template, palette and combination IDs |
| signature, select | `generate.ts` | Combination signature over template, palette and each slot's category, colour, fabric, silhouette and pattern; duplicates dropped; best look per template first, then per template and palette, then the rest; at most 5 |
| explain | `explain.ts` | Sentences only from `explanationRefs`: template, palette, occasion, matched preferences and signals, up to 3 supporting rule rationales, and conflicts; each sentence passes the inclusive-language check or is dropped |
| alternatives, phrases | `slots.ts`, `text.ts` | Up to 5 per slot, each differing in one of colour, category option, fabric or silhouette and meeting the same hard constraints; search phrases and size notes from vocabulary labels only |
| Palettes | `palettes.ts` | `view=all` by ID; `view=suggested` without palettes containing a disliked colour, ordered by tone affinity, liked colours, contrast and occasions (AI.md §10.2) |

**Known limits (defaults chosen for #33).** Template `wearType` is read from the C0 `wear-*` tags until #63 adds the field (`templateWearType()` is the only place to change). There is no neckline-to-coverage mapping in the vocabulary, so with a neckline minimum no neckline is stated. Comfort preferences and profile `preferredWearTypes` (not in the profile contract yet) are not ranking inputs. Look feedback (D-115) will be a fourth, lowest tier (#42). No rate limit on the endpoint yet.

## 9. Authentication, security and privacy

Specified in [SECURITY.md](SECURITY.md); summary of what the code enforces:

| Control | Implementation |
|---|---|
| Passwords | argon2id (D-04); policy: ≥ 8 chars with upper, lower, digit, special (D-87) |
| Tokens and sessions | HS256 JWT with `tokenVersion`, session ID and Remember Me flag; server-side `sessions` record checked on every request; 30 days with Remember Me, else 24 h (D-05, D-07, D-91) |
| Codes and links | 6-digit codes (5 min) and links (15–30 min), stored hashed, single-use; 3 wrong codes lock for 30 min; 30 s resend cooldown, 6 sends/hour (D-89) |
| Login lockout | 3 wrong passwords → 30 min (D-90) |
| Google | Authorization code + PKCE, `state`, `nonce`; API verifies signature, issuer, audience, nonce, `email_verified` (D-88) |
| Authorization | Every `/v1` request scoped to the authenticated user; other users' records return `NOT_FOUND` |
| Transport and headers | `helmet`, CORS to `WEB_ORIGIN` only, BFF shared secret, Next.js security headers (§3.3) |
| Logging | No bodies, passwords, codes, tokens, signals, photos or image URLs; tests T-57 and `appearance-log-privacy.test.ts` |
| Privacy | Signals optional, self-reported, switchable and clearable; no photos collected; deletion immediate with tombstones (D-85) |
| AI rule 16 | Personal photos, measurements and appearance signals are never sent to an external AI provider. Sole exception: full-body photos to Gemini under D-122, after the privacy review |
| **Resolved conflict** | D-63 resolved 2026-10-21: Open Public Beta (`PUBLIC_SIGNUP_ENABLED=true` default; email verification code required); invite gating available via `false` |

## 10. Integrations

| Integration | State | Boundary |
|---|---|---|
| SMTP email | Implemented boundary; provider decided at HC-1 (Resend/Brevo free tier, D-84) | `services/messaging.ts` (`SMTP_URL`, dev outbox) |
| SMS | Boundary only; no provider (`SMS_PROVIDER=none`, D-92) | `services/messaging.ts` |
| Google sign-in | Implemented (optional, `GOOGLE_CLIENT_ID`) | `services/google.ts`, `app/api/oauth/google/*` |
| AI provider | Gemini `generateContent` client for optional wording, off by default (#55); no SDK, `fetch` only | `integrations/ai/` |
| Retailers | Blocked (D-43 … D-45) | `integrations/retailers/` (not created) |
| Weather | Deferred (D-60) | `integrations/weather/` (not created) |
| Cloudinary, MediaPipe, PDF, try-on | Deferred / future | empty placeholder folders |

## 11. Testing

Strategy and scenario IDs: [TESTING.md](TESTING.md). Suite state verified on 2026-10-18 on `feature/styling-foundation` (`c5e1621`):

| Suite | Files | Tests | Result |
|---|---|---|---|
| `packages/contracts` | 4 | 91 | All pass |
| `apps/api` (unit + API on in-memory MongoDB) | 15 | 133 | 132 pass; **1 fails by design**: "the shipped library in src/style-rules/data is linter-clean", because the C0 records are `draft` |
| `apps/web` (Vitest + Testing Library, jsdom) | 8 | 58 | All pass |
| `pnpm typecheck`, `pnpm lint` | — | — | Pass |
| `pnpm format:check` | — | — | Fails on a Windows checkout with `core.autocrlf=true` (CRLF only); `prettier --check --end-of-line auto .` passes ([TODO.md](TODO.md) TD-DOC-06) |
| Playwright E2E (`e2e/`) | 2 | 5 × 2 viewports | Added by #36: auth smoke flow and browser-level T-47/T-48 ([TESTING.md](TESTING.md) §7) |
| Evaluation set | — | — | Not set up (#54) |

With C0 approved (2026-10-19) the shipped library is linter-clean, so that test passes everywhere.

**Update 2026-10-18 (#33 branch, on top of `main` 6e663d8):** contracts 6 files / 112 tests, `apps/api` 20 files / 209 tests (new `unit/engine.test.ts` 43, `api/recommendations.test.ts` 13; 2026-10-19 after C0 approval: `unit/engine.test.ts` 50 incl. AC5, 218 API tests, none skipped), `apps/web` 8 / 58 — all pass; typecheck, lint and build pass.

**Update (local working tree, after adding the dormant My Profile schema):** contracts 5 files / 103 tests, all pass (new `my-profile.test.ts`); `apps/api/tests/api/profile.test.ts` gained 2 tests (proposed fields stay rejected and hidden; account deletion removes `userPhotos` and `appearanceAnalyses`).

## 12. Deployment

Specified in [DEPLOYMENT.md](DEPLOYMENT.md). **Nothing is deployed.** Hosting accounts, plans and costs wait for HC-1 (D-81, #60). CI (`ci.yml`) runs install (frozen lockfile), typecheck, lint, format check, `style-rules lint`, coverage report (to the job summary), tests, build and a Docker image build (not pushed). An open proposal for a free demo deployment (#66) conflicts with D-75 and is undecided.

## 13. Quality standards

* Definition of Done: UI, API, validation, database, error handling, authorization, tests and documentation ([CONTRIBUTING.md](CONTRIBUTING.md) §3).
* Coverage: no global gate; ≥ 80 % line coverage for the generator, rule loader and budget engine (D-70).
* Accessibility: keyboard operable, visible focus, labelled controls, WCAG AA text contrast, 44 px touch targets, reduced-motion support ([UI_DESIGN.md](UI_DESIGN.md) §8; NFR-USE).
* Data honesty: never fabricate products, prices, ratings, reviews, availability or confidence (FR-DATA); fixtures synthetic, `isFixture: true`, test-only.

## 14. Technical acceptance criteria

The release acceptance criteria are AC-01 … AC-25, AC-B1 … B4 ([MVP.md](MVP.md) §5). Technical gates every PR must meet:

| ID | Criterion | How verified |
|---|---|---|
| TAC-01 | `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` pass | CI |
| TAC-02 | Shipped style library is lint-clean (approved records only) | CI `style-rules lint`; API startup |
| TAC-03 | Every new endpoint has a Zod contract in `packages/contracts`, uses the envelope, and is scoped to the user | Review; API tests |
| TAC-04 | New user-owned collections are in `USER_OWNED_COLLECTIONS`; deletion and tombstone replay tests cover them | API tests |
| TAC-05 | No logs of bodies, personal data, codes, tokens, photos or image URLs | log-privacy tests |
| TAC-06 | No AI call on the core path; AI failures fall back with `AI_ENHANCEMENT_SKIPPED` | T-25, T-26 (#34, #55) |
| TAC-07 | No product, price, retailer or availability in generated looks while the product layer is off | T-24 (#34); strict contracts already reject these fields |
| TAC-08 | Engine determinism: same input + content version → same looks | T-12 (#34) |
| TAC-09 | A "Coming soon" section is turned on only when its page works end to end | Review of `lib/features.ts` |

## 15. Traceability

| Requirement area | Contract | Code | Tests | Issue(s) | State |
|---|---|---|---|---|---|
| FR-AUTH, FR-ONB | `auth.ts`, `profile-completeness.ts` | `auth.service.ts`, `account.service.ts`, `onboarding.service.ts`; `(auth)`, `onboarding` | `registration`, `login-sessions`, `recovery-account`, `onboarding`, `admin-seed` API tests; `auth-ui`, `screens`, `profile-completeness` web tests | #1, PR #25, #28 | Implemented |
| FR-UI | — | `TopNav.tsx`, `AppShell.tsx`, `(site)`, `AuthSplitLayout.tsx` | `top-nav.test.ts`, `components.test.tsx` | PR #26 | Implemented |
| FR-PROF, FR-SIZE-01 … 04 | `profile.ts` | `profile.service.ts`, `ProfileForm.tsx` | `profile.test.ts`, `profile-form.test.ts` | #4 | Implemented (no `preferredWearTypes`) |
| FR-SIG | `appearance.ts` | `appearance.service.ts`, `AppearanceForm.tsx` | `appearance.test.ts`, `appearance-log-privacy.test.ts`, `appearance-form.test.ts` | #5 | Implemented |
| FR-STY | (`style-vocabulary.ts`) | `style-rules/*` | `style-rules.test.ts`, `style-rules-scale.test.ts`, `style-vocabulary.test.ts` | #2, #3, #30, #63, #32, #35 | Tooling implemented; content draft |
| FR-LOOK | `outfit.ts` | `services/engine/*`, `recommendations.service.ts` | `outfit.test.ts`; `unit/engine/*.test.ts`, `api/recommendations.test.ts` | #33, #34, #45 … #49 | Engine and endpoint merged (#33); named engine tests and evaluation entry point (#34, merged in PR #74 and PR #87); optional AI wording off by default (#55, PR #87); UI not built |
| FR-PAL | `palette.ts` | `services/engine/palettes.ts`, `palette.service.ts` | `outfit.test.ts`; `unit/engine.test.ts`, `api/recommendations.test.ts` | #33, #39, #40 | Ranking and endpoint (#33); UI not built |
| FR-OUT | `outfit.ts` | `services/outfits.service.ts`, `services/feedback.service.ts`, `LookDetail.tsx`, `SavedAlternatives.tsx`, `FeedbackButtons.tsx` | `outfit.test.ts`, `api/outfits.test.ts`, `saved-outfits.test.tsx`, `feedback-alternatives.test.tsx` | #41, #42 | Implemented |
| FR-LIST, FR-BUD | `product.ts` | — | `outfit.test.ts` (shortlist and price-summary contracts) | #37, #38, #43 | Contract only |
| FR-DATA | `product.ts` labels | landing/feature copy | `security.test.ts` (web) | #52, #59 | Partial |
| FR-PROD, FR-MATCH, FR-QUAL | — | — | — | #57 | Blocked |
| FR-WX | — | — | — | — | Deferred |
| FRD §4.16 (deferred / future) | `design.ts`, `chat.ts` reserved | — | — | #56, #58, #65 | Deferred |
| FR-MYP (proposed) | `my-profile.ts`, `photos.ts` | models only (`profiles`, `appearanceProfiles`, `userPhotos`, `appearanceAnalyses`) | `my-profile.test.ts`; 2 tests in `profile.test.ts` | — (no issue) | Proposed; dormant schema |
| FR-HOME (proposed) | — | — | — | — (no issue) | Proposed |
| FR-DMS, FR-PAL-04 … 30, FR-OCAT, FR-SHOP, FR-VTO, FR-SAVE, FR-ADM, FR-CONN | `catalogue.ts`, `saved-items.ts`, `admin.ts` (enums, IDs, permission matrix) | models declared (`catalogue.ts`, `user-collections.ts`) | `catalogue.test.ts` (contracts), `catalogue-models.test.ts` (API) | — (no issue; [TODO.md](TODO.md) §6b) | Specified |

## 16. Unresolved technical decisions

| # | Question | Where it stands | Needed from |
|---|---|---|---|
| U-01 | Public sign-up default (`PUBLIC_SIGNUP_ENABLED`) vs D-63 closed beta | **Resolved (2026-10-21):** Founder approved Open Public Beta (`PUBLIC_SIGNUP_ENABLED=true` default per D-63); landing page hero and FAQ aligned | — |
| U-02 | How drafts are reviewed locally when the API refuses to start with unapproved records | No documented procedure | Shreya + founder |
| U-03 | Exact IDs and labels for formality, broad categories and garment types (D-97, D-98) | Decided in principle; not implemented (#63 closed) | Shreya, founder approval |
| U-04 | Route and navigation label for look results vs. the style-profile editor, both called "Discover My Style" | **Resolved (D-109):** Discover My Style is its own page; the editor moves to My Profile | — |
| U-05 | Outfit Categories requirement | **Resolved:** FRD §4.19 | — |
| U-06 | Save a palette; request a copy of my data | Save a palette **resolved** (FR-PAL-19 … 21); data export **approved** (D-105, FR-MYP-17), not built | — |
| U-07 | Hosting, email provider, tombstone store location, backup retention | **Resolved at HC-1 (2026-10-21):** D-81 (100% Free Stack: Vercel Hobby + Render Free + Atlas M0), D-84 (Resend/Brevo Free), D-85 (Separate Atlas M0 cluster), D-79 (30 days confirmed) | — |
| U-08 | Demo deployment proposal (#66) vs D-75 "no demo release" | **Resolved (2026-10-21):** Superseded by D-81 100% Free Stack; #66 closed | — |
| U-09 | Virtual Try-On approach (D-48; #58 deferred vs #65 self-hosted proposal) | Pending | Founder, privacy review |
| U-10 | Deferred features order (D-76) | Pending | Founder |
| U-11 | Weather provider (D-60), retailer permissions (D-43 … D-45), legal review (D-74) | Deferred / blocked | Founder, external parties |
| U-12 | Rate-limit store if more than one API instance runs (D-38) | Single free-tier instance on Render (`singapore`), in-memory rate limiting | — |
| U-13 | Single definition of shared ID schemas (contracts vs style-rules) | Duplicated | Shreya |
| U-14 | My Profile scope: measurements, photo analysis, age group, export (D-102 … D-105) | Approved 2026-10-18; dormant schema added; release gates per D-103, D-104 | — |
| U-15 | Home redesign (D-106) and feedback as a preference signal (D-108) | Approved (D-106 2026-10-18; D-108 via D-115) | — |
| U-16 | Private object storage provider for photos (D-107) | **Resolved at HC-1 (2026-10-21):** Cloudflare R2 Free Tier ($0.00/mo, zero egress) | — |
| U-17 | How photo analysis runs on device vs own server, accuracy evaluation before confidence labels ship | Not designed | Shreya, privacy review |
| U-18 | Under-18 users under DPDP (D-104) | Needs legal review (D-74) | Founder |
| U-19 | Saved palettes in Saved Outfits too, or only in My Colour Palette (D-117) | Resolved 2026-10-18: only in My Colour Palette | — |
| U-20 | Gemini for full-body photo analysis vs AI rule 16 (D-122) | Approved (option b) 2026-10-18; privacy review still to be recorded before release | Founder, privacy review |
| U-21 | Engine index refresh across several API instances after a publish (D-110) | Single instance: in-process refresh; several: short polling | HC-1 |
| U-22 | Measurement-ratio thresholds for body-shape classification (D-112) | To calibrate and have reviewed | Shreya, founder |
| U-23 | Admin MFA method (D-121) | **Resolved at HC-1 (2026-10-21):** TOTP Authenticator App ($0.00, RFC 6238) | — |
