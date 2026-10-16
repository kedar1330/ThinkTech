# StyleMe — Project Overview

> What StyleMe does, how each part of the app is meant to behave, and what exists today. Detailed requirements live in [FRD.md](FRD.md); decisions in [ImplementationPlan.md](ImplementationPlan.md) §8; the build order in [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md); who does what in [TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md).
>
> GitHub issues #1 … #18 were all closed on 2026-10-15 (marked completed) without new commits on `main`; statuses in this document come from the code, not from issue state.
>
> The intended behaviour follows the approved workflow (`StyleMe_all_pages.pdf`, 20 pages; referenced below as "PDF page n"). Where the PDF and a recorded decision differ, the decision applies until the founder changes it (§13).

**Status legend** — verified against the code on `main` at `781b59e`:

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
* Respect for privacy: appearance signals are optional, self-reported and deletable; no photo analysis in Stage 1 ([SECURITY.md](SECURITY.md), AI rule 16).
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

**Shared dependency (PDF p9, p13):** every styling feature depends on the **shared styling rules and databases** — the palettes, outfit templates and rules in `apps/api/src/style-rules/` — and the look engine built on them. Those data files are **empty on `main`** today, so no styling feature can show real results until they are filled and approved ([DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) M2).

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

---

## 4. Profile, preferences, consent and privacy (PDF p4, p11, p12) — 🟡 Partial

**Purpose.** Keep the information StyleMe uses accurate and under the user's control.

| Area | Status | Details |
|---|---|---|
| Style profile (department, sizes per category, fit, liked and disliked colours, contrast, silhouettes, coverage, comfort, fabrics, styles, occasions, budget per look) | ✅ | `/profile` (labelled Discover My Style), `GET/PUT /v1/profile` |
| Skin tone (Monk range) and undertone, body proportions — self-reported, with a "use in recommendations" switch and clear | ✅ | `/profile#appearance`, `GET/PUT /v1/appearance` |
| Name, city, marketing consent, email change (verified), password change (emailed code), optional phone | ✅ | `/settings` |
| Account deletion (emailed code + confirmation; tombstone so backups can't restore it) | ✅ | `/settings#delete`, D-85 |
| **Body measurements** (PDF p4, p11) | ⛔ | Not collected before size charts exist (FR-SIZE-06, data minimisation) |
| **Face / full-body photos and photo-based estimates** (PDF p1, p11) | ⛔ | Deferred (D-76); AI rule 16 forbids sending personal photos to external AI |
| **Request a copy of my data** (PDF p4 "Request Data") | ⬜ | Not specified in the FRD — needs a founder decision (§13) |

**Owner:** Kedar for account and settings; the profile form is shared — fields that styling features consume are agreed with Shreya ([TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md) §6).

---

## 5. Shared styling foundation (PDF p1, p9, p13) — 🟡 Partial (tooling only)

**Purpose.** The single source of styling knowledge every feature uses: a colour vocabulary, palettes (cool, warm, neutral, olive or any undertone; low to high contrast), outfit templates by department, wear type, occasion and style, styling/fit and fabric rules, and the deterministic engine that combines them with the user's profile.

| Part | Status | Where |
|---|---|---|
| Shared vocabulary: departments, occasions, styles, categories, 39 colours with swatch hex codes, fabrics, silhouettes, fits, coverage, undertones, Monk tones, proportions | ✅ | `packages/contracts/src/style-vocabulary.ts` |
| **Decided vocabulary changes (#30 audit, D-96 … D-100):** wear type, 8 broad categories with garment types, slot formality, colour and fabric growth, coverage extension | ⬜ Decided, not implemented | Separate vocabulary issue, before C0 (#32) |
| Record schemas, loader, linter (contradictions, duplicates, unknown references, judgemental language), coverage report, scale test | ✅ | `apps/api/src/style-rules/`, `pnpm --filter @styleme/api style-rules lint\|coverage` |
| **Content: palettes, templates, rules** | ⬜ **0 records** | `apps/api/src/style-rules/data/*.json` — C0 seed (#32) and C1 release set (#35), founder-approved only (D-57, D-62); earlier issues #9 and #10 were closed without content |
| Look engine (`POST /v1/recommendations`, ranking, explanations, `outfits` model) | ⬜ | Not built (#33; earlier #11 closed without code); contracts `outfit.ts` is an empty placeholder (#31) |

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
| Today | ✅ The style-profile editor (`/profile`) carries this name. ⬜ Recommendations are not built |
| Depends on | M2 (content + engine) |
| Owner | Johita (UI and integration); Shreya (engine) |
| Docs / Issues | [FRD.md](FRD.md) FR-LOOK-01 … 19; [API.md](API.md) §3.5; earlier issues #11, #12 (closed) |

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
| Today | "Coming soon" page only; 0 palettes in the data files |
| Depends on | M2 palettes and ranking |
| Owner | Ankita (presentation); Shreya (palette data and ranking) |
| Docs / Issues | [FRD.md](FRD.md) FR-PAL-01 … 03; earlier issue #12 (closed) |
| Gap | PDF "Save Palette → personal collection" has no FRD requirement (§13) |

---

## 8. Outfit Categories (PDF p16) — ⬜ Placeholder

**Purpose.** Browse outfit designs by clothing category and garment type rather than starting from an occasion.

**Intended flow.** Select category → garment or outfit type → occasion → style and fit preferences → colour or palette → budget if relevant → available body information (self-described proportions, or none → general suitable templates) → retrieve predefined templates → rank → gallery → open design → explore alternatives · shop matching products · customise in Design Studio · save.

| | |
|---|---|
| Inputs | Category (required); garment type, occasion, style, colour, budget (optional); proportions only if signals are on |
| Outputs | A ranked gallery of templates as outfit designs with explanations |
| Empty | No templates for the chosen filters → say which filter is limiting and offer to relax it |
| Not in Stage 1 | Measurement- and photo-based filtering (PDF p16) — see §4 |
| Depends on | M2 templates and engine |
| Owner | Johita |
| Gap | No FRD section defines the category gallery (§13) |

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
| Docs / Issues | [FRD.md](FRD.md) FR-OUT-01 … 04; earlier issue #13 (closed) |

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
| Docs / Issues | [FRD.md](FRD.md) FR-LIST, FR-BUD, FR-PROD, FR-MATCH, FR-QUAL; earlier issues #8, #14 (closed) |

---

## 11. Design Studio (PDF p20) — ⛔ Deferred (D-76)

**Intended.** Start from a blank design, a predefined template, a saved outfit or inspiration → garment type → silhouette and fit → fabric → colours → patterns → sleeves, neckline and details → combine garments → preview → save with a name and notes to the personal collection → continue editing · shop matching products · try on if available.

**Status.** Only a "Coming soon" page. Building it needs the founder's D-76 decision. **Owner:** Kedar (after approval).

---

## 12. Style Assistant (PDF p19) — ⛔ Deferred (D-76)

**Intended.** Suggested questions → the user asks → the assistant identifies the intent (colour, outfit, occasion, fabric and pattern, budget and shopping) → applies the shared styling rules (and authorised product data only if needed) → a supported answer → follow-up, open outfit, save recommendation.

**Status.** "Coming soon" page; the chatbot is deferred (D-76). Any AI use must follow [AI.md](AI.md) §2 (no personal photos or appearance signals sent to external AI; deterministic core). **Owner:** Shreya (later).

---

## 13. Virtual Try-On (PDF p18) — ⛔ Future (D-48)

**Intended when approved.** Explain image use and obtain consent → personalised model from permitted photos, a measurement-based approximate avatar, or a photo estimate → avatar in a neutral outfit → choose an outfit → preview with fit and rendering limitations → try another · save preview · delete photo or preview.

**Today, as the PDF requires when the feature is not approved:** explain that it is not yet available (the "Coming soon" page does this). Offering outfit images or a moodboard instead depends on M3.

**Status.** Not built or approved (D-48, AI rule 16, privacy review). **Owner:** Kedar (later, subject to approval).

---

## 14. Weather-aware styling (PDF p7) — ⛔ Stage 2 (D-60)

**Intended.** If enabled: permitted weather for the user's city → temperature and conditions → suitable fabrics and layers → apply style and colour preferences → weather-aware outfits; if disabled or unavailable, standard styling. Weather must never block a recommendation (FR-X-05).

**Status.** Not built; the provider is chosen only after its terms and pricing are verified (D-60). The city is already stored. **Owner:** Shreya (shared weather-styling rules, later).

---

## 15. Conflicts and missing decisions

Recorded for founder review. Rows marked **Resolved** cite the decision that settled them; nothing else here has been changed in code or requirements.

| # | Topic | PDF | Recorded decision / code | Needed |
|---|---|---|---|---|
| 1 | Who can register | — | D-63: invite-only closed beta until the legal review (D-74). Code since PR #25: `PUBLIC_SIGNUP_ENABLED` defaults to `true` | Confirm whether D-63 is revised or production must set `PUBLIC_SIGNUP_ENABLED=false` |
| 2 | Photos and measurements | p1, p4, p11, p16, p18 | D-76, FR-SIZE-06, AI rule 16 | Stays deferred unless the founder decides otherwise |
| 3 | Kids department | p1 (unverified) | **Resolved (D-101):** no kids department in Stage 1 | A later addition needs a legal review (D-74), a kids size system and founder approval |
| 4 | Retailer products | p1, p17 | D-43 … D-45 blocked; no scraping | Retailer permission in writing |
| 5 | Design Studio, Style Assistant, Try-On in the roadmap | p13, p18–p20 | D-76, D-48 | Founder decisions |
| 6 | Outfit Categories gallery | p16 | No FRD section | Write and approve the requirement |
| 7 | Save a palette | p15 | FR-PAL has no save | Decide and specify |
| 8 | Request a copy of my data | p4 | Not in the FRD | Decide (privacy/DPDP) and specify |
