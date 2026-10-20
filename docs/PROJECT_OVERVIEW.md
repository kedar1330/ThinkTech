# StyleMe — Project Overview

> What StyleMe does, how each part of the app is meant to behave, and what exists today. Detailed requirements live in [FRD.md](FRD.md); decisions in [ImplementationPlan.md](ImplementationPlan.md) §8; the build order in [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md); who does what in [TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md).
>
> GitHub issues #1 … #18 were all closed on 2026-10-15 (marked completed) without new commits on `main`; statuses in this document come from the code, not from issue state. The remaining work is tracked in issues #30 … #66 (created 2026-10-16/17); the consolidated checklist is [TODO.md](TODO.md). Technical specification: [SPECS.md](SPECS.md); screens: [UI_DESIGN.md](UI_DESIGN.md).
>
> The intended behaviour follows the approved workflow (`StyleMe_all_pages.pdf`, 20 pages; referenced below as "PDF page n"). Where the PDF and a recorded decision differ, the decision applies until the founder changes it (§15).

**Status legend** — verified on 2026-10-18 against the code on `main` at `5b65b5c`; work that exists only in an open pull request is named as such (PR #68, branch `feature/styling-foundation`):

| Status | Meaning |
|---|---|
| ✅ Built | Working end to end (UI, API, data, tests) |
| 🟡 Partial | Some of the intended behaviour works; the rest is listed |
| ⬜ Placeholder | Only a "Coming soon" page exists; no feature logic |
| ⛔ Deferred / blocked | Not to be built until the named decision or approval |

---

## 1. What StyleMe is

StyleMe is a personal styling web app for users in India. It suggests complete looks — what to wear for an occasion, in colours and cuts that suit the user's stated preferences — and explains why each suggestion fits. It is a styling guide, not a shop: it does not sell clothes, and it never invents products, prices or availability ([FRD.md](FRD.md) FR-DATA).

**Problem.** People know the occasion they are dressing for but not how to put an outfit together: which colours work for them, which cuts and fabrics suit the occasion, what to search for, and how to stay within a budget. Generic shopping sites show products, not reasons.

**Intended users.** Adults in India dressing for everyday, work, festive, wedding, party, date, travel and formal occasions, across Indian, fusion and western wear, in the women's and men's departments (or "show me everything").

**Goals.**
* Explainable, deterministic look suggestions built from a curated, founder-approved style knowledge base ([AI.md](AI.md) §3–§4).
* Respect for privacy: appearance signals are optional, self-reported and deletable; optional photo analysis (approved, D-103) needs consent and ships only after the privacy review ([SECURITY.md](SECURITY.md), AI rule 16, D-122).
* Honesty about data: user-entered prices are labelled as such; real products appear only from authorised sources ([FRD.md](FRD.md) FR-DATA, D-43 … D-46).

---

## 2. The journey (PDF p2, p5, p8, p9, p12)

```
Landing → Sign up (email + 6-digit code, or Google) → Style profile setup  ──or──  Skip for now
        → Home (Personalized home + "Complete your profile")
        → Discover My Style → My Colour Palette → Outfit Categories
        → a selected look → Save it · Shop for it · (later) Try it on · (later) Customise it in Design Studio
```

All nine sections are reachable from the top navigation (PR #26): Home, Discover My Style, My Colour Palette, Outfit Categories, Shop My Look, Virtual Try-On, Design Studio, Style Assistant, Saved Outfits. Sections that are not built show an honest "Coming soon" page and never a mock-up ([FRD.md](FRD.md) FR-UI-03, FR-DATA-02).

**Shared dependency (PDF p9, p13):** every styling feature depends on the **shared styling rules and databases** — the palettes, outfit templates and rules in `apps/api/src/style-rules/` — and the look engine built on them. Those data files are **empty on `main`** today (C0 drafts exist only in PR #68, unapproved), and the engine is not built, so no styling feature can show real results until both land ([DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) M2).

**Feature specifications of 2026-10-18 (D-109 … D-128).** The founder specified My Colour Palette, Outfit Categories, Discover My Style, Shop My Look, Virtual Try-On (2D), Saved Outfits and an Admin Panel in detail ([FRD.md](FRD.md) §4.17 – §4.24). The sections below summarise each one under **Specified**; statuses still describe the code. The data model is declared but unused ([DATABASE.md](DATABASE.md) §3.10 – §3.14, §4a, §4b); the shared catalogue moves into MongoDB (D-110); build order is [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) M10 – M14; tasks are [TODO.md](TODO.md) §6b.

**Missing information (PDF p10):** a feature checks the inputs it needs. If one is missing it explains what is missing, offers general results when it can work without it, and offers to add the information. The shared helpers for this exist: `profileCompleteness()` and `departmentScope()` in `packages/contracts/src/profile-completeness.ts`.

---

## 3. Account, onboarding and Home — ✅ Built

**Purpose.** Create an account, verify the email, optionally describe your style, and land on a personalised Home.

**Flow (verified).** Sign up with name, email, password, city, optional mobile number and consent → a 6-digit code is emailed; the account is created only when the code is verified in the same browser → **Set up now** (style profile, then optional appearance signals) **or Skip for now** → Home. Google sign-up asks for a StyleMe password first. Login sends each user to their next onboarding step; users who skipped go straight to Home.

| | |
|---|---|
| Required inputs | Sign-up: name, email, password, city, terms. Set up now: department (city for Google sign-ups). Skip: nothing |
| Optional inputs | Phone, marketing consent, Remember me; every other profile field; appearance signals |
| Outputs / actions | Verified account and session; Home with greeting, style-profile summary, Discover My Style card and the list of upcoming sections; **Complete your profile** card, avatar dot and menu item while the profile is incomplete |
| States | Wrong / expired / reused code, lockout after 3 wrong codes, resend cooldown, delivery failure ("We could not send the verification email"), login lockout, "Not set — showing all departments" when no department |
| Status | ✅ PR #25 (sign-up with email code), PR #26 (top navigation), PR #28 (Skip for now, profile completeness) |
| Owner | Kedar (maintains account, onboarding, Home and navigation — see [TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md) §2) |
| Docs | [FRD.md](FRD.md) FR-AUTH, FR-ONB-01 … 05, FR-UI; [API.md](API.md) §3.1; [DATABASE.md](DATABASE.md) §3.1 |

**Profile completeness** counts seven items: department, city, at least one size, liked colours, occasions, styles and budget per look. Appearance signals and finer preferences never make a profile incomplete.

**Home redesign — ⏳ approved 2026-10-18 (D-106), not built** ([FRD.md](FRD.md) §4.1b, FR-HOME-01 … 18). Two-row desktop header (logo, global search, notification bell, account menu; then all nine sections with icons), mobile ☰ menu at the top left; hero with first name and a personalised look; outfit carousel (personalised, general and seasonal looks) with quick view; all eight feature cards with images and accurate availability; recent activity, continue links, quick actions and a profile-completion chart; skeletons and per-section retry; light/dark/system theme. The style summary shows only preferred styles and occasions. No `home` collection — Home reads existing collections; only notifications and recent activity are stored ([DATABASE.md](DATABASE.md) §3.9). Not built: today's Home is as described above.

---

## 4. Profile, preferences, consent and privacy (PDF p4, p11, p12) — 🟡 Partial

**Purpose.** Keep the information StyleMe uses accurate and under the user's control.

| Area | Status | Details |
|---|---|---|
| Style profile (department, sizes per category, fit, liked and disliked colours, contrast, silhouettes, coverage, comfort, fabrics, styles, occasions, budget per look) | ✅ | `/profile` (labelled Discover My Style), `GET/PUT /v1/profile` |
| Skin tone (Monk range) and undertone, body proportions — self-reported, with a "use in recommendations" switch and clear | ✅ | `/profile#appearance`, `GET/PUT /v1/appearance` |
| Name, city, marketing consent, email change (verified), password change (emailed code), optional phone | ✅ | `/settings` |
| Account deletion (emailed code + confirmation; tombstone so backups can't restore it) | ✅ | `/settings#delete`, D-85 |
| **Body measurements** (PDF p4, p11) | ⏳ | Approved 2026-10-18 (D-102, revises FR-SIZE-06); not built. Size recommendations still need size charts |
| **Face / full-body photos and photo-based estimates** (PDF p1, p11) | ⏳ | Approved 2026-10-18 (D-103); not built. Ships only after the privacy review; face photos never go to external AI, full-body photos may use Gemini (D-122) |
| **Request a copy of my data** (PDF p4 "Request Data") | ⬜ | Not specified in the FRD — needs a founder decision (§15 #8) |

**Owner:** Kedar for account and settings; the profile form is shared — fields that styling features consume are agreed with Shreya ([TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md) §6).

**My Profile redesign — ⏳ approved 2026-10-18 (D-102 … D-105), not built** ([FRD.md](FRD.md) §4.3a, FR-MYP-01 … 19). Sections with their own Save (plus Save all): Basic information (name, optional age group, optional city, Men's / Women's), Skin tone & undertone (face photo or manual cards), Body shape (full-body photos, measurements and/or manual cards, with confidence and review), Body measurements (essential + detailed, cm/in, manual only), Style & fit (Slim/Regular/Relaxed/Oversized per category, styles, colours, occasions incl. custom, default and per-category budgets). Consent per photo kind, retention choice, separate deletion of photos, results and measurements, reset preferences, JSON/PDF export, completion chart. Storage: extend `profiles`, new `userPhotos` (files in private object storage) and `appearanceAnalyses` — **declared in the models but unused; no endpoint accepts these fields** ([DATABASE.md](DATABASE.md) §3.2, §3.7, §3.8). Release gates: the age group and photo analysis need the privacy review and D-74 legal review; photo upload needs storage deletion on account deletion and D-107 storage.

---

## 5. Shared styling foundation (PDF p1, p9, p13) — 🟡 Partial (tooling only)

**Purpose.** The single source of styling knowledge every feature uses: a colour vocabulary, palettes (cool, warm, neutral, olive or any undertone; low to high contrast), outfit templates by department, wear type, occasion and style, styling/fit and fabric rules, and the deterministic engine that combines them with the user's profile.

| Part | Status | Where |
|---|---|---|
| Shared vocabulary: departments, occasions, styles, wear types (D-96), slot types, size groups, 11 categories, 63 colours with swatch hex codes (Indian colours added, D-99), fabrics, silhouettes, fits, necklines, patterns and Indian techniques, coverage, undertones, Monk tones, proportions | ✅ | `packages/contracts/src/style-vocabulary.ts` |
| **Decided vocabulary changes (#30 audit, D-97 … D-100):** 8 broad categories with garment types, slot formality, template `wearType`, profile `preferredWearTypes`, colour and fabric growth, coverage-report dimensions | ⬜ Decided, not implemented. **Issue #63 was closed on 2026-10-17, but only `WEAR_TYPES` exists** (verified 2026-10-18) | #63 Part 1 before C0 approval, Part 2 before C1 |
| Shared contracts: recommendation request/response, look, slot, alternatives, saved looks, feedback, palettes, shortlist and user-entered price summary | ✅ Contract only (no endpoint or model yet) | `packages/contracts/src/{outfit,palette,product,common}.ts` (#31, PR #64); `design.ts`, `chat.ts` reserved and empty |
| Record schemas, loader, linter (contradictions, duplicates, unknown references, judgemental language), coverage report, scale test | ✅ | `apps/api/src/style-rules/`, `pnpm --filter @styleme/api style-rules lint\|coverage` |
| **Content: palettes, templates, rules** | 🔄 **C0 approved (local, PR pending):** 8 palettes, 8 templates, 8 styling rules, 6 fabric rules in the shipped library, founder-approved by Shreya Sharma on 2026-10-19 (version 2); fabric practicality not yet validated. C1 (#35) not started | `apps/api/src/style-rules/data/*.json` — C0 seed (#32) and C1 release set (#35), founder-approved only (D-57, D-62); earlier issues #9 and #10 were closed without content. Templates carry `wear-*` / `formality-*` tags until the vocabulary fields land. Drafts live only in `apps/api/style-rules-drafts/`; a draft in the shipped library fails the linter and stops the API — by design ([TODO.md](TODO.md) TD-DOC-04) |
| Look engine (`POST /v1/recommendations`, ranking, explanations, `outfits` model, palette ranking) | ✅ **Merged (#33, PR #71); named test suite and evaluation entry point in review (#34)** | `apps/api/src/services/engine/`, `recommendations.service.ts`, `palette.service.ts`; `GET /v1/style/palettes`. Named suite T-12 … T-28 and T-38 plus `runEvaluation` (TESTING.md §6.1): #34, PR pending; AC-05 … AC-08 pass on C0. Optional AI wording (#55): built, off by default, PR pending |

**Rules that never change:** soft effects only (prefer / deprioritise, never forbid); explanations describe effects, never judge a body or skin tone; only approved records load at runtime ([CONTRIBUTING.md](CONTRIBUTING.md) §6, [AI.md](AI.md) §4).

**Owner:** Shreya.

---

## 6. Discover My Style (PDF p14) — 🟡 Partial

**Purpose.** "What should I wear?" — choose an occasion, optionally a category and style; StyleMe matches outfit templates to the profile, ranks them by suitability and shows outfit ideas with reasons.

**Intended flow.** Load the available profile → choose occasion → choose clothing category → choose style → apply colour and fit preferences → apply optional budget → match predefined templates → rank → display ideas → open details (garments and styling tips) · save · shop · request alternatives.

| | |
|---|---|
| Required inputs | Occasion |
| Optional inputs | Category, style, wear type (Indian / fusion / western — a hard filter for that request, D-96), palette mode; profile preferences (including preferred wear types, a soft preference); appearance signals (only if switched on) |
| Outputs / actions | Up to 5 looks, each slot with colour, fabric, silhouette and an explanation; 3–5 alternatives per slot when available (D-53); save; shop; request alternatives |
| Empty / limited | `INSUFFICIENT_MATCHES` (never padded), `ALTERNATIVES_LIMITED`, `DEFAULTS_APPLIED`, `PREFERENCE_CONFLICT`; no department → general results labelled "no department filter applied" |
| Loading / error | Skeleton while generating; API failure → retry message; no partial looks |
| Today | ✅ Request form at `/discover/looks` (#45); the Discover My Style navigation entry opens it, and the style-profile editor stays at `/profile`. ✅ Looks shown below the form with size notes and result flags (#47). 🔄 "Why this works", per-slot alternatives and copyable search phrases (#48, PR open). ⬜ Save, Shop this look and Regenerate (#41, #43, #49) |
| Depends on | M2 (content + engine) |
| Owner | Johita (UI and integration); Shreya (engine) |
| Docs / Issues | [FRD.md](FRD.md) FR-LOOK-01 … 19; [API.md](API.md) §3.5; issues #45 (form), #46 (size notes), #47 (results), #48 (alternatives), #49 (regenerate), #53 (tests); earlier #11, #12 (closed) |
| Open question | ~~Where look results live~~ — resolved by the specification (§15 #9): Discover My Style becomes its own page; the profile editor moves to My Profile |

**Specified (FR-DMS, D-109).** Explains **which individual garment features suit you and why** — necklines, sleeves, top lengths, trouser cuts, waistlines, skirts, dress silhouettes, jackets — from body shape, measurements (preferred when sufficient), fit, comfort, goals and preferences. Page: My Style Overview → Recommended for You → expandable Necklines, Sleeves, Tops and lengths, Trousers, Dresses, Jackets, Skirts, Complete Outfits, Saved Styles. Path: category → attribute → illustrated styles (editorial croquis) → detail → choose colour (palette, picker, or keep sketch colours; no pretend recolouring) → explore outfits, Design Studio, shop, try on, save. Multiple styles can be combined; recommendations are labelled as suggestions, selections as the user's choice; nothing changes the profile silently. Rule-based and explainable; no close match → say so and offer related styles. Shares one catalogue with Outfit Categories.

---

## 7. My Colour Palette (PDF p15) — ⬜ Placeholder

**Purpose.** Show palettes that suit the user — personalised when tone/undertone or colour preferences exist, otherwise the general curated collection — with swatches, names and colour codes, and coordinating colours.

| | |
|---|---|
| Inputs | Optional: undertone and skin-tone range (if signals are on), liked/disliked colours, contrast preference |
| Paths | Tone and undertone → match colour-theory and tone rules → rank; partial preferences → filter; no preferences → browse all curated palettes |
| Outputs / actions | Palette cards (swatches, colour names, hex codes, combinations with contrast level); open a palette; view coordinating colours; explore matching outfits; later customise in Design Studio |
| Rules | Suggestions never exclude a liked colour (FR-PAL-03); undertone is a soft signal only |
| Empty | No approved palettes → honest "no palettes yet" message, never placeholders |
| Today | "Coming soon" page only; 0 palettes on `main` (8 unapproved drafts in PR #68); response contract merged (`palette.ts`) |
| Depends on | M2 palettes and ranking |
| Owner | Ankita (presentation); Shreya (palette data and ranking) |
| Docs / Issues | [FRD.md](FRD.md) FR-PAL-01 … 03; issues #39 (browse), #40 (personalised ranking), #51 (tests); earlier #12 (closed) |
| Gap | ~~"Save Palette" has no requirement~~ — resolved: FR-PAL-19 … 21 (§15 #7) |

**Specified (FR-PAL-04 … 30).** Short colour-analysis intro → greeting, profile-based explanation and a featured palette → Recommended for You → Explore All → My Saved Palettes → Colour theory. Palettes are ranked **by skin tone and undertone first**, then harmony, favourite and avoided colours, style, occasion and garment, feedback and saves, season and culture; without tone or undertone, general palettes are labelled as general with an optional profile prompt. 100 – 150 curated palettes (D-57) across every colour family; categories include warm/cool/neutral, seasonal, Indian festive, office, wedding, casual, minimal/elegant/bold/experimental and harmony types. Cards: name, swatches, very short description and suitability line, tags, save, preview. Detail: large preview, names, HEX and roles (copy a HEX), garment combinations, Indian/fusion/western examples, occasions, save, customise. Users save palettes (collections), customise a **separate copy** (replace, add, remove, reorder, rename), create from a picker or HEX codes, and give feedback ("too bright", "not my style"). No sharing (D-118). Saved palettes appear only here, not in Saved Outfits (D-117 = a).

---

## 8. Outfit Categories (PDF p16) — ⬜ Placeholder

**Purpose.** Browse outfit designs by clothing category and garment type rather than starting from an occasion.

**Intended flow.** Select category → garment or outfit type → occasion → style and fit preferences → colour or palette → budget if relevant → available body information (self-described proportions, or none → general suitable templates) → retrieve predefined templates → rank → gallery → open design → explore alternatives · shop matching products · customise in Design Studio · save.

| | |
|---|---|
| Inputs | Category (required); garment type, occasion, style, colour, budget (optional); proportions only if signals are on |
| Outputs | A ranked gallery of templates as outfit designs with explanations |
| Empty | No templates for the chosen filters → say which filter is limiting and offer to relax it |
| Body information | Manual body shape, measurements and the optional photo estimate are all Stage 1 sources (FR-OCAT-09; D-102, D-103 revise the PDF's "not in Stage 1"); photo estimates ship only after the privacy review — see §4 |
| Depends on | M2 templates and engine |
| Owner | Johita |
| Issues | #44 (spec checked against PDF p16, gaps below); the gallery is TD-FS-OCAT-01 ([TODO.md](TODO.md) §6b, issue opened when the team picks it up); #47 is the Discover results page only |
| Gap | ~~No FRD section~~ — resolved: FRD §4.19 (§15 #6). Check against PDF p16 (#44): (1) the PDF's "colour or palette" step is a hand-off in FR-OCAT-25, not a browse filter in FR-OCAT-20; (2) the "name the limiting filter and offer to relax it" empty state is specified for Recommended for you (FR-OCAT-13) but not for filtered browsing (FR-OCAT-20 has Reset / Clear all). Both are open for the founder; neither blocks TD-FS-OCAT-01 |

**Specified (FR-OCAT, D-110 … D-114).** Category-first browsing of a **shared style catalogue**: Women / Men → clothing group (tops, bottoms, dresses, Indian ethnic, fusion, outerwear, traditional menswear, co-ords, loungewear) → category → attribute (neckline, collar, sleeves, lengths, fit, silhouette, fabric and drape, rise, leg shape, skirt shapes …) → **reusable style records** linked to many body shapes through separate suitability rules. Body shapes: women hourglass, pear, inverted triangle, rectangle, apple; men rectangle, triangle, inverted triangle, oval; always "Not sure". Styling goals (taller, balanced, define the waist, longer line, structure, relaxed, highlight, explore freely), fit, comfort and coverage count too. **Recommended for you shows only suitable styles (3 – 5)**; browsing stays open to all. Visuals: artistic editorial croquis plus technical flats, figures in a plain white shirt and white pants by default, rights recorded and required before publishing. Search (including natural language), filters, sort, compare, detail pages, save; hand-offs to palettes, shop, try-on and Design Studio only when supported. Body-shape analysis "using Gemini" is approved for full-body photos only (D-122 = b), after the privacy review; manual choice and measurements work meanwhile.

---

## 9. Saved Outfits and feedback (PDF p3, p6) — ⬜ Placeholder

**Purpose.** A personal collection of saved looks (and later palettes and designs), and feedback that improves future suggestions.

| | |
|---|---|
| Actions | Save a suggested look (removes its 7-day expiry); list; open details; remove with confirmation; "love it" / "not for me" with an optional reason; request alternatives; open matching shopping |
| Rules | Only the owner sees or changes a saved look; feedback is a permitted preference signal and never overrides explicit profile choices (PDF p6) |
| States | Empty collection message; removal confirmation; not-found for another user's look |
| Depends on | M2 (`outfits` from the engine) and M3 |
| Owner | Ankita |
| Docs / Issues | [FRD.md](FRD.md) FR-OUT-01 … 04; issues #41 (save, list, open, remove), #42 (feedback), #50 (illustrations, blocked), #51 (tests); earlier #13 (closed). Contracts merged (`outfit.ts`: `outfitDetailSchema`, `outfitFeedbackRequestSchema`, fixed `FEEDBACK_REASONS`) |

**Specified (FR-SAVE, D-116).** One shared save system for every feature: styles, outfits, designs, shopping looks, products, try-on looks and palettes (palettes shown only in My Colour Palette, D-117), each clearly labelled; references to shared records, never copies; duplicate saves detected; customising never overwrites the original (Save as New Look, Duplicate). Header with search, collection selector and sort; sections All Saved, Outfits, My Designs (no Palettes section, D-117 = a); responsive cards with the source's best visual; detail view with components, colours, occasion, the original "why it was recommended", notes and dates; named collections (an item can be in several), Favourites as a flag, filters, sorting, bulk move and remove, Undo. Retired sources and unavailable products stay readable and are labelled honestly; prices are shown as historical. Private, owner-only, no sharing. Feedback (D-115) is a soft signal; the user can undo, pause or reset personalisation.

---

## 10. Shop My Look (PDF p17) — ⬜ Placeholder; product data ⛔

**Stage 1 (D-77 = B):** a **shortlist of items the user found themselves** — name, optional https link, the price they enter, optional note — attached to a look slot, with a budget summary. Every user-entered price is labelled "not verified by StyleMe"; StyleMe never fetches the link.

**Later (product layer):** verified products with image, price, size and disclosures, filtered by budget and suitability, 3–5 alternatives — **only** from a retailer that has authorised StyleMe in writing. Flipkart and Meesho have **not** approved StyleMe (D-43 … D-45). No scraping. When verified data or usage rights are unavailable, explain that and offer styling alternatives (PDF p17).

| | |
|---|---|
| Inputs | Budget, category, size per category, colour/style/fit preferences; shortlist item fields |
| States | No shortlist yet; over budget; product data unavailable ("we can't show products for this yet"); invalid link or price |
| Depends on | Saved looks (M4) for attaching items; M7 approvals for any real product |
| Owner | Kedar |
| Docs / Issues | [FRD.md](FRD.md) FR-LIST, FR-BUD, FR-PROD, FR-MATCH, FR-QUAL; issues #37 (budget engine), #38 (shortlist), #43 (page), #57 (retailer products, blocked); earlier #8, #14 (closed). Contracts merged (`product.ts`) |

**Specified (FR-SHOP, D-124).** Shop a complete look or one garment, entered directly or from any feature with its context (palette colour, style, outfit, design) shown as removable filters. Filters (category, occasion, budget, size per category, colour, style, fit), keyword search, best-match and price sorting, Load more, preserved state on Back. Outfit assembly with per-item replacement, a total of known verified prices in ₹ (partial totals labelled; shipping and taxes separate), budget warnings with cheaper suggestions, a temporary selection for the session, and saving looks with dated price snapshots. Variants grouped; exact vs closest matches labelled; "Not interested" and "Report an issue". **Products only from authorised sources** — until one exists the page says live results aren't available and offers styling alternatives and the shortlist; commission never affects ranking.

---

## 11. Design Studio (PDF p20) — ⛔ Deferred (D-76)

**Intended.** Start from a blank design, a predefined template, a saved outfit or inspiration → garment type → silhouette and fit → fabric → colours → patterns → sleeves, neckline and details → combine garments → preview → save with a name and notes to the personal collection → continue editing · shop matching products · try on if available.

**Status.** Only a "Coming soon" page. Building it needs the founder's D-76 decision (issue #56: requirements and approval gate only). **Owner:** Kedar (after approval).

---

## 12. Style Assistant (PDF p19) — ⛔ Deferred (D-76)

**Intended.** Suggested questions → the user asks → the assistant identifies the intent (colour, outfit, occasion, fabric and pattern, budget and shopping) → applies the shared styling rules (and authorised product data only if needed) → a supported answer → follow-up, open outfit, save recommendation.

**Status.** "Coming soon" page; the chatbot is deferred (D-76). Any AI use must follow [AI.md](AI.md) §2 (no personal photos or appearance signals sent to external AI; deterministic core). **Owner:** Shreya (later).

---

## 13. Virtual Try-On (PDF p18) — 2D version specified (D-119); photo-based ⛔ Future (D-48)

**Specified and approved (FR-VTO, D-119): a 2D illustrative try-on.** A fashion-brand workspace with a large central preview: a clothed default model (plain white shirt and plain white pants) → Start Styling → garment cards by tab (Tops, Bottoms, Dresses, Outerwear, Accessories) layered as SVG on the model in a fixed order with compatibility rules → recolour with a palette colour or any supported colour → change, remove, undo, reset, zoom → save the configuration to Saved Outfits and reopen it. A few body-shape model variants and skin-tone shades, chosen from the profile; no photos, no camera, no AI; always labelled "illustrative 2D preview". Opens from Discover My Style, Outfit Categories, Design Studio (compatible designs) and Shop My Look (eligible products only).

**Photo-based or generative try-on — intended when approved.** Explain image use and obtain consent → personalised model from permitted photos, a measurement-based approximate avatar, or a photo estimate → avatar in a neutral outfit → choose an outfit → preview with fit and rendering limitations → try another · save preview · delete photo or preview.

**Today, as the PDF requires when the feature is not approved:** explain that it is not yet available (the "Coming soon" page does this). Offering outfit images or a moodboard instead depends on M3.

**Status.** 2D version: not built; models and contracts declared; layer assets needed (TODO TD-FS-VTO-01, TD-FS-CAT-06). Photo-based: not built or approved (D-48, AI rule 16, privacy review). Issue #58 holds the decision proposal; issue #65 (2D try-on with a self-hosted model on a serverless GPU) is superseded for the first version by D-119 — the issue itself was not changed. **Owner:** Kedar.

---

## 13a. Admin Panel — specified (D-120)

**Purpose.** Manage the fashion catalogue, palettes, authorised products and accounts, and troubleshoot, without unnecessary access to private data.

**Specified (FR-ADM).** A protected `/admin` area in the existing web app using `/v1/admin/*` on the existing API and database. Roles: **Super Admin** (one, the seeded admin) and **Content Admin** (designed, not provisioned). Seven screens: Dashboard (aggregate registrations, active users, catalogue counts, feature usage, items needing attention), Users (search; status and registration date only; suspend, reactivate, start deletion), Fashion Catalogue (categories, attributes, styles, rules, templates, illustrations — draft, approve, publish, archive), Colour Palettes, Shop Products (authorised records, imports, reports), Try-On Monitoring (aggregates and asset coverage), Admin Activity (audit log). Styling content is published only after the founder's approval (D-62); assets only with verified rights. No profiles, measurements, photos or passwords in admin screens; every action audited. MFA is decided at HC-1 (D-121).

**Status.** ⬜ Not built; `adminAccounts`, `adminAuditLogs` and `usageDailyStats` models declared; permission matrix in `packages/contracts/src/admin.ts`. **Owner:** to confirm.

---

## 14. Weather-aware styling (PDF p7) — ⛔ Stage 2 (D-60)

**Intended.** If enabled: permitted weather for the user's city → temperature and conditions → suitable fabrics and layers → apply style and colour preferences → weather-aware outfits; if disabled or unavailable, standard styling. Weather must never block a recommendation (FR-X-05).

**Status.** Not built; the provider is chosen only after its terms and pricing are verified (D-60). The city is already stored. **Owner:** Shreya (shared weather-styling rules, later).

---

## 15. Conflicts and missing decisions

Recorded for founder review. Rows marked **Resolved** cite the decision that settled them; nothing else here has been changed in code or requirements.

| # | Topic | PDF | Recorded decision / code | Needed |
|---|---|---|---|---|
| 1 | Who can register | — | D-63: invite-only closed beta until the legal review (D-74). Code since PR #25: `PUBLIC_SIGNUP_ENABLED` defaults to `true`. The landing page says both "Closed beta · registration by invitation" (hero) and "Can anyone sign up? Yes" (FAQ) | Confirm whether D-63 is revised or production must set `PUBLIC_SIGNUP_ENABLED=false`; then align the landing copy |
| 2 | Photos and measurements | p1, p4, p11, p16, p18 | D-76, FR-SIZE-06, AI rule 16 | **Resolved 2026-10-18:** measurements and photo analysis approved (D-102, D-103); Gemini for full-body photos approved (D-122), behind the privacy review |
| 3 | Kids department | p1 (unverified) | **Resolved (D-101):** no kids department in Stage 1 | A later addition needs a legal review (D-74), a kids size system and founder approval |
| 4 | Retailer products | p1, p17 | D-43 … D-45 blocked; no scraping | Retailer permission in writing |
| 5 | Design Studio, Style Assistant, Try-On in the roadmap | p13, p18–p20 | D-76, D-48. **Partly resolved (D-119):** a 2D illustrative try-on is approved | Founder decisions for Design Studio, Style Assistant and photo-based try-on |
| 6 | Outfit Categories gallery | p16 | **Resolved (D-109):** FRD §4.19 | — |
| 7 | Save a palette | p15 | **Resolved (D-109):** FR-PAL-19 … 21 | — |
| 8 | Request a copy of my data | p4 | JSON and PDF export (FR-MYP-17) | **Resolved:** D-105 approved 2026-10-18 |
| 9 | What "Discover My Style" opens | p14 | **Resolved (D-109, FR-DMS):** Discover My Style is its own page of style recommendations; the profile editor moves to My Profile (account menu) | Change `lib/features.ts` when the page works |
| 10 | Demo deployment | — | D-75: "There is no demo release"; D-81: hosting postponed to HC-1. Open issue #66 proposes a free demo deployment for a pitch | Founder decides whether #66 proceeds (and whether D-75 changes) |
| 11 | Vocabulary issue state | — | #63 is closed, but only `WEAR_TYPES` is implemented; #32's issue body still says "Not started" while PR #68 is open | Reopen or replace #63; update #32 ([TODO.md](TODO.md) TD-DOC-01, TD-DOC-02) |
| 12 | Notifications | Product description | No notification bell exists in the code. Bell with unread count and panel (FR-HOME-05) | **Resolved:** D-106 approved 2026-10-18; not built |
| 13 | Measurements, photo analysis, age group | Profile and Home requirements (2026-10-18) | FR-SIZE-06, D-76, FR-SIG-04, FR-PROF-04 exclude them from Stage 1; the new requirements include them (FR-MYP) | **Resolved:** D-102 … D-104 approved 2026-10-18; under-18 handling still needs the legal review (D-74) before the age group ships |
| 14 | Feedback and personalisation | Home requirements | **Resolved (D-115, D-108 = b):** feedback is a soft, undoable signal; the user can pause or reset personalisation | Align FR-HOME-14 if D-106 is approved |
| 15 | Profile completeness items | Profile requirements | Code counts 7 items including city (FR-ONB-05); proposal makes city optional and weights core sections | Part of D-102 |
| 16 | Clothing preference | Profile requirements | Code offers Women / Men / "Show me everything"; proposal shows Men's / Women's cards | Part of D-102: keep "Show me everything"? (The catalogue has Women and Men sections; `any` sees both, D-111) |
| 17 | Where saved palettes appear | My Colour Palette Q35 vs Saved Outfits Q2, Q20 | Only in My Colour Palette vs a Palettes section in Saved Outfits | **Resolved (D-117 = a):** only in My Colour Palette |
| 18 | Gemini for full-body photos | Outfit Categories specification | AI rule 16, D-103 proposal (no external AI), Shop My Look Q40 | **Resolved (D-122 = b):** full-body photos only, with the D-122 safeguards; privacy review (D-74) before any real photo is sent |
| 19 | Knowledge base location | Outfit Categories, Admin Panel specifications | D-66 kept content in repository files | **Resolved (D-110):** MongoDB at runtime; files stay the review and seed format |
| 20 | Admin UI | Admin Panel specification | D-73: no admin UI | **Resolved (D-120):** admin panel with two roles |
