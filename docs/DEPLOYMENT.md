# StyleMe — Deployment and Operations

> Part of the StyleMe documentation baseline. Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Security: [SECURITY.md](SECURITY.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Platforms

| Component | Platform | Stage |
|---|---|---|
| Next.js web (`apps/web`) | Vercel | 1 |
| Express API (`apps/api`) | Render (Docker) | 1 |
| Database | MongoDB Atlas | 1 |
| Source and CI | GitHub, GitHub Actions | 1 |
| Image storage | Cloudinary, only when a feature stores user or generated images (deferred features) | Deferred |

These are the planned platforms. **Hosting is postponed by the founder (D-81):** no Atlas, Vercel or Render account, paid plan or credential is assumed. Development (S1.1 … S1.5, S1.B) runs locally and in CI. At the hosting checkpoint HC-1 the founder is asked, with options and current costs (§9), before anything is deployed.

---

## 2. Environments and Data Separation (D-78)

| Environment | Web | API | Database | Data allowed | Who uses it |
|---|---|---|---|---|---|
| **Local** | `pnpm dev` | `pnpm dev` or Docker Compose | Local MongoDB instance (or `mongodb-memory-server`) | Fixtures, test accounts | Developers |
| **CI** | — | Test runner | `mongodb-memory-server`, per run | Fixtures | GitHub Actions |
| **Staging** (created after HC-1) | Vercel preview deployments (access-protected) | Separate Render service | Separate Atlas database | Fixtures, staff test accounts. **Never** production data | Founder and developers |
| **Production** (created in S1.7 per the HC-1 decision; closed beta until D-74) | Vercel production | Render production service | Separate Atlas database and credentials | Real users and, with the product layer, verified products. **Never** fixtures | Users |

**Why staging exists:** Vercel preview deployments run unreviewed pull-request code. Pointing them at production would let untested code read or write real user data. A small staging API and database avoid that. If staging's cost turns out to be prohibitive, the fallback is to disable API access from preview deployments, not to point them at production.

**Safeguards:**
- Each environment has its own database credentials. Production credentials exist only in the production services.
- Fixtures live in `apps/api/tests/fixtures/`. Seed and fixture scripts refuse to run when `APP_ENV=production`.
- The production API refuses to start if any document has `isFixture: true`, and product ingestion rejects fixtures.
- Staging is protected (for example with Vercel deployment protection) and isn't advertised to users.
- Tests T-29 and T-30 ([TESTING.md](TESTING.md)) verify these safeguards in CI.

---

## 3. Configuration

### 3.1 API (Render)

| Variable | Stage | Notes |
|---|---|---|
| `NODE_ENV` | 1 | `production` in staging and production |
| `PORT` | 1 | Provided by Render; the API binds to `0.0.0.0` (default 4000 locally) |
| `MONGODB_URI` | 1 | Per environment |
| `AUTH_ACCESS_TOKEN_SECRET` | 1 | Per environment |
| `BFF_SHARED_SECRET` | 1 | Shared with the web app (same value); the API trusts the forwarded end-user IP header only with it, so per-IP rate limits apply to the real user ([SECURITY.md](SECURITY.md) §5) |
| `WEB_ORIGIN` | 1 | The environment's web origin (e.g. `http://localhost:3000` locally): the only origin CORS allows (D-37) and the base of every emailed link |
| `APP_ENV` | 1 | `local` \| `staging` \| `production`; drives the fixture safeguards |
| `AI_WORDING_ENABLED` | 1 | `false` by default (D-67) |
| `PUBLIC_SIGNUP_ENABLED` | 1 | `false` (closed beta, D-63). Set to `true` only after D-74 is recorded complete and AC-24 passes |
| `TOMBSTONE_STORE_URI` | 1 | Tombstone store connection, per environment; API credentials insert-only (D-85) |
| `TOMBSTONE_HMAC_KEY` | 1 | Secret for `emailHmac` in tombstones, per environment (D-85) |
| `MAINTENANCE_MODE` | 1 | `false`; `true` during a restore — all `/v1` endpoints return `SERVICE_UNAVAILABLE` (D-85) |
| `SMTP_URL`, `EMAIL_FROM` | 1 | **Required in staging and production** — the API refuses to start without them, because registration needs email verification (D-89). `SMTP_URL` is the provider's SMTP connection string including credentials (e.g. `smtps://user:pass@smtp.example.com:465`); `EMAIL_FROM` the sender (e.g. `StyleMe <no-reply@…>`). Turn off the provider's link and open tracking. Provider chosen at HC-1 (D-84). Locally, leave empty to use the dev outbox |
| `DEV_OUTBOX_DIR` | 1 (local only) | Folder where local development writes emails and SMS as JSON instead of sending them (default `.dev-outbox`, git-ignored). Never used outside `APP_ENV=local` |
| `SMS_PROVIDER` | 1 | `none` (no SMS provider integrated yet, D-92): phone verification reports "not available" outside local development |
| `GOOGLE_CLIENT_ID` | 1 (optional) | Google OAuth client ID; the API verifies ID tokens against it (D-88). Empty disables Google sign-in |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 1 (optional) | Required only when `AI_WORDING_ENABLED=true` (the API refuses to start without them then). The model is chosen and recorded when enabling (D-12) |
| `AI_WORDING_TIMEOUT_MS` | 1 (optional) | Timeout of one AI wording call, 500 – 30 000 ms (default 4000); on timeout the template text is used |
| `PRODUCT_LAYER_ENABLED` | Product layer | `false` until an authorised source and D-74 allow the Stage 3 release |
| `FLIPKART_AFFILIATE_ID`, `FLIPKART_AFFILIATE_TOKEN` | Product layer | Only after Flipkart approves access (D-44) |
| `WEATHER_API_KEY` | 2 | Only if the chosen provider needs one (D-60) |

None of these is set in any hosted environment yet (D-81). `.env.example` lists the names (no values). The 2026-10-12 release removed `PASSWORD_RESET_EMAIL_ENABLED` (self-service reset is always on) and Auth.js's `AUTH_SECRET`.

### 3.2 Web (Vercel, planned)

| Variable | Notes |
|---|---|
| `BFF_SHARED_SECRET` | Same value as the API's; sent on every server-side API call ([SECURITY.md](SECURITY.md) §5) |
| `AUTH_URL` | The web origin, per environment: used for the `Origin` check on state-changing requests and the Google redirect URI; an `https` URL turns on `Secure`, `__Host-` cookies ([SECURITY.md](SECURITY.md) §1) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional (D-88). Web application OAuth client; authorised redirect URI `${AUTH_URL}/api/oauth/google/callback`. Without both, Google buttons show "not available yet" |
| `API_BASE_URL` | Staging API for previews, production API for production |

Never use `NEXT_PUBLIC_` for secrets (D-40). `.env.example` lists names only.

---

**Photo storage (D-103 approved 2026-10-18; provider D-107 at HC-1):** photo uploads need a private object-storage bucket per environment (encrypted, no public access, short-lived signed URLs) and its credentials as API-only secrets, chosen at HC-1. No variable for it exists in `env.ts` yet; it is added in the PR that builds the storage integration. Gemini for full-body photos (D-122) reuses the AI provider key (server-side only) and stays disabled by a flag until the privacy review is recorded.

## 4. Build and Runtime

- **Monorepo rule:** `apps/web` and `apps/api` both depend on `packages/contracts`, so every build runs from the repository root.
- **API Docker image** (`apps/api/Dockerfile`, multi-stage): base Node image (D-01) → enable pnpm → copy workspace manifests → install → copy API and contracts → build TypeScript → slim runtime image → start Express. Secrets are never in the image.
- **Docker Compose** (`docker-compose.yml`) runs the API locally against the developer's database. MongoDB isn't run in Docker. The web app runs with `pnpm dev`.
- **Vercel:** root directory `apps/web`, with workspace support for `packages/contracts`.
- **Render:** web service from GitHub, Docker runtime, Dockerfile `apps/api/Dockerfile`, repository-root build context, health check `/health`, defined in `render.yaml` (D-40).

---

## 5. CI/CD

GitHub Actions on every pull request and every push to `main`, from S1.1 (D-42). **Checks are added progressively:** S1.1 starts with install, typecheck, lint, unit/API tests and build; each later milestone adds its checks as it introduces them — the style-rule linter, coverage report and scale test with S1.4, fixture safeguards and the E2E smoke flow by S1.6. The full sequence once all are in place:

```
Checkout → Setup Node/pnpm → Install → Typecheck → Lint → Style-rule linter + coverage report
→ Unit/API tests (incl. fixture safeguards and the scale test) → E2E smoke (Playwright) → Build → PASS/FAIL
```

- Before HC-1: CI only; nothing is deployed.
- After HC-1: each pull request gets a Vercel preview that calls the staging API; the staging API is deployed from `main`, or manually from a pull-request branch when its API change needs testing in staging. From S1.7, merging to `main` deploys to production after CI passes. Feature branches never deploy to production.
- Database migrations run as a release step before the new API version takes traffic (§6).

---

## 6. Migrations, Backups and Recovery (D-79)

- **Migrations:** versioned scripts in `apps/api/scripts/migrations/`, applied in order with `pnpm --filter @styleme/api migrate` (built: `node dist/migrate.js`) and recorded in the `migrations` collection. Run them after the backup and before the new API version serves traffic. `001-auth-onboarding` (2026-10-12) prepares existing accounts for verification and onboarding ([DATABASE.md](DATABASE.md) §10). Every change is backward-compatible (add first, remove in a later release), so the previous API version keeps working.
- **Backups:** use Atlas backups if the chosen tier includes them. Otherwise run a scheduled `mongodump` of production (weekly, and before every migration) to private, access-controlled storage. Keep backups for 30 days (proposed, not yet approved; confirmed at HC-1). Check the tier's capabilities and cost first. The tombstone store (D-85) is outside the main database's backup and restore scope.
- **Restore procedure (D-85).** Every restore follows these steps; there is no shortcut.
  1. **Maintenance on.** Set `MAINTENANCE_MODE=true` in production: every `/v1` endpoint returns `SERVICE_UNAVAILABLE`, `/health` reports `maintenance`, and the web app shows a maintenance page. No user can log in or read data.
  2. **Coverage check.** Record the backup's timestamp. Stop if it is older than the tombstone retention period minus 7 days (the tombstones covering it may have expired).
  3. **Isolated restore.** Restore the backup into a new database that the serving API is not connected to. Never restore in place.
  4. **Read tombstones.** Read every unexpired tombstone from the tombstone store, which the restore does not touch. Stop if the store can't be read in full.
  5. **Replay.** For each tombstone, delete the account's data from the restored database using the replay list ([DATABASE.md](DATABASE.md) §3.1c), including `betaInvites` whose email matches `emailHmac`. Replay is idempotent.
  6. **Verify.** Zero documents for any tombstoned `userId` in every user-owned collection; zero `betaInvites` matching any tombstone; tombstones read = tombstones processed; the fixture startup check passes. Write a restore report: backup timestamp, tombstones applied, verification counts, operator and time — no personal data.
  7. **Switch over.** Only if step 6 passes: point the API at the restored database, run the smoke checks, then set `MAINTENANCE_MODE=false`.

  **Failure behaviour:** if any step fails, StyleMe stays in maintenance mode, and the restored database is never connected to the serving API. Fix the cause and rerun from step 4, or restart from step 3. Notify the founder. Users are never served data whose deletion replay hasn't been verified.
- **Reconciliation:** the same replay and verification (steps 4–6) can run against the live database after any account deletion that failed partway.
- **Restore test:** run the full procedure in staging, with at least one account deleted after the backup was taken, before the Stage 1 closed-beta release (S1.7) and after any backup change. The result is recorded (T-43).
- **Rollback:** redeploy the previous Vercel and Render deployment. Thanks to backward-compatible migrations, rollback doesn't need a restore. Restore is only for data loss.

---

## 7. Monitoring and Logging (D-17, D-69)

- Structured JSON logs to stdout, collected by Render. Request IDs are included; sensitive fields never are.
- `GET /health` returns `{ status, version, time }` and is used by Render's health check.
- An external uptime check on `/health` and the web home page, alerting the founder by email.
- Weekly review of error logs before public launch, then as needed.
- **Product layer:** an alert when a retailer sync fails or a large share of products goes stale or expired.

---

## 8. Release Checklist

**Stage 1 closed-beta release (all required):**
- [ ] CI green on `main`, including fixture safeguards and the E2E smoke test
- [ ] Production database contains no fixtures; startup check enabled
- [ ] Security checklist complete ([SECURITY.md](SECURITY.md) §11)
- [ ] Stage 1 acceptance criteria met ([MVP.md](MVP.md) §5.1 and §5.2)
- [ ] Style knowledge base linter clean; only approved records deployed
- [ ] Backups configured and a restore tested in staging, including tombstone replay and verification (D-85)
- [ ] Uptime monitoring active
- [ ] Hosting decision D-81 made by the founder at HC-1; plan limits and costs recorded
- [ ] Email provider configured (`SMTP_URL`, `EMAIL_FROM`, D-84) and a verification email received in staging and production; Google either configured (redirect URI registered) or shown as not available
- [ ] Migrations applied (`001-auth-onboarding`)
- [ ] Terms and Privacy pages replaced or confirmed by the legal review, or still marked as drafts (D-74)
- [ ] Content set C1 approved
- [ ] `PUBLIC_SIGNUP_ENABLED=false`; invite allow-list in place
- [ ] Founder reminded to arrange the legal review (D-74)

**Public launch, additionally** (the blockers in [ImplementationPlan.md](ImplementationPlan.md) §11):
- [ ] HC-2 complete: AC-24 (self-service reset by email) passes in production
- [ ] D-74 legal review recorded complete in the register with every required change done (AC-20)
- [ ] Closed-beta criteria re-run on the production release and passing
- [ ] Only then `PUBLIC_SIGNUP_ENABLED=true`

**Product layer, additionally:**
- [ ] The retailer's permissions are recorded and in force (D-43 … D-45)
- [ ] Freshness, link-check and sync jobs tested
- [ ] Disclosures reviewed (D-46)

---

## 9. Hosting Decisions and Setup Steps (for the hosting checkpoint, D-81)

Nothing in this section is done until the founder decides at HC-1. At that point the implementer presents the options below with **current** limits and prices, checked on the providers' sites at that time (NFR-COST-03). Prices are not recorded here because they change.

**Open issues (2026-10-18):** HC-1 is tracked in #60 and closed-beta readiness in #61. Issue #66 proposes a free demo deployment (Vercel, Render Free, MongoDB Atlas M0, Brevo SMTP) for a pitch; it is labelled needs-founder-approval and conflicts with D-75 ("There is no demo release") and D-81 (hosting postponed). Nothing in #66 is approved, and the free-tier constraints in §9.1 apply to it ([PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #10).

### 9.1 Known plan constraints (checked 2026-10-10; re-check at HC-1)

These facts were checked on the providers' own pages because they affect requirements already in these documents. They are not a recommendation, and plans change.

| Service | Constraint | Why it matters to StyleMe | Source |
|---|---|---|---|
| Vercel Hobby (free) | "Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan." Commercial usage includes any deployment used for the financial gain of anyone involved in producing it, including a paid developer | StyleMe is a business product; whether the closed beta and later production can use Hobby is part of D-81 | [Vercel fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines) |
| Render free web service | Spins down after 15 minutes without inbound traffic; waking takes about a minute; 750 free instance hours per workspace per month; local filesystem is wiped on spin-down | Incompatible with the proposed p95 target (AC-18, D-68) for the first request after idle; the API is already stateless (NFR-SCL-03) | [Render: Deploy for Free](https://render.com/docs/free) |
| MongoDB Atlas Free (M0) | 0.5 GB storage including indexes; backups can't be enabled (only `mongodump`); 100 operations per second; one free cluster per project; may be paused after 30 days with no connections | Backups and restore (D-79) would rely on scheduled `mongodump`; the tombstone store (D-85) must be a separate deployment outside the main database's restore scope | [Atlas free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) |
| Gemini API (only if AI wording is enabled) | Google's pricing page: free-tier content is used to improve Google's products; paid-tier content is not | The wording input has no personal data (AI rule 16), but the tier is chosen with this in mind (D-12) | [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Open-Meteo (Stage 2 candidate) | The free API may be used only for non-commercial purposes; commercial use needs a paid plan | Can't be assumed for weather (D-60) | [Open-Meteo terms](https://open-meteo.com/en/terms) |

### 9.2 Decisions the founder makes at HC-1

| Service | Decision | What it affects |
|---|---|---|
| MongoDB Atlas | Tier for production and for staging | Storage, performance, and whether built-in backups exist; without them, scheduled `mongodump` is used (D-79) |
| Render (API) | Instance type for production and staging | Whether the service sleeps when idle (slow first request) and its memory and CPU; latency is then measured on the chosen plan (AC-18) |
| Vercel (web) | Plan | Usage limits, deployment protection for previews, and whether the plan's terms allow the intended commercial use |
| Staging | Full staging, or the cheaper fallback of disabling API access from previews (§2) | Cost versus safety of testing before production |
| Monitoring | Which uptime-check service | Alerts for `/health` and the web app (D-69) |
| Tombstone store (D-85) | Where it lives — it must be outside the main database's backup and restore scope (for example a separate small database deployment), with its own credentials | Whether a restore can safely re-apply deletions; its cost |
| Backup retention | Confirm or change the proposed 30 days (D-79) | How long deleted data stays in backups; the tombstone retention follows it (+ 7 days) |
| API instance count | One instance, or more | More than one instance needs a shared rate-limit store, because the in-memory limits are per instance (D-38) |
| Email provider (D-84, moved here from HC-2) | Transactional email service and sender domain | Registration can't be completed without it (verification, D-89) |
| Google OAuth client (D-88) | Google Cloud project, consent screen, redirect URI | Whether Google sign-in is offered |
| SMS provider (D-92) | Optional; any provider for Indian numbers | Whether phone verification is available |
| Who owns the accounts | Founder-owned accounts, with access granted to developers | Credentials stay with the founder |

### 9.3 Setup steps once decided
1. The founder creates (or authorises) the accounts and grants access. Credentials are never committed or sent in chat.
2. Create separate Atlas projects or clusters for staging and production; least-privilege database users; network access per D-20.
3. Create the Render services from `render.yaml` (staging, production); set API variables (§3.1) per environment, including `APP_ENV` and `PUBLIC_SIGNUP_ENABLED=false`.
4. Create the Vercel project (root `apps/web`); set web variables (§3.2); point previews at the staging API and production at the production API; enable deployment protection for previews.
5. Configure backups (Atlas or `mongodump`) and the tombstone store; run the full restore procedure in staging, including tombstone replay and verification (§6, D-79, D-85).
6. Set up the uptime check and email alerts.
7. Verify: `/health` green in both environments, the fixture startup check passes in production, E2E smoke passes against staging.
8. Record the decision, plans and costs in D-81.

### 9.3a Bringing an Atlas database live (after HC-1 only)

Steps for step 2 above, per environment (staging first, then production). Nothing here is done before the founder decides HC-1.

1. **Cluster:** in the founder-owned Atlas organisation, create one project per environment and a cluster on the tier chosen at HC-1, in a region close to the Render API region.
2. **Main database user:** `readWrite` on the `styleme` database only, with a generated password. **Tombstone store (D-85):** a separate deployment (not the main cluster's backup scope) with its own user, which may only insert into `deletionTombstones` (a custom role with `insert` and `find`, no `update` or `remove`).
3. **Network access (D-20):** allow only the Render service's outbound addresses. Never `0.0.0.0/0` in production.
4. **Connection strings:** copy the `mongodb+srv://…/styleme?retryWrites=true&w=majority` URI into Render's environment as `MONGODB_URI`, and the tombstone URI as `TOMBSTONE_STORE_URI`. Never into `.env` files in git, chat or the web app.
5. **Schema:** the API creates every collection and index on startup (`connectDatabase` runs `Model.init()`). Then run, from a machine allowed by step 3, with the environment's variables loaded:
   - `pnpm --filter @styleme/api migrate` (applies the numbered migrations)
   - `pnpm --filter @styleme/api catalogue:import` (approved styling content only; `--include-drafts` is refused in production)
   - `pnpm --filter @styleme/api seed` (admin account, D-95; then remove `SEED_ADMIN_PASSWORD`)
6. **Backups:** turn on Atlas backups if the tier has them, otherwise schedule `mongodump` (§6, D-79).
7. **Verify:** `/health` is green, the startup fixture check passes, and a test sign-up and account deletion work in staging.

### 9.4 HC-2 — public-launch checkpoint (D-84)

Raised only when the founder wants to prepare public launch, after the closed beta is running. The email provider is already chosen at HC-1 (D-84) and D-86 is decided (D-89). The implementer reminds the founder about the legal review (D-74), confirms the email plan's volume limits suit public sign-up, and verifies AC-24. `PUBLIC_SIGNUP_ENABLED` stays `false` until every public-launch blocker in [ImplementationPlan.md](ImplementationPlan.md) §11 is met.

---

## 10. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-01, D-17, D-20, D-40 … D-42, D-44, D-60, D-63, D-67, D-69, D-74, D-77, D-78, D-79, D-81, D-83, D-84, D-85, D-88, D-89, D-92.
