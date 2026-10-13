# StyleMe — Minimum Viable Product (First Real Release)

> Part of the StyleMe documentation baseline. Business context: [BRD.md](BRD.md). Requirements: [FRD.md](FRD.md), [SRS.md](SRS.md). Plan: [ImplementationPlan.md](ImplementationPlan.md). Tests: [TESTING.md](TESTING.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Definition

The StyleMe MVP is **Stage 1 — Personal Styling**: the smallest product that real users can rely on to answer "what should I wear for this occasion, in colours and cuts that suit my preferences, and why?" — and to keep track of items they find and what those would cost against their budget.

It is a real product, not a demo:
- real accounts, real saved data, real deletion;
- real, founder-reviewed styling rules, applied deterministically;
- no fabricated products, prices, retailer links, stock, reviews, quality claims or confidence values;
- deployed to production with monitoring, backups and a tested restore.

**Product and budget scope (D-77 = Option B, approved 2026-10-10).** Stage 1 includes an optional shortlist: users add items they found themselves, with prices they enter, and StyleMe totals those prices against their budget. Every such item, price and total is labelled as entered by the user and **not verified by StyleMe**. This needs no retailer approval. Verified products and retailer integrations are the product layer, planned for Stage 3 and subject to authorisation.

---

## 2. Problem and Users

People in India who want personal fashion guidance (see [BRD.md](BRD.md) §1–§2). Stage 1 focuses on explained, personal looks and budgeting on the user's own finds. Verified-product shopping follows when StyleMe has an authorised source.

---

## 3. Scope

### 3.1 In Stage 1

| Capability | Requirements |
|---|---|
| Public landing site; sign-up by email (verified by code or link) or Google (invite-only closed beta until D-74); login with Remember Me and lockout; logout of this device; self-service reset by link or code; password change by emailed code; email change; optional verified phone; account deletion by code and confirmation (D-87 … D-94) | FR-AUTH, FR-UI |
| Server-authoritative onboarding (style profile → optional appearance → Personalized Home) and a dashboard whose unbuilt sections are labelled "Coming soon" | FR-ONB, FR-UI |
| Profile: department, sizes and fit per category, colour likes and dislikes, contrast, silhouette, coverage, comfort, fabrics, styles, occasions, optional per-look budget | FR-PROF, FR-SIZE-01 … 04 |
| Optional self-reported appearance signals (skin-tone range, undertone, proportions), switchable and deletable | FR-SIG |
| Founder-reviewed style knowledge base, Stage 1 release set C1: 12–20 palettes, about 20 templates, rules covering every FR-STY-09 area (coordination, occasions, preferences, fit, sizes, budget where it applies, alternatives). Built to support the full library of 100+ palettes and 100+ templates | FR-STY |
| Deterministic look recommendations for an occasion: up to 5 distinct looks, look specifications per slot, explanations, alternatives, size notes, search phrases | FR-LOOK |
| Palette view: suggested and all palettes | FR-PAL |
| Save, list, open and delete looks; feedback | FR-OUT |
| Shortlist of items the user found: name, price they enter, optional link and note, optionally attached to a saved look's slot | FR-LIST |
| Budget totals on user-entered prices, per saved look, labelled "not verified by StyleMe" | FR-BUD (Stage 1 rows) |
| Data honesty labels; style illustrations only where licensed | FR-DATA |
| Optional AI wording, off by default | FR-LOOK-16 |

### 3.2 Not in Stage 1

- **Product layer (Stage 3, needs authorisation):** verified products, retailer integrations, retailer-sourced prices, stock, ratings, reviews, quality evidence, matching, comparison, size charts and measurements (FR-PROD, FR-MATCH, FR-QUAL, FR-SIZE-05 … 07, verified-price FR-BUD rows).
- **Full styling library C2 (Stage 2 release requirement):** at least 100 palettes and at least 100 outfit templates, 8–12 categories, comprehensive rules (D-57). Stage 1 ships with C1; C2 is planned and produced from the start ([ImplementationPlan.md](ImplementationPlan.md) §5.2).
- Weather (Stage 2).
- Photo-based appearance analysis, 3D avatar, Design Studio, sketch-to-design, chatbot and tailor PDF (D-76).
- Virtual try-on (D-48).
- Cart, checkout and payments (never).

---

## 4. User Journey

```
Landing → Sign up (email + verification, or Google + password) → Style profile (department, sizes, fit, colours,
styles, occasions, optional budget) → (optional) self-reported signals → Personalized Home → Ask for looks (occasion, optional style, suggested/explore palette)
→ Looks: slots with colour swatches, look specification, size note, search phrase, "Why this works"
→ Explore alternatives and palettes → Change a preference → Regenerate
→ Save a look → (optional) add an item you found to a slot: name, your price, optional link and note
→ See "Total of prices you entered: ₹… (n of m slots) — within budget / over budget. Not verified by StyleMe."
→ Saved looks → Feedback / delete looks and items → Log out → (any time) delete account
```

**When there is no product data**, which is always the case in Stage 1, the look is complete as a styling suggestion. StyleMe says plainly that it doesn't show products, offers the search phrase, and lets the user record their own finds. It never fills the gap with placeholders, invented products or test data.

---

## 5. Acceptance Criteria

Each criterion is checked by the tests named in brackets ([TESTING.md](TESTING.md)) or by the stated measurement. A criterion is met only when its result is recorded.

### 5.1 Stage 1 core

| ID | Criterion |
|---|---|
| AC-01 | Register (D-87 fields, consent recorded), verify by code or link, log in (with and without Remember Me), log out and `GET /v1/auth/me` work; unverified accounts can't log in; 3 wrong passwords lock login for 30 minutes. Protected pages and endpoints reject unauthenticated access and revoked tokens. After logout only that session's token is rejected; other sessions keep working (T-01 … T-05, T-46, T-50 … T-52) |
| AC-02 | Account deletion needs an emailed code and explicit confirmation; it writes a minimal tombstone first (D-85), then removes the user, sessions, codes, profile, signals, looks, feedback, shortlist items and their beta invite record; the user can no longer log in and existing tokens are rejected (T-06) |
| AC-03 | A profile can be saved with only `department`; invalid values (including a budget ≤ 0) are rejected; measurement fields are rejected because size charts don't exist yet (T-07, T-08) |
| AC-04 | Self-reported signals are optional, stored without confidence, can be turned off or cleared, and never appear in any outbound call (T-09 … T-11) |
| AC-05 | For every evaluation profile, a request with only an occasion returns at least one look, or a `200` with `INSUFFICIENT_MATCHES` naming the limiting constraint. Never an error (T-16, T-18) |
| AC-06 | Identical requests with the same knowledge-base version return identical looks (T-12) |
| AC-07 | Across the evaluation set, 0 looks violate a hard constraint (disliked colours, avoided fabrics, coverage, department) (T-13, T-15) |
| AC-08 | No response repeats a combination signature. Alternatives are 3–5, or fewer with `ALTERNATIVES_LIMITED`; never padded (T-19, T-20) |
| AC-09 | 100% of explanations in the evaluation set pass the fidelity and inclusive-language checks (T-21, T-22) |
| AC-10 | The founder reviews every evaluation-set look. The proposed target is at least 80% judged relevant (D-52). The measured result and any documented gaps are recorded before release |
| AC-11 | No generated look contains a product, price, retailer, stock or availability, and search phrases contain no link or price. The only prices in any response are user-entered and carry `priceBasis: "user_entered"` (T-23, T-24) |
| AC-12 | Looks are complete with AI wording off, and when AI wording is on but fails, times out or returns invalid output (`AI_ENHANCEMENT_SKIPPED`). Only references and attribute tags are sent to the AI step (T-25 … T-27) |
| AC-13 | Save, list, open, delete and feedback work; unsaved looks expire after 7 days; size notes use only the user's category size; the palette view lists suggested and all palettes (T-31 … T-33) |
| AC-14 | Every style illustration is labelled "Style illustration — not a product" and has a recorded licence; otherwise a labelled swatch is shown (T-34) |
| AC-15 | Fixture safeguards hold: production refuses to start with fixtures; seed scripts refuse production; no endpoint returns a fixture in production configuration (T-29, T-30) |
| AC-16 | Error responses use the envelope without internals; rate limits are enforced; every item on the security checklist ([SECURITY.md](SECURITY.md) §11) is checked (T-35, T-36) |
| AC-17 | The Playwright smoke flow, including adding a priced item to a saved look, passes at 375×812 and 1280×800 ([TESTING.md](TESTING.md) §7) |
| AC-18 | After the hosting checkpoint (D-81), p95 latency of `POST /v1/recommendations` without AI is measured on the plan chosen for production (in staging if it runs on the same plan, otherwise on production before beta users are invited). Proposed target under 2 s (D-68); the measured value is recorded. A plan that sleeps when idle can't meet this target for the first request (DEPLOYMENT.md §9.1) |
| AC-19 | A backup has been restored into staging with the full restore procedure: accounts deleted after the backup are deleted again by tombstone replay, verification passes before users are served, and a failed replay keeps the system in maintenance (T-43 … T-45). Uptime monitoring alerts the founder; a rollback has been rehearsed in staging (D-79, D-85) |
| AC-20 | **Public launch only** (checked at HC-2): the legal review (D-74) is recorded as complete in the register, as the D-74 entry describes, with every required change done, and the other public-launch blockers in [ImplementationPlan.md](ImplementationPlan.md) §11 are met. Until then StyleMe is a closed beta for invited users (D-63), and the founder has been reminded to arrange the review |
| AC-21 | While `PUBLIC_SIGNUP_ENABLED` is `false`, registration (email or Google) with an email not on the invite allow-list fails with `NOT_INVITED`; invited emails can register; an already-registered email gets the "already registered" message with a Log in link (T-37) |
| AC-22 | With a synthetic fixture library of 150 palettes and 150 templates, the loader, linter and generator work without code changes, and generation latency is measured and recorded (T-38) |
| AC-23 | Password change by emailed code revokes all other sessions and keeps this browser signed in; reset by link (15 minutes) or code (5 minutes) revokes all sessions and doesn't log in; codes lock after 3 wrong tries and resend is limited; admin-assisted recovery issues a single-use, hashed code valid 60 minutes that the admin never sees; email change, phone verification and Google sign-in follow D-88, D-92 and D-93 (T-39 … T-42, T-53 … T-55) |
| AC-24 | Checked in production before public launch: self-service reset and verification emails arrive through the chosen provider with tracking off; resets are rate-limited and revoke all sessions (T-41, T-42) |
| AC-25 | Session and token hardening: credential cookies are `HttpOnly`, `Secure` with `__Host-` in staging and production, `SameSite=Lax` and host-only; state-changing requests with a foreign `Origin` are rejected; token pages keep the token out of the URL after load and send `Referrer-Policy: no-referrer` and `Cache-Control: no-store`; passwords, codes and tokens never appear in logs (T-47, T-48, T-57) |

### 5.2 Stage 1 shortlist and budget (D-77 = B)

| ID | Criterion |
|---|---|
| AC-B1 | Every user-entered item, price and total shows the FR-LIST-02 labels ("not verified by StyleMe"), visible without extra clicks; API responses carry `priceBasis: "user_entered"`, `verifiedByStyleMe: false` and `USER_ENTERED_PRICES` (B-01, B-05) |
| AC-B2 | StyleMe never fetches, previews or modifies a user-entered link, and shows no retailer name, logo, image, stock, rating or quality for user-entered items. Links are https only and rendered with `rel="noopener noreferrer nofollow"` (B-02, B-06) |
| AC-B3 | The budget engine computes totals, priced-slot counts, budget remaining and status exactly per FR-BUD-03 and FR-BUD-07, including partial pricing and no budget (B-04, B-07, unit tests) |
| AC-B4 | Validation and limits per FR-LIST-07 and D-80 are enforced; items can only attach to the user's own saved looks; deleting a look detaches its items; deleting the account deletes all items; attachment is by `{outfitId, slotId}`, so repeated slot types never collide; `outfitId` and `slotId` are given together or not at all (B-02, B-03, B-08 … B-10) |

### 5.3 Product layer (Stage 3; not part of the Stage 1 release)

| ID | Criterion |
|---|---|
| AC-P1 | Every product shown is verified (`authorised` or `verified_real`) with complete evidence; imports with missing evidence, a foreign domain, a future date or a fixture flag are rejected (P-14) |
| AC-P2 | Every price shows "Price as of"; stale prices are warned; expired prices are not recommended (P-05, P-06) |
| AC-P3 | Out-of-stock, size-unavailable, broken-link and quality-`rejected` products are never recommended (P-02, P-08 … P-10) |
| AC-P4 | Slots with no eligible product show "No verified product available" with the search phrase; never a fixture or a poorer match (P-13) |
| AC-P5 | No over-budget look is returned; totals are labelled as estimates, not checkout prices (P-11, P-19) |
| AC-P6 | Ranking and quality are identical with and without affiliate tracking; disclosure appears only on tracked links (P-12) |
| AC-P7 | Quality verdicts cite evidence; low evidence gives `insufficient_evidence`; confidence is never 1 (P-01, P-03, P-04) |
| AC-P8 | A source outage doesn't break requests; data ages and an alert is raised; comparison is shown only where permitted (P-15, P-16) |
| AC-P9 | User-entered and verified prices are never combined into one total (B-04) |

### 5.4 Stage 2 weather (only if weather ships; D-60)

| ID | Criterion |
|---|---|
| AC-W1 | With weather off, no provider call is made and results don't depend on location (W-01) |
| AC-W2 | Provider failure never blocks recommendations; manual entry is offered (W-03, W-06) |
| AC-W3 | Device coordinates are rounded and never stored, logged or sent to AI (W-05) |

### 5.5 Stage 2 full styling library (release requirement, D-57)

| ID | Criterion |
|---|---|
| AC-C1 | At least 100 approved palettes and at least 100 approved outfit templates, across 8–12 categories; linter clean |
| AC-C2 | The coverage report (FR-STY-11) shows no empty cell for any supported occasion × department combination, and rules cover every FR-STY-09 area |
| AC-C3 | The expanded evaluation set (every supported occasion × department combination has at least one profile) meets the relevance target (D-52) or documented gaps are accepted by the founder; no regression on AC-07 … AC-09 |

---

## 6. Data Honesty in Stage 1

| Class | Examples in Stage 1 | Label |
|---|---|---|
| User-provided | Profile, sizes, signals, budget | "Your …" |
| User-provided, not verified | Shortlist items, prices the user enters, and totals of those prices | "Added by you — not verified by StyleMe", "Price entered by you — not verified by StyleMe", "Total of prices you entered — not verified by StyleMe; not a checkout price" |
| Verified | None in Stage 1 (product layer, Stage 3) | — |
| Derived | Looks, explanations, size notes | "Suggested for you", "Why this works" |
| Estimated | None in Stage 1 | — |
| Unavailable | Any missing value | "Not available" |

Test fixtures never exist in production ([DEPLOYMENT.md](DEPLOYMENT.md) §2).

---

## 7. Definition of Done

The MVP (Stage 1) is done when content set C1 is approved, every closed-beta criterion in §5.1 and §5.2 (all except AC-20 and AC-24) is met and recorded, the hosting decision (D-81) has been made at the hosting checkpoint, and the release checklist ([DEPLOYMENT.md](DEPLOYMENT.md) §8) is complete. It is released as a closed beta; public launch needs every blocker in [ImplementationPlan.md](ImplementationPlan.md) §11 (D-74 recorded complete, AC-20, AC-24). A working email provider (D-84) is needed before the closed beta, because registration requires email verification. The full product styling scope (C2, §5.5) is the Stage 2 release requirement.

---

## 8. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-07, D-46, D-86 … D-94, D-52, D-53, D-55, D-57, D-62, D-63, D-65, D-67, D-68, D-74, D-76 … D-86.

**D-77 is approved (Option B).** D-48 and D-76 stay pending and are raised only when needed; D-81 (hosting) is decided at the hosting checkpoint; D-74 (legal review) blocks public launch only.
