# StyleMe — Testing Strategy

> Part of the StyleMe documentation baseline. Requirements: [FRD.md](FRD.md). Acceptance criteria: [MVP.md](MVP.md) §5. Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Objectives

- Prove the deterministic core (looks, explanations, sizing notes, budget totals on user-entered prices, and later eligibility and quality verdicts) is correct and repeatable.
- Prove StyleMe never shows invented or test data as real, and never sends personal data to external AI.
- Prove optional features (AI wording, weather) can fail without breaking the core.
- Enforce authentication, authorization, data isolation and deletion.
- Measure recommendation quality on an evaluation set, without claiming results that haven't been measured.

No accuracy, relevance or performance figure is claimed without an actual test result. Thresholds are proposals until measured.

---

## 2. Test Levels and Tools (D-02, D-36)

| Level | Tool | Location |
|---|---|---|
| Unit | Vitest | `apps/api/tests/unit`, `apps/web/tests` |
| API | Vitest + Supertest + `mongodb-memory-server` | `apps/api/tests/api` |
| Style-rule linter | Run in CI and at startup | `apps/api/src/style-rules` |
| End-to-end | Playwright, at 375×812 and 1280×800 viewports | `e2e/` |
| Evaluation | Scripted runs over synthetic profiles + founder review | `apps/api/tests/evaluation` |

All automated suites run in CI on every pull request and push to `main` (D-42). AI providers are stubbed in CI; no real keys are used (D-39). The Playwright suite (`e2e/`, #36) runs as the `e2e` CI job; how to run it and add a flow is in [`e2e/README.md`](../e2e/README.md). **Not set up yet:** the `tests/evaluation` harness (#54); its row above describes the planned location.

**Current suite (run 2026-10-18 on `feature/styling-foundation`, `c5e1621`):** contracts 4 files / 91 tests, all pass; API 15 files / 133 tests, 132 pass and 1 fails by design ("the shipped library in src/style-rules/data is linter-clean", because PR #68's C0 records are drafts; it passes on `main`, where the library is empty); web 8 files / 58 tests, all pass. `pnpm typecheck` and `pnpm lint` pass. On a Windows checkout with `core.autocrlf=true`, `pnpm format:check` reports CRLF line endings only; `prettier --check --end-of-line auto .` passes ([TODO.md](TODO.md) TD-DOC-06).

---

## 3. Test Data Rules

- Fixtures are synthetic, marked `isFixture: true` and kept in `apps/api/tests/fixtures/`.
- Fixtures (including the synthetic scale-test library) are used in local, CI and staging only. Production refuses to start if any exist (T-29, T-30).
- Fixtures may imitate real retailer listings in shape, so product-layer logic can be tested before any retailer approves access, but they are never shown to real users.
- Evaluation profiles are synthetic and contain no real personal data.

---

## 4. Stage 1 Unit Tests

| Target | What to verify |
|---|---|
| Look generator | Same inputs and knowledge-base version → same looks; precedence order; defaults; conflicts; signatures |
| Palette selection | Liked colours boosted, disliked colours excluded, undertone as a soft signal, explore mode |
| Rule application | Soft weights only; no "forbid" path; fit preferences override rules |
| Alternatives | 3–5 when available; fewer with `ALTERNATIVES_LIMITED`; never padded |
| Explanation builder | Every claim maps to a reference; inclusive-language check |

**Status (2026-10-20, #34 merged in PR #74; #55 PR pending):** the engine tests live in `apps/api/tests/unit/engine/`, one file per area, and every test name starts with its ID (`it('T-12 …')`): `determinism.test.ts` (output contract, T-12, T-19, T-24, T-28 content version), `constraints.test.ts` (filters, T-13, T-14, T-15 precedence, T-10, T-32), `defaults-conflicts.test.ts` (T-16 … T-18), `explanations.test.ts` (T-20 … T-23, T-25), `palettes.test.ts` (T-33, T-10 for palettes), `scale.test.ts` (T-38 generator half: 150 palettes and 150 templates, every occasion × department, about 8 ms per request locally), `c0-content.test.ts` (AC-05 … AC-08 and AC5 on the approved C0 library, loaded as in production) and `evaluate.test.ts` (the evaluation entry point, §6.1). They run on the synthetic engine fixture library (`buildEngineFixtureLibrary()`) and the profile builders in `tests/fixtures/profiles.ts`. The optional AI wording step (#55) is tested with a fake provider (`tests/fixtures/wording.ts`, D-39): `tests/unit/wording.test.ts` covers T-25 (off by default, no provider call), T-26 (timeout, rate limit, provider error, invalid output, a missing or invented reference, an unverified colour, signal, link, price or record ID, judgemental language: each keeps the template text with its cause), T-27 (the payload holds only references and labels: no identity, appearance signal, signal-scoped rule, size, budget or measurement) and the Gemini client with a stubbed `fetch`. `apps/api/tests/api/recommendations.test.ts` adds T-10, T-12, T-13, T-16, T-17, T-18, T-24, T-25, T-26 and T-27 end to end (with AI wording off: no outbound call; on: the fake provider). No test is left as `it.todo`. **Test IDs:** the IDs in §5 are canonical. Issue #34's table labels T-24 "palette ranking with signals off" and T-27 "inclusive language"; those areas are tested under T-10 and T-33 (`palettes.test.ts`) and T-22 (`explanations.test.ts`), and T-24 and T-27 keep their §5 meanings, as MVP.md AC-11 and AC-12 and SPECS.md TAC-06 and TAC-07 use them. **Coverage (D-70):** `pnpm --filter @styleme/api test:coverage` (`@vitest/coverage-v8`) measures the generator (`src/services/engine/`) and the rule loader and linter, and fails below 80 % lines in any of those files. It is not part of `pnpm test` or CI (D-70: no global gate). Measured results are recorded in §6.1.
| Search phrase builder | Built from the look spec only; no links or prices |
| Size note | Uses the category size; body shape and signals have no effect |
| Budget engine (user-entered prices) | Totals, `pricedSlots`/`totalSlots`, `complete`, budget remaining, `within_budget` / `over_budget` / `no_budget`, exact boundary `total == budget` |
| Style-rule loader and linter | Rejects invalid records, contradictions, duplicates, duplicate `slotId`s within a template, unknown references, missing rationale or limitations; loads only `approved` |
| Codes and links (`ChallengeService`) | 6-digit codes and 256-bit link tokens; only hashes stored; expiry per purpose; a new one invalidates the old; 3 wrong codes lock for 30 minutes; 30-second cooldown and 6 sends per hour |
| Password policy, phone and city schemas | Each password rule enforced separately; Indian mobile numbers normalised to `+91…`; city IDs from the shared list |
| Registration draft (web) | Only non-sensitive fields kept; expires after 24 hours; corrupt data ignored |
| Google OAuth helpers (web) | PKCE S256 challenge, random `state` and `nonce`, constant-time state comparison, no client secret in the authorization URL |
| Migration `001-auth-onboarding` | Legacy users marked verified, defaults added, onboarding derived from profiles, legacy reset tokens removed; runs once |
| Coverage report | Counts and empty cells computed correctly (FR-STY-11) |
| Coordination rules | Colour compatibility, formality, pattern mixing and proportion rules applied across slots; alternatives differ meaningfully and stay coordinated |
| Validators | Zod schemas accept valid and reject invalid input |
| Appearance model | Self-reported values have no confidence; `userConfirmed: true`; clearing works |
| AI wording guard | Input contains only references; invalid or extra claims are rejected; failure → template (`tests/unit/wording.test.ts`, #55) |
| Fixture guard | Startup check and script guards behave per environment |

---

## 5. Stage 1 API and Behaviour Scenarios

| # | Scenario | Expected |
|---|---|---|
| T-01 | Register (all D-87 fields), verify by code, `GET /v1/auth/me` | `201`; consent versions recorded; only hashes stored; verification opens a session in the registering browser; no `passwordHash` returned |
| T-02 | Wrong password; unknown email; 3 wrong passwords; repeated attempts from one IP | Identical generic `UNAUTHENTICATED`; then `ACCOUNT_LOCKED` for 30 minutes even with the right password; per-IP `RATE_LIMITED`; a spoofed client-IP header without the BFF secret is ignored |
| T-03 | Protected endpoint without a token | `UNAUTHENTICATED` |
| T-04 | User A requests user B's look | `NOT_FOUND` |
| T-05 | `tokenVersion` incremented; `isActive` set to `false` | Old tokens rejected; inactive user can't log in and their tokens are rejected |
| T-06 | `DELETE /v1/account` with an emailed code, with and without the confirmation | Without: `INVALID_REQUEST`, nothing deleted. With: a tombstone with only `userId`, `emailHmac`, `deletedAt`, `source` and `expiresAt` is written first; all the user's data, sessions and codes are gone; the token is rejected and the account can't log in |
| T-07 | Profile without `department` / with invalid enums / with `ageRange` or `height` | `INVALID_REQUEST` (age range and height aren't Stage 1 fields) |
| T-08 | `measurements` sent (no size charts in Stage 1); `budgetPreference` ≤ 0 | Rejected (`INVALID_REQUEST`); a positive budget is saved |
| T-09 | Set self-reported signals | Stored as `self_reported`, `userConfirmed: true`, no confidence |
| T-10 | Signals turned off or cleared | Looks identical to a profile without signals |
| T-11 | Any request with signals set | No signal value appears in any outbound call |
| T-12 | Same request twice with the same knowledge base | Same looks (deterministic) |
| T-13 | Disliked colour | Never appears in looks or alternatives |
| T-14 | `paletteMode: explore` | Non-palette colours the user hasn't disliked can appear |
| T-15 | Hard constraint vs rule vs signal | Precedence order holds |
| T-16 | Only `occasion` supplied | Looks returned; `DEFAULTS_APPLIED` lists defaults |
| T-17 | Colour both liked and disliked | `PREFERENCE_CONFLICT`; restrictive choice applied and explained |
| T-18 | Very restrictive request | `200` with 0–2 looks, `INSUFFICIENT_MATCHES`, limiting constraint and relaxation named |
| T-19 | Any response | No repeated combination signature |
| T-20 | Alternatives | 3–5 or `ALTERNATIVES_LIMITED`; never padded |
| T-21 | Explanation fidelity | Every rule and attribute mentioned is in `explanationRefs`, and only those |
| T-22 | Judgemental phrase injected into a rule rationale in a test knowledge base | Rejected by the linter/check |
| T-23 | Search phrase | Generic text only; no link, price or availability |
| T-24 | Product layer disabled | No generated look contains a product, price, retailer or availability field; the only prices anywhere are shortlist prices with `priceBasis: "user_entered"` |
| T-25 | AI wording disabled | Complete looks and template explanations |
| T-26 | AI wording enabled; provider times out, rate-limits, errors or returns invalid output | `200`, template explanations, `aiModel: null`, `AI_ENHANCEMENT_SKIPPED` |
| T-27 | AI wording enabled | Outbound payload contains only references and attribute tags; no identity, signals, sizes or measurements |
| T-28 | Unapproved or contradictory style record | Linter fails CI; record never loaded |
| T-29 | Fixture present when `APP_ENV=production` | API refuses to start; fixture/seed scripts refuse to run in production |
| T-30 | Production configuration with a fixture inserted directly into the database (test) | Never returned by any endpoint; ingestion rejects fixtures |
| T-31 | Save, list, get, delete, feedback; suggested look past 7 days | Work as specified; expired suggestions are removed |
| T-32 | Size note | Shows the user's category size or asks for one; unaffected by body proportions |
| T-33 | `GET /v1/style/palettes` | Suggested list with reasons; `view=all` lists every approved palette; liked colours never excluded |
| T-34 | Style illustration | Labelled "Style illustration — not a product"; missing licence → labelled swatch |
| T-35 | Any error | Standard envelope; no stack traces or internals |
| T-36 | Rate limits | Enforced per D-38 |
| T-37 | Register with `PUBLIC_SIGNUP_ENABLED=false`: invited email; uninvited email; Google sign-up uninvited | Invited succeeds; uninvited gets `NOT_INVITED` without creating a user |
| T-38 | Scale: synthetic fixture library of 150 palettes and 150 templates (never deployed) | Loads and lints without code changes; generator returns valid, diverse looks; latency recorded |
| T-39 | Change password with an emailed code: wrong code, right code | Wrong: `OTP_INVALID`, nothing changes. Right: other sessions rejected, the current browser gets a new session with the same Remember Me choice, a notice is emailed |
| T-40 | Admin-issued reset code redeemed within 60 minutes | User sets a new password; all old tokens rejected; the admin script output and logs never contain the new password; the code doesn't appear in logs |
| T-41 | Reset confirm with an unknown, used, expired or superseded token; two concurrent redemptions of one valid link | `LINK_INVALID`; exactly one concurrent redemption succeeds |
| T-42 | Reset request by link and by code for a registered and an unregistered email; code entry wrong ×3; resend cooldown and hourly limit (mocked email sender) | Link valid 15 minutes; code 5 minutes and exchanged for a reset token; `EMAIL_NOT_REGISTERED` for the unknown email; `OTP_LOCKED`; `RESEND_COOLDOWN` then `RESEND_LIMIT`; reset clears the login lockout and revokes all sessions |
| T-43 | Staging restore: take a backup, delete an invited test account, restore the backup with the full procedure | The deleted account and its invite are back in the restored database before replay, gone after it; verification passes; the restore report has no personal data. Variant: tombstone store unreadable → the procedure stops and the system stays in maintenance |
| T-44 | Account deletion while the tombstone store is unavailable; deletion failing partway after the tombstone write | First: `SERVICE_UNAVAILABLE`, nothing deleted. Second: reconciliation replay completes the deletion |
| T-45 | `MAINTENANCE_MODE=true` | Every `/v1` endpoint returns `SERVICE_UNAVAILABLE`; `/health` reports `maintenance`; login impossible |
| T-46 | Two sessions for one user; log out of one and replay its token; then change the password from the other; then reset the password | Logged-out token → `UNAUTHENTICATED`, the other session still works; after the change only the changing browser's new session works; after the reset none do |
| T-47 | Web app in an HTTPS configuration: inspect credential cookies; send a state-changing request with a foreign `Origin` | Cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, host-only, `__Host-` prefixed; no `Max-Age` without Remember Me, 30 days with it; the foreign-origin request changes nothing |
| T-48 | Open a reset, verification or email-change link (`#token=…`); redeem it; inspect logs | Token gone from the address bar after load; `Referrer-Policy: no-referrer` and `Cache-Control: no-store`; token absent from logs |
| T-49 | Login with an unknown email and a wrong password; verification recovery for a registered and an unknown email | Each group gets identical responses |

| T-50 | Email verification: right code; wrong ×3; expired code; link once, reused, expired; resend cooldown and limit; correcting the email; verifying from another device | Per D-89: `OTP_INVALID`, `OTP_LOCKED`, `LINK_INVALID`, `RESEND_COOLDOWN`, `RESEND_LIMIT`; old code and link stop working after an email correction; another device verifies without a session |
| T-51 | Login before verifying | `EMAIL_NOT_VERIFIED`; no session created |
| T-52 | Remember Me on and off | Token and session expire after 30 days and 24 hours respectively; an expired session is rejected |
| T-53 | Google: sign-up (terms accepted, invited); without terms; unverified Google email; wrong nonce; sign-up with an existing email; login linking a verified account; login linking an unverified account; unknown email; a second account claiming the same Google ID; not configured | Per D-88 and FR-AUTH-15; the unverified account's old password stops working; `PROVIDER_NOT_CONFIGURED` without configuration |
| T-54 | Email change: wrong password, address in use, by code, by link, superseded link | Old address works until confirmed; old address notified; superseded link `LINK_INVALID` |
| T-55 | Phone: valid and invalid numbers, SMS code, removal, no SMS provider | Verified only after the code; `PROVIDER_NOT_CONFIGURED` without a provider |
| T-56 | Onboarding: email path, Google path, resume after logout, other users' state | Steps complete only on the server's conditions; login returns the next step; no cross-user effect |
| T-57 | Logs after register, verify, login, reset | No password, code, link token, access token or `Authorization` header |

**Implemented automatically (2026-10-12):** T-01 … T-03, T-05, T-06, T-35, T-37, T-39 … T-42, T-44, T-45, T-46 (its steps across several tests), T-49 … T-57 in `apps/api/tests/api/*.test.ts` (in-memory MongoDB, recording email and SMS senders, a Google verifier that runs the production claim checks on test tokens — no real email, SMS or Google calls); T-43 at service level; T-47 and T-48 at configuration level in `apps/web/tests/security.test.ts`, with their browser-level checks in `e2e/security.spec.ts` (#36). Component tests (Testing Library in jsdom, `apps/web/tests/components.test.tsx` and `screens.test.tsx`) cover the six-box code entry (focus movement, paste, Backspace and arrows, no automatic submission), password show/hide and checklist, the city combobox's keyboard operation, accessible error and success messages, the registration form (fields, consent defaults, Google gating, 24-hour draft without secrets), the login form, the public hamburger menu, the dashboard sidebar (Coming soon labels, collapse, mobile drawer) and the deletion confirmation dialog. *Update 2026-10-15:* the sidebar was replaced by the top navigation (PR #26), covered by `apps/web/tests/top-nav.test.ts` (overflow fitting, active state); profile completeness is covered by `profile-completeness.test.tsx` (PR #28); contract tests for looks, palettes, shortlist and price summaries are in `packages/contracts/tests/outfit.test.ts` (#31). Layout was checked with screenshots at 1280–1440 px and at 375 px (device emulation), with no horizontal overflow on any checked page; this is not yet automated.

---

## 6. Evaluation Set (Recommendation Quality)

- **Profiles:** for C1, 25–30 synthetic profiles covering departments, occasions, styles, colour likes and dislikes, conflicting and missing inputs, and with and without self-reported signals. For C2 the set grows so every supported occasion × department combination has at least one profile (estimate 60–100).
- **Automated checks per profile:** hard constraints respected, coordination rules respected, no duplicates, alternatives meaningfully different, explanation fidelity, no product data without the product layer, inclusive language.
- **Founder review:** each look is judged relevant or not relevant to the profile and occasion.
- **Proposed target:** at least 80% of looks judged relevant (D-52). This is a target to measure, not a result.
- **Uses:** tune rule weights (D-19), find library gaps (FR-STY-08), and decide whether optional AI wording improves explanations (D-67).

### 6.1 Evaluation entry point (#34, for the #54 dataset)

`runEvaluation(profiles, library)` in `apps/api/src/services/engine/evaluate.ts` runs each synthetic profile through the engine and returns `[{ profileId, looks, warnings, limitedBy, checks }]`. It is pure (no database, network or AI) and uses only the engine's `StyleLibrary` interface (D-110).

| Check | Verifies |
|---|---|
| `outcome` | At least one look, or no looks with `INSUFFICIENT_MATCHES` and `limitedBy` (AC-05). Fewer than 5 looks always names the limit. The engine never throws |
| `contract` | Every look parses with the shared `lookSchema` |
| `deterministic` | A second run gives identical looks (AC-06) |
| `hardConstraints` | No disliked colour, avoided fabric, coverage minimum or department violation, in any slot or alternative (AC-07) |
| `templateFidelity` | Occasion, style, wear type, compatible palette, category options and required slots come from the template; suggested mode uses palette colours only |
| `uniqueSignatures` | No repeated combination signature (AC-08) |
| `alternatives` | 0–5 distinct alternatives per slot, none equal to the slot; `ALTERNATIVES_LIMITED` exactly when a slot has fewer than 3 (AC-08) |
| `explanationFidelity` | Every referenced rule is quoted and every quoted rationale is referenced; template, palette and occasion are referenced; liked colours and signals are cited only when used (T-21) |
| `noProductData` | No product, price, retailer, availability or link field or text (T-23, T-24) |
| `inclusiveLanguage` | Every explanation passes `findJudgementalLanguage` (T-22) |

**From code (tests):** build profiles with `evaluationProfile(id, request, profileFields, signals)` from `tests/fixtures/profiles.ts`, then `runEvaluation(profiles, library)`; `summarizeEvaluation` and `formatEvaluationReport` give counts and a Markdown report. `edgeCaseProfiles()` has 16 edge cases (missing inputs, every department, conflicts, hard constraints, explore mode, signals on and off, restrictive requests).

**From the command line:** `pnpm --filter @styleme/api evaluate` runs the edge-case profiles on the approved shipped library and prints the Markdown report; `--profiles <file.json>` runs a JSON array of profiles instead; `--json` prints the full result. It exits 1 if any check fails and 2 if the profile file is invalid. A profile in the file is `{ id, request, profile, signals? }`: `request` as `POST /v1/recommendations` takes it, `profile` as `PUT /v1/profile` takes it (with `department` allowed to be `null`), `signals` as `{ undertone?, skinTone?, bodyProportions? }`. Unknown fields are rejected (`evaluationProfileInputSchema`).

**Rules for the dataset:** profiles are synthetic and identified by ID only; reports never print profile values. The checks are automated; relevance is still judged by the founder (above).

**Recorded results (2026-10-19, C0 content version `cf425d8178522449`):** AC-05 … AC-08: 160 profiles (every occasion × department, plus the 16 edge cases on every occasion) pass all 10 checks; 723 looks; 15 restrictive edge cases get no looks, each with `INSUFFICIENT_MATCHES` and the limit named. The 16 edge cases alone (`pnpm --filter @styleme/api evaluate`): 16/16 pass, 75 looks. T-38: 32 requests on 150 palettes and 150 templates, about 8.6 ms each locally. Coverage (D-70, lines): 96.3 % over the measured files; every file ≥ 80 % (`evaluate.ts` 89.4, `text.ts` 90, `loader.ts` 94.3, `linter.ts` 98.1, `slots.ts` 98.3, `generate.ts` 99.2, the other engine files 100). Not in the D-70 scope, for information: `wording.service.ts` 88 %, `wording-client.ts` and `prompts/v1.ts` 100 %.

**Issue #34 acceptance status (2026-10-20).** (1) *Named tests:* T-12 … T-28 and T-38 exist, are named with their IDs and pass (§4 status). The suite merged with PR #74; T-26, and T-27 with AI wording on, test the optional AI wording step and land with #55 (fake provider, wording off by default). Turning wording on stays a separate step after the #54 evaluation (D-67). (2) *AC-05 … AC-08 on C0:* verified and recorded in the issue ([#34 comment](https://github.com/kedar1330/ThinkTech/issues/34#issuecomment-6270614982)): 160/160 profiles, 723 looks, 0 hard-constraint violations. (3) *Evaluation entry point:* documented in this section for the #54 owner. The D-70 coverage target in TODO.md TD-STY-04 is met (above).

### 6.2 Stage 1 evaluation set (#54)

**Profiles:** 28 synthetic profiles in `apps/api/tests/evaluation/profiles/stage1.json` (`EVAL-01` … `EVAL-28`), in the `--profiles` format above. They cover every occasion; departments women, men, "show me everything" and not saved; requested styles and wear types; explore mode; liked and disliked colours; a colour liked and disliked and a fabric liked and avoided (conflicts); an occasion with nothing else (missing inputs); coverage and comfort preferences; sizes; self-reported signals on and off; and requests nothing can satisfy.

**Automated checks in CI:** `apps/api/tests/evaluation/evaluation.test.ts` runs the set on the shipped library and on the synthetic engine fixture library and requires every check to pass for every profile (100 %), and that the set still covers the list above. It runs with `pnpm test`.

**Founder relevance review (D-52):**

1. Export: `pnpm --filter @styleme/api evaluate --profiles tests/evaluation/profiles/stage1.json --export-review review.csv`. One row per look: content version, profile ID, look number, template, palette, combination signature, items (garment and colours), explanation, and an empty `relevant` column. Profiles are named by ID only; their values are in `stage1.json`.
2. The founder opens the CSV in a spreadsheet and marks each look `yes` (relevant to the profile and occasion) or `no`, without changing the other columns.
3. Import: the same command with `--import-review review.csv` prints the relevance rate. Marks are matched to looks by profile and combination signature; marks made on another content version are rejected, because the looks may have changed. The ≥ 80 % target is compared only when every look is marked; until then the report says the review is incomplete.

Keep marked review files out of the repository; record only the date, content version and numbers here and in #54.

**Recorded results:**

| Date | Content | Profiles | Looks | Automated checks | Without looks | Relevance (founder) |
|---|---|---|---|---|---|---|
| 2026-10-20 | C0 `cf425d8178522449` | 28 | 130 | 28/28 profiles pass all 10 checks (AC-05 … AC-08, T-21 … T-24) | 2 (`EVAL-13` limited by style, `EVAL-27` by wear type), each with `INSUFFICIENT_MATCHES` | Not reviewed |

The C1 run (AC-07 … AC-10 measured on the release content, #35) and the founder review are still to do; their results are added to this table when measured.

---

## 7. End-to-End (Playwright)

**Stage 1 smoke flow:**

```
Register (with an invited test email; closed beta) → Verify (code from the test outbox) → Onboarding: style profile
→ Skip appearance → Personalized Home → Log out → Log in → Profile (department, sizes, fit, colours) → optional signals
→ Request looks → View explanations, swatches, search phrases → Explore palettes
→ Change a preference → Regenerate → Save a look → Add a priced item to a slot and check the labelled total
→ Open saved looks → Delete the item → Delete a look
→ Log out → Log in → Delete account
```

It runs at mobile and desktop viewports in CI against a local build with fixtures. After the hosting checkpoint (D-81) it also runs against staging (`BASE_URL`).

**Implemented (#36):** the harness (`e2e/`, `pnpm e2e`, the `e2e` CI job: in-memory MongoDB, the API with `APP_ENV=local` and the dev outbox, `next start`) and the authentication part of the flow in `e2e/auth.spec.ts`: register → verify with the emailed code → onboarding (set-up path, and Skip for now) → change password → log out → log in → forgot/reset password by code → delete account, at 375×812 and 1280×800. T-47 and T-48 run in the browser in `e2e/security.spec.ts`. The remaining stages (profile details, looks, palettes, saved looks, priced items) are added by their feature issues (#51, #53, #59, #65) as those features land; [`e2e/README.md`](../e2e/README.md) explains how. *Update 2026-10-20 (#53):* `e2e/discover.spec.ts` covers the looks flow on the shipped library: occasion → 5 ranked looks → Why this works → alternatives → copy a search phrase, the size prompt, no department, `INSUFFICIENT_MATCHES` (Festive + Fusion returns none), a missing occasion, and no horizontal overflow at 320, 390, 768 and 1366 px. Save and Shop this look join the journey with #41 and #43. An API failure can't be produced from the browser without a test-only hook, so Retry is covered by component tests (`apps/web/tests/discover-results.test.tsx`). The local harness serves plain HTTP, so T-47's `Secure` and `__Host-` checks run only with an `https` `BASE_URL` (staging, after HC-1).

---

## 8. Product Layer Scenarios

All run on fixtures and mocked sources. No live retailer calls in CI.

| # | Scenario | Expected |
|---|---|---|
| P-01 | Few, short, duplicated or unverified reviews | Lower confidence; `insufficient_evidence` or `INSUFFICIENT_QUALITY_EVIDENCE`; never high-confidence `acceptable` |
| P-02 | Recurring serious complaints above threshold | `rejected`; never recommended |
| P-03 | No reviews or ratings | `rating: null`, "Not available"; `insufficient_evidence` with warning |
| P-04 | Seller rating only | Cannot make a product `acceptable` |
| P-05 | Stale price | Shown with `PRICE_STALE` and "Price as of" |
| P-06 | Expired price | Not recommended; listed for re-verification |
| P-07 | Price changed after a look was saved | Old and new price with times; budget re-checked |
| P-08 | Out of stock | Not recommended; saved look shows "No longer available" with alternatives |
| P-09 | User's size not in stock / not reported | Not recommended / allowed with `SIZE_AVAILABILITY_UNKNOWN` |
| P-10 | Broken link | Not recommended; saved look shows "Link not working" |
| P-11 | No budget-valid combination | No over-budget look; budget named as the limiting constraint |
| P-12 | Affiliate-tracked vs untracked, otherwise identical | Same rank and quality; disclosure only on the tracked one |
| P-13 | No eligible product for a slot | Slot shown without a product, with its search phrase and `NO_VERIFIED_PRODUCT`; never a poorer match or a fixture |
| P-14 | Import with missing evidence, foreign domain, future date or fixture flag | Rejected |
| P-15 | Retailer source unavailable during sync | Existing data ages; app keeps working; alert raised |
| P-16 | Comparison without recorded permission | Comparison not shown |
| P-17 | Look match wording; photo-discrepancy evidence | Never "guaranteed"; level lowered |
| P-18 | Size chart with and without measurements | Guidance with basis and confidence, or "unavailable"; measurements deletable |
| P-19 | Totals | Labelled "Estimated items total — not a checkout price"; shipping excluded unless known |

## 9. Shortlist and Budget Scenarios (Stage 1, D-77 = B)

| # | Scenario | Expected |
|---|---|---|
| B-01 | Add an item with a price | Item labelled "Added by you — not verified by StyleMe", price "Price entered by you — not verified by StyleMe"; response has `priceBasis: "user_entered"`, `verifiedByStyleMe: false` |
| B-02 | Non-https, `javascript:` or over-long URL; name, note or price outside FR-LIST-07 limits | `INVALID_REQUEST`; a valid URL is stored unchanged and never fetched (no outbound request observed) |
| B-03 | Attach to another user's look, an unsaved look or an unknown `slotId`; a second item on the same `slotId`; the 201st item; list or delete another user's item | `NOT_FOUND` / `INVALID_REQUEST` / `CONFLICT` as specified; other users' items are never listed and return `NOT_FOUND` |
| B-04 | A look whose slots have user-entered prices (and, in Stage 3 tests, verified prices) | Totals per basis; the two bases are never added together |
| B-05 | Open a look with attached items | `priceSummary` and `USER_ENTERED_PRICES` returned; UI shows the total label without extra clicks |
| B-06 | Item with a link to a known retailer domain | No retailer name, logo, image, stock, rating or quality shown; link rendered with `rel="noopener noreferrer nofollow"` |
| B-07 | 2 of 3 slots priced; no budget set; total exactly equals budget; total above budget | "2 of 3 slots priced", `complete: false`; `no_budget`; `within_budget` with ₹0 remaining; `over_budget` |
| B-08 | Delete an item; delete a look with items; delete the account | Summary updates on next read; items detached but kept; all items deleted |
| B-09 | A look from a template with two slots of the same type (e.g. `accessory-1`, `accessory-2`) | Each slot accepts its own item; items never collide; the price summary counts both slots |
| B-10 | Several unattached items; then `outfitId` without `slotId` (and the reverse) | All unattached items are accepted (up to 200); a half-attachment is rejected with `INVALID_REQUEST` |

## 10. Weather Scenarios (Stage 2)

| # | Scenario | Expected |
|---|---|---|
| W-01 | Weather off | No provider call; nothing stored; results independent of location |
| W-02 | Weather on with a city | Conditions with source and time; soft ranking change; nothing excluded |
| W-03 | Provider error or quota | `WEATHER_UNAVAILABLE`; manual entry or continue; recommendations returned |
| W-04 | Location permission denied | City entry offered |
| W-05 | Device location used | Rounded; not stored, logged or sent to AI |
| W-06 | Manual conditions | Used and labelled "manual" |
| W-07 | Wording | Never claims a fabric is "always" right |
| W-08 | Date beyond the forecast range | Current conditions with a note, or manual entry |

## 10a. My Profile and Home scenarios (D-102 … D-106, approved 2026-10-18)

The founder approved these features on 2026-10-18; the scenarios are not implemented yet. Already automated for the dormant schema: `packages/contracts/tests/my-profile.test.ts` and two tests in `apps/api/tests/api/profile.test.ts` (fields rejected and hidden today; account deletion removes `userPhotos` and `appearanceAnalyses`).

| ID | Scenario | Expected |
|---|---|---|
| T-58 | Save one My Profile section | Only that section and its `sectionUpdatedAt` change |
| T-59 | Leave My Profile with unsaved edits | Confirmation prompt; saved sections stay saved |
| T-60 | Measurements entered in inches | Stored in cm; shown back in inches; out-of-range values rejected with a field error |
| T-61 | Fit-based look request without essential measurements | Asks for the missing essentials; non-fit features still work |
| T-62 | Delete measurements only | Other profile data unchanged; affected recommendations refresh |
| T-63 | Photo analysis without consent | Refused; no photo stored or processed |
| T-64 | Face and body uploads | Stored as separate kinds; body photos carry an angle; no storage key or URL in responses |
| T-65 | Unclear photo | Quality issue explained; retake or manual selection offered |
| T-66 | Photo-only body-shape result | Shows High/Medium/Low; used only after confirm or correct |
| T-67 | Delete photos | Objects and metadata deleted; derived results kept |
| T-68 | Revoke consent, choose keep / delete results | Future analysis stops; results kept or deleted as chosen |
| T-69 | Retention "delete after analysis" | Photos deleted after analysis; revoking retention deletes immediately |
| T-70 | Any photo request | Face photos never reach an external provider (AI rule 16); full-body photos reach Gemini only when the D-122 flag is on, with per-use consent and metadata stripped (flag off until the privacy review); logs contain no photo, URL or key |
| T-71 | Reset preferences | Selected sections reset; basic information, photos and measurements kept unless selected |
| T-72 | Export JSON and PDF | Owner only; contains profile and measurements |
| T-73 | Account deletion with photos | Stored objects, `userPhotos` and `appearanceAnalyses` deleted; tombstone replay covers them |
| T-74 | Home with an empty profile | General content plus an optional setup prompt; no error |
| T-75 | One Home section fails | Retry shown for that section; navigation and other sections usable |
| T-76 | Unavailable feature card | "Coming soon" with an alternative; never a mock |
| T-77 | Profile change | Relevant Home recommendations refresh; "Your recommendations have been updated." shown |
| T-78 | Notifications | Unread count accurate; mark read persists |
| T-79 | Theme | Light, dark and system; AA contrast in both themes |

## 10b. Feature-specification scenarios (D-109 … D-128)

Written with the specifications; each feature's issue implements its rows. Already automated for the declared models: `packages/contracts/tests/catalogue.test.ts` (IDs, body-shape mapping, HEX, custom-palette limits, admin permission matrix, audit change shape) and `apps/api/tests/api/catalogue-models.test.ts` (no publish without founder approval or verified rights, duplicate-save detection, account deletion removes the new user-owned collections).

**Shared catalogue and engine**

| ID | Scenario | Expected |
|---|---|---|
| T-80 | Import approved style-rules files into MongoDB twice | Same records and versions; idempotent; drafts not published |
| T-81 | Publish a styling record without founder approval | `NOT_APPROVED`; nothing changes |
| T-82 | Publish an illustration without verified rights | `NOT_APPROVED` |
| T-83 | Archive a style that a template or saved item references | `RECORD_IN_USE` unless a replacement is named; saved item still opens with `SOURCE_RETIRED` |
| T-84 | Publish a change | Engine index refreshed; next request sees the new version; version and audit entry recorded |
| T-85 | Same profile and content version, same request | Identical recommendations (deterministic) |
| T-86 | Representative profile scenarios per body shape × goal × department | Only suitable styles in "Recommended"; explanations cite only matched rules; judgemental language rejected |
| T-87 | No style meets all requirements | `NO_SUITABLE_MATCH`, criteria named, closest suitable alternatives; never an unsuitable style as a match |
| T-88 | Measurements present vs body-shape label only | Measured proportions take precedence; photo-only estimates unused until confirmed |
| T-89 | Profile without body data | General styles, `GENERAL_RESULTS`, missing inputs listed; nothing blocked |
| T-90 | "Not for me" on a style, then undo | Lower rank, still browsable; undo restores; `useFeedback: false` ignores feedback; reset ignores earlier feedback |
| T-91 | Natural-language search with AI off or failing | Parser result; no error |
| T-92 | Natural-language search with AI on | Only the query text leaves the server; output validated against the vocabulary |

**Discover My Style and Outfit Categories**

| ID | Scenario | Expected |
|---|---|---|
| T-93 | Category → attribute → style → detail | Correct illustrations and attributes; related similar and contrasting styles |
| T-94 | Combine V-neck + three-quarter sleeves + hip length | Combined preference passed to outfits and Design Studio hand-off; profile unchanged |
| T-95 | Colour step on a line-only sketch | Swatch shown beside the sketch; no pretend recolour |
| T-96 | Filters and Clear all | Combine correctly; temporary; not saved to the profile |
| T-97 | Compare two styles | Side by side with the same attributes |
| T-98 | Missing illustration or failed request | Placeholder or section retry; rest of the page works |

**My Colour Palette**

| ID | Scenario | Expected |
|---|---|---|
| T-99 | With and without skin tone and undertone | Ranked by tone/undertone first, or general palettes labelled as general with an optional prompt |
| T-100 | Avoided colour | Never appears; liked colours never excluded |
| T-101 | Customise a curated palette | Separate custom palette created; curated palette unchanged |
| T-102 | Create from HEX codes | 2 – 12 colours with roles; invalid HEX rejected |
| T-103 | Swatch → copy HEX; swatch → Shop this colour | Clipboard gets the HEX; Shop My Look opens with that colour preselected and removable |
| T-104 | Unsave a palette | Saved reference removed; catalogue unchanged |

**Saved Outfits**

| ID | Scenario | Expected |
|---|---|---|
| T-105 | Save the same item twice | One record; "Already saved" |
| T-106 | Save a customised variation | Separate item |
| T-107 | Replace a garment in a saved outfit | Save as New Look by default; original unchanged |
| T-108 | Item in two collections; delete one collection with keep items | Item remains, in the other collection |
| T-109 | Unsave in Saved Outfits | Save indicators update on source cards; Undo restores |
| T-110 | Retired source or discontinued product | Snapshot with notice; historical price labelled; no broken image |
| T-111 | Another user's saved item or collection ID | `NOT_FOUND` |
| T-112 | Load failure | Retry shown; never an empty collection |

**Shop My Look**

| ID | Scenario | Expected |
|---|---|---|
| T-113 | No authorised source | `PRODUCT_DATA_UNAVAILABLE`, styling alternatives and the shortlist; no placeholder product |
| T-114 | Outfit total with a missing price | `PARTIAL_TOTAL`, labelled partial estimate; shipping unknown stated |
| T-115 | Budget lowered below the total | Overage highlighted, substitutions suggested; nothing replaced automatically |
| T-116 | Replace one item | Other items kept |
| T-117 | Inherited filters from a palette or style | Visible, editable, removable; precedence order of D-127 |
| T-118 | Back from product detail | Same results, filters and selection |
| T-119 | Report an issue | Stored for review; product data unchanged |
| T-120 | Ranking with and without affiliate data | Identical order (D-46) |

**Virtual Try-On (2D)**

| ID | Scenario | Expected |
|---|---|---|
| T-121 | First view | Default model in a plain white shirt and plain white pants; illustrative label |
| T-122 | Dress after top and trousers | Asks, then replaces both; never overlapping layers |
| T-123 | Garment without a layer for the model variant | Unavailable for this preview, alternative offered |
| T-124 | Recolour a non-recolourable garment | Only supported colours offered |
| T-125 | Save, reload, reopen | Same configuration; removed garment shows an unavailable notice |
| T-126 | Any try-on action | No camera request, upload or external call |

**Admin Panel**

| ID | Scenario | Expected |
|---|---|---|
| T-127 | Non-admin, disabled admin, or admin without an `adminAccounts` record | `ADMIN_FORBIDDEN` on every `/v1/admin/*` route |
| T-128 | Content Admin on users, audit, admins, styling approval | `ADMIN_FORBIDDEN` |
| T-129 | Suspend a user | Sessions revoked; next request `ACCOUNT_SUSPENDED`; reactivation restores access; both audited |
| T-130 | Admin user detail response | No profile, measurements, appearance, photos or preferences |
| T-131 | Failed admin action | Audit entry with `status: failure`; no sensitive values |
| T-132 | Dashboard with a group of 7 | Shown as "fewer than 10" |
| T-133 | Bulk publish with one invalid record | Valid ones per confirmation; invalid one reported; nothing half-written |
| T-134 | Last active Super Admin disabled or self-escalation | Refused |

**Connected journeys (E2E, FR-CONN-08):** each journey listed in FR-CONN-08 runs at 375×812 and 1280×800; a connection counts as ready only when its journey passes.

## 11. Deferred and Future Features

When a deferred feature is approved, its test plan must cover at least:
- **Photo analysis:** consent required; good, bad, dark, multiple-person, no-face and partial-body photos; low confidence and `not_sure`; confirmation never changes confidence; unconfirmed estimates unused; photos deleted after analysis unless kept by choice; no face photo reaches an external AI provider; full-body photos reach Gemini only under D-122 (flag off until the privacy review).
- **Chatbot and sketch:** minimised context; Zod validation; AI failure → clear error, never a fake answer.
- **Photo-based or generative try-on:** must not be built until D-48 is decided; fallback never implies success. (The 2D illustrative try-on is covered by T-121 … T-126.)

---

## 12. Definition of Done (testing part)

A feature is done only when its unit and API tests exist and pass, the relevant scenarios above pass, authorization and isolation are tested, and the E2E smoke flow still passes. Coverage target: at least 80% line coverage for the look generator, rule loader and budget engine (D-70). There is no global percentage gate.

---

## 13. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-02, D-07, D-19, D-36, D-39, D-42, D-52, D-67, D-70, D-77, D-78, D-80, D-82, D-83, D-87 … D-94, D-109 … D-128.
