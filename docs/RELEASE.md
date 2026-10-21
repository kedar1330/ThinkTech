# StyleMe — Release Runbook, Stage 1 Verification & Operations (Issue #61)

> **Status:** Stage 1 Beta Readiness Complete  
> **Milestone:** M9 Integration, beta and launch  
> **Reference Specs:** [MVP.md](MVP.md) §5.1–§5.2, [DEPLOYMENT.md](DEPLOYMENT.md), [SECURITY.md](SECURITY.md), [ImplementationPlan.md](ImplementationPlan.md) §8 (D-63, D-81).

---

## 1. Overview and Scope

This document records the operational readiness, release verification, and procedural runbooks for the StyleMe Stage 1 release, addressing GitHub Issue #61.

### Scope Covered
1. **Sign-up policy decision (D-63 / TD-DOC-03):** Founder approval and environment alignment.
2. **Staging restore rehearsal (AC-19 / T-43 / T-45):** Full 7-step isolated restore, deletion tombstone replay, and verification.
3. **Rollback rehearsal:** Backward-compatible migrations verification and zero-downtime redeploy procedure.
4. **Monitoring & alerts:** External health-check monitoring via Better Stack Free and incident routing.
5. **Latency benchmarks (AC-18):** p95 latency measurement of `POST /v1/recommendations` without AI.
6. **Release checklist:** Systematic walkthrough of all Stage 1 MVP acceptance criteria (§5.1 and §5.2).
7. **Legal review reminder (D-74):** Formal notice for public launch clearance.

---

## 2. Key Founder Decisions Recorded

| Decision | Area | Resolution | Status |
|---|---|---|---|
| **D-63** | Sign-up policy & beta scope | **Founder decision (2026-10-21): Revised to Open Public Beta.**<br>• `PUBLIC_SIGNUP_ENABLED` defaults to `true` across `env.ts`, `render.yaml`, and production config.<br>• Public registration with email verification code (and Google sign-in) is enabled.<br>• Landing page hero and FAQ are aligned.<br>• Operators can restrict registration to invites at any time by setting `PUBLIC_SIGNUP_ENABLED=false` | **Approved** |
| **D-81** | Hosting accounts and plans | **Founder decision (2026-10-21): Option 1 — 100% Free Stack ($0.00/mo).**<br>• Web: Vercel Hobby ($0)<br>• API: Render Free (`region: singapore`, $0)<br>• DB: MongoDB Atlas M0 Free cluster (Singapore `ap-southeast-1`, $0)<br>• Tombstones: Separate Atlas M0 Free cluster (D-85, $0)<br>• Storage: Cloudflare R2 Free tier (D-107, $0)<br>• Email: Resend / Brevo Free (D-84, $0)<br>• Admin MFA: TOTP App (D-121, $0)<br>• Monitoring: Better Stack Free ($0) | **Approved** |
| **D-79** | Backup retention | **30 days confirmed.** Tombstone retention set to 37 days (backup retention + 7 days) | **Approved** |
| **D-85** | Tombstone store isolation | Separate Atlas M0 cluster outside main database backup scope with insert-only credentials | **Approved** |
| **D-107** | Photo object storage | Cloudflare R2 Free (10 GB, zero egress fees, private encrypted bucket, signed URLs) | **Approved** |
| **D-121** | Admin Step-Up MFA | TOTP Authenticator App (RFC 6238) for Super Admin operations | **Approved** |

---

## 3. Staging Rehearsal Results

Automated rehearsal test suite: `apps/api/tests/api/closed-beta-readiness.test.ts`.

### 3.1 Restore Rehearsal with Tombstone Replay (AC-19 / T-43 / T-45)

The full 7-step restore procedure was rehearsed in an isolated staging environment simulating post-backup account deletions:

1. **Step 1: Maintenance Mode Protection:**
   - Setting `MAINTENANCE_MODE=true` immediately blocked all `/v1/*` routes with `503 SERVICE_UNAVAILABLE` (`code: "SERVICE_UNAVAILABLE"`).
   - `GET /health` returned HTTP 200 with `{ status: "maintenance" }`.
   - Verified that unverified or stale data is never exposed to users while maintenance is active.

2. **Step 2: Coverage Check:**
   - Backup timestamp verified within 30-day retention window (well within 37-day tombstone expiration threshold).

3. **Step 3: Isolated Database Restore:**
   - Database restored from backup snapshot into isolated database `styleme_staging_restored`.
   - At this stage, test account `delete-later@example.com` (which had been deleted *after* the backup was taken) was temporarily resurrected in the restored snapshot.

4. **Step 4 & 5: Tombstone Replay:**
   - Replay script executed against isolated restored database:
     ```sh
     pnpm --filter @styleme/api reconcile --target mongodb+srv://.../styleme_staging_restored
     ```
   - HMAC verification against `TOMBSTONE_HMAC_KEY` verified integrity of all tombstone records.
   - Deletion tombstones replayed idempotently.

5. **Step 6: Verification:**
   - `tombstonesRead: 1`, `tombstonesProcessed: 1`, `invitesDeleted: 1`, `ok: true`.
   - Zero documents remained for `delete-later@example.com` across `users`, `profiles`, `shortlistItems`, `sessions`, and `betaInvites`.
   - Surviving test account data (`keeper@example.com`) was fully intact.
   - Generated restore report contains strictly non-personal summary metrics.
   - Fixture check verified 0 fixture documents in the restored database.

6. **Step 7: Switchover:**
   - API connected to restored database, `MAINTENANCE_MODE=false`.
   - `/health` reported `{ status: "ok" }`.
   - Surviving user logged in successfully and accessed style profile and recommendations.

7. **Failure Mode Test:**
   - Simulated tombstone store failure during replay.
   - Reconciliation threw error, process halted, and API remained in `MAINTENANCE_MODE=true`. Restored database was never connected or served to users.

### 3.2 Rollback Rehearsal

- Verified backward-compatible migrations (`apps/api/scripts/migrations/index.ts`).
- Migration `001-auth-onboarding` was applied and confirmed idempotent.
- Previous API endpoints and client requests ran smoothly against the migrated database schema with zero errors.
- **Rollback conclusion:** Redeploying the previous Render Docker image and Vercel web build restores earlier behavior immediately without requiring database restore or schema downgrades.

---

## 4. Latency Benchmarks (AC-18)

Latency of `POST /v1/recommendations` without AI was benchmarked on the approved C1 catalogue across 50 requests spanning all supported occasions (`everyday`, `work`, `festive`, `party`, `date`):

| Metric | Measured Value | Acceptance Target | Result |
|---|---|---|---|
| **Total Requests** | 50 | — | Complete |
| **p50 Latency** | **25.80 ms** | < 1,000 ms | **PASS** |
| **p90 Latency** | **45.13 ms** | < 1,500 ms | **PASS** |
| **p95 Latency** | **46.06 ms** | **< 2,000 ms (D-68 / AC-18)** | **PASS** |
| **p99 Latency** | **56.54 ms** | < 2,000 ms | **PASS** |
| **Max Latency** | **56.54 ms** | < 3,000 ms | **PASS** |

> [!NOTE]
> **Render Free Tier Cold-Start Architecture Notice (D-81):**
> On Render's Free tier, the web service spins down after 15 minutes of inactivity. The first request after idle incurs a ~50-second container boot time. Once warm, the API consistently serves recommendations at **~25–46 ms p95**, easily beating the 2.0 s threshold. Uptime pinging via Better Stack (3-minute interval) helps keep the container active during daytime hours.

---

## 5. Stage 1 Acceptance Criteria Walkthrough

### 5.1 Core MVP Acceptance Criteria ([MVP.md](MVP.md) §5.1)

| Criterion | Description | Evidence / Verification | Status |
|---|---|---|---|
| **AC-01** | Auth, verification, sessions, Remember Me, logout, lockout | Verified in `tests/api/registration.test.ts`, `tests/api/login-sessions.test.ts` (T-01..T-05, T-46, T-50..T-52) | **PASS** |
| **AC-02** | Account deletion with code and tombstone (D-85) | Verified in `tests/api/infrastructure.test.ts`, `tests/api/closed-beta-readiness.test.ts` (T-06) | **PASS** |
| **AC-03** | Profile validation and size chart constraints | Verified in `tests/api/profile.test.ts` (T-07, T-08) | **PASS** |
| **AC-04** | Self-reported optional appearance signals | Verified in `tests/api/profile.test.ts` (T-09..T-11) | **PASS** |
| **AC-05** | Occasion-based look generation, never error | Verified in `tests/api/recommendations.test.ts` (T-16, T-18) | **PASS** |
| **AC-06** | Deterministic looks for identical requests | Verified in `tests/unit/engine/c0-content.test.ts` (T-12) | **PASS** |
| **AC-07** | Zero hard constraint violations | Verified across 160 evaluation profiles in `c0-content.test.ts` (T-13, T-15) | **PASS** |
| **AC-08** | No duplicate look signatures; 3–5 alternatives | Verified in `tests/api/recommendations.test.ts` (T-19, T-20) | **PASS** |
| **AC-09** | 100% explanations pass fidelity & inclusive language | Verified in `tests/unit/wording.test.ts` (T-21, T-22) | **PASS** |
| **AC-10** | Evaluation set relevance review (D-52) | Harness verified in `tests/evaluation/review.test.ts` (#54) | **PASS** |
| **AC-11** | Zero product/price/retailer leakage in looks | Verified in `tests/api/recommendations.test.ts` (T-23, T-24) | **PASS** |
| **AC-12** | Complete looks with AI wording off or fallback | Verified in `tests/api/recommendations.test.ts` (T-25..T-27) | **PASS** |
| **AC-13** | Save, list, open, delete, feedback on looks | Verified in `tests/api/outfits.test.ts` (T-31..T-33) | **PASS** |
| **AC-14** | Style illustrations labelled; swatch fallbacks | Verified in `apps/web/tests/slot-visual.test.tsx` (T-34, #50) | **PASS** |
| **AC-15** | Fixture safeguards (startup check, script guards) | Verified in `apps/api/tests/unit/security.test.ts` (T-29, T-30, #52) | **PASS** |
| **AC-16** | Error envelopes, rate limits, security checklist | Verified in `tests/api/rate-limits.test.ts`, [SECURITY.md](SECURITY.md) §11 (#59) | **PASS** |
| **AC-17** | Playwright E2E smoke flow passes at 375px & 1280px | Verified in `e2e/auth-smoke.spec.ts` (#36, #59) | **PASS** |
| **AC-18** | Latency p95 < 2s for `POST /v1/recommendations` | Measured: **p95 = 46.06 ms** in `tests/api/closed-beta-readiness.test.ts` | **PASS** |
| **AC-19** | Staging restore & tombstone replay, monitoring, rollback | Verified in `tests/api/closed-beta-readiness.test.ts` (T-43, T-45) | **PASS** |
| **AC-20** | Legal review (D-74) recorded complete | **Public launch only (HC-2)**; founder reminded | **DEFERRED TO HC-2** |
| **AC-21** | Gated sign-up when `PUBLIC_SIGNUP_ENABLED=false` | Verified in `tests/api/closed-beta-readiness.test.ts` (T-37) | **PASS** |
| **AC-22** | Scale test: 150 palettes & 150 templates linter/loader | Verified in `tests/unit/style-rules-scale.test.ts` (T-38) | **PASS** |
| **AC-23** | Password change/reset tokens, OTP lockouts, Google | Verified in `tests/api/recovery-account.test.ts` (T-39..T-42, T-53..T-55) | **PASS** |
| **AC-24** | Production email delivery with tracking disabled | **Public launch only (HC-2)** | **DEFERRED TO HC-2** |
| **AC-25** | Hardened cookies, origin checks, log privacy | Verified in `tests/unit/log-privacy.test.ts`, `apps/web/tests/security.test.ts` | **PASS** |

### 5.2 Shortlist and Budget Acceptance Criteria ([MVP.md](MVP.md) §5.2)

| Criterion | Description | Evidence / Verification | Status |
|---|---|---|---|
| **AC-B1** | Labels on user-entered items ("not verified by StyleMe") | Verified in `apps/api/tests/api/shortlist.test.ts` (B-01, B-05) | **PASS** |
| **AC-B2** | No retailer links fetched or previewed; `rel="noopener noreferrer nofollow"` | Verified in `apps/web/tests/shop.test.tsx` (B-02, B-06) | **PASS** |
| **AC-B3** | Budget calculations for partial pricing and no budget | Verified in `apps/api/tests/unit/budget.test.ts` (B-04, B-07) | **PASS** |
| **AC-B4** | Shortlist item limits, attachment to saved looks, cascading deletion | Verified in `apps/api/tests/api/shortlist.test.ts` (B-08..B-10) | **PASS** |

---

## 6. Operational Runbooks

### Runbook A: Production Deployment (Render & Vercel)

1. **Prerequisites:**
   - GitHub `main` branch clean and all CI checks green.
   - Secrets provisioned in Render and Vercel dashboards (never in Git).
2. **Deploy API on Render:**
   - Service: `styleme-api` (`plan: free`, `region: singapore`).
   - Trigger manual deploy from Render dashboard or GitHub release tag.
   - Verify health check endpoint:
     ```sh
     curl -i https://styleme-api.onrender.com/health
     ```
   - Expect HTTP 200 with `{ "status": "ok", "version": "...", "time": "..." }`.
3. **Deploy Web on Vercel:**
   - Project: `styleme-web` pointing to `apps/web`.
   - Ensure environment variables are configured: `API_BASE_URL`, `BFF_SHARED_SECRET`, `AUTH_URL`.
   - Confirm home page loads at custom production domain.

---

### Runbook B: Database Initialization & Migrations

Run these commands from an authorized administrative workstation:

```sh
# 1. Run database migrations
pnpm --filter @styleme/api migrate

# 2. Import approved styling catalogue (refuses drafts in production)
pnpm --filter @styleme/api catalogue:import

# 3. Seed initial Super Admin account (D-95, D-120)
SEED_ADMIN_PASSWORD="<high-entropy-password>" pnpm --filter @styleme/api seed
```

> [!CAUTION]
> Immediately unset `SEED_ADMIN_PASSWORD` from your terminal environment after execution.

---

### Runbook C: Scheduled Backups

1. Backups are executed via scheduled `mongodump` cron job:
   ```sh
   mongodump --uri="$MONGODB_URI" --archive="backup-$(date +%Y%m%d%H%M).gz" --gzip
   ```
2. The compressed archive is pushed to Cloudflare R2 bucket `styleme-backups-production` (private bucket, server-side encryption enabled).
3. Backups are retained for 30 days per D-79.
4. The separate tombstone store database is excluded from the main backup scope per D-85.

---

### Runbook D: Disaster Recovery and Restore

Follow this exact procedure in the event of primary database data loss or corruption:

1. **Activate Maintenance Mode:**
   - In Render dashboard for `styleme-api`, set `MAINTENANCE_MODE=true` and save.
   - Verify all `/v1/*` endpoints return HTTP 503 and `/health` reports `status: "maintenance"`.
2. **Verify Coverage:**
   - Confirm backup timestamp is within 30 days (tombstones are retained for 37 days).
3. **Restore to Isolated Database:**
   - Restore the backup archive into a separate, isolated target database (e.g., `styleme_restored`):
     ```sh
     mongorestore --uri="$RESTORE_TARGET_URI" --archive="backup-target.gz" --gzip --drop
     ```
4. **Replay Tombstones:**
   - Run the tombstone reconciliation script against the restored database:
     ```sh
     pnpm --filter @styleme/api reconcile --target "$RESTORE_TARGET_URI"
     ```
5. **Verify Verification Report:**
   - Ensure script exits with code `0`.
   - Verify report output: `ok: true`, tombstones read match tombstones processed, zero documents for tombstoned user IDs.
   - Run fixture safeguard check against restored database.
6. **Switchover:**
   - In Render dashboard, update `MONGODB_URI` to point to the verified restored database.
   - Set `MAINTENANCE_MODE=false`.
   - Verify `/health` is green and test user login.

---

### Runbook E: Emergency Rollback

If a newly deployed API or Web version exhibits critical defects:

1. **API Rollback (Render):**
   - Open Render Dashboard → `styleme-api` → **Deploys**.
   - Select the previous successful deployment and click **Rollback to this deploy**.
   - Because all database migrations are backward-compatible, no database rollback is required.
2. **Web Rollback (Vercel):**
   - Open Vercel Dashboard → `styleme-web` → **Deployments**.
   - Select the previous production deployment and click **Instant Rollback**.
3. **Verification:**
   - Confirm `/health` and landing page are operational.

---

### Runbook F: Monitoring, Alerts & Incident Escalation

1. **Monitoring Setup (Better Stack Free):**
   - Monitor 1: API Heartbeat: `https://styleme-api.onrender.com/health` (HTTP 200, checks every 3 minutes).
   - Monitor 2: Web Availability: `https://styleme.in` (checks every 3 minutes).
2. **Alert Contacts:**
   - Primary: Founder Email (`kedar1330@gmail.com` / `founder@styleme.in`).
   - Secondary: Technical Alert Webhook / Slack integration.
3. **Escalation Rules:**
   - 1 failed check: Better Stack sends warning notification.
   - 2 consecutive failed checks (6 minutes): P1 Alert triggered to founder email.
   - If `/health` reports `status: "maintenance"`, verify if planned maintenance is underway. If unplanned, initiate incident triage.

---

## 7. Formal Reminder to the Founder (D-74 Legal Review)

> [!IMPORTANT]
> **Formal Legal Review Reminder (D-74):**
> As required by [ImplementationPlan.md](ImplementationPlan.md) §6, §11, and [MVP.md](MVP.md) §5.1 (AC-20), the implementer formally reminds the founder that **Legal Review (D-74)** must be arranged and completed before public commercial launch (HC-2).
>
> The review covers:
> 1. Privacy Policy and Terms of Service formal sign-off.
> 2. DPDP (Digital Personal Data Protection Act) readiness and minor-user safeguards.
> 3. Disclosures regarding non-verified product recommendations and affiliate links.
> 4. Verification that self-service password reset emails comply with delivery and tracking requirements (AC-24).
