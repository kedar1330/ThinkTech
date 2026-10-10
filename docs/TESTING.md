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

All automated suites run in CI on every pull request and push to `main` (D-42). AI providers are stubbed in CI; no real keys are used (D-39).

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
| Search phrase builder | Built from the look spec only; no links or prices |
| Size note | Uses the category size; body shape and signals have no effect |
| Budget engine (user-entered prices) | Totals, `pricedSlots`/`totalSlots`, `complete`, budget remaining, `within_budget` / `over_budget` / `no_budget`, exact boundary `total == budget` |
| Style-rule loader and linter | Rejects invalid records, contradictions, duplicates, duplicate `slotId`s within a template, unknown references, missing rationale or limitations; loads only `approved` |
| Reset tokens | Generated with ≥ 128 bits; only the hash is stored; expiry per purpose; new token invalidates earlier ones |
| Coverage report | Counts and empty cells computed correctly (FR-STY-11) |
| Coordination rules | Colour compatibility, formality, pattern mixing and proportion rules applied across slots; alternatives differ meaningfully and stay coordinated |
| Validators | Zod schemas accept valid and reject invalid input |
| Appearance model | Self-reported values have no confidence; `userConfirmed: true`; clearing works |
| AI wording guard | Input contains only references; invalid or extra claims are rejected; failure → template |
| Fixture guard | Startup check and script guards behave per environment |

---

## 5. Stage 1 API and Behaviour Scenarios

| # | Scenario | Expected |
|---|---|---|
| T-01 | Register, log in, `GET /v1/auth/me` | Works; no `passwordHash` returned |
| T-02 | Wrong password; repeated attempts | Generic `UNAUTHENTICATED`; then `RATE_LIMITED` |
| T-03 | Protected endpoint without a token | `UNAUTHENTICATED` |
| T-04 | User A requests user B's look | `NOT_FOUND` |
| T-05 | `tokenVersion` incremented; `isActive` set to `false` | Old tokens rejected; inactive user can't log in and their tokens are rejected |
| T-06 | `DELETE /v1/account` with the correct password (and, as a variant, a wrong password → `PASSWORD_INCORRECT`, nothing deleted, session still valid) | A tombstone with only `userId`, `emailHmac`, `deletedAt`, `source` and `expiresAt` is written first; user, profile, signals, looks, feedback, shortlist items and the user's beta invite record are gone; login fails; existing tokens are rejected |
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
| T-37 | Register with `PUBLIC_SIGNUP_ENABLED=false`: invited email; uninvited email | Invited succeeds; uninvited fails with the generic `FORBIDDEN` message without creating a user |
| T-38 | Scale: synthetic fixture library of 150 palettes and 150 templates (never deployed) | Loads and lints without code changes; generator returns valid, diverse looks; latency recorded |
| T-39 | Change password: correct and wrong current password | Correct: new password works, old tokens rejected, current session gets a new token, outstanding reset tokens deleted. Wrong: `PASSWORD_INCORRECT`; nothing changes and the session stays valid |
| T-40 | Admin-issued reset code redeemed within 60 minutes | User sets a new password; all old tokens rejected; the admin script output and logs never contain the new password; the code doesn't appear in logs |
| T-41 | Reset confirm with an unknown, used, expired or superseded token; repeated attempts; two concurrent redemptions of one valid token | One generic `INVALID_REQUEST`; then `RATE_LIMITED`; exactly one concurrent redemption succeeds |
| T-42 | Reset request: with `PASSWORD_RESET_EMAIL_ENABLED=false`; with it `true` for existing and unknown emails (mocked email provider) | Disabled: `FORBIDDEN` with the beta message. Enabled: identical `202` for both; an email only for the existing active account; rate limits enforced |
| T-43 | Staging restore: take a backup, delete an invited test account, restore the backup with the full procedure | The deleted account and its invite are back in the restored database before replay, gone after it; verification passes; the restore report has no personal data. Variant: tombstone store unreadable → the procedure stops and the system stays in maintenance |
| T-44 | Account deletion while the tombstone store is unavailable; deletion failing partway after the tombstone write | First: `SERVICE_UNAVAILABLE`, nothing deleted. Second: reconciliation replay completes the deletion |
| T-45 | `MAINTENANCE_MODE=true` | Every `/v1` endpoint returns `SERVICE_UNAVAILABLE`; `/health` reports `maintenance`; login impossible |
| T-46 | Two sessions for one user; log out of one and replay its token (simulating a copied cookie); then change the password from the other; then reset the password | Logged-out token → `UNAUTHENTICATED`, the other session still works; after the password change every earlier session is rejected and only the new one works; after a reset all sessions are rejected; session records deleted on account deletion |
| T-47 | Web app in a staging-like HTTPS configuration: inspect the session cookie; send a state-changing request with a foreign `Origin` | Cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, host-only, `__Secure-` prefixed; the foreign-origin request is rejected and changes nothing |
| T-48 | Open a reset link `/reset-password#token=…` (Playwright, network log captured); redeem it; inspect API and web logs | Token is gone from the address bar after load; response has `Referrer-Policy: no-referrer` and `Cache-Control: no-store`; no request goes to a third-party host; the token goes only in the `POST` body; it appears in no log line |
| T-49 | Login with an unknown email, a wrong password and an inactive account; register with an uninvited and an already-registered email | Each group gets identical status codes and messages |

---

## 6. Evaluation Set (Recommendation Quality)

- **Profiles:** for C1, 25–30 synthetic profiles covering departments, occasions, styles, colour likes and dislikes, conflicting and missing inputs, and with and without self-reported signals. For C2 the set grows so every supported occasion × department combination has at least one profile (estimate 60–100).
- **Automated checks per profile:** hard constraints respected, coordination rules respected, no duplicates, alternatives meaningfully different, explanation fidelity, no product data without the product layer, inclusive language.
- **Founder review:** each look is judged relevant or not relevant to the profile and occasion.
- **Proposed target:** at least 80% of looks judged relevant (D-52). This is a target to measure, not a result.
- **Uses:** tune rule weights (D-19), find library gaps (FR-STY-08), and decide whether optional AI wording improves explanations (D-67).

---

## 7. End-to-End (Playwright)

**Stage 1 smoke flow:**

```
Register (with an invited test email; closed beta) → Log in → Profile (department, sizes, fit, colours) → optional signals
→ Request looks → View explanations, swatches, search phrases → Explore palettes
→ Change a preference → Regenerate → Save a look → Add a priced item to a slot and check the labelled total
→ Open saved looks → Delete the item → Delete a look
→ Log out → Log in → Delete account
```

It runs at mobile and desktop viewports in CI against a local build with fixtures. After the hosting checkpoint (D-81) it also runs against staging. The smoke flow doesn't test password reset; T-39 … T-42 cover it at API level.

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

## 11. Deferred and Future Features

When a deferred feature is approved, its test plan must cover at least:
- **Photo analysis:** consent required; good, bad, dark, multiple-person, no-face and partial-body photos; low confidence and `not_sure`; confirmation never changes confidence; unconfirmed estimates unused; photos deleted after analysis; no photo reaches an external AI provider unless rule 16 is satisfied.
- **Chatbot and sketch:** minimised context; Zod validation; AI failure → clear error, never a fake answer.
- **Try-on:** must not be built until D-48 is decided; fallback never implies success.

---

## 12. Definition of Done (testing part)

A feature is done only when its unit and API tests exist and pass, the relevant scenarios above pass, authorization and isolation are tested, and the E2E smoke flow still passes. Coverage target: at least 80% line coverage for the look generator, rule loader and budget engine (D-70). There is no global percentage gate.

---

## 13. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-02, D-07, D-19, D-36, D-39, D-42, D-52, D-67, D-70, D-77, D-78, D-80, D-82, D-83.
