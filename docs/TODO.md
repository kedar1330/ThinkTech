# StyleMe — Consolidated TODO

> The single actionable checklist for the team. Each task has a stable ID, its GitHub issue, owner, dependencies and acceptance criteria. Feature behaviour: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md). Build order: [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md). Ownership: [TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.
>
> **Verified 2026-10-18** against `main` at `5b65b5c` and branch `feature/styling-foundation` at `c5e1621` (PR #68), and against GitHub issue state on the same day. GitHub is the source of truth for issue state; when this file and GitHub disagree, update this file.

**Status:** ✅ Done (merged to `main`) · 🔄 In progress (open PR or partly merged) · 🟢 Ready (no blocking dependency) · ⏸ Waiting (on another task) · ⛔ Blocked (founder decision or external approval) · 💤 Deferred (not to be started)

**Priority** is given only where the dependency graph justifies it: **P0** = on the critical path of the first vertical slice (occasion → looks → save → shortlist); **P1** = needed for the Stage 1 closed beta; **P2** = later or approval-gated.

**Stable IDs.** `TD-<area>-<n>`. IDs are never reused or renumbered. The earlier proposal IDs (SH-x, JO-x, AN-x, KE-x in [PROPOSED_ISSUES.md](PROPOSED_ISSUES.md)) are listed for traceability.

---

## 1. Critical path (first vertical slice)

```
TD-STY-01 #63 vocabulary Part 1 (only WEAR_TYPES landed) ─► TD-STY-02 #32 C0 approval (PR #68) ─┐
TD-STY-03 #33 engine on fixtures ───────────────────────────────────────────────────────────────┼─► real looks
        ├─► TD-DIS-01 #45 → TD-DIS-03 #47 → TD-DIS-04 #48            (Johita)                   │
        ├─► TD-PAL-02 #40 (after TD-PAL-01 #39)                         (Ankita)                │
        └─► TD-SAV-01 #41 → TD-SAV-02 #42                               (Ankita)                │
TD-SHP-01 #37 → TD-SHP-02 #38 → TD-SHP-03 #43 (needs #41)              (Kedar)                  ┘
```

`#33` (engine) is the single largest unblocker: it unblocks #34, #39 (data), #40, #41, #42, #45, #47, #48 and #55. **2026-10-18:** built and tested on fixtures; it unblocks them once its PR merges.

---

## 2. Shared styling foundation — Shreya

| ID | Task | Issue | Status | Pri | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|
| TD-STY-00 | Audit styling schemas and vocabulary (was SH-1) | #30 | ✅ closed; decisions D-96 … D-101 recorded (PR #62) | — | — | Gap list posted; decisions in the register |
| TD-STY-00b | Shared contracts: recommendations, looks, palettes, shortlist; reserve design and chat (was SH-5) | #31 | ✅ PR #64 merged | — | — | `outfit.ts`, `palette.ts`, `product.ts`, `common.ts` exported; 91 contract tests pass |
| TD-STY-01 | Implement #30 vocabulary decisions, Part 1: formality, 8 broad categories, garment types with size groups, template `wearType`, slot `garmentType`/`formality`, profile `preferredWearTypes`, coverage dimensions, CONTRIBUTING §6 guide | #63 | ⚠️ **Issue closed 2026-10-17 but only `WEAR_TYPES` exists** (verified: no `FORMALITY_LEVELS`, no garment types, no `wearType` on templates, no `preferredWearTypes` in `profile.ts`) | P0 | — | Every item in #63 §9 Definition of Done; no existing ID renamed; founder approves the exact IDs |
| TD-STY-01b | Vocabulary Part 2: ~60–80 colours (Indian first), fabrics (brocade/banarasi, organza, net, muslin, tissue), techniques as patterns (D-99) | #63 (Part 2) | 🟡 Drafted 2026-10-19: 63 colours (+24), 22 fabrics (+5), 17 patterns (+5 techniques); awaiting founder approval of IDs and labels | P1 | TD-STY-01 | New IDs only; founder approval; before C1 |
| TD-STY-02 | C0 content proposal (≥ 6 palettes, ≥ 6 templates, referenced rules) for founder review (was SH-2) | #32 | ✅ locally, PR pending: all 30 records founder-approved by Shreya Sharma on 2026-10-19 (version 2), moved to `src/style-rules/data/`; `style-rules lint` clean; coverage 89 empty / 54 thin cells (C1 gaps). Fabric practicality not validated | P0 | Founder approval (D-62); TD-STY-01 for `wearType`/`formality` fields (C0 uses `wear-*`/`formality-*` tags meanwhile) | Founder approves each record; `reviewStatus: approved`, `reviewedBy`, `reviewedAt` set; `style-rules lint` clean; coverage report attached |
| TD-STY-02b | Decide what to do with `StyleMe APP.txt` (1,102-line product blueprint dated 2026-10-10) added in PR #68's commit | #68 | 🟢 | P1 | — | Removed from PR #68 or moved into `docs/` deliberately; it references D-01 … D-85 only and predates D-86 … D-101 |
| TD-STY-03 | Matching and ranking engine on fixtures: `POST /v1/recommendations`, `outfits` model (7-day expiry), palette ranking for `GET /v1/style/palettes` (was SH-4) | #33 | 🔄 done locally, PR pending: engine (`services/engine/`), `POST /v1/recommendations`, `outfits` (TTL), `GET /v1/style/palettes`; AC5 verified on approved C0 (all departments × occasions) and recorded on #33; 218 API tests pass | P0 | Contracts ✅ (#31) | T-12 … T-19, T-24, T-28 pass; deterministic for the same input and content version; no hard-constraint violation; `INSUFFICIENT_MATCHES` never padded |
| TD-STY-03b | ✅ Resolved 2026-10-19 by founder-approved corrections, except the neckline mapping (still open). Founder-review notes from running the engine on the C0 drafts: FAB and STY rules with no `appliesTo.categories` reach every garment (e.g. an `embroidered` preference reaches festive trousers; `denim` and `jersey_knit` appear as kurti alternatives); metallic `gold`/`silver` serve as neutrals for bottoms; a neckline-to-coverage (`NECKLINE_DEPTHS`) mapping is needed before a neckline minimum can be enforced (today no neckline is stated then) | #32, #63 | 🟢 | P1 | Founder (D-62) | Scoped rules or confirmed as intended; mapping approved and added to the vocabulary |
| TD-STY-04 | Engine test suite and evaluation-harness integration | #34 | 🔄 PR pending: named T-12 … T-28 and T-38 tests, `runEvaluation` entry point, AC-05 … AC-08 pass on C0 (T-26 and T-27 with AI wording on are added with the #55 module; D-70 coverage measured with `test:coverage`, every file ≥ 80 %) | P1 | TD-STY-03; TD-STY-02 for AC checks | ≥ 80 % line coverage on generator and loader (D-70); AC-05 … AC-08 on C0 |
| TD-STY-05 | C1 release content set (12–20 palettes, ~20 templates, rules for every FR-STY-09 area) (was SH-3) | #35 | ⛔ | P1 | TD-STY-02 approved, TD-STY-03, TD-STY-01b | Coverage report: no empty supported cell; founder approval of every record |
| TD-STY-06 | Optional AI wording module for explanations, off by default (D-67) | #55 | ⏸ | P2 | TD-STY-03; enabling needs TD-QA-04 | AI rule 16 respected; falls back with `AI_ENHANCEMENT_SKIPPED`; off by default |
| TD-STY-07 | Style Assistant logic; shared weather-styling rules (was SH-6) | — (no issue) | 💤 | P2 | D-76 (assistant); D-60 + Stage 2 (weather) | No work until the decisions are recorded |
| TD-STY-08 | C2 full library (≥ 100 palettes, ≥ 100 templates, 8–12 categories) | — | 💤 | P2 | C1; Stage 2 | D-57; founder approval |

## 3. Discover My Style and Outfit Categories — Johita

| ID | Task | Issue | Status | Pri | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|
| TD-DIS-01 | Discover My Style request form and inputs on the shared contracts (was JO-1) | #45 | 🔄 PR open: form at `/discover/looks`; shows a found-looks message until the results page (#47) adds the redirect | P0 | Contracts ✅ | Occasion required; style, wear type, palette mode optional; keyboard accessible; usable at 320 px; field errors shown |
| TD-DIS-02 | Size notes on look slots (FR-SIZE-04) | #46 | 🟢 not started | P1 | Contracts ✅ | Saved size shown per sized slot; prompt to add one otherwise; nothing for free-size slots |
| TD-DIS-03 | Outfit results page (was JO-2; the JO-3 gallery moved to TD-FS-OCAT-01, FR-OCAT) | #47 | ⏸ | P0 | TD-STY-03, TD-DIS-01, TD-DIS-02 | AC-05 (occasion-only request → looks or a clear message); AC-08 (no duplicate combination); "no department filter applied" when no department |
| TD-DIS-04 | Ranking, explanations and alternatives UI (was JO-4) | #48 | ⏸ | P1 | TD-STY-03, TD-DIS-03 | 3–5 alternatives per slot or `ALTERNATIVES_LIMITED` (D-53); explanations shown as returned |
| TD-DIS-05 | Write the Outfit Categories requirement for founder approval | #44 | ✅ the founder's specification is FRD §4.19 (D-109, 2026-10-18); checked against PDF p16, two gaps recorded on #44 and in [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §8; gallery tracked as TD-FS-OCAT-01 | P1 | — | FRD section adopted; founder approval recorded; gaps posted |
| TD-DIS-06 | Regenerate looks after changing preferences | #49 | ⏸ | P1 | TD-DIS-03, TD-SAV-01 | Changed preference changes the next request; saved looks unchanged |
| TD-DIS-07 | Discover and Categories tests: component, integration, E2E (was JO-6) | #53 | ⏸ | P1 | TD-DIS-01 … 04, TD-QA-01 | Responsive checks at 320, 390, 768, 1366 px; empty and error states covered |
| TD-DIS-08 | Turn on the nav entries for Discover results / Outfit Categories in `apps/web/lib/features.ts` | (part of #47) | ⏸ | P1 | TD-DIS-03 | Entry has an `href`; "Coming soon" removed only when the page works (FR-UI-03) |

**Open product question (not a task until decided):** today "Discover My Style" in the navigation opens the style-profile editor (`/profile`); the look results page (#47) has no agreed route or nav label yet. See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #9.

## 4. My Colour Palette, Saved Outfits and feedback — Ankita

| ID | Task | Issue | Status | Pri | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|
| TD-PAL-01 | My Colour Palette: browse palettes and open a palette (was AN-1) | #39 | 🟢 not started (real data needs TD-STY-02, TD-STY-03) | P1 | Contracts ✅ | Swatches, names and hex codes visible; honest empty state when no approved palettes; usable at 320 px |
| TD-PAL-02 | Personalised palette ranking integration (was AN-2) | #40 | ⏸ | P1 | TD-PAL-01, TD-STY-03 | FR-PAL-01 … 03; liked colours never excluded; `suggestedBecause` shown |
| TD-PAL-03 | "Save palette" | — | 🟢 specified: FR-PAL-19 … 21 (D-109); built as TD-FS-PAL-02 | P2 | — | See §6b |
| TD-SAV-01 | Saved Outfits: save, list, open and remove looks — API and UI (was AN-3) | #41 | ⏸ | P0 | TD-STY-03 (`outfits` model) | FR-OUT-01 … 03; another user's look → `NOT_FOUND`; saving removes the expiry; removal needs confirmation |
| TD-SAV-02 | Feedback on looks, permitted preference signals, saved-look alternatives (was AN-4) | #42 | ⏸ | P1 | TD-SAV-01, TD-STY-03 | `love_it` / `not_for_me` + fixed reasons only (no free text); never overrides explicit profile choices; new collection added to `USER_OWNED_COLLECTIONS` |
| TD-SAV-03 | Labelled style illustrations on looks, only with cleared licences | #50 | ⛔ | P2 | Founder sign-off of sources (D-65) | "Style illustration — not a product" label; recorded licence |
| TD-SAV-04 | Palette and Saved Outfits tests: persistence, authorisation, UI, E2E (was AN-5) | #51 | ⏸ | P1 | TD-PAL-01 … TD-SAV-02, TD-QA-01 | Deletion and tombstone replay cover saved looks and feedback |

## 5. Shop My Look, Design Studio, Virtual Try-On — Kedar

| ID | Task | Issue | Status | Pri | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|
| TD-SHP-01 | Budget engine: pure functions for totals and status on user-entered prices (was KE-1) | #37 | 🟢 not started | P0 | — | FR-BUD; `itemsTotal ≤ budget` ⇒ within budget; INR limits; matches `userPriceSummarySchema` |
| TD-SHP-02 | Shortlist of items you found: model, API and UI | #38 | ⏸ | P0 | TD-SHP-01; contract ✅ | FR-LIST; https only; link never fetched; 200-item limit; one item per `{outfitId, slotId}`; "not verified by StyleMe" labels |
| TD-SHP-03 | Shop My Look page and "Shop this look" entry point (was KE-3) | #43 | ⏸ | P1 | TD-SHP-01, TD-SHP-02, TD-SAV-01 | No real product, price or retailer appears; clear "product data unavailable" state |
| TD-SHP-04 | Retailer product integration (was KE-2) | #57 | ⛔ | P2 | Written retailer permission (D-43 … D-45), D-46, D-74 | — |
| TD-SHP-05 | Design Studio: requirements and approval gate (was KE-4) | #56 | 💤 | P2 | D-76 | No implementation before D-76 |
| TD-SHP-06 | Virtual Try-On decision proposal (was KE-5) | #58 | 💤 for photo-based / generative try-on only; the 2D illustrative try-on is approved (D-119, TD-FS-VTO-*) | P2 | D-48, privacy review, AI rule 16 | Proposal only |
| TD-SHP-07 | 2D Virtual Try-On via a self-hosted model on serverless GPU | #65 | ⛔ superseded for the first version by D-119 (SVG layers in the browser, no model or GPU). Issue #65 not changed | P2 | D-48, #60 (GPU hosting cost), #43 | Must satisfy AI rule 16 and D-48 before any work |

## 6. Platform, quality and release

| ID | Task | Issue | Owner | Status | Pri | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| TD-QA-01 | Playwright E2E harness and auth smoke flow (both viewports) | #36 | Kedar | 🟡 in review: harness, auth smoke flow, browser-level T-47/T-48 and the `e2e` CI job | P1 | — | Runs in CI at 375×812 and 1280×800 (D-36) |
| TD-QA-02 | Complete fixture safeguards: documents, script guards, tests, CI | #52 | Ankita | 🟡 partly done (loader `FIXTURE_RECORD` guard and T-29 exist) | P1 | — | T-29, T-30; seed scripts refuse production |
| TD-QA-03 | Remaining privacy and security hardening; legal-review follow-up | #59 | Kedar | 🟡 partly done | P1 | D-74 (founder) | SECURITY §11 checklist complete |
| TD-QA-04 | Styling evaluation dataset (25–30 synthetic profiles) with measured thresholds | #54 | Johita | ⏸ | P1 | TD-STY-03, TD-STY-04, TD-STY-05; founder review | Relevance target ≥ 80 % proposed (D-52); thresholds measured, not assumed |
| TD-OPS-01 | Hosting checkpoint HC-1: present options and current costs | #60 | Kedar | ⛔ founder decision D-81 | P1 | — | D-81, D-84, D-85 store location recorded |
| TD-OPS-02 | Closed-beta readiness: backups and restore, monitoring, rollback, sign-up policy | #61 | Kedar | ⛔ | P1 | #60, #59, #52, #36, #35; D-63 policy | DEPLOYMENT §8 release checklist |
| TD-OPS-03 | Free demo deployment for the pitch (Vercel + Render Free + Atlas M0 + Brevo) | #66 | Kedar | ⛔ needs founder approval | P2 | Founder decision | **Conflicts with D-75 ("there is no demo release") and D-81 (hosting postponed)** — the founder must decide before any work ([PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #10) |

## 6a. My Profile and Home — approved 2026-10-18 (D-102 … D-106; D-108 via D-115)

Written from the My Profile and Home requirements of 2026-10-18 ([FRD.md](FRD.md) §4.1b, §4.3a). The founder approved D-102 … D-106 on 2026-10-18. **No GitHub issue exists for these yet** (none was created or changed); create issues from these rows when the team picks them up. Photo analysis and the age group keep their release gates (privacy review, D-74). Owners follow [TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md); "to confirm" means the matrix doesn't name one.

| ID | Task | Owner | Status | Pri | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|
| TD-MYP-00 | Dormant schema: contracts `my-profile.ts`, `photos.ts`; optional `profiles` fields; `appearanceProfiles.photoConsent`/`photoRetention`; `userPhotos`, `appearanceAnalyses` models; both added to `USER_OWNED_COLLECTIONS`; tests | Shreya | 🔄 local working tree (uncommitted) | — | — | 103 contract tests pass; profile API still rejects and hides the fields; deletion removes the new collections |
| TD-MYP-01 | Founder decisions D-102 (structure, measurements), D-103 (photo analysis), D-104 (age group), D-105 (export), D-108 (feedback) | Founder | ✅ approved 2026-10-18 (uncommitted docs) | P1 | — | Each recorded in [ImplementationPlan.md](ImplementationPlan.md) §8.5 as Approved |
| TD-MYP-02 | Legal review scope covers photos, measurements and under-18 users (DPDP) | Founder | ⛔ | P1 | D-74 | Recorded in D-74 before any of these fields ship |
| TD-MYP-03 | Vocabulary: `oversized` fit, body-shape card names (inclusive-language check), "Not sure" | Shreya | ⛔ needs founder approval of the IDs (D-62) | P2 | D-102 ✅, D-62 | Founder-approved IDs and labels |
| TD-MYP-04 | Section-based profile API: `PATCH /v1/profile`, measurements PUT/DELETE, reset, `sectionUpdatedAt` | Shreya (contracts) / UI owner to confirm | 🟢 | P1 | D-102 ✅ | Per-section save; contract tests; no other section changes |
| TD-MYP-05 | My Profile UI: sections with Edit/Save and Save all, unsaved-change warning, last-updated, summary, completion chart, required vs optional labels, mobile stacking, accessible cards and swatches | to confirm | ⏸ | P1 | TD-MYP-04 | FR-MYP-01, -02, -14, -16, -18; usable at 320 px |
| TD-MYP-06 | Private object storage integration (`src/integrations/storage`), provider at HC-1 | Kedar | ⛔ provider at HC-1 (D-107) | P2 | D-103 ✅, D-107, #60 | Private bucket, encryption, signed URLs; account deletion deletes objects |
| TD-MYP-07 | Photo upload, consent, retention, deletion endpoints and UI (face and body separate) | to confirm | ⏸ | P2 | D-103 ✅, TD-MYP-06 | FR-MYP-08, -09, -11; EXIF stripped; no logs of photos/URLs |
| TD-MYP-08 | On-device / own-server analysis for skin tone (face) and body shape, with confidence, review and correction | Shreya (rules) / to confirm | 🟢 build; ⛔ release needs the privacy review | P2 | D-103 ✅, privacy review | FR-MYP-04 … -06, -10; accuracy measured before confidence labels ship; face photos never go to external AI |
| TD-MYP-08b | Gemini full-body analysis module in `src/integrations/ai/` against mocks behind a disabled flag; per-use consent, metadata stripped, Zod-validated output, user confirmation, manual/measurement fallback | to confirm | 🟢 build on mocks; ⛔ real photos need the privacy review | P2 | D-122 ✅, D-74 | No real photo leaves StyleMe while the flag is off; no photo, URL or key in logs (T-70) |
| TD-MYP-09 | Data export JSON and PDF | Kedar | 🟢 | P2 | D-105 ✅ | Owner only; all profile data and measurements included |
| TD-HOME-01 | Founder decision D-106 (Home redesign) | Founder | ✅ approved 2026-10-18 | P1 | — | Recorded in §8.5 |
| TD-HOME-02 | Two-row desktop header, mobile ☰ menu, account menu (My Profile, Settings, Privacy, Sign out) | Kedar | 🟢 | P1 | D-106 ✅ | FR-HOME-02, -03, -06; keyboard and screen-reader tests |
| TD-HOME-03 | Home sections: hero, carousel with quick view, eight feature cards, recent activity, quick actions, completion chart; skeletons and per-section retry | Kedar (with feature owners for previews) | ⏸ | P1 | D-106 ✅; carousel needs #33 | FR-HOME-07 … -15; honest availability labels |
| TD-HOME-04 | Notifications and recent activity collections and endpoints | Kedar | 🟢 | P2 | D-106 ✅ | Added to `USER_OWNED_COLLECTIONS`; TTLs |
| TD-HOME-05 | Global search | to confirm | ⏸ | P2 | D-106 ✅; content to search | Only existing content is returned |
| TD-HOME-06 | Dark and system themes (dark tokens in `globals.css`) | Kedar | 🟢 | P2 | D-106 ✅ | WCAG AA in both themes |
| TD-HOME-07 | Licensed editorial imagery across wear types, body types, skin tones and ages; white shirt/pants rule for models | Kedar | 🟢 | P2 | D-106 ✅, D-65 | Credits recorded; no product implied |

## 6b. Feature specifications — D-109 … D-128 (2026-10-18)

From the founder's specifications for My Colour Palette, Outfit Categories, Discover My Style, Shop My Look, Virtual Try-On, Saved Outfits and the Admin Panel ([FRD.md](FRD.md) §4.17 – §4.24). **No GitHub issue was created or changed**; create issues from these rows when the team picks them up. Owners follow the existing areas in [TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md); "to confirm" where none applies. Milestones: [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) M10 – M14.

| ID | Task | Owner | Status | Pri | Depends on | Acceptance criteria |
|---|---|---|---|---|---|---|
| TD-FS-00 | Contracts (`catalogue.ts`, `saved-items.ts`, `admin.ts`) and declared models (`models/catalogue.ts`, `models/user-collections.ts`, optional `users`/`profiles` fields, `USER_OWNED_COLLECTIONS`); tests; docs | Shreya | 🔄 local working tree (uncommitted) | — | — | 112 contract tests and the API tests pass (except the by-design `NOT_APPROVED` lint on PR #68 drafts); no endpoint uses the new models |
| TD-FS-01 | Founder: decide D-117 (saved palettes location) and D-122 (Gemini for body photos) | Founder | ✅ 2026-10-18: D-117 = a (My Colour Palette only), D-122 = b (Gemini, full-body only, after the privacy review) | P1 | — | Recorded in [ImplementationPlan.md](ImplementationPlan.md) §8.6 |
| TD-FS-02 | Vocabulary values for new attributes (collar, sleeve design, shoulder, hem, drape, rise, waistband, leg shape, skirt shape, waist placement, layering) and body-shape labels through the inclusive-language check | Shreya | 🟢 needs founder approval (D-62) | P1 | — | New IDs only; `GARMENT_ATTRIBUTES[].values` filled; founder approval recorded |
| TD-FS-03 | Switch the dormant `bodyShapeChoiceSchema` (`my-profile.ts`) to `BODY_SHAPES` IDs so profile and catalogue use one list | Shreya | 🟢 | P2 | D-102 ✅ | One definition; descriptors derived from the mapping |
| TD-FS-CAT-01 | Catalogue import script: approved style-rules files → MongoDB by ID and version; same Zod schemas and linter; idempotent | Shreya | 🔄 built locally 2026-10-18 (uncommitted): `pnpm --filter @styleme/api catalogue:import [--include-drafts]`, `src/services/catalogue-import.ts`, T-80 in `tests/api/catalogue-import.test.ts` | P0 | TD-FS-00 | T-80; drafts never published |
| TD-FS-CAT-02 | Engine library interface fed from published MongoDB records (in-memory index, refreshed after publish) | Shreya | ⏸ | P0 | TD-STY-03 (#33), TD-FS-CAT-01 | T-84, T-85; FR-STY-10 scale test still passes |
| TD-FS-CAT-03 | Styling-rule extension (body shapes, goals, measurement ratios, benefit and trade-off) and palette extension (roles, temperature, seasonal, harmony, moods, examples) in `style-rules/schemas.ts` | Shreya | 🟢 | P1 | TD-FS-02 | Optional fields; existing records valid; linter covers the new fields |
| TD-FS-CAT-04 | Suitability engine and catalogue read API (F1 – F7): recommendations with reasons, `NO_SUITABLE_MATCH`, general results, diversity | Shreya | ⏸ | P0 | TD-FS-CAT-02, TD-FS-CAT-03 | T-86 … T-90; explanations cite only matched rules |
| TD-FS-CAT-05 | Natural-language parser (D-123); optional AI behind a flag, off | Shreya | ⏸ | P2 | TD-FS-CAT-04 | T-91, T-92 |
| TD-FS-CAT-06 | First croquis and technical-flat set with recorded rights; base figures per body shape in white shirt and pants; try-on layers for a starter set | to confirm (illustrator) | 🟢 needs founder sign-off of sources (D-65, D-113) | P1 | — | Every asset has rights verified, alt text, `figureClothing`; no publish without rights |
| TD-FS-CAT-07 | Women's starter catalogue: categories, attribute values, styles and suitability rules for tops, bottoms, dresses, Indian ethnic; then men's to the same depth | Shreya (rules) + founder (approval) | ⏸ | P1 | TD-FS-02, TD-FS-CAT-03, TD-FS-CAT-06 | Founder approval of every record; coverage report shows no empty supported cell |
| TD-FS-DMS-01 | Discover My Style page: overview, sections, style detail, combined selections, colour step, hand-offs (FR-DMS) | Johita | ⏸ | P1 | TD-FS-CAT-04 | FR-DMS-17; T-93 … T-95, T-98 |
| TD-FS-OCAT-01 | Outfit Categories: overview, tiles, filters, search, sort, compare, detail pages (FR-OCAT) | Johita | ⏸ | P1 | TD-FS-CAT-04 | FR-OCAT-26; T-93, T-96 … T-98 |
| TD-FS-PAL-01 | My Colour Palette page order, filters, search, detail panel, swatch copy, feedback (FR-PAL-04 … 18, -24 … -30) | Ankita | ⏸ | P1 | TD-FS-CAT-01, palette ranking (#40) | T-99, T-100, T-103 |
| TD-FS-PAL-02 | Save palettes and custom palettes (F10, F11; FR-PAL-19 … 21) | Ankita | ⏸ | P1 | TD-FS-SAV-01 | T-101, T-102, T-104 |
| TD-FS-SAV-01 | Saved-items API and collections (F12 – F20), feedback and personalisation (F21 – F23) | Ankita | ⏸ | P0 | TD-FS-00 | T-105 … T-112; deletion and replay cover the collections |
| TD-FS-SAV-02 | Saved Outfits page: sections, cards, search, filters, sort, detail, edit, duplicate, Save as New Look, Undo (FR-SAVE) | Ankita | ⏸ | P1 | TD-FS-SAV-01 | FR-SAVE-18 |
| TD-FS-SAV-03 | `SaveToggle` on every source feature, with live saved status (F14) | Ankita + feature owners | ⏸ | P1 | TD-FS-SAV-01 | Unsaving anywhere updates every indicator |
| TD-FS-SHP-01 | Shop My Look search with inherited context, filters, sort, outfit assembly and totals, report issue, honest unavailable state (F24 – F27) | Kedar | ⏸ | P1 | TD-SHP-01 (#37), TD-FS-SAV-01; real products need TD-SHP-04 | FR-SHOP-18 within the data available; T-113 … T-120 |
| TD-FS-VTO-01 | 2D try-on: canvas, model variants, layering and compatibility, recolour, undo/reset, save and reopen (FR-VTO) | Kedar | ⏸ | P1 | TD-FS-CAT-06 (layers), TD-FS-SAV-01 | FR-VTO-15; T-121 … T-126 |
| TD-FS-ADM-01 | Admin access: `/admin` route group, `/v1/admin/me`, RBAC middleware, audit logging, provisioning of the Super Admin record | to confirm | 🟢 | P1 | TD-FS-00 | T-127, T-128, T-131, T-134 |
| TD-FS-ADM-02 | Admin catalogue and palette editors: drafts, validation, founder approval, publish, archive, bulk | to confirm (with Shreya) | ⏸ | P1 | TD-FS-ADM-01, TD-FS-CAT-01 | T-81 … T-84, T-133 |
| TD-FS-ADM-03 | Admin dashboard aggregates and `usageDailyStats`, `users.lastActiveAt`; Try-On Monitoring | to confirm | ⏸ | P2 | TD-FS-ADM-01 | T-132; no personal data in responses |
| TD-FS-ADM-04 | Admin users: search, suspend, reactivate, start deletion | to confirm (Kedar for accounts) | ⏸ | P1 | TD-FS-ADM-01 | T-129, T-130 |
| TD-FS-ADM-05 | Admin products, import runs and product reports | Kedar | ⛔ data needs TD-SHP-04 | P2 | TD-FS-ADM-01, product layer | Authorised records only |
| TD-FS-CONN-01 | Hand-off URL contracts and Back/return state for every FR-CONN-08 journey; E2E tests | each feature owner; Kedar (E2E harness #36) | ⏸ | P1 | TD-QA-01 and the features | Every FR-CONN-08 journey passes at both viewports |

## 7. Documentation and housekeeping (found in the 2026-10-18 audit)

| ID | Task | Owner | Status | Acceptance criteria |
|---|---|---|---|---|
| TD-DOC-01 | Reopen or replace #63: it is closed but Part 1 is not implemented | Shreya | 🟢 | GitHub state matches the code |
| TD-DOC-02 | Update #32's issue body: it says "Not started (waits for #63 Part 1)" while PR #68 is open | Shreya | 🟢 | Status line matches PR #68 |
| TD-DOC-03 | Resolve the public sign-up conflict: D-63 says `PUBLIC_SIGNUP_ENABLED=false`; the code defaults to `true`; the landing page says both "Closed beta · registration by invitation" and "Anyone can sign up" | Founder; then Kedar | ⛔ | One policy, reflected in D-63, `env.ts`, the landing page and the FAQ |
| TD-DOC-04 | The API refuses to start on any branch with draft records (`api_start_failed … NOT_APPROVED`), so PR #68 cannot be run locally | Shreya | 🟢 | Either a documented local-review procedure (e.g. review drafts with `style-rules lint`/`coverage` only) or an explicitly approved dev-only option; production behaviour unchanged |
| TD-DOC-05 | `slotIdSchema` and the ID regexes are defined both in `packages/contracts/src/common.ts` and `apps/api/src/style-rules/schemas.ts` (CLAUDE.md: never duplicate a schema) | Shreya | 🟢 | One definition, imported by the other |
| TD-DOC-06 | Windows checkouts with `core.autocrlf=true` fail `pnpm format:check` (CRLF); `prettier --check --end-of-line auto .` passes | Kedar | 🟢 | `.gitattributes` with `eol=lf` or a documented local setting |
| TD-DOC-07 | `apps/web/app/globals.css` cites a "FRONTEND.md" that doesn't exist; [UI_DESIGN.md](UI_DESIGN.md) now documents the design system | Kedar | 🟢 | Comment points to `docs/UI_DESIGN.md` |
| TD-DOC-08 | Register-form city hint says "Used for weather- and region-aware styling", but weather is Stage 2 (D-60) | Kedar | 🟢 | Copy describes only current use |
| TD-DOC-09 | D-71 usage KPIs must be defined before the closed beta ends | Founder | 💤 | Recorded in the register |

---

## 8. Done (for reference)

| Work | Evidence |
|---|---|
| Monorepo, contracts, Express skeleton, CI, Dockerfile | `main`; issue #1 |
| Accounts: sign-up with 6-digit email code, Google sign-in, login lockout, Remember Me, reset by link or code, email and password change, phone, deletion with tombstones | PR #25 and earlier; [API.md](API.md) §3.1 |
| Style profile with category sizes and fit; self-reported appearance signals | PR #22, #21 (issues #4, #5) |
| Style vocabulary; knowledge-base tooling (schemas, loader, linter, coverage, scale test) | PR #19, #20 (issues #2, #3) |
| Top navigation; optional onboarding with Skip for now; profile completeness | PR #26, #28 |
| Team documentation; vocabulary decisions D-96 … D-101; shared contracts; CLAUDE.md | PR #29, #62, #64, #67 |
