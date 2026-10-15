# StyleMe — Development Roadmap

> The dependency-based order in which the team builds StyleMe, with the current, evidence-based status of each milestone. It follows the approved workflow PDF (p13 "development roadmap", p9 dependency map) and maps onto the milestones and decision checkpoints in [ImplementationPlan.md](ImplementationPlan.md) §5–§7, which remain the detailed plan. No dates are given: estimates in the Implementation Plan are unmeasured and founder content hours are the pacing item (§5.2 there).

**Status:** ✅ Completed (merged to `main`, evidence given) · 🔄 In progress (some parts merged) · ⏳ Planned (ready when its dependencies are met) · ⛔ Blocked (needs a founder decision or external approval). Status checked against `main` at `781b59e`.

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
        ├──────────────► M8 Style Assistant ⛔ D-76 · Weather ⛔ Stage 2, D-60 · Virtual Try-On ⛔ D-48
        │
M7 Authorized retailer integrations ⛔ D-43 … D-45, D-46, D-50, D-51, D-74 (product layer)

M9 Integration testing, privacy and security review, hosting (HC-1), closed beta (S1.7), legal review (D-74), launch approval
   — runs after M5 for the Stage 1 closed beta; repeated for each later release
```

## 2. Milestones

| # | Milestone | Status and evidence | Owner | Implementation Plan |
|---|---|---|---|---|
| M1 | Account, onboarding, Home and profile foundation | ✅ Sign-up with email code (PR #25), top navigation (#26), Skip for now and profile completeness (#28); profile, appearance signals, settings, deletion and tombstones (S1.1–S1.3) | Kedar (maintains); profile contracts Shreya | S1.1, S1.2, S1.3 |
| M2 | Shared styling data, rules, validation and engine | 🔄 Vocabulary, record schemas, loader, linter, coverage and scale test merged (#2, #3). **Content: 0 palettes, 0 templates, 0 rules.** Engine and `outfits` not built (#11) | Shreya | S1.4, content C0 (#9), C1 (#10) |
| M3 | Discover My Style, My Colour Palette, Outfit Categories | ⏳ Placeholders only; the style-profile editor is live as "Discover My Style" | Johita (Discover, Categories), Ankita (Palette) | S1.4 results page, S1.5 (#12) |
| M4 | Saved Outfits and feedback | ⏳ Not built | Ankita | S1.5 (#13) |
| M5 | Shop My Look, initial version (shortlist and budget on user-entered prices) | ⏳ Not built | Kedar | S1.B (#8, #14) |
| M6 | Design Studio | ⛔ D-76 | Kedar | Deferred (§9) |
| M7 | Authorized retailer integrations | ⛔ No retailer has approved StyleMe (D-43 … D-45); disclosures D-46; legal review D-74 | Kedar | Product layer (§6) |
| M8 | Style Assistant, weather styling, Virtual Try-On | ⛔ Assistant D-76 · weather Stage 2, provider D-60 · try-on D-48, AI rule 16 | Shreya (assistant, weather rules), Kedar (try-on) | §7, §9 |
| M9 | Integration testing, privacy/security review, closed beta, launch approval | ⏳ Not done on `main`; the earlier issues #6, #7, #15, #16, #17 (HC-1), #18 (S1.7) are closed | Shared; see each issue | S1.6, HC-1, S1.7, HC-2 |

GitHub issues #1 … #18 were all closed on 2026-10-15 (marked completed) without new commits on `main`; statuses in this document come from the code, not from issue state. Issue numbers above refer to those earlier issues.

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
Not started until the decision is recorded in [ImplementationPlan.md](ImplementationPlan.md) §8: D-76 (Design Studio, Style Assistant), D-60 (weather provider), D-48 plus a privacy review (Virtual Try-On), D-43 … D-46, D-50, D-51, D-74 (retailers). Photo analysis and body measurements stay out of scope (D-76, FR-SIZE-06, AI rule 16).

### M9 — Integration, review, beta and launch
* **Deliverables.** Fixture safeguards (#6), Playwright E2E smoke at both viewports (#7), evaluation set and harness (#15), privacy notices and security checklist (#16), hosting checkpoint HC-1 (#17), production closed beta (#18), legal review (D-74), public-launch checkpoint HC-2.
* **Acceptance.** As in the issues and [TESTING.md](TESTING.md) §6–§7; public sign-up policy confirmed (see [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #1).

## 4. Safe parallel work and integration checkpoints

| Now (no blocking dependency) | Waits for |
|---|---|
| Shreya: schema and vocabulary audit; C0 proposal; engine against fixtures | Approved C0 content for real looks |
| Johita: Discover and Categories UI against agreed contracts and fixtures; Categories requirement draft | Engine (M2) for live results |
| Ankita: palette UI from vocabulary colours and fixture palettes; saved-look API design | `outfits` model (M2) for saving |
| Kedar: budget engine; unattached shortlist items | Saved looks (M4) to attach items to slots |

**Checkpoints.**
1. **Contracts agreed** — Shreya's recommendation, outfit and palette contracts merged and reviewed by Johita, Ankita and Kedar.
2. **First vertical slice** — on C0: occasion → looks → save → feedback → add a shortlist item, end to end on `main`. Recalibrate the remaining estimates after this (D-61).
3. **C1 release content** — coverage complete; evaluation set re-run.
4. **Stage 1 feature-complete** — M3–M5 merged; full E2E smoke; then M9.
