# StyleMe — Development Roadmap

> The dependency-based order in which the team builds StyleMe, with the current, evidence-based status of each milestone. It follows the approved workflow PDF (p13 "development roadmap", p9 dependency map) and maps onto the milestones and decision checkpoints in [ImplementationPlan.md](ImplementationPlan.md) §5–§7, which remain the detailed plan. No dates are given: estimates in the Implementation Plan are unmeasured and founder content hours are the pacing item (§5.2 there).

**Status:** ✅ Completed (merged to `main`, evidence given) · 🔄 In progress (some parts merged) · ⏳ Planned (ready when its dependencies are met) · ⛔ Blocked (needs a founder decision or external approval). Status checked on 2026-10-18 against `main` at `5b65b5c` and the open PR #68. Task-level checklist: [TODO.md](TODO.md).

## 1. Dependency graph

```
M1 Account, onboarding, Home, profile ✅
        │
        ▼
M2 Shared styling data, rules, validation, engine 🔄  ◄── founder approval of content (D-62)
        │
        ├──────────────► M3 Discover My Style · My Colour Palette · Outfit Categories ⏳
        │                        │
        │                        ▼
        │               M4 Saved Outfits and feedback ⏳
        │                        │
        │                        ▼
        │               M5 Shop My Look — shortlist and budget on user-entered prices ⏳
        │                        │                     (budget engine can start now)
        │                        ▼
        │               M6 Design Studio ⛔ D-76
        │
        ├──────────────► M8 Style Assistant ⛔ D-76 · Weather ⛔ Stage 2, D-60 · photo-based try-on ⛔ D-48 (2D try-on → M13)
        │
M7 Authorized retailer integrations ⛔ D-43 … D-45, D-46, D-50, D-51, D-74 (product layer)

M9 Integration testing, privacy and security review, hosting (HC-1), closed beta (S1.7), legal review (D-74), launch approval
   — runs after M5 for the Stage 1 closed beta; repeated for each later release

Feature specifications of 2026-10-18 (D-109 … D-128) — extend M2 – M8:
M10 Shared catalogue in MongoDB + suitability engine ⏳ (after M2's engine interface)
        ├──► M11 Discover My Style + Outfit Categories (full specification) ⏳
        ├──► M12 My Colour Palette (full) + Saved Outfits (one save system) ⏳
        │            └──► M13 Shop My Look (full; products still need M7) + 2D Virtual Try-On ⏳
        └──► M14 Admin Panel ⏳ (catalogue editing replaces PR-based content changes once live)
```

## 2. Milestones

| # | Milestone | Status and evidence | Owner | Implementation Plan |
|---|---|---|---|---|
| M1 | Account, onboarding, Home and profile foundation | ✅ Sign-up with email code (PR #25), top navigation (#26), Skip for now and profile completeness (#28); profile, appearance signals, settings, deletion and tombstones (S1.1–S1.3) | Kedar (maintains); profile contracts Shreya | S1.1, S1.2, S1.3 |
| M2 | Shared styling data, rules, validation and engine | 🔄 Merged: vocabulary, record schemas, loader, linter, coverage and scale test (#2, #3); audit and decisions D-96 … D-101 (#30, PR #62); shared contracts for looks, palettes and shortlist (#31, PR #64). **Not done:** vocabulary decisions beyond `WEAR_TYPES` (#63 Part 1 — closed but not implemented; Part 2 merged in PR #75). **C1 (#35) founder-approved 2026-10-20 (16 palettes, 21 templates, 20 styling and 11 fabric rules); #54 evaluation on C1 passes 28/28 (2026-10-20, content version `8e50e8ae24e5a11e`), AC-10 founder relevance review completed (129/135 relevant, 95.6 %, meets target).** **Merged 2026-10-19 (PR #71):** C0 content in the shipped library, founder-approved by Shreya Sharma on 2026-10-19 (version 2); engine, `POST /v1/recommendations`, `outfits` model and palette ranking (`GET /v1/style/palettes`), verified on fixtures and on approved C0 (#33, AC5). **Merged 2026-10-19 … 20 (PR #74, PR #87):** engine tests T-12 … T-28 and T-38, evaluation entry point, AC-05 … AC-08 on C0 (#34, closed) | Shreya | S1.4, content C0 (#32), C1 (#35) |
| M3 | Discover My Style, My Colour Palette, Outfit Categories | ⏳ Placeholders, plus the Discover My Style request form at `/discover/looks` (#45) and its results (#47, PR open). Issues #45, #46, #47, #48, #44, #53 (Johita); #39, #40 (Ankita). #39, #45, #46 can start now on the merged contracts | Johita (Discover, Categories), Ankita (Palette) | S1.4 results page, S1.5 |
| M4 | Saved Outfits and feedback | 🔄 Saved Outfits (#41), feedback + saved-look alternatives (#42), and tests (#51) implemented. Issues #49 (regenerate), #50 (blocked) | Ankita (#49 Johita) | S1.5 |
| M5 | Shop My Look, initial version (shortlist and budget on user-entered prices) | 🔄 Budget engine (#37) and shortlist (#38) merged; Shop My Look page with attaching and price summaries in review (#43) | Kedar | S1.B |
| M6 | Design Studio | ⛔ D-76 (#56) | Kedar | Deferred (§9) |
| M7 | Authorized retailer integrations | ⛔ No retailer has approved StyleMe (D-43 … D-45); disclosures D-46; legal review D-74 (#57) | Kedar | Product layer (§6) |
| M8 | Style Assistant, weather styling, photo-based Virtual Try-On | ⛔ Assistant D-76 · weather Stage 2, provider D-60 · photo-based or generative try-on D-48, AI rule 16 (#58; proposal #65 needs founder approval). The 2D illustrative try-on is approved (D-119) and planned in M13 | Shreya (assistant, weather rules), Kedar (try-on) | §7, §9 |
| M9 | Integration testing, privacy/security review, closed beta, launch approval | ⏳ Not done on `main`. Open issues: #36 Playwright, #52 fixture safeguards (implemented; PR pending), #54 evaluation set, #55 optional AI wording (merged with the flag off in PR #87 and closed; enabling is a separate D-67 step after the #54 evaluation), #59 hardening (done), #60 HC-1 (✅ completed: D-81, D-84, D-85, D-107, D-121 decided), #61 closed-beta readiness; #66 demo deployment proposal (superseded by D-81 100% free stack). Earlier #6, #7, #15–#18 are closed | Shared; see each issue | S1.6, HC-1, S1.7, HC-2 |
| M10 | Shared catalogue in MongoDB and suitability engine (D-110 … D-114) | ⏳ Models and contracts **declared** (2026-10-18, unused); not done: import script, catalogue read API (F1 – F7), suitability rules extension, engine index from MongoDB, illustration pipeline and first croquis set, body-shape vocabulary approval | Shreya (engine, import, rules); illustrations: owner to confirm | S1.4 (extends) |
| M11 | Discover My Style and Outfit Categories, as specified | ⏳ FRD §4.17, §4.19; issues to be created (none created or changed). Outfit Categories design features (necklines, sleeves …, D-132) built and uncommitted; its 136 suitability rules await founder approval | Johita | S1.5 (extends) |
| M12 | My Colour Palette (full) and Saved Outfits (one save system) | ⏳ FRD §4.18, §4.22; models declared; saved palettes only in My Colour Palette (D-117 = a). Colour library (Monk tone → undertone → 120 colours, liked/avoided, D-133) built and uncommitted; content approved; users see only their own skin tone and undertone. Issue #105: My Colour Palette shows only My colours, with coordinating colours and stored curated combinations (TD-PAL-04) — 🔄 built on `feature/105-my-colours-combinations`, PR pending | Ankita | S1.5 (extends) |
| M13 | Shop My Look (full) and 2D Virtual Try-On | ⏳ FRD §4.20, §4.21; real products still M7; try-on needs layer assets | Kedar | S1.B (extends) |
| M14 | Admin Panel | ⏳ FRD §4.23; models declared; MFA D-121 decided (TOTP app) at HC-1 | Owner to confirm | New |
| M15 | My Profile and Home redesign (D-102 … D-106, approved 2026-10-18; D-129, D-130 on 2026-10-22) | 🟡 **My Profile built 2026-10-22 (D-129, uncommitted):** Clothing Preference, photo/manual skin tone and undertone, measurement/photo body type, fit measurements, Gemini photo analysis, photos in MongoDB, new logo (D-130); Home redesign, per-section save, reset and export still to do. FRD §4.1b, §4.3a, §4.3b; dormant schema declared (uncommitted); TODO §6a. Release gates: privacy review and D-74 for photo analysis and the age group; D-107 storage decided at HC-1 (Cloudflare R2 Free); full-body Gemini analysis only after the privacy review (D-122) | Shreya (contracts, analysis rules), Kedar (Home, storage, export); My Profile UI owner to confirm | New |

GitHub issues #1 … #18 were all closed on 2026-10-15 (marked completed) without new commits on `main`; statuses in this document come from the code, not from issue state. The current work is in issues #30 … #66.

The order matches the recorded decisions: content gates the engine (D-57, D-62); the shortlist follows saved looks (S1.B after S1.5); hosting is decided at HC-1 after S1.5 and S1.B (D-81); public launch waits for the legal review (D-74).

## 3. Deliverables, acceptance and approvals

### M2 — Shared styling data, rules, validation and engine (Shreya)
* **Deliverables.** Audit of schemas and vocabulary against PDF p1 and p9; C0 seed proposal (≥ 6 palettes, ≥ 6 templates, referenced rules); founder-approved C0 merged; engine (`POST /v1/recommendations`, `outfits` model with 7-day expiry, ranking, diversity, alternatives, explanations); contracts for recommendations, outfits and palettes; C1 release set (12–20 palettes, about 20 templates, rules covering every FR-STY-09 area).
* **Acceptance.** `style-rules lint` clean; coverage report shows no empty supported cell (C1); engine tests T-12 … T-19, T-24, T-28; AC-05 … AC-08 on C0, re-verified on C1.
* **Approvals.** Founder approves every record (D-62). C0 is temporary development input; C1 is release scope (D-57).

### M3 — Discover My Style, My Colour Palette, Outfit Categories (Johita, Ankita)
* **Deliverables.** Request form and results with explanations and alternatives (Johita); palette suggestions and browse-all with swatches, names and codes (Ankita); category gallery once its requirement is approved (Johita).
* **Acceptance.** Occasion-only requests return looks or `INSUFFICIENT_MATCHES`; no padded or duplicate results; liked colours never excluded; "no department filter applied" shown when no department is set; usable from 320 px to desktop.
* **Approvals.** Outfit Categories gallery requirement (no FRD section yet).

### M4 — Saved Outfits and feedback (Ankita)
* **Deliverables.** Save, list, open and remove with confirmation; feedback with optional reason; request alternatives; owner-only access; saved data removed on account deletion.
* **Acceptance.** FR-OUT-01 … 04; authorisation tests; deletion and tombstone replay cover the new collections.

### M5 — Shop My Look, initial version (Kedar)
* **Deliverables.** Budget engine (pure functions); shortlist of user-found items, attachable to a look slot; budget summary on saved looks; Shop My Look page with filters and clear unavailable-data states.
* **Acceptance.** FR-LIST, FR-BUD; labels "not verified by StyleMe"; links never fetched; no real products or prices.
* **Approvals.** None for user-entered data (D-77 = B). Real products need M7.

### M6 – M8 — Approval-gated
Not started until the decision is recorded in [ImplementationPlan.md](ImplementationPlan.md) §8: D-76 (Design Studio, Style Assistant), D-60 (weather provider), D-48 plus a privacy review (photo-based or generative Virtual Try-On; the 2D try-on is M13), D-43 … D-46, D-50, D-51, D-74 (retailers). Body measurements and photo analysis are approved for Stage 1 (D-102, D-103; see the My Profile row), and photo analysis ships only after the privacy review.

### M10 – M14 — Feature specifications (D-109 … D-128)
* **Deliverables.** M10: catalogue import (idempotent, by ID and version), catalogue read API, suitability engine with explainable reasons, palette ranking by tone and undertone first, natural-language parser, illustration records with rights, first croquis set (white shirt and pants figures). M11: Discover My Style page and sections, style detail, colour step, combined selections, hand-offs; Outfit Categories overview, tiles, filters, search, sort, compare, detail pages. M12: palette page order, filters, detail panel, save, custom palettes, feedback; saved-items API, collections, favourites, detail, duplicate and Save as New Look. M13: shop search with inherited context, outfit assembly and totals, report issue, honest unavailable state; 2D try-on canvas, model variants, layering, recolour, save and reopen. M14: admin access and RBAC, dashboard aggregates, catalogue and palette editors with approval and publish, users (suspend, reactivate), products, try-on monitoring, audit log.
* **Acceptance.** FRD acceptance rows (FR-DMS-17, FR-PAL-30, FR-OCAT-26, FR-SHOP-18, FR-VTO-15, FR-SAVE-18, FR-ADM-01 … 12); [TESTING.md](TESTING.md) T-80 … T-134; every FR-CONN-08 journey passes end to end; no simulated action.
* **Approvals.** Founder approval of all styling content and of new vocabulary values (D-62); the privacy review (D-74) before any real full-body photo goes to Gemini (D-122 = b); D-121 at HC-1; product data per M7. Saved Outfits has no Palettes tab (D-117 = a).

### M9 — Integration, review, beta and launch
* **Deliverables.** Fixture safeguards (#6), Playwright E2E smoke at both viewports (#7), evaluation set and harness (#15), privacy notices and security checklist (#16), hosting checkpoint HC-1 (#17), production closed beta (#18), legal review (D-74), public-launch checkpoint HC-2.
* **Acceptance.** As in the issues and [TESTING.md](TESTING.md) §6–§7; public sign-up policy confirmed (see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #1).

## 4. Safe parallel work and integration checkpoints

| Now (no blocking dependency) | Waits for |
|---|---|
| Shreya: vocabulary Part 1 (#63); engine tests (#34) and AI wording (#55) on the #33 engine | #33 merged (C0 approved 2026-10-19) |
| Johita: request form (#45), size notes (#46), Categories spec check (#44, done) | #33 merged for live results (built and verified on C0; PR pending) |
| Ankita: palette browsing (#39) against the merged contract and fixtures | #33 merged for `GET /v1/style/palettes` and the `outfits` model used by saving (#41) |
| Kedar: budget engine (#37); Playwright harness (#36); unattached shortlist items (#38) | Saved looks (#41) to attach items to slots |

**Checkpoints.**
1. **Contracts agreed** — ✅ reached 2026-10-16: recommendation, outfit, palette and shortlist contracts merged (#31, PR #64).
2. **First vertical slice** — on C0: occasion → looks → save → feedback → add a shortlist item, end to end on `main`. Recalibrate the remaining estimates after this (D-61).
3. **C1 release content** — coverage complete; evaluation set re-run.
4. **Stage 1 feature-complete** — M3–M5 and M10–M14 merged; every FR-CONN-08 journey passes; full E2E smoke; then M9.
