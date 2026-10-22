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
| `PUBLIC_SIGNUP_ENABLED` | 1 | `true` by default (open public beta, D-63 founder decision 2026-10-21). Operators can set to `false` to restrict registration to invited users (`betaInvites`) |
| `TOMBSTONE_STORE_URI` | 1 | Tombstone store connection, per environment; API credentials insert-only (D-85) |
| `TOMBSTONE_HMAC_KEY` | 1 | Secret for `emailHmac` in tombstones, per environment (D-85) |
| `MAINTENANCE_MODE` | 1 | `false`; `true` during a restore — all `/v1` endpoints return `SERVICE_UNAVAILABLE` (D-85) |
| `SMTP_URL`, `EMAIL_FROM` | 1 | **Required in staging and production** — the API refuses to start without them, because registration needs email verification (D-89). `SMTP_URL` is the provider's SMTP connection string including credentials (e.g. `smtps://user:pass@smtp.example.com:465`); `EMAIL_FROM` the sender (e.g. `StyleMe <no-reply@…>`). Turn off the provider's link and open tracking. Provider chosen at HC-1 (D-84). Locally, leave empty to use the dev outbox |
| `DEV_OUTBOX_DIR` | 1 (local only) | Folder where local development writes emails and SMS as JSON instead of sending them (default `.dev-outbox`, git-ignored). Never used outside `APP_ENV=local` |
| `SMS_PROVIDER` | 1 | `none` (no SMS provider integrated yet, D-92): phone verification reports "not available" outside local development |
| `GOOGLE_CLIENT_ID` | 1 (optional) | Google OAuth client ID; the API verifies ID tokens against it (D-88). Empty disables Google sign-in |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 1 (optional) | `GEMINI_API_KEY` turns on photo analysis (D-129). Both are required when `AI_WORDING_ENABLED=true` (the API refuses to start without them then). The wording model is chosen and recorded when enabling (D-12). Secret: set in the API host's environment, never in the web app or `NEXT_PUBLIC_*` |
| `AI_WORDING_TIMEOUT_MS` | 1 (optional) | Timeout of one AI wording call, 500 – 30 000 ms (default 4000); on timeout the template text is used |
| `PHOTO_ANALYSIS_ENABLED` | 1 (optional) | Default `true` (D-129): face and full-body photo analysis by Gemini runs whenever `GEMINI_API_KEY` is set. `false` switches it off (users choose manually) |
| `GEMINI_VISION_MODEL` | 1 (optional) | Gemini model for photo analysis; must accept images. Default `gemini-3.8-flash` (stable on 2026-10-22); change it when Google retires that model |
| `PHOTO_ANALYSIS_TIMEOUT_MS` | 1 (optional) | Timeout of one photo analysis, 1 000 – 120 000 ms (default 90 000; Gemini often takes 10–80 s) |
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
- **Restore test:** run the full procedure in staging, with at least one account deleted after the backup was taken, before the Stage 1 release (S1.7) and after any backup change. The procedure was fully rehearsed and verified in staging (T-43, Issue #61; see runbook in [RELEASE.md](RELEASE.md) §3.1).
- **Rollback:** redeploy the previous Vercel and Render deployment. Thanks to backward-compatible migrations, rollback doesn't need a database restore. Rollback was rehearsed in staging (Issue #61; see [RELEASE.md](RELEASE.md) §3.2). Restore is only for data loss.

---

## 7. Monitoring and Logging (D-17, D-69)

- Structured JSON logs to stdout, collected by Render. Request IDs are included; sensitive fields never are.
- `GET /health` returns `{ status, version, time }` and is used by Render's health check and external monitoring.
- **External Uptime Monitoring (D-81):** Better Stack Free ($0.00/mo) configured to monitor:
  1. API Heartbeat: `GET https://styleme-api.onrender.com/health` (3-minute interval).
  2. Web Home: `GET https://styleme.in` (3-minute interval).
  Alerts route via email to founder (`founder@styleme.in` / `kedar1330@gmail.com`). Documented in [RELEASE.md](RELEASE.md) §6 Runbook F.
- Weekly review of error logs before public launch, then as needed.
- **Product layer:** an alert when a retailer sync fails or a large share of products goes stale or expired.

---

## 8. Release Checklist

**Stage 1 beta release (all completed & verified per [RELEASE.md](RELEASE.md)):**
- [x] CI green on `main`, including fixture safeguards and the E2E smoke test
- [x] Production database contains no fixtures; startup check enabled (#52)
- [x] Security checklist complete ([SECURITY.md](SECURITY.md) §11, #59)
- [x] Stage 1 acceptance criteria met ([MVP.md](MVP.md) §5.1 and §5.2; [RELEASE.md](RELEASE.md) §5)
- [x] Style knowledge base linter clean; only approved records deployed (#35)
- [x] Backups configured and restore tested in staging, including tombstone replay and verification (T-43, T-45, D-85; [RELEASE.md](RELEASE.md) §3.1)
- [x] Uptime monitoring active (Better Stack Free on `/health`, D-69, D-81; [RELEASE.md](RELEASE.md) §6 Runbook F)
- [x] Hosting decision D-81 made by founder at HC-1: Option 1 — 100% Free Stack ($0.00/mo) across Singapore region (#60)
- [x] Email provider configured (`SMTP_URL`, `EMAIL_FROM`, D-84); Google OAuth configured with fallback
- [x] Migrations applied and verified backward-compatible (`001-auth-onboarding`)
- [x] Terms and Privacy pages deployed with draft markers pending legal review (D-74)
- [x] Content set C1 approved
- [x] Sign-up policy decided by founder (D-63): open public beta (`PUBLIC_SIGNUP_ENABLED=true`); landing hero and FAQ aligned
- [x] Latency measured: p95 = 46.06 ms for `POST /v1/recommendations` without AI (AC-18 target < 2s; [RELEASE.md](RELEASE.md) §4)
- [x] Founder formally reminded to arrange the legal review before public commercial launch (D-74; [RELEASE.md](RELEASE.md) §7)

**Public launch, additionally** (the blockers in [ImplementationPlan.md](ImplementationPlan.md) §11):
- [ ] HC-2 complete: AC-24 (self-service reset by email) passes in production
- [ ] D-74 legal review recorded complete in the register with every required change done (AC-20)
- [ ] Beta criteria re-run on the production release and passing

**Product layer, additionally:**
- [ ] The retailer's permissions are recorded and in force (D-43 … D-45)
- [ ] Freshness, link-check and sync jobs tested
- [ ] Disclosures reviewed (D-46)

---

## 9. Hosting Decisions and Setup Steps (for the hosting checkpoint, D-81)

This section presents the hosting options with current plan limits and checked prices for the founder checkpoint HC-1 (issue #60), together with the founder's recorded decisions (D-81, D-84, D-85, D-107, D-121).

**Open issues (2026-10-21):** HC-1 is resolved (issue #60 closed); closed-beta readiness is tracked in #61. Issue #66 (free demo deployment proposal) is superseded by D-81 (Option 1: 100% Free Stack).

### 9.1 Current plan limits and prices (verified 2026-10-21)

| Service | Plan / Tier | Current Price | Limits & Constraints | Architectural Impact |
|---|---|---|---|---|
| **Vercel** (Web) | **Hobby** (Free)<br>*(Decided)* | $0 / month | Non-commercial personal use terms; 100 GB bandwidth, 1M edge requests, 100 edge invocations/day | Zero cost. Closed beta suitable; upgrade to Pro ($20/mo) at public launch if commercial terms dictate |
| **Vercel** (Web) | **Pro** | $20 / seat-mo | Commercial use allowed; preview deployment protection; 1 TB bandwidth, 1M edge config reads | Suitable for commercial production scale |
| **Render** (API) | **Free**<br>*(Decided)* | $0 / month | 512 MB RAM, 0.5 CPU; spins down after 15 minutes idle (~50s cold start wake-up); 750 free instance hours/month. **Outbound SMTP ports 25, 465, and 587 are blocked** on the free tier | API is stateless (NFR-SCL-03). Emails must route via provider HTTPS REST API (port 443) or use the local dev outbox for non-prod. Cold start affects the first request after idle |
| **Render** (API) | **Starter** | $7 / service-mo | 512 MB RAM, 0.5 CPU; **always on (no spin-down/cold starts)**; outbound SMTP ports open; metrics and alerting | Eliminates 50s idle cold-start delay; latency measurement (AC-18) meets target |
| **MongoDB Atlas** (Database) | **M0 Free**<br>*(Decided)* | $0 / month | 512 MB shared RAM/storage; 100 operations/second; no automated continuous backups (manual or scheduled `mongodump` only); 1 free cluster per project | Backups and restore (D-79) use scheduled `mongodump`. Tombstone store (D-85) lives in a separate free cluster |
| **MongoDB Atlas** (Database) | **M10 Dedicated** | ~$57 / month | 10 GB dedicated storage, 2 GB RAM; automated continuous cloud backups with point-in-time recovery; no sleep | Production-grade continuous backup retention (D-79) |
| **Photo Object Storage** (D-107, D-103) | **Cloudflare R2**<br>*(Decided)* | **$0.00 / month** (Free allowance: 10 GB storage, 1M write ops, 10M read ops) | $0.015 / GB-mo storage thereafter; **$0.00 data egress fee forever**; S3-compatible API | Private bucket, server-side AES-256 encryption, 15-minute presigned URLs. Zero egress fees forever make this ideal for user photos (face & full-body) |
| **Admin Step-Up MFA** (D-121) | **TOTP App**<br>*(Decided)* | **$0.00** | Standard RFC 6238 TOTP (Google Authenticator, Microsoft Authenticator, 1Password) | Protects sensitive Super Admin operations in the admin panel (D-120). Offline, instant verification, zero transactional email consumption |
| **Email Provider** (D-84) | **Resend / Brevo Free**<br>*(Decided)* | **$0.00 / month** | Resend: 3,000 emails/month (100/day); Brevo: 300 emails/day (9,000/mo) | Free tier handles beta volumes. Configured via HTTPS or SMTP; link and open tracking disabled to protect tokens |
| **Monitoring** | **Better Stack Free**<br>*(Decided)* | **$0.00 / month** | 10 uptime monitors, 3-minute check intervals, email and webhook alerts | Checks `/health` endpoint and web app availability (D-69) at zero cost |

---

### 9.2 Hosting options evaluated

| Dimension | Option 1: 100% Free Stack<br>*(Approved by Founder)* | Option 2: Low-Cost Hybrid | Option 3: Paid Foundation |
|---|---|---|---|
| **Monthly Cost** | **$0.00 / month** | ~$14.00 / month | ~$84.00 – $104.00 / month |
| **Web Tier** | Vercel Hobby ($0) | Vercel Hobby ($0) | Vercel Pro ($20/mo) |
| **API Tier** | Render Free ($0, Singapore) | Render Starter ($7 prod + $7 staging) | Render Starter ($7 prod + $7 staging) |
| **Database Tier** | MongoDB Atlas M0 Free ($0, Singapore) | MongoDB Atlas M0 Free ($0) | MongoDB Atlas M10 ($57/mo) |
| **Tombstone Store (D-85)** | Separate Atlas M0 Free cluster ($0) | Separate Atlas M0 Free cluster ($0) | Separate Atlas M0/Flex cluster ($0) |
| **Photo Storage (D-107)** | Cloudflare R2 Free (10 GB, $0 egress) | Cloudflare R2 Free ($0) | Cloudflare R2 ($0–$5/mo) |
| **Admin MFA (D-121)** | TOTP Authenticator App ($0) | TOTP Authenticator App ($0) | TOTP Authenticator App ($0) |
| **Transactional Email (D-84)** | Resend / Brevo Free ($0) | Resend / Brevo Free ($0) | Resend / Brevo Paid ($20/mo) |
| **Backups (D-79)** | Scheduled `mongodump` to R2 ($0) | Scheduled `mongodump` to R2 ($0) | Automated Atlas Cloud Backups (30 days) |
| **Cold Starts** | Yes (~50s after 15m idle) | None (always-on API) | None (always-on API) |
| **Target Phase** | Closed Beta & Initial Testing | Low-cost Beta with Fast Latency | Production Commercial Launch |

---

### 9.3 Founder decisions recorded at HC-1 (2026-10-21)

| Decision | Question | Resolution | Status |
|---|---|---|---|
| **D-81 Hosting Accounts & Plans** | Which hosting tier bundle for staging and production? | **Founder decision (2026-10-21): Option 1 — 100% Free Stack ($0.00 / month).**<br>• Web: Vercel Hobby ($0)<br>• API: Render Free (`plan: free`, `region: singapore`, $0)<br>• DB: MongoDB Atlas M0 Free cluster (512 MB, Singapore `ap-southeast-1`, $0)<br>• Tombstones: Separate Atlas M0 Free cluster (D-85, $0)<br>• Storage: Cloudflare R2 Free tier (D-107, $0)<br>• Admin MFA: TOTP App (D-121, $0)<br>• Email: Resend/Brevo Free (D-84, $0)<br>• Monitoring: Better Stack Free ($0) | **Approved** |
| **D-107 Photo Object Storage** | Which provider and parameters for user photos (FR-MYP-04..11, D-103)? | **Founder decision (2026-10-21): Cloudflare R2 Free Tier ($0.00 / month).**<br>• Storage: 10 GB free allowance ($0.015/GB thereafter)<br>• Bandwidth: **$0.00 egress fee** forever<br>• Operations: 1M Class A (write) / 10M Class B (read) free per month<br>• Security: Private bucket, server-side encryption AES-256, 15-minute presigned URL lifetime<br>• Deletion: Account deletion purges all stored photo objects | **Approved** |
| **D-121 Super Admin MFA** | Emailed step-up code or TOTP app for sensitive admin operations? | **Founder decision (2026-10-21): TOTP Authenticator App ($0.00).**<br>• Standard RFC 6238 TOTP (Google Authenticator, Microsoft Authenticator, 1Password, Aegis)<br>• Fully offline, instant verification, zero transactional email volume or third-party dependency | **Approved** |
| **D-84 Transactional Email Provider** | Which email service for verification codes and links? | **Founder decision (2026-10-21): Free Tier of Resend or Brevo ($0.00 / month).**<br>• Resend Free (3,000 emails/month, 100/day) or Brevo Free (300 emails/day, 9,000/mo)<br>• Custom sender domain with SPF, DKIM, DMARC; link/open tracking disabled to protect security tokens | **Approved** |
| **D-85 Tombstone Store Location** | Where does the tombstone store live? | **Founder decision (2026-10-21): Separate MongoDB Atlas M0 Free Cluster ($0.00).**<br>• Physically separate cluster outside the main database's backup and restore scope<br>• Dedicated least-privilege user with insert-only permissions (custom role: `insert` and `find`, no `update` or `remove`) | **Approved** |
| **D-79 Backup Retention** | Backup retention period? | **30 days confirmed.** Tombstone retention set to 37 days (backup retention + 7 days). Backups via scheduled `mongodump` | **Approved** |

---

### 9.4 Staging environment topology and configuration

Staging is isolated from production (D-78):
- **Web:** Vercel preview deployments for branches / pull requests, pointing to the Staging API.
- **API:** Render web service `styleme-api-staging` running `render.yaml` with `APP_ENV=staging`, `PUBLIC_SIGNUP_ENABLED=false`, `autoDeploy: true`, `plan: free`, `region: singapore`.
- **Database:** Dedicated Atlas staging database `styleme` (separate cluster or database user), never containing real user data.
- **Tombstone Store:** Separate staging tombstone collection with insert-only staging credentials.
- **Outbox / Email:** Staging uses the chosen transactional email provider or a dedicated staging domain / test inbox.

Secrets are configured directly in provider dashboards and never committed to Git:
- **Render Dashboard:** `MONGODB_URI`, `TOMBSTONE_STORE_URI`, `TOMBSTONE_HMAC_KEY`, `AUTH_ACCESS_TOKEN_SECRET`, `BFF_SHARED_SECRET`, `WEB_ORIGIN`, `SMTP_URL`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`.
- **Vercel Dashboard:** `API_BASE_URL` (points to `https://styleme-api-staging.onrender.com`), `BFF_SHARED_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

---

### 9.5 Setup steps once decided

1. The founder creates (or authorises) the accounts (Vercel, Render, MongoDB Atlas, Cloudflare, Email provider) owned by the founder's organization. Credentials are never committed or sent in chat.
2. In Atlas, create the staging project and cluster in `ap-southeast-1` (Singapore); configure database users (`readWrite` for API, separate custom role with `insert` only for tombstones); configure IP access list for Render.
3. In Render, deploy the blueprint `render.yaml`: provision `styleme-api` and `styleme-api-staging`. Populate environment variables in Render dashboard.
4. In Vercel, connect the GitHub repository, set root directory to `apps/web`, configure environment variables, and verify preview deployment protection.
5. In Cloudflare, create private R2 bucket `styleme-photos-staging` with default AES-256 encryption.
6. Verify staging deployment:
   - `GET https://<staging-api>/health` returns `{ status: "ok", ... }`.
   - Run numbered migrations: `pnpm --filter @styleme/api migrate`.
   - Import styling catalogue: `pnpm --filter @styleme/api catalogue:import`.
   - Seed initial admin: `pnpm --filter @styleme/api seed`.
7. Run the E2E verification suite against staging:
   ```sh
   BASE_URL=https://<staging-web-domain> pnpm e2e:run
   ```
8. Record the decision in `docs/ImplementationPlan.md` §8.

---

### 9.6 Bringing an Atlas database live (after HC-1 only)

Steps for step 2 above, per environment (staging first, then production). Nothing here is done before the founder decides HC-1.

1. **Cluster:** In the founder-owned Atlas organisation, create one project per environment and a cluster on the tier chosen at HC-1, in a region close to the Render API region (`ap-southeast-1` Singapore).
2. **Main database user:** `readWrite` on the `styleme` database only, with a generated high-entropy password. **Tombstone store (D-85):** a separate deployment (not the main cluster's backup scope) with its own user, which may only insert into `deletionTombstones` (a custom role with `insert` and `find`, no `update` or `remove`).
3. **Network access (D-20):** allow only the Render service's outbound addresses. Never `0.0.0.0/0` in production.
4. **Connection strings:** copy the `mongodb+srv://…/styleme?retryWrites=true&w=majority` URI into Render's environment as `MONGODB_URI`, and the tombstone URI as `TOMBSTONE_STORE_URI`. Never into `.env` files in git, chat or the web app.
5. **Schema & Data:** the API creates every collection and index on startup (`connectDatabase` runs `Model.init()`). Then run, from an authorized machine:
   - `pnpm --filter @styleme/api migrate` (applies the numbered migrations)
   - `pnpm --filter @styleme/api catalogue:import` (approved styling content only; `--include-drafts` is refused in production)
   - `pnpm --filter @styleme/api seed` (admin account, D-95; then remove `SEED_ADMIN_PASSWORD`)
6. **Backups:** turn on Atlas automated cloud backups if M10 is used; otherwise schedule `mongodump` (§6, D-79).
7. **Verify:** `/health` is green, the startup fixture check passes, and a test sign-up and account deletion work in staging.

---

### 9.7 HC-2 — public-launch checkpoint (D-84)

Raised only when the founder wants to prepare public launch, after the closed beta is running. The email provider is already chosen at HC-1 (D-84) and D-86 is decided (D-89). The implementer reminds the founder about the legal review (D-74), confirms the email plan's volume limits suit public sign-up, and verifies AC-24. `PUBLIC_SIGNUP_ENABLED` stays `false` until every public-launch blocker in [ImplementationPlan.md](ImplementationPlan.md) §11 is met.

---

## 10. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-01, D-17, D-20, D-40 … D-42, D-44, D-60, D-63, D-67, D-69, D-74, D-77, D-78, D-79, D-81, D-83, D-84, D-85, D-88, D-89, D-92, D-107, D-121.
