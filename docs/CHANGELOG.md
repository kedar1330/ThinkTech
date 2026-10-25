# StyleMe — Changelog

> What changed on `main`, by merged pull request, newest first. Built from the GitHub pull-request history on 2026-10-18. Nothing is released or deployed yet (D-81); there are no version tags. Dates are merge dates (UTC). Planned work is in [TODO.md](TODO.md).

## Unreleased — open pull requests

| PR | Branch | Change | State |
|---|---|---|---|
| — | `feature/155-3d-mannequin` | feat: 3D mannequin redesign (#155) — still all code, no model files (D-138): studio with room reflections, shadow bias (no stripes), plinth and closer framing (`lib/try-on/stage.ts`); smooth body with knees, elbows, hands and shoes, shaped bust and seat; fabric with sheen, soft folds and finished hems; sleeves that follow the arm; tops that fall straight unless fitted; kurta and kurti placket with band collar, shirt collar and buttoned front; saree pallu draped over the left shoulder and front pleats | PR |
| #156 | `feature/154-shop-my-look-accuracy` | feat: Shop My Look keeps to the look's garment and department (#154) — an item must name the garment (kurta = kurti); other departments, children's wear and men-only garments are left out, and with 3 or more items confirmed for the department by their own title, unconfirmed ones are too; a set is never offered as just its bottom; another colour family and blends rank lower; price ranges and stats use relevant items only. Up to 16 matches and 8 other styles per store (`PRODUCTS_PER_STORE`, `ALTERNATIVES_PER_STORE`), 8 shown at a time with "Show more"; aligned item cards; "Your outfit" as a two-column card; the outfit image no longer keeps "Loading…" over a cached picture | Merged 2026-10-25 |
| #148 | `feature/145-discover-outfit-images` | feat: Discover My Style outfit images follow the request — prompt `outfit-image-v3` adds the wear type from Outfit Categories and draws the designed garment (D-132) with the features the user chose (neckline, sleeve, length, fabric …; occasion and stretch left out), garment details only (AI rule 16); optional colour picker for the outfit image (`chosenColours`, up to `CHOSEN_COLOURS_MAX` = 12 of the user's own colours; otherwise coordinating colours, then liked, then the top of their palette less avoided ones); "No sizes saved yet" and "No style chosen" notices no longer shown on the results | Merged 2026-10-23 |
| — | `feature/137-style-assistant` | feat: Style Assistant (D-136, approved 2026-10-23) — `/assistant` chat (`/v1/chat`, contract `chat.ts`): Gemini (or a keyword matcher) works out the intent, the assistant runs Discover My Style, the colour library, palettes, Design Studio (after the notice), Saved Outfits or Shop My Look for the user and shows the results as cards with Save / Shop / Change in Design Studio and links; replies written by Gemini from the feature's facts (never photos, measurements, height or appearance labels) or fixed wording; conversations in `chatConversations` (user-owned, 30 per user, deletable); rate limit 10/min, 120/h; Home manual step 7 now links to it | PR (#137) |
| — | `feature/106-3d-try-on` | feat: realistic try-on model with views (D-139) — the shared model is a photorealistic synthetic person on a studio backdrop (redrawn when `DRAPE_PROMPT_VERSION` changes); after dressing, three-quarter, side and back views are drawn from the front (`POST /v1/try-on/drapes/:id/views/:view`, `?view=` on the image) and shown as a turntable-style strip with arrows beside the large view (`ModelViews`) | PR (#106) |
| — | `feature/106-3d-try-on` | feat: fitting room and free cartoon avatar try-on (D-138) — `/try-on` shows the look's Shop My Look clothes, the avatar and the outfit with prices; the clicked item goes on first and items swap per part. Default view: a shared Bitmoji-style avatar (`tryOnAvatars`) dressed in the real items by Pollinations image editing (free models, one garment per call; `tryOnDrapes`, 24 h TTL; `/v1/try-on/avatars/:department`, `/v1/try-on/drapes`). Tab: a code-built three.js 3D mannequin, rotatable 360°, garments by category and cut in the colour read from each thumbnail. `items` on `POST /v1/try-on/jobs` for "Make it realistic with AI". Env `DRAPE_ENABLED`, `DRAPE_MODELS`, `DRAPE_TIMEOUT_MS` | PR (#106) |
| — | `feature/106-3d-try-on` | feat: 3D Virtual Try-On (D-137, approved 2026-10-23) — `/try-on` from Shop My Look (whole look on a tab, or one similar item); after per-use consent the user's try-on photo and the item's store thumbnail go to fal.ai: FASHN dresses the photo garment by garment, TRELLIS builds a GLB model (`integrations/tryon/fal-client.ts`, queued and advanced by polls); try-on picture + 360° view (`@google/model-viewer`); user-owned `tryOnJobs` with 24 h TTL (in `USER_OWNED_COLLECTIONS`, also deleted with the photo); `/v1/try-on/*`; env `TRY_ON_ENABLED` (default on), `FAL_KEY`, `FAL_TRY_ON_MODEL`, `FAL_3D_MODEL`, timeouts | PR (#106) |
| — | `feature/130-design-studio-profile-followups` | feat: My Profile follow-ups (D-135) — body type by measurements or direct choice (no body-photo upload in the UI); stricter face-photo rules and tolerant Gemini reply parsing; body-photo prompt proportion rules (no hourglass default); 3D Virtual Try-On section (`profiles.tryOnModel` = `custom_photo` \| `dummy_model`, `POST /v1/photos/try-on` stores a reference photo without analysis); Discover My Style profile summary from D-129 signals and saved colours; city search by other spellings and former names (Amravati vs Amaravati); `loadConfig` also reads `.env` files | PR (#130) |
| — | `feature/130-design-studio-profile-followups` | feat: Design Studio (D-134, approved 2026-10-23) — `/design-studio`: draw (canvas), upload a sketch or garment picture, describe, or "Change it in Design Studio" from a look (whole look or one piece, quick changes); Gemini (`design-client.ts`, prompt `design-studio-v1`) writes a Zod-validated tailor spec and a garment-only prompt; Pollinations FLUX draws it with Cloudflare Workers AI FLUX as fallback (`integrations/image/image-client.ts`, text prompt only); `/design-studio/[id]` with picture, sketch, printable spec, redraw and delete; user-owned `designs` (in `USER_OWNED_COLLECTIONS`); `/v1/design-studio/*`, `DESIGN_UNUSABLE`; env `DESIGN_STUDIO_ENABLED` (default on), `POLLINATIONS_*`, `CLOUDFLARE_*`, timeouts | PR (#130) |
| — | `feature/issue-61-closed-beta-readiness` (uncommitted) | feat: colour library (D-133) — Monk tone (1 – 10) → undertone (warm, cool, neutral, olive) → 120 colours each, from 607 openly licensed colours (CSS named colours, CC0 xkcd survey; judgemental, bodily, "skin"/"nude" and brand names filtered), scored by deterministic OKLCH colour-theory rules (no AI); `colourSwatches`, `colourCategories`, user-owned `userColourPreferences` (in `USER_OWNED_COLLECTIONS`); `/v1/colours/mine` (only the user's own skin tone × undertone) and `/v1/colours/preferences`; `/palette/colours` shows only the user's own colours with album-style multi-select to like or avoid them; `colours:report`, `colours:drafts`, `colours:seed` scripts. Content approved by the founder (Shreya Sharma, 2026-10-22) and shipped in `src/style-rules/data/colour-library.json` | Uncommitted |
| — | `feature/issue-61-closed-beta-readiness` (uncommitted) | feat: height in the profile (D-131) — optional `profiles.heightCm` (ft/in or cm in My Profile, counted in completeness); engine height bands and `appliesTo.heights` with six draft rules (STY-021 … STY-026, awaiting founder approval); height sent to Gemini with the full-body photo (prompt `photo-analysis-v2`, notice `2026-10-22.2`). Logo shown without its plum box (transparent dark- and light-surface versions, larger). Landing page: the two hero photos kept; styling and category photos replaced with team-supplied photos and a new Lookbook section | Uncommitted |
| — | `feature/issue-61-closed-beta-readiness` (uncommitted) | feat: My Profile redesign (D-129) and new logo (D-130) — Clothing Preference (Women's Wear / Men's Wear); skin tone & undertone by face photo (Gemini, `vision-client.ts`, prompt `photo-analysis-v1`) or manual Monk swatches and four undertone cards; body type by step-by-step measurements (`classifyBodyType`, `measurements-v1`) or full-body photo, with women's and men's lists; optional fit measurements; `GET/PUT /v1/measurements`, `GET/POST/DELETE /v1/photos`, `POST /v1/appearance/confirm`, `PHOTO_UNUSABLE`; photos stored in `userPhotos.data`; `appearanceProfiles.bodyType`; 46 code-generated measuring/undertone SVGs seeded into `illustrations`; colours, fit, contrast, silhouettes, coverage, comfort, styles, occasions and sizes removed from My Profile; completeness = Clothing Preference, city, skin tone & undertone, body type; env `PHOTO_ANALYSIS_ENABLED`, `GEMINI_VISION_MODEL`, `PHOTO_ANALYSIS_TIMEOUT_MS`; logo artwork, emblem icons and favicon | Uncommitted |
| — | `feature/issue-61-closed-beta-readiness` (uncommitted) | feat: Outfit Categories → design features (D-132) — Women/Men → Indian/Western/Indo-Western → garment → feature category → feature in MongoDB (`outfitCategories`, `designFeatureCategories`, `designFeatures`, `featureSuitabilityRules`, `featureCombinations`; user-owned `userDesignPreferences`, `userDesignSelections`); `/v1/design/*`; only features that suit the user shown (body type, height band, goals; "Show all" toggle); personalised result stored per garment; 148 code-generated neckline/sleeve SVGs (cards + customizer layers); `/categories` asks the outfit category, then the garment; `/categories/design/[garment]` with illustrated neckline cards, sleeve grid, filter tags and visual customizer; 136 draft suitability rules awaiting founder approval; `design:generate`, `design:seed`, `design:drafts` | Uncommitted |
| #87 | `feature/55-ai-wording` | feat: optional AI wording of explanations (#55), off by default — `WordingProvider` interface and Gemini client, versioned prompt `wording-v1`, `WordingService` (timeout, Zod check, reference and vocabulary checks, inclusive-language check, template fallback with `AI_ENHANCEMENT_SKIPPED`), `AI_WORDING_ENABLED` / `GEMINI_API_KEY` / `GEMINI_MODEL` / `AI_WORDING_TIMEOUT_MS`, `outfits.aiPromptVersion`, `aiCache` (D-13, 7-day TTL); appearance signals and signal-scoped rules never sent | Merged 2026-10-20 |
| — | `feature/issue-44` | docs: FR-OCAT checked against PDF p16 (#44) — two gaps recorded (colour as a browse filter; limiting-filter empty state for browsing); gallery tracked as TD-FS-OCAT-01; #47 scoped to the results page; stale "not in Stage 1" body-information row updated for D-102, D-103 | Open |
| #74 | `feature/34-engine-tests` | test: named engine suite (#34) — `tests/unit/engine/` split by area with every test named by its ID (T-10, T-12 … T-25, T-27 with AI wording off, T-28, T-32, T-33, T-38; T-26 and T-27 with AI wording on came with #55 in PR #87), profile builders (`tests/fixtures/profiles.ts`), `runEvaluation` with 10 automated checks and `pnpm --filter @styleme/api evaluate`; AC-05 … AC-08 pass on C0 (160 profiles); `test:coverage` with `@vitest/coverage-v8` for the D-70 target; `.gitattributes` (LF checkouts on every OS) | Merged 2026-10-19 |
| #71 | `feature/33-matching-engine` | feat: deterministic look engine (#33) — `services/engine/` (filterTemplates, fillSlots, rules and tiered ranking, signatures, explanations, alternatives, search phrases, palette ranking), `outfits` model with 7-day TTL, `POST /v1/recommendations`, `GET /v1/style/palettes`, `validateQuery`, library `contentVersion`, look-level contrast rules; C0 content (#32) approved by the founder on 2026-10-19 (30 records, version 2) after two correction rounds and moved to the shipped library; real AC5 test on the shipped library replaces the simulated-approval test | Merged 2026-10-19 |

## 2026-10-21

| PR | Change |
|---|---|
| — | feat(ops): closed-beta readiness, backups, restore rehearsal, rollback, monitoring and sign-up policy (#61) — D-63 founder decision approved (Open Public Beta, `PUBLIC_SIGNUP_ENABLED=true` default, landing hero and FAQ aligned); full 7-step staging restore rehearsal with tombstone replay verified (T-43, T-45); rollback rehearsal verified (backward-compatible migrations); external monitoring configured (Better Stack Free on `/health`, D-69, D-81); AC-18 latency benchmark measured (p95 = 46.06 ms < 2000 ms target); operational runbooks and Stage 1 acceptance criteria documented in `docs/RELEASE.md`; formal legal review reminder recorded (D-74) |
| #101 | test: Stage 1 full E2E smoke and security checklist walk-through (#59) |
| #100 | feat(ops): complete hosting checkpoint HC-1 with 100% free stack (#60) |
| #99 | feat(web): labelled style illustrations with licence-cleared fallback (#50) |
| #98 | test: palette and saved outfits authorisation, deletion, UI and E2E flows (#51) |
| #97 | feat: feedback on looks, permitted preference signals and saved-look alternatives (#42) |

## 2026-10-18

| PR | Change |
|---|---|
| #69 | feat: catalogue models, feature-spec contracts and docs (D-109 … D-128) — `catalogue`, `saved-items`, `admin`, `my-profile`, `photos` contracts and declared models; founder decisions D-102 … D-106 approved, D-117 = a, D-122 = b |
| #70 | fix(style-rules): move the unapproved C0 drafts out of the shipped library into `apps/api/style-rules-drafts/` (`style-rules drafts` check) |
| #68 | feat(style-rules): C0 styling content for founder review (#32): 8 palettes, 8 templates, 8 styling rules, 6 fabric rules, all `draft`; adds `StyleMe APP.txt` |

## 2026-10-16

| PR | Change |
|---|---|
| #67 | docs: `CLAUDE.md` agent guidance |
| #64 | feat(contracts): looks, palettes and shortlist contracts (#31) — `outfit.ts`, `palette.ts`, `product.ts`, `common.ts`; `WEAR_TYPES` in the vocabulary; `design.ts` and `chat.ts` reserved |
| #62 | docs: #30 styling-vocabulary decisions D-96 … D-101 |
| #29 | docs: team workflow, roadmap and ownership (`PROJECT_OVERVIEW`, `DEVELOPMENT_ROADMAP`, `TEAM_TASK_ASSIGNMENTS`, `PROPOSED_ISSUES`) |

## 2026-10-15

| PR | Change |
|---|---|
| #28 | feat: optional onboarding with **Skip for now**; profile completeness (`profileCompleteness()`, `departmentScope()`) on Home and in the navigation |
| #27 | test: fix a flaky appearance privacy log assertion |
| #26 | feat: responsive **top navigation** replaces the sidebar |

## 2026-10-13

| PR | Change |
|---|---|
| #25 | Public sign-up with a 6-digit email code; the account is created only after verification (`pendingRegistrations`); `PUBLIC_SIGNUP_ENABLED` defaults to `true` |
| #24 | revert: roll back PR #23 (auth and onboarding redesign) |
| #23 | Auth and onboarding redesign (D-87 … D-94); reverted by #24, then re-applied on `main` in commit `05a295c` |
| #22 | feat: style profile with category sizes and fit (#4) |
| #21 | feat: self-reported appearance signals (#5) |

## 2026-10-10

| PR | Change |
|---|---|
| #20 | Style knowledge-base tooling: record schemas, loader, linter, coverage report, scale test (#3) |
| #19 | Shared style vocabulary in `packages/contracts` (#2) |

## Before 2026-10-10

Foundation and accounts (monorepo, contracts package, Express skeleton, CI, Dockerfile, accounts) were merged through issue #1; see `git log` on `main` for individual commits.
