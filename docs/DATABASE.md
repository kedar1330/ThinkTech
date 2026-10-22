# StyleMe — Database Design

> Part of the StyleMe documentation baseline. Requirements: [FRD.md](FRD.md). API: [API.md](API.md). Environments: [DEPLOYMENT.md](DEPLOYMENT.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Overview

| Item | Value |
|---|---|
| Database | MongoDB, accessed through Mongoose (models in `apps/api/src/models/`). Hosted on MongoDB Atlas in staging and production (planned; account and tier decided at HC-1, D-81); a local instance until then |
| Access | Only the Express API reads or writes the database. Scripts in `apps/api/scripts/` use the same models |
| Isolation | Every query on a user-owned collection is scoped to the authenticated user's ID |
| Field types and enums | Defined as Zod schemas in `packages/contracts` (D-03, D-09). Mongoose schemas mirror them |
| Environments | Separate databases for local, CI, staging and production (§7; D-78) |

---

## 2. Collections by Stage

| Collection | Purpose | Owner | Stage |
|---|---|---|---|
| `users` | Accounts and credentials | Per user | 1 |
| `betaInvites` | Closed-beta invite allow-list (FR-AUTH-10) | Admin-managed | 1 |
| `sessions` | Revocable login sessions (D-07) | Per user | 1 |
| `authChallenges` | Hashed one-time codes and links: email verification, password reset and change, email change, phone verification, account deletion (D-89) | Per user | 1 |
| `migrations` | Applied schema migrations (`pnpm --filter @styleme/api migrate`) | System | 1 |
| `deletionTombstones` | Minimal records of deleted accounts, replayed after a restore (D-85). **Kept in a separate tombstone store, outside the main database's backup and restore scope** | System | 1 |
| `profiles` | Preferences, category sizes, fit | Per user | 1 |
| `appearanceProfiles` | Self-reported appearance signals (estimates later) | Per user | 1 |
| `outfits` | Suggested and saved looks | Per user | 1 |
| `aiCache` | Cached optional AI wording | System | 1 (only if AI wording is enabled) — model and TTL index implemented (#55) |
| `shortlistItems` | Items the user found elsewhere, with prices they entered (not verified by StyleMe) | Per user | 1 (D-77 = B) |
| `retailers` | Retailer registry, access level and disclosure | Shared | Product layer |
| `products` | Verified real product listings | Shared | Product layer |
| `reviewEvidence` | Curated quality evidence | Shared | Product layer |
| `userPhotos` | Metadata of private face and full-body photos; files in private object storage (§3.7) | Per user | Approved (D-103) — model declared, unused |
| `appearanceAnalyses` | History of photo- and measurement-based analyses (§3.8) | Per user | Approved (D-103) — model declared, unused |
| `notifications`, `userActivity` | Home notification bell and recent activity (§3.9) | Per user | Approved (D-106) — not created |
| `savedItems` | One save system for every feature: styles, outfits, designs, shopping looks, products, try-on looks, palettes (§3.10) | Per user | 1 (D-116) — model declared, unused |
| `savedCollections` | User-named collections of saved items (§3.11) | Per user | 1 (D-116) — model declared, unused |
| `customPalettes` | Personal palettes, created or customised from a curated one (§3.12) | Per user | 1 (D-109) — model declared, unused |
| `userFeedback` | Explicit likes and "not for me" on styles, palettes, templates, products, saved items (§3.13) | Per user | 1 (D-115) — model declared, unused |
| `productReports` | "Report an issue" on a product (§3.14) | Per user | Product layer (D-124) — not created |
| `catalogueCategories`, `garmentAttributes`, `clothingStyles` | Shared clothing-style catalogue: hierarchy, attribute values, reusable styles (§4a) | Shared | 1 (D-110, D-111) — models declared, unused |
| `palettes`, `outfitTemplates`, `stylingRules`, `fabricRules` | The knowledge base in MongoDB (§4a.4) | Shared | 1 (D-110) — models declared, unused |
| `illustrations` | Croquis, technical flats, try-on layers and models, imagery, with rights (§4a.5) | Shared | 1 (D-113) — model declared, unused |
| `adminAccounts`, `adminAuditLogs` | Admin roles and the admin audit log (§4b) | Admin / system | 1 (D-120) — models declared, unused |
| `usageDailyStats` | Aggregate daily counters for the admin dashboard; no user ID (§4b.3) | System | 1 (D-125) — model declared, unused |
| `manualSteps` | Interactive website manual workflow steps with feature roadmap, imagery and metadata | Shared | 1 |
| `productImportRuns` | Results of product imports and syncs (§4.6) | System | Product layer — not created |
| `designs`, `chatMessages` | Design Studio, chatbot | Per user | Deferred (D-76) |
| try-on results | Photo-based or generative try-on | Per user | Future (D-48). The 2D try-on stores only configurations in `savedItems` (D-119, D-128) |

**Where the styling knowledge lives (D-110).** The runtime source of truth for palettes, templates, rules, clothing styles, categories, attributes and illustrations is the set of shared MongoDB collections in §4a. The JSON files in `apps/api/src/style-rules/data/` remain the founder-review and seed format until the admin panel edits the catalogue; an import script loads approved records into MongoDB, validated by the same Zod schemas and linter (§6).

**Implemented on `main` (verified 2026-10-18):** `users`, `betaInvites`, `pendingRegistrations`, `authChallenges`, `sessions`, `profiles`, `appearanceProfiles`, `deletionTombstones` (separate connection) and `migrations`. **Declared but unused (approved, D-103):** `userPhotos`, `appearanceAnalyses` — both already in `USER_OWNED_COLLECTIONS`. **Implemented in #33 (not yet merged):** `outfits` (§3.4), already in `USER_OWNED_COLLECTIONS`. **Not yet created:** `shortlistItems` (already listed in `USER_OWNED_COLLECTIONS`, so deletion and replay will cover it), `aiCache`, and every product-layer and deferred collection. Their shapes are fixed by the merged contracts in `packages/contracts/src/{outfit,product}.ts`.

**Declared on 2026-10-18 for the feature specifications (D-109 … D-128), not yet used by any endpoint, script or engine:** `catalogueCategories`, `garmentAttributes`, `clothingStyles`, `palettes`, `outfitTemplates`, `stylingRules`, `fabricRules`, `illustrations`, `usageDailyStats` (`apps/api/src/models/catalogue.ts`); `savedItems`, `savedCollections`, `customPalettes`, `userFeedback`, `adminAccounts`, `adminAuditLogs` (`apps/api/src/models/user-collections.ts`). Their enums come from `packages/contracts/src/{catalogue,saved-items,admin}.ts`. All new user-owned collections are already in `USER_OWNED_COLLECTIONS`, so account deletion and tombstone replay cover them (tested in `apps/api/tests/api/catalogue-models.test.ts`). The optional fields added to `users` and `profiles` default to `undefined`, so existing documents are unchanged and **no migration is needed**.

---

## 3. Stage 1 Collections

### 3.1 `users`

| Field | Type / rule |
|---|---|
| `email` | string, unique, lower-cased |
| `passwordHash` | string (argon2id), or `null` until a Google sign-up creates its StyleMe password (D-88). The plain password is never stored or logged |
| `name` | string (full name) |
| `emailVerifiedAt` | timestamp, or `null` until the email is verified (D-89). Unverified accounts can't log in |
| `googleSub` | Google account ID, unique when set (D-88) |
| `city` | city ID from the shared list in `packages/contracts/src/cities.ts`, or `null` (Google sign-ups give it during onboarding; users who skip onboarding may add it later in Settings) |
| `phone` | `{ e164, verifiedAt }` or `null` (D-92) |
| `consent` | `{ termsVersion, termsAcceptedAt, privacyVersion, privacyAcceptedAt, marketingOptIn, marketingUpdatedAt }` (D-87) |
| `loginSecurity` | `{ failedCount, lockedUntil }` — login lockout (D-90) |
| `onboarding` | `{ styleProfileCompletedAt, appearanceCompletedAt, skippedAt }` — server-authoritative progress (FR-ONB). `skippedAt` is set when the user chose "Skip for now" instead of saving a style profile (FR-ONB-05); such users may have no `profiles` document and no city |
| `role` | `user` \| `admin` (D-73) |
| `isActive` | boolean; set only by admin scripts. When `false`, login fails and existing tokens are rejected (FR-AUTH-08) |
| `tokenVersion` | integer; incremented to revoke all API tokens — on password change or reset, when Google linking discards a pre-registered password, or by admin script (D-05, D-07, D-83, D-88) |
| `passwordChangedAt` | timestamp of the last password change or reset, or `null` |
| `lastActiveAt` | **Specified (D-125):** date of the last authenticated request, updated at most once a day; used only for aggregate "active users" counts. Not set yet |
| `suspension` | **Specified (D-120):** `{ suspendedAt, suspendedBy, reasonCode }` when a Super Admin suspended the account through the admin panel (alongside `isActive: false`); removed on reactivation. Not set yet |
| `createdAt`, `updatedAt` | timestamps |

### 3.1a `betaInvites`

| Field | Type / rule |
|---|---|
| `email` | string, unique, lower-cased |
| `invitedAt`, `invitedBy` | timestamp; admin user ID |
| `usedAt` | set when the invitee registers, else `null` |

Managed only by a server-side admin script; no API endpoint writes it.

### 3.1e `pendingRegistrations`

A sign-up waiting for its email code. The `users` document is created only when the code is verified, from these fields; this document and its challenge are then deleted.

| Field | Type / rule |
|---|---|
| `_id` | reserved as the future user's `_id`; the `email_verification` challenge's `userId` |
| `email` | string, unique, lower-cased |
| `name`, `city`, `phone` | as entered (`phone` in E.164 or `null`) |
| `passwordHash` | argon2id hash; the password is never stored |
| `termsVersion`, `privacyVersion`, `acceptedAt`, `marketingOptIn` | consent given at sign-up |
| `expiresAt` | 24 hours after the last code was sent (TTL index) |

### 3.1b `authChallenges` (D-89; replaces `passwordResetTokens`)

One document per user and purpose. Issuing a new code or link replaces the earlier one, so only the latest works.

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `purpose` | `email_verification` \| `password_reset` \| `password_change` \| `email_change` \| `phone_verification` \| `account_deletion`; unique with `userId` |
| `target` | the new email (`email_change`) or phone (`phone_verification`) being verified, else `null` |
| `otpHash`, `otpExpiresAt` | HMAC-SHA-256 of the 6-digit code (keyed with `AUTH_ACCESS_TOKEN_SECRET`); valid 5 minutes |
| `linkHash`, `linkExpiresAt` | SHA-256 of a random link token (256 bits); unique when set. Verification and email-change links 30 minutes, reset links 15 minutes, admin codes 60 minutes, reset tokens from a verified code 10 minutes |
| `consumedAt` | set when used; never accepted again |
| `failedAttempts`, `lockedUntil` | 3 wrong codes lock this challenge for 30 minutes; kept across resends |
| `sentAt` | send times in the last hour: 30-second cooldown, at most 6 sends (first + 5 resends) per hour |
| `pendingTokenHash`, `rememberMe` | `email_verification` only: SHA-256 of the pending-registration token held in the registering browser's `HttpOnly` cookie, and its Remember Me choice |
| `issuedBy` | admin user ID for admin-issued reset codes (FR-AUTH-12), else `null` |
| `expiresAt` | 24 hours after the last send (TTL index), so the send history, lockout and pending registration outlive the codes themselves |

Codes, link tokens and pending tokens are never stored or logged in plain form. A successful reset deletes the user's other challenges; account deletion deletes all of them.

### 3.1d `sessions` (D-07)

| Field | Type / rule |
|---|---|
| `sidHash` | SHA-256 of the random session ID (≥ 128 bits) carried in the token; unique. The session ID itself is never stored or logged |
| `userId` | reference → `users` |
| `createdAt` | login time |
| `remember` | Remember Me (D-91) |
| `expiresAt` | `createdAt` + 30 days with Remember Me, otherwise + 24 hours — the same as the token; TTL index |

Created at login, at verification in the registering browser and at Google sign-in. Deleted at logout (that session only), on password change (all others; the browser that changed it gets a new one), on reset, Google linking of an unverified account and by admin script (all), and on account deletion. No IP address, user agent or other device data is stored.

### 3.1c `deletionTombstones` (separate tombstone store, D-85)

| Field | Type / rule |
|---|---|
| `userId` | the deleted account's internal ID |
| `emailHmac` | HMAC-SHA-256 of the normalised email with the server secret `TOMBSTONE_HMAC_KEY`; used only to find a restored `betaInvites` record, which has no `userId`. The plain email is not stored |
| `deletedAt` | timestamp |
| `source` | `self_service` \| `admin_request` |
| `expiresAt` | `deletedAt` + backup retention period + 7 days (37 days while backup retention is the proposed 30); TTL index |

No name, plain email, IP address, reason text or other personal data. The store sits outside the main database's restore scope, so restoring the main database never rolls tombstones back. The API's database user may only **insert** tombstones; only the restore and reconciliation scripts may read them.

**Account deletion order:** (1) write the tombstone — if this fails, return `SERVICE_UNAVAILABLE` and delete nothing; (2) delete all of the user's data from the live database, the `users` record last; (3) if step 2 fails partway, the tombstone remains, and the reconciliation script replays all tombstones against the live database. Replay is idempotent.

**Replay list:** `users` (by `_id`), `sessions`, `profiles`, `appearanceProfiles`, `userPhotos` and `appearanceAnalyses` (approved, not yet written; their stored photo objects must also be deleted once uploads exist), `outfits` (including feedback), `shortlistItems`, `savedItems`, `savedCollections`, `customPalettes`, `userFeedback`, `productReports`, `adminAccounts`, `authChallenges` and the legacy `passwordResetTokens` (by `userId`), and `betaInvites` (by matching `emailHmac`). Any new user-owned collection must be added to the replay list and its verification before it ships.

### 3.2 `profiles` (one per user)

| Field | Type / rule |
|---|---|
| `userId` | reference → `users`, unique |
| `department` | The **Clothing Preference** (D-129): `women` \| `men` (required). `any` remains valid only on profiles saved before D-129; My Profile asks those users to choose again |
| `sizes` | per category group, each optional ([FRD.md](FRD.md) §4.8): `tops` `{ letter: XS…3XL, collarIn? 13–20 in 0.5 steps }`; `bottoms` `{ waistIn: 24–50, lengthIn?: 26–36 }`; `ethnicTops` `{ letter?, numeric?: 28–54 }` (at least one); `ethnicSets` `{ letter?, waistIn? }` (at least one); `shoes` `{ uk: 1–14 }`. Letter sizes: `XS`, `S`, `M`, `L`, `XL`, `2XL`, `3XL`. `dresses` is added with that category in Stage 2. Ranges are defaults (D-54) and can be widened without migration |
| `fitPreferences` | per category group (`tops`, `bottoms`, `ethnicTops`, `ethnicSets`): `slim` \| `regular` \| `relaxed` |
| `likedColors[]`, `dislikedColors[]` | colour IDs from the knowledge base |
| `contrastPreference` | `low` \| `medium` \| `high` \| `no_preference` |
| `silhouettePreferences[]` | enum values (D-09) |
| `coveragePreferences` | the least coverage the user accepts (a hard constraint, FR-LOOK-08): `{ minSleeveLength?, minNecklineCoverage?, minGarmentLength? }`, each from the vocabulary lists ordered least → most coverage |
| `comfortPreferences[]` | comfort options from the vocabulary (e.g. stretch, loose fit, breathable) |
| `fabricPreferences` | `{ liked[], avoided[] }` |
| `preferredStyles[]`, `preferredOccasions[]` | enum values (D-09) |
| `preferredWearTypes[]` | `indian` \| `fusion` \| `western`; optional soft ranking preference (D-96). A wear type chosen in a look request overrides it. **Planned (#63): not yet in `profileSchema` or the profile contract** |
| `budgetPreference` | optional per-look budget in whole ₹ (1 – 10,00,000). Stage 1: compared only with totals of user-entered prices; never filters generation |
| `measurements` | **Built (D-129):** `{ displayUnit: cm \| in, valuesCm: { … }, updatedAt }`, written by `PUT /v1/measurements`. Body-type measurements — women: `shoulder`, `bust`, `waist`, `hip`, `highHip`; men: `shoulder`, `chest`, `waist`, `hip`. Optional fit measurements — women: `underbust`, `shoulderToWaist`, `backWidth`, `armhole`, `upperArm`, `wrist`, `sleeveLength`, `neck`, `waistToHip`, `thigh`, `knee`, `calf`, `inseam`, `outseam`, `riseFront`, `riseBack`, `dressLength`; men: `neck`, `backWidth`, `shoulderToWaist`, `armhole`, `upperArm`, `wrist`, `sleeveLength`, `thigh`, `knee`, `calf`, `inseam`, `outseam`, `riseFront`, `riseBack`, `jacketLength`, `shirtLength`. Entered by the user only, stored in cm, each value range-checked (`BODY_MEASUREMENTS`, `MEASUREMENT_ORDER` in `packages/contracts/src/my-profile.ts`). Never sent to any AI provider; never logged |
| `ageGroup` | **Built (D-104, kept by D-129 on 2026-10-22):** optional `under_18` \| `18_24` \| `25_34` \| `35_44` \| `45_plus`; no date of birth. Reported to admins only as aggregated counts |
| `heightCm` | **Built (D-131, 2026-10-22):** optional height in whole centimetres (120 – 230), unset until given. The engine uses only its height band (`heightBand()`); it goes to Gemini with a full-body photo, never with a face photo |
| `bodyShapeChoice` | **Unused since D-129** (the body type lives in `appearanceProfiles.bodyType`); kept for existing documents |
| `defaultFit` | **Approved (D-102), declared, not yet written:** default fit applied where `fitPreferences` has no value for a category; adds `oversized` to the fit options (vocabulary change, D-62) |
| `categoryBudgets` | **Approved (D-102), declared, not yet written:** `{ <size group>: ₹ }`, e.g. `{ tops: 1500, bottoms: 2000 }`; `budgetPreference` stays the default per look. Temporary budget changes while exploring are not stored |
| `customOccasions[]` | **Approved (D-102), declared, not yet written:** up to 10 plain-text labels (≤ 40 characters); shown to the user only, never read by the engine or logged |
| `sectionUpdatedAt` | **Approved (D-102), declared, not yet written:** `{ basic_info?, skin_tone?, body_shape?, measurements?, style_fit?, colours?, occasions?, budget? }` dates for "Last updated" per My Profile section |
| `stylingGoals[]` | **Specified (D-111, FR-OCAT-11):** styling goals from `STYLING_GOALS` (e.g. `taller_silhouette`, `define_waist`, `explore_freely`); soft ranking inputs |
| `preferredStyleIds[]`, `avoidedStyleIds[]` | **Specified (FR-OCAT-16):** clothing-style IDs (`CST-…`) the user explicitly prefers or avoids; avoided styles are deprioritised in recommendations, never hidden from browsing |
| `personalization` | **Specified (D-115):** `{ paused, useFeedback, resetAt }` — pause personalisation, decide whether feedback affects ranking, and the time of the last reset (feedback older than `resetAt` is ignored) |
| `weatherPreferences` | Stage 2: `{ enabled: false, city: { cityId, name } \| null }`; never coordinates |
| `createdAt`, `updatedAt` | timestamps |

**Allowed values (D-09).** Every enumerated field here and in `appearanceProfiles` (department, colour IDs, contrast, silhouettes, coverage, comfort, fabrics, styles, wear types, occasions, fit, undertone, Monk range, proportion descriptors) uses the shared vocabulary in `packages/contracts/src/style-vocabulary.ts`, which the style knowledge base uses too. Values are stored as strings, so adding a value needs no migration; IDs are never renamed or removed.

*D-129:* My Profile no longer asks for `sizes`, `fitPreferences`, colours, `contrastPreference`, silhouettes, coverage, comfort, styles or occasions; saving My Profile sends them cleared. The fields stay in the schema for existing data and for features that ask per outfit.

Age range and height are **not collected** in Stage 1: no Stage 1 rule or feature uses them (FR-PROF-04). They are added only when a released rule or feature defines a purpose for them.

**My Profile (D-102 … D-104, approved 2026-10-18; not built).** The request's `user_profiles` collection is this existing `profiles` collection — no second profile collection is created. The proposed fields above are already declared in `profileSchema` (`apps/api/src/models/index.ts`) with `default: undefined`, so existing documents are unchanged and **no migration is needed**. `PUT /v1/profile` still rejects them and `GET /v1/profile` never returns them (tested in `apps/api/tests/api/profile.test.ts`). Name and city stay on `users` (one place each); clothing preference is `department`; section completion is computed on read (`profileCompleteness()`), never stored.

### 3.3 `appearanceProfiles` (one per user, D-72)

| Field | Type / rule |
|---|---|
| `userId` | reference → `users`, unique |
| `skinTone` | attribute object (§5); `value` is `{ monkRange: "4-5" }` (tones `a-b`, 1 ≤ a ≤ b ≤ 10, span ≤ 2) |
| `undertone` | attribute object (§5); `value` is `warm` \| `cool` \| `neutral` \| `olive` \| `not_sure` |
| `bodyProportions` | attribute object (§5); `value` is a self-described proportion or silhouette descriptor (D-09). Set automatically from `bodyType` (`BODY_SHAPES[].proportion`) |
| `bodyType` | **Built (D-129):** attribute object (§5); `value` is one of `BODY_TYPES_BY_DEPARTMENT[department]` — women: `hourglass`, `top_hourglass`, `bottom_hourglass`, `pear`, `spoon`, `rectangle`, `inverted_triangle`, `oval`, `diamond`; men: `rectangle`, `triangle`, `inverted_triangle`, `trapezoid`, `oval`. Cleared when the Clothing Preference changes to one whose list lacks it |
| `useInRecommendations` | boolean, default `true`; when `false`, all appearance signals are ignored (they stay stored until cleared) |
| `analysisVersion` | prompt version of the latest photo analysis (`photo-analysis-v1`) |
| `createdAt`, `updatedAt` | timestamps |

Since D-129 an attribute's `source` is `self_reported` (manual), `photo_estimate` (Gemini), `measurements` (`classifyBodyType`) or `user_corrected`. Photo and measurement results are written at once with `userConfirmed: false`, `confirmedAt: null` and `estimate: { analysisId, confidence }`; `POST /v1/appearance/confirm` sets `userConfirmed: true`. Any attribute can be cleared (set to `null`).

**Consent fields (D-103; written by `POST /v1/photos` since D-129):**

| Field | Type / rule |
|---|---|
| `photoConsent` | `{ face?: { noticeVersion, grantedAt, revokedAt }, body?: { … } }` — consent per photo kind, asked before the first analysis; revoking stops future analysis |
| `photoRetention` | `keep` \| `delete_after_analysis` — unused since D-129 (photos are kept until the user deletes them) |

The history of estimates lives in `appearanceAnalyses` (§3.8).

### 3.7 `userPhotos` — built (D-103, D-129)

Private profile photos. **Since D-129 (founder decision 2026-10-22) the image bytes are stored in this document** (`data`, BSON binary, `select: false`, never returned to clients or logged), so account deletion removes them with the document (`USER_OWNED_COLLECTIONS`). Only the newest photo of each kind is kept. `storage: object_storage` with `storageKey` is reserved for a later move to R2 (D-107).

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `kind` | `face` (skin tone and undertone) \| `body` (body shape) — two separate uploads |
| `angle` | `front` \| `side` \| `back` for body photos; `null` for face photos |
| `storage` | `mongodb` (default) \| `object_storage` |
| `data` | the image bytes (when `storage: mongodb`); never selected by default |
| `storageKey` | unset while photos live in MongoDB; unique (partial index) when used |
| `contentType`, `bytes` | `image/jpeg` \| `image/png` \| `image/webp`; ≤ 8 MB, file signature checked. The web app redraws the photo before upload, which drops EXIF/location metadata |
| `retention` | `keep` \| `delete_after_analysis` |
| `uploadedAt`, `analyzedAt` | timestamps |
| `deleteAfter` | set for `delete_after_analysis`; a deletion job removes the stored object **and** this document together (no TTL index, which would orphan the object) |

Deleting a photo deletes the object and this document; it does **not** delete results derived from it (§3.8).

### 3.8 `appearanceAnalyses` — built (D-103, D-129)

History of skin-tone and body-type analyses: Gemini photo analyses (`analysisVersion: photo-analysis-v1`; `result` `{ monkTone, undertone }` or `{ bodyType }`) and body types identified from measurements (`source: measurements`, `measurements-v1`, `confidence: null`). A new result supersedes the previous pending one of the same kind; confirming sets `confirmed`, a correction sets `corrected`.

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `kind` | `skin_tone` \| `body_shape` |
| `source` | `photo` \| `measurements` \| `photo_and_measurements` (measurements are always typed by the user) |
| `photoIds[]` | references → `userPhotos` (may point to photos since deleted) |
| `result` | the estimate, in the vocabulary of the matching `appearanceProfiles` attribute |
| `confidence` | `high` \| `medium` \| `low` for photo-only results; `null` otherwise — never shown as certainty |
| `status` | `pending_review` → `confirmed` \| `corrected`; older results become `superseded` |
| `analysisVersion` | version of the analysis method |
| `reviewedAt`, `createdAt`, `updatedAt` | timestamps |

Users can delete photo-derived results (`source` `photo` or `photo_and_measurements`) separately from photos and measurements. When consent is revoked they choose to keep or delete them.

### 3.9 Home dashboard data — approved (D-106), not created

Home has **no collection of its own**. It reads `profiles`, `appearanceProfiles` (summary only), palettes and templates (knowledge base), `outfits`, future `designs` and profile completeness. Only persistent user actions would be stored, in two new user-owned collections that are **not created yet**:

| Collection | Purpose | Fields (proposed) |
|---|---|---|
| `notifications` | Notification bell | `userId`, `type` (account security, profile update, feature availability, privacy notice), `title`, `body`, `link`, `readAt`, `createdAt`, TTL on `expiresAt` |
| `userActivity` | Recently visited features and continue links | `userId`, `feature` (slug), `target` (optional ID), `visitedAt`; capped to the latest ~20 per user, TTL 90 days |

The theme preference (light / dark / system) is a browser setting, not stored on the server. Recommendations are generated by the engine; a cache or `recommendations` collection is added only if measured performance requires it. Both collections must be added to `USER_OWNED_COLLECTIONS` when created.

### 3.10 `savedItems` — one save system for every feature (D-116)

Model declared in `apps/api/src/models/user-collections.ts`. **Saved looks (#41, D-116 mechanism agreed on #41):** `OutfitsService.save` upserts one entry per saved look (`itemType: "outfit"`, `sourceFeature: "discover_my_style"`, `ref: { kind: "look" }`, `identityKey` = SHA-256 of `outfit|look|<outfitId>`; name, a minimal snapshot, `recommendationContext`, `origin` and `facets` filled from the look) and `OutfitsService.remove` deletes it with the look; `outfits` stays the source of truth for the look, and `/saved` reads `outfits` until the shared Saved page (TD-FS-SAV-02) exists. No other feature writes `savedItems` yet.

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `itemType` | `clothing_style` \| `outfit` \| `design` \| `shopping_look` \| `product` \| `tryon_look` \| `palette` (`SAVED_ITEM_TYPES`) |
| `sourceFeature` | the feature it was saved from (`STYLEME_FEATURES`), used to reopen it |
| `ref` | `{ kind, id }` — `clothing_style` (`CST-…`), `outfit_template` (`OUT-…`), `look` (`outfits._id`), `catalogue_palette` (`PAL-…`), `custom_palette`, `product`, `design` or `tryon_config` (no separate record). Shared records are referenced, never copied |
| `identityKey` | hash of the reference plus the user's customisation; unique per user, so saving the same thing twice finds the existing item while a deliberate variation gets a new key |
| `name`, `notes` | user-editable; name ≤ 80 characters (default generated), notes ≤ 500 |
| `isFavourite` | Favourites is a status, not a copy |
| `collectionIds[]` | references → `savedCollections` (an item may be in up to 20) |
| `customization` | type-specific choices validated by Zod: colours per garment, selected components, design settings, try-on configuration `{ modelVariantId, garments: [{ styleId, layer, colourHex }] }` |
| `snapshot` | the permitted minimum to keep the item understandable if its source is retired: names, attributes, swatches, illustration IDs; for products the price **as captured** with its capture time (always shown as historical, never as current) |
| `recommendationContext` | the original "why this was recommended" (explanation, rule IDs, matched attributes) when the item came from a recommendation |
| `origin` | `{ paletteId, customPaletteId, templateId, designId, clothingStyleIds[] }` — the inspiration, so it can be reopened |
| `facets` | `{ occasions[], categories[], styles[], colorIds[] }` copied at save time for filters |
| `coverIllustrationId` | the chosen cover (only from the item's own images) |
| `derivedFromId` | set by Duplicate or Save as New Look |
| `createdAt`, `updatedAt` | "recently saved" / "recently updated" |

Limits (defaults, `SAVED_LIMITS`): 1,000 items and 50 collections per user. Deleting a saved item never deletes the shared record or a separately stored design.

### 3.11 `savedCollections` (D-116)

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `name` | ≤ 40 characters; `nameKey` (lower-cased) unique per user |
| `createdAt`, `updatedAt` | timestamps |

Membership lives on `savedItems.collectionIds`, so renaming keeps items and an item can be in several collections without duplication. Deleting a collection removes its ID from the items (the items stay in All Saved, or are removed if the user chooses).

### 3.12 `customPalettes` (D-109, FR-PAL-20, -21)

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `name` | ≤ 60 characters |
| `colours[]` | 2 – 12 entries in display order: `{ hex: "#RRGGBB" (upper case), name?, role: primary \| secondary \| accent \| neutral }` |
| `basedOnPaletteId` | the curated palette it was customised from, or `null` when created from scratch; the curated palette is never changed |
| `createdAt`, `updatedAt` | timestamps |

Creating a custom palette also creates its `savedItems` entry (`ref.kind: custom_palette`), so it appears in My Saved Palettes and can join collections. At most 100 per user.

### 3.13 `userFeedback` (D-115)

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `targetType`, `targetId` | `clothing_style` \| `catalogue_palette` \| `outfit_template` \| `product` \| `saved_item` and its ID; unique together per user (one current reaction) |
| `value` | `like` \| `not_for_me` |
| `reasons[]` | optional, fixed list (`USER_FEEDBACK_REASONS`): fit, comfort, style, occasion, colour, price, too bright, I dislike these colours. No free text |
| `feature` | where it was given |
| `createdAt`, `updatedAt` | timestamps |

Undo deletes the document. Ranking reads feedback only while `profiles.personalization.useFeedback` is not `false` and only feedback newer than `personalization.resetAt`; it is a soft signal that never overrides explicit preferences, and one "not for me" never hides a record from browsing. Looks keep their own `outfits.feedback` (FR-OUT-04).

### 3.14 `productReports` — product layer (D-124)

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `productId` | reference → `products` |
| `issue` | `broken_link` \| `wrong_price` \| `wrong_image` \| `unavailable_size` \| `other` |
| `status` | `open` \| `confirmed` \| `dismissed`, set by an admin (`reviewedBy`, `reviewedAt`) |
| `createdAt` | timestamp |

A report never changes verified product data by itself. Created with the product layer; already in `USER_OWNED_COLLECTIONS`.

### 3.4 `outfits` (looks)

One document per look. `POST /v1/recommendations` creates up to 5 looks sharing a `recommendationId`. **Implemented (#33, #41, #42):** model `Outfit` in `apps/api/src/models/index.ts`; indexes `{ userId, status, createdAt: -1 }` and a TTL index on `expiresAt` (`expireAfterSeconds: 0`; documents without `expiresAt` never expire). Saving (#41) and feedback (#42) are implemented: saving sets `status: 'saved'` and removes `expiresAt`; feedback is stored on `outfits.feedback` (`{ value, reason?, recordedAt }`).

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `recommendationId` | groups looks generated by one request |
| `status` | `suggested` \| `saved` (D-23) |
| `expiresAt` | set for `suggested` (7 days, TTL index); removed when saved |
| `request` | snapshot: `{ occasion, style?, wearType?, paletteMode, budget? (product layer only) }` |
| `inputsUsed` | snapshot of the profile inputs used, for regenerate (#49): `department`, `departmentFiltered`, liked and disliked colours, contrast, silhouettes, fit, coverage, fabric preferences, preferred styles, `sizesSaved[]` (size **groups** only) and `signalsUsed` (a boolean — appearance signal **values are not copied** onto looks) |
| `contentVersion` | hash of the approved library's record IDs and versions the look came from; the same input and content version give the same looks |
| `templateId`, `paletteId` | knowledge-base references |
| `slots[]` | see below |
| `explanation` | "Why this works" text |
| `explanationRefs` | `{ ruleIds[], attributes[] }` actually used (FR-LOOK-12) |
| `combinationSignature` | hash of template, palette and key attributes |
| `defaultsApplied[]`, `conflicts[]`, `warnings[]` | as returned (FR-LOOK-09, -10) |
| `aiModel` | `null` unless optional AI wording was used |
| `aiPromptVersion` | Prompt version of the AI wording (e.g. `wording-v1`); `null` unless optional AI wording was used (#55) |
| `feedback` | `{ value: "love_it" \| "not_for_me", reason? (fixed list), at }` or null |
| `priceSummary` | **not stored for user-entered prices**: computed on read from the user's shortlist items (FR-BUD-07). Product layer: stored with the snapshot as `{ itemsTotal, priceBasis: "verified", budget?, budgetRemaining?, label }` |
| `weatherContext` | Stage 2: `{ source, observedAt, summary, bands }` or manual; never location |
| `createdAt`, `updatedAt` | timestamps |

`slots[]` element:

| Field | Type / rule |
|---|---|
| `slotId` | stable ID copied from the template slot (e.g. `top`, `accessory-1`); unique within the look; never changes for a saved look (D-82) |
| `slot` | category/type: `top` \| `bottom` \| `one_piece` \| `layer` \| `footwear` \| `accessory`; may repeat within a look |
| `lookSpec` | `{ category, colorFamily, colorId, fabric?, fit?, silhouette?, neckline?, sleeve?, length?, pattern? }` |
| `searchPhrase` | generic phrase (FR-LOOK-15) |
| `sizeNote` | e.g. "Your saved size: M" or a prompt to add one |
| `alternatives[]` | slot variations (FR-LOOK-14) |
| `productMatch` | product layer only: `{ productId, snapshot: { retailerId, name, price, priceVerifiedAt, productUrl, qualityVerdict, lookMatch } }`, else `null` |

Items the user attaches to a slot are linked from `shortlistItems` (`outfitId`, `slotId`), not stored on the look, so there is one source of truth. The snapshot keeps a saved look readable after rules or products change. With the product layer, viewing a saved look compares the snapshot with the current product (FR-MATCH-08).

### 3.5 `aiCache`

| Field | Type / rule |
|---|---|
| `cacheKey` | SHA-256 of request type + model + normalised input (D-13); unique |
| `provider`, `model`, `requestType` | strings |
| `response` | cached, validated output |
| `createdAt`, `expiresAt` | TTL index on `expiresAt` (explanation wording: 7 days) |

The input to the optional AI wording step contains only rule references and attribute tags, never personal data (AI rule 16), so cached entries hold no personal data. **Implemented (#55):** `requestType: "explanation-wording"`, `response: { text, promptVersion }`; not user-owned, so not in `USER_OWNED_COLLECTIONS`. Written only while AI wording is on.

### 3.6 `shortlistItems` (Stage 1, D-77 = B)

The user's own notes. Nothing in this collection is verified by StyleMe.

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `outfitId`, `slotId` | optional, but set together or both `null`. When set: the saved look and the `slotId` of the slot the item is attached to, with at most one item per `{outfitId, slotId}` (D-82). When `null`: an unattached item; any number are allowed within the 200-item limit. Both set to `null` when the look is deleted |
| `name` | string, required, ≤ 120 characters |
| `url` | optional `https://` URL entered by the user, ≤ 2,048 characters; never fetched, previewed or modified |
| `priceEntered` | number, required, > 0 and ≤ ₹10,00,000 (1,000,000) |
| `currency` | `INR` |
| `priceBasis` | always `user_entered` |
| `note` | optional, ≤ 300 characters |
| `createdAt` | timestamp; items are not edited (delete and re-add) |

There are no fields for retailer, stock, rating, image or quality: StyleMe doesn't record them for user-entered items. Limits: D-80.

**Implemented (#38):** the `ShortlistItem` model in `apps/api/src/models/index.ts` with the fields above (`createdAt` only, no `updatedAt`), the index `{ userId: 1, createdAt: -1 }` and the unique index `{ outfitId: 1, slotId: 1 }`, partial to attached items (`outfitId` is an ObjectId) so unattached items never conflict. `shortlistItems` is in `USER_OWNED_COLLECTIONS`, so account deletion and tombstone replay remove the items. Until #43, the API creates only unattached items.

---

## 4. Product Layer Collections

These collections exist only when the product layer is enabled (Stage 3). The product layer never contains mock, illustrative or invented products.

### 4.1 `retailers`

| Field | Type / rule |
|---|---|
| `retailerId` | slug, unique (e.g. `flipkart`) |
| `name` | display name, shown only as permitted (D-44) |
| `domains[]` | allowed listing domains for link validation |
| `accessLevel` | `A` (approved API/feed) \| `B` (permitted manual curation) \| `C` (link-only) \| `D` (disabled) ([BRD.md](BRD.md) §7.3) |
| `sourceMethod` | `affiliate_api` \| `partner_feed` \| `manual_curation` \| `none` |
| `status` | `active` \| `pending_access` \| `disabled` |
| `permissions` | recorded outcome of the terms review: `{ display, caching, comparison, nameUse, aiProcessing, reviewedAt, evidenceRef }` |
| `disclosureText` | shown next to links that carry affiliate tracking (D-46) |
| `createdAt`, `updatedAt` | timestamps |

Credentials (for example affiliate tokens) are never stored here. They are environment secrets.

### 4.2 `products`

Only verified real listings. Required fields:

| Field | Type / rule |
|---|---|
| `retailerId`, `retailerProductId` | unique together |
| `provenance` | `authorised` (from an approved API or feed) \| `verified_real` (recorded by a person from a source the retailer's terms permit) |
| `isFixture` | always `false` in production; `true` only in local, CI and staging test data (§7) |
| `name`, `category`, `department`, `colors[]`, `sizes[]`, `styles[]`, `occasions[]` | from the source or curator tags |
| `brand`, `fabric` | from the source; `null` if not provided |
| `price` | ₹, unconditional selling price, > 0 |
| `mrp` | ₹ or `null`; ≥ `price` if present |
| `currency` | `INR` |
| `priceVerifiedAt` | when the price was last verified |
| `availability` | `{ status: in_stock \| out_of_stock \| unknown, sizesInStock[], verifiedAt }` |
| `productUrl` | listing URL on one of the retailer's `domains[]` |
| `linkStatus` | `{ status: ok \| broken \| unchecked, checkedAt }` |
| `imageUrls[]` | source-provided URLs, shown only as the retailer permits (D-47); never copied |
| `affiliateTracked` | `true` if the source-supplied URL carries tracking; used only for disclosure |
| `rating` | `{ average, count, reviewCount, source, capturedAt }` or `null` |
| `sizeSystem`, `sizeChart` | chart only where permitted, with `source` and `capturedAt`, else `null` |
| `quality` | latest assessment (§4.4) |
| `evidence` | provenance evidence (§4.5) |
| `active` | boolean |
| `createdAt`, `updatedAt`, `lastSyncedAt` | timestamps |

`freshness` (fresh / stale / expired) is derived in code from `priceVerifiedAt` and the source method (D-50). It is not stored.

**Shop My Look additions (D-124, specified 2026-10-18):**

| Field | Type / rule |
|---|---|
| `variantGroupId` | groups colour and size variants of one product when the source supports it; each variant keeps its own `productUrl`, `price` and `availability`, so the selected variant always maps to the right link and price |
| `seller` | seller name as the source provides it, or `null` |
| `attributes` | `{ neckline?, sleeve?, length?, fit?, silhouette?, rise?, legShape?, pattern? }` from the source or curator tags, in vocabulary IDs — used to match catalogue styles and designs; never guessed |
| `sizeGroup` | the size group (`tops`, `bottoms`, `dresses`, `shoes` …) the user's category size is compared with |
| `status` | `draft` \| `published` \| `archived` (admin panel); only `published`, `active` products are served |
| `lastVerifiedAt` | the most recent of the price, availability and link checks |

### 4.6 `productImportRuns` (product layer)

| Field | Type / rule |
|---|---|
| `retailerId`, `sourceMethod` | the source being imported or synced |
| `startedAt`, `finishedAt` | timestamps |
| `status` | `running` \| `succeeded` \| `partial` \| `failed` |
| `counts` | `{ received, accepted, rejected }` |
| `errors[]` | `{ code, sourceRecordId }` — sanitised; no payloads |

Shown on the admin Shop Products screen (FR-ADM-07); TTL 180 days.

---

## 4a. Shared Styling Catalogue (D-110 … D-113)

One shared copy of every catalogue record, managed through the admin panel (D-120) and referenced by users only by stable ID. Models in `apps/api/src/models/catalogue.ts`; declared, not yet used. Every record carries the same **lifecycle fields**:

| Field | Type / rule |
|---|---|
| `status` | `draft` \| `published` \| `archived`. Only `published` records reach users; archived ones stay readable by ID so saved items never break |
| `version` | integer, incremented on every published change; changes are recorded in `adminAuditLogs` |
| `review` | `{ status: draft \| reviewed \| approved, approvedBy, approvedAt }`. **Styling content cannot be published unless `review.status` is `approved`** (D-62, enforced by the model); only the Super Admin records approval |
| `publishedAt`, `archivedAt` | timestamps ("recently added" sorts by `publishedAt`) |
| `createdBy`, `updatedBy` | admin user IDs |

### 4a.1 `catalogueCategories` — the hierarchy (D-111)

| Field | Type / rule |
|---|---|
| `key` | unique kebab-case slug, e.g. `women-tops-necklines` |
| `name`, `description` | display text |
| `level` | `department` \| `group` \| `category` \| `subcategory` |
| `department` | `women` \| `men` (a profile with department `any` sees both) |
| `parentId`, `path[]` | parent node and the keys from the department down |
| `sortOrder` | admin-arranged order |
| `garmentTypes[]` | vocabulary garment types (D-97) the node groups |
| `wearTypes[]`, `attributeIds[]`, `illustrationIds[]` | wear types, explorable attributes (e.g. necklines and sleeves for tops) and tile art |

### 4a.2 `garmentAttributes` — attribute values (D-111)

One document per attribute value, e.g. `{ attributeId: neckline, valueId: v_neck }` (unique pair). `valueId` is a vocabulary ID (D-09); the document adds `label`, `description`, `categoryIds[]` (where it applies), `illustrationIds[]` and `sortOrder`. Attributes whose value list doesn't exist in the vocabulary yet (`GARMENT_ATTRIBUTES` entries with `values: null` — collar, sleeve design, shoulder, hem, drape, rise, waistband, leg shape, skirt shape, waist placement, layering) can't be used until those values are approved and added.

### 4a.3 `clothingStyles` — reusable styles (D-111, D-112)

| Field | Type / rule |
|---|---|
| `styleId` | `CST-001` …, unique and stable; `slug` unique |
| `name`, `description` | e.g. "V-neck" |
| `department`, `categoryId` | `women` \| `men`; the category or subcategory node |
| `definingAttribute` | `{ attributeId, valueId }` the style illustrates |
| `attributes[]` | other structured attributes (category-specific) |
| `wearTypes[]`, `occasions[]`, `styles[]`, `stylingGoals[]` | vocabulary IDs |
| `suitabilityRuleIds[]` | `STY-…` rules linking the style to body shapes, proportions, goals, fit and comfort (one style, many shapes) |
| `bodyShapes[]` | denormalised from the approved rules for filtering; the rules stay authoritative |
| `explanation` | `{ summary, benefits[], tradeOffs[], stylingTips[], fitAndComfort, coverage }` |
| `illustrations[]` | `{ illustrationId, role: primary \| view \| technical \| detail, view }` |
| `relatedStyleIds[]`, `alternativeStyleIds[]` | similar and contrasting styles |
| `tryOn` | `{ supported, layer: inner \| top \| bottom \| one_piece \| outer \| accessory, replaces[] }` (D-119) |
| `tags[]` | search |

Popularity ("most saved") is computed from `savedItems` by aggregation, not stored. Products are matched by attributes at query time; no product is attached by hand.

### 4a.4 `palettes`, `outfitTemplates`, `stylingRules`, `fabricRules` (D-110)

The existing knowledge-base record types (§6), stored one document per record:

| Field | Type / rule |
|---|---|
| `recordId` | `PAL-…`, `OUT-…`, `STY-…`, `FAB-…`; unique |
| `name`, `tags[]` | display and search |
| `record` | the record body, **validated by the Zod schemas in `apps/api/src/style-rules/schemas.ts`** before every write — not re-declared in Mongoose |
| `facets` | copies of the fields lists filter on. Palettes: `temperature`, `colorIds[]`, `colourFamilies[]`, `harmony`, `seasonal[]`, `moods[]`, `undertoneAffinity[]`, `occasions[]`, `styles[]`, `culturalContexts[]`. Templates: `department`, `wearType`, `occasions[]`, `styles[]`, `garmentTypes[]`, `clothingStyleIds[]`. Styling rules: `type`, `bodyShapes[]`, `stylingGoals[]`, `attributeIds[]`. Fabric rules: `fabric` |

**Palette record extension (FR-PAL-11 … 17, added to the palette schema with the content work):** every colour gets a `role` (primary, secondary, accent, neutral), with its name and HEX from the colour vocabulary; plus `temperature`, `seasonal[]`, `harmony`, `moods[]`, `culturalContexts[]`, `garmentCombinations[]` (which colour goes where) and `outfitExamples[]` (Indian, fusion and western, with colour placement). **Styling-rule extension (FR-OCAT-04):** `appliesTo.bodyShapes[]`, `appliesTo.stylingGoals[]`, optional measurement-ratio conditions, and `benefit` / `tradeOff` text. Both are optional fields, so existing records stay valid.

### 4a.5 `illustrations` (D-113)

| Field | Type / rule |
|---|---|
| `assetId` | `ILL-001` …, unique |
| `kind` | `croquis` \| `technical_flat` \| `body_shape_figure` \| `tryon_model` \| `tryon_layer` \| `palette_mood` \| `editorial_photo` \| `measurement_guide` \| `undertone_guide` (D-129) |
| `title`, `altText` | alt text is required |
| `views[]` | `{ view: front \| back \| side \| detail, storage: static \| object_storage, path, format: svg \| webp \| png \| jpeg, width, height }`; at least one |
| `depicts` | `{ departments[], clothingStyleIds[], bodyShape, skinToneRange }` — skin tone for representation only |
| `figureClothing` | `plain_white_shirt_and_white_pants` (the default for every figure) or `styled_outfit`; figures are never unclothed |
| `tryOn` | `{ layer, zIndex, recolourable, recolourRegions[], compatibleModelIds[] }` for try-on models and layers |
| `rights` | `{ source: team_made \| commissioned \| cc0 \| cc_by \| licensed_in_writing \| code_generated \| ai_tool_permitted, creator, licence, licenceUrl, attribution, allowedUsage[], evidenceRef, verifiedBy, verifiedAt }`. **A record can't be published until `rights.verifiedAt` is set** (enforced by the model) |

Files: static assets under the web app's public folder in the first release (`storage: static`), object storage later if needed (D-107). These are never user media.

**My Profile guides (D-129).** 46 code-generated SVGs (`rights.source: code_generated`, published): one measuring guide per measurement and Clothing Preference (`ILL-1101` … women, `ILL-1201` … men, in `MEASUREMENT_ORDER`; figure in a plain white shirt and pants with a yellow tape) and four undertone hands (`ILL-1301` … `ILL-1304`). Files live in `apps/web/public/illustrations/profile/`. `pnpm --filter @styleme/api illustrations:generate` rewrites the files; `illustrations:seed` upserts the records.

---

## 4c. Design Features (D-132)

Outfit Categories → necklines, sleeves and more: a shared catalogue (not user-owned) and two user-owned collections. Seeded by `pnpm --filter @styleme/api design:seed` from `src/design/catalogue.ts` (safe to re-run); images written by `design:generate`.

| Collection | Owner | Purpose | Key fields and indexes |
|---|---|---|---|
| `outfitCategories` | shared | Hierarchy: `department` (women, men) → `outfit_category` (indian, western, fusion = Indo-Western) → `garment_type` | `key` unique (`garment-kurta`); `departments[]`, `outfitCategories[]`, `garmentKind` (top, one_piece, bottom, layer, drape), `featureCategoryIds[]`; index `{level, departments, status, sortOrder}` |
| `designFeatureCategories` | shared | Neckline, sleeve, fit, length … and how the page shows them (`illustrated`, `grid`, `tags`) | `categoryId` unique; `garmentKinds[]` |
| `designFeatures` | shared | One record per feature (`neckline_v_neck`), shared by Women's and Men's Wear where it is the same | `featureId` unique; `featureCategory`, `departments[]`, `garmentKinds[]` (empty = all of the category's), `attributes` (depth, width, sleeve length, volume), `illustrations[] {department, role: card/layer, assetId}`, `selectable` (false for "Not applicable"), `status`, `version` |
| `featureSuitabilityRules` | shared, styling content | When a feature is recommended / alternative / not preferred, and why | `ruleId` unique (`FSR-001`); `featureId`, `departments[]`, `applicableGarments[]`, `conditions {bodyTypes[], heightBands[], stylingGoals[]}` (every non-empty list must match), `recommendation {result, reason, confidence}`, `priority` (goals 1, body type 2, height 3); `status` can be `active` only with `reviewStatus: approved` (validated) |
| `featureCombinations` | shared | Pairs that cannot be made (`incompatible`) or curated pairings | `pairKey` + `kind` unique; `featureIds[2]`, `reason` |
| `userDesignPreferences` | **user** | Likes / dislikes / explore, goals, fit and occasion preferences; `personalised[]` = the last result per garment | `userId` unique; `featurePreferences[] {featureId, featureCategory, preference}`, `stylingGoals[]`, `personalised[] {garmentType, department, basisKey (SHA-256 of the inputs), computedAt, features[] {featureId, result, ruleIds}}` — no height, body type or measurement is copied |
| `userDesignSelections` | **user** | The visual customizer's saved combination | unique `{userId, clothingPreference, garmentType}`; `outfitCategory`, `selectedFeatures {category: featureId}`, `customization {necklineDepth, sleeveLength, otherSelectedAttributes}`, `savedAt` |

Both user collections are in `USER_OWNED_COLLECTIONS` (account deletion and tombstone replay). Images are `illustrations` of kind `design_feature` (cards) and `design_feature_layer` (base figures `ILL-2000` / `ILL-3000`, neckline and sleeve layers): static SVGs under `apps/web/public/illustrations/design/`.

---

## 4d. Colour library (D-133)

Monk tone (1 – 10) → undertone (warm, cool, neutral, olive) → 100+ colours. Two shared collections and one user-owned. Built deterministically by `src/colours/library.ts` from openly licensed names (`src/colours/sources.ts`: CSS named colours and the CC0 xkcd survey in `src/colours/data/xkcd-colours.json`) and the reviewed content file, and written by `pnpm --filter @styleme/api colours:seed` (approved content, `src/style-rules/data/colour-library.json`) or `colours:seed -- --drafts` (a future draft, preview only; refused in production). Safe to re-run. Users read only their own category (`/v1/colours/mine`).

| Collection | Owner | Purpose | Key fields and indexes |
|---|---|---|---|
| `colourSwatches` | shared | One named colour (`CLR-0001` …) | `colourId` unique; `name`, `hex`, `rgb[3]`, `oklch {l, c, h}`, `family` (12), `temperature`, `depth`, `intensity`, `source` (`css`, `xkcd`), `status` (`published`, `retired`: colours that leave the list are retired, never deleted); index `{family, status}` |
| `colourCategories` | shared, styling content | One per Monk tone and undertone (`monk-06-warm`), 40 in all | `categoryId` unique; unique `{monkTone, undertone}`; `label`, `skinHex`, `rationale`, `limitations`, `colours[] {colourId, score, rank, reasons[]}`, `contentVersion`, `reviewStatus` (`draft`, `approved`), `reviewedBy`, `reviewedAt` |
| `userColourPreferences` | **user** | Liked and avoided colours | `userId` unique; `colours[] {colourId, preference: liked \| avoided, savedAt}` (oldest first; at most 600) |

`userColourPreferences` is in `USER_OWNED_COLLECTIONS` (account deletion and tombstone replay). No personal data reaches the shared collections; the user's category is computed per request from `appearanceProfiles`, never stored.

---

## 4b. Admin Collections (D-120, D-125)

### 4b.1 `adminAccounts`

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` (which must have `role: admin`), unique |
| `role` | `super_admin` \| `content_admin` |
| `status` | `active` \| `disabled` — disabled admins lose admin access on the next request |
| `createdBy`, `lastLoginAt` | provenance and last admin sign-in |
| `createdAt`, `updatedAt` | timestamps |

No password or credential: admins log in with the normal account (D-95). The collection name follows the existing camelCase convention (the requirements' `admin_accounts`); likewise `user_profiles` in the requirements is the existing `profiles`. Listed in `USER_OWNED_COLLECTIONS`, so deleting the admin's account removes it.

### 4b.2 `adminAuditLogs`

| Field | Type / rule |
|---|---|
| `adminId` | the acting admin's user ID |
| `action` | `CREATED`, `UPDATED`, `APPROVED`, `PUBLISHED`, `UNPUBLISHED`, `ARCHIVED`, `RESTORED`, `USER_SUSPENDED`, `USER_REACTIVATED`, `USER_DELETION_REQUESTED`, `ADMIN_ROLE_CHANGED`, `ADMIN_DISABLED`, `ADMIN_ENABLED`, `REPORT_REVIEWED` |
| `targetType`, `targetId` | e.g. `clothing_style` / `CST-001`, `user` / an internal ID |
| `status` | `success` \| `failure` |
| `changes[]` | `{ field, from?, to? }` — field names, and values only for non-personal catalogue fields (`auditChangeSchema`); never passwords, tokens, photos, user-media URLs, measurements or profile values |
| `requestId` | for troubleshooting |
| `at`, `expiresAt` | time; TTL 1 year |

A security record: it is **not** deleted with a user's account (it holds only an internal ID) and ages out by TTL. Readable only by the Super Admin.

### 4b.3 `usageDailyStats`

`{ day: "YYYY-MM-DD", feature, metric, count }`, unique per day, feature and metric — e.g. `discover_my_style / recommendations_served`, `outfit_categories / empty_results`, `virtual_try_on / unsupported_combination`. Incremented by the API; **no user ID or other personal data**. Groups under 10 are shown as "fewer than 10".

### 4.3 `reviewEvidence`

| Field | Type / rule |
|---|---|
| `productId`, `retailerId` | references |
| `sourceType` | `retailer_aggregate` \| `curated_excerpt` \| `partner_feed` |
| `sourceUrl`, `capturedAt`, `capturedBy` | required |
| `kind` | `rating_summary` \| `review_excerpt` \| `complaint_theme` \| `photo_discrepancy_note` |
| `dimensions[]` | `fabric` \| `fit` \| `stitching` \| `durability` \| `sizing` \| `color_accuracy` \| `overall` |
| `sentiment` | `positive` \| `negative` \| `mixed` \| `neutral` |
| `excerpt` | ≤ 200 characters, only where permitted; otherwise `null` |
| `verifiedPurchase` | boolean or `null` |
| `language` | e.g. `en`, `hi` |
| `isFixture` | as for products |
| `createdAt` | timestamp |

No reviewer names, profiles, photos or other personal data are stored. Customer photos are never copied; a curator may record what they show as a `photo_discrepancy_note`.

### 4.4 Quality assessment (embedded in `products.quality`)

`{ verdict, confidence (0–1, never 1), confidenceLevel, dimensions { fabric, fit, stitching, durability, sizing, colorAccuracy → { signal, evidenceCount } }, recurringComplaints[], reasons[], warnings[], evidenceIds[], evidenceCount, methodVersion, assessedAt }`. Only the latest assessment is kept.

### 4.5 Product provenance evidence (what makes a product "verified")

| Source method | Required evidence in `products.evidence` |
|---|---|
| `affiliate_api` / `partner_feed` | `{ sourceMethod, syncJobId, fetchedAt, sourceRecordId }`, plus the retailer's `permissions` recorded in `retailers` |
| `manual_curation` | `{ sourceMethod, sourceUrl, capturedAt, curatorId, reviewedAt, criteriaVersion, status: approved \| needs_recheck \| retired }` |

**Validation (import and sync).** A record is rejected if:
- the `productUrl` host isn't in the retailer's `domains[]`;
- the price is ≤ 0, or the MRP is below the price;
- a timestamp is in the future;
- required evidence is missing;
- `isFixture` is `true` in production;
- the retailer isn't `active` at access level A or B.

Values the source doesn't provide stay `null` and are never estimated. Expiring signed feed URLs are never stored. No commission or affiliate-rate fields exist.

---

## 5. Appearance Attribute and Confidence Model

Each appearance attribute keeps the **value used for recommendations** separate from any **model estimate**:

```json
{
  "value": "warm",
  "source": "self_reported",
  "userConfirmed": true,
  "confirmedAt": "2026-10-10T10:00:00Z",
  "estimate": null
}
```

| `source` | Meaning | `estimate` | Confidence shown? |
|---|---|---|---|
| `self_reported` | The user entered the value (Stage 1) | `null`; no confidence is stored or shown | No |
| `photo_estimate` | The model's estimate (photo analysis; deferred, D-76). Before confirmation `value` is `null` and `userConfirmed` is `false`; confirming copies `estimate.value` into `value` | `{ value, confidence, analysisVersion }` | Yes, next to the estimate, before and after confirmation; never presented as the confidence of the confirmed value |
| `user_corrected` | The user replaced an estimate with their own value | Kept unchanged as the model's record | Only as part of the kept estimate |

Rules:
- Confirming an estimate sets `userConfirmed: true` and `confirmedAt`. It **never** changes `estimate.confidence`, which is never set to 1.
- An estimate below the calibrated confidence threshold (D-15) is not offered as a value: the user sees "not sure" (or chooses a value themselves), so a low-confidence classification is never forced.
- Withdrawing photo consent or deleting the photo-derived data clears every `estimate` and every value whose source is `photo_estimate`; what else withdrawal deletes is decided with photo analysis (D-11).
- Recommendations use `value` only when `userConfirmed` is `true` and `useInRecommendations` is on. Unconfirmed estimates are never used.
- No fake confidence values exist for self-reported data.

---

## 6. Style Knowledge Base (repository files, not MongoDB)

Palettes (`PAL-xxx`), styling/fit rules (`STY-xxx`), fabric rules (`FAB-xxx`) and outfit templates (`OUT-xxx`) live in `apps/api/src/style-rules/` (D-66). **From D-110 the runtime copy is in MongoDB (§4a.4):** these files remain the founder-review and seed format and are imported by stable ID and version; the same schemas and linter validate the import and every admin publish. They are Zod-validated and linted at startup and in CI. Every record has `id`, `version`, `tags[]`, applicable contexts, user-adjustable preferences, `rationale`, `limitations`, `reviewStatus` (`draft` \| `reviewed` \| `approved` \| `retired`), `reviewedBy` and `reviewedAt`. Type-specific fields: [AI.md](AI.md) §4. Looks reference records by ID, and each template slot carries a `slotId` unique within its template (D-82). Templates carry a `wearType` (D-96); slots name garment types grouped into broad categories (D-97) and carry a `formality` (D-98). IDs use three digits or more (`PAL-001` …) so the library can grow past 100 records per type; the files are loaded once at startup and sized for at least 150 palettes and 150 templates (FR-STY-10).

---

## 7. Environments and Test Data

| Environment | Database | Test fixtures allowed? | Real user data? |
|---|---|---|---|
| Local development | Local MongoDB instance (or `mongodb-memory-server`); no hosted account is assumed before HC-1 (D-81) | Yes | No |
| CI | `mongodb-memory-server`, created per run | Yes | No |
| Staging (created after HC-1, per D-81) | Separate Atlas database | Yes (and staff test accounts) | No |
| Production (created in S1.7, per D-81) | Separate Atlas database and credentials | **Never** | Yes |

Each environment also has its own tombstone store (D-85): a separate local database or in-memory server locally and in CI, and a store outside the main database's restore scope in staging and production.

Safeguards (D-78):
- Production database credentials exist only in the production environment.
- Fixtures live in `apps/api/tests/fixtures/` and are loaded only by test and seed scripts that refuse to run when `APP_ENV=production`.
- The production API refuses to start if any document has `isFixture: true`.
- Product ingestion rejects fixtures in production.
- Automated tests verify all of this ([TESTING.md](TESTING.md) T-29, T-30).

---

## 8. Indexes

| Collection | Index |
|---|---|
| `users` | `email` (unique) |
| `betaInvites` | `email` (unique) |
| `profiles`, `appearanceProfiles` | `userId` (unique) |
| `outfits` | `{ userId, status, createdAt }`; `recommendationId`; TTL on `expiresAt` |
| `aiCache` | `cacheKey` (unique); TTL on `expiresAt` |
| `shortlistItems` | `{ userId, createdAt }`; `{ outfitId, slotId }` — a partial unique index covering only attached items (`outfitId` set), so unattached items never conflict |
| `users` | `googleSub` (unique, partial: only when set) |
| `authChallenges` | `{ userId, purpose }` (unique); `linkHash` (unique, partial); `pendingTokenHash` (partial); TTL on `expiresAt` |
| `sessions` | `sidHash` (unique); `userId`; TTL on `expiresAt` |
| `deletionTombstones` (tombstone store) | `userId`; `emailHmac`; TTL on `expiresAt` |
| `retailers` | `retailerId` (unique) |
| `products` | `{ retailerId, retailerProductId }` (unique); `{ active, category, department }`; `priceVerifiedAt`; `availability.status`; `quality.verdict` |
| `reviewEvidence` | `productId` |
| `userPhotos` (approved, D-103) | `storageKey` (unique); `{ userId, kind, uploadedAt: -1 }`; `deleteAfter` (partial: only when set) |
| `appearanceAnalyses` (approved, D-103) | `{ userId, kind, createdAt: -1 }`; `{ userId, source }` |
| `notifications`, `userActivity` (approved, D-106; not created) | `{ userId, createdAt: -1 }` / `{ userId, visitedAt: -1 }`; TTL on `expiresAt` |
| `savedItems` | `{ userId, identityKey }` (unique); `{ userId, itemType, createdAt: -1 }`; `{ userId, updatedAt: -1 }`; `{ userId, collectionIds }`; `{ userId, isFavourite }`; `{ userId, ref.kind, ref.id }` |
| `savedCollections` | `{ userId, nameKey }` (unique) |
| `customPalettes` | `{ userId, updatedAt: -1 }` |
| `userFeedback` | `{ userId, targetType, targetId }` (unique); `{ userId, updatedAt: -1 }` |
| `catalogueCategories` | `key` (unique); `{ parentId, sortOrder }`; `{ department, level, status }`; `path` |
| `garmentAttributes` | `{ attributeId, valueId }` (unique); `{ categoryIds, attributeId, status }` |
| `clothingStyles` | `styleId`, `slug` (unique); `{ department, categoryId, status }`; `{ status, bodyShapes }`; `{ status, definingAttribute }`; `{ status, publishedAt: -1 }`; text index on name, description, tags |
| `palettes` | `recordId` (unique); `{ status, publishedAt: -1 }`; `{ status, facets.undertoneAffinity, facets.temperature }`; `{ status, facets.colourFamilies }`; `{ status, facets.occasions }`; text index on name, tags, colour IDs |
| `outfitTemplates`, `stylingRules`, `fabricRules` | `recordId` (unique); `{ status, publishedAt: -1 }`; templates `{ status, facets.department, facets.occasions }`, `facets.clothingStyleIds`; rules `{ status, facets.type }`, `{ status, facets.bodyShapes }` |
| `illustrations` | `assetId` (unique); `{ kind, status }`; `depicts.clothingStyleIds` |
| `adminAccounts` | `userId` (unique); `{ role, status }` |
| `adminAuditLogs` | `at: -1`; `{ adminId, at: -1 }`; `{ targetType, targetId, at: -1 }`; TTL on `expiresAt` |
| `usageDailyStats` | `{ day, feature, metric }` (unique) |
| `productReports`, `productImportRuns` (product layer) | `{ productId, status }`, `{ userId, createdAt: -1 }`; `{ retailerId, startedAt: -1 }`, TTL |

---

## 9. Relationships

```
users 1─1 profiles
users 1─1 appearanceProfiles
users 1─n outfits                 (outfits.userId)
users 1─n shortlistItems          (shortlistItems.userId)
outfits.slots[].productMatch ──► products          (product layer)
shortlistItems.outfitId + slotId ──► outfits.slots[].slotId (optional attachment)
users 1─n authChallenges          (authChallenges.userId, one per purpose)
users 1─n sessions                (sessions.userId)
retailers 1─n products            (products.retailerId)
products 1─n reviewEvidence       (reviewEvidence.productId)
outfits.templateId / paletteId ──► style-rules files (by ID)
users 1─n userPhotos              (approved; userPhotos.storageKey ──► private object storage)
users 1─n appearanceAnalyses      (approved; photoIds[] ──► userPhotos, may outlive the photo)
appearanceAnalyses (confirmed) ──► appearanceProfiles attribute (value copied on confirmation)

catalogueCategories 1─n catalogueCategories   (parentId; department → group → category → subcategory)
catalogueCategories 1─n clothingStyles        (clothingStyles.categoryId)
garmentAttributes  ◄── clothingStyles.definingAttribute / attributes[]  (by attributeId + valueId)
clothingStyles n─n stylingRules               (suitabilityRuleIds[] ──► STY-…; one style, many body shapes)
clothingStyles n─n illustrations              (illustrations[].illustrationId ──► ILL-…)
outfitTemplates.facets.clothingStyleIds ──► clothingStyles
users 1─n savedItems                          (savedItems.ref ──► CST / OUT / PAL / look / custom palette / product / design)
savedItems n─n savedCollections               (savedItems.collectionIds[])
users 1─n customPalettes                      (basedOnPaletteId ──► palettes, never modified)
users 1─n userFeedback                        (targetType + targetId ──► catalogue record, product or saved item)
users 1─1 adminAccounts                       (role: super_admin | content_admin)
adminAccounts 1─n adminAuditLogs              (adminId)
```

---

## 10. Data Lifecycle and Retention

| Data | Retention |
|---|---|
| Account, profile, appearance signals, saved looks, feedback, shortlist | Until the user deletes them; all deleted from the live database immediately on account deletion (FR-AUTH-09) |
| Suggested (unsaved) looks | 7 days (TTL) |
| Codes and links (`authChallenges`) | Codes and links stop working when used, superseded or expired (5 to 60 minutes); the hashed record is removed 24 hours after the last send (TTL) and with the account |
| Consent records | With the account (terms and privacy versions, acceptance times, marketing choice and its time) |
| Sessions | Until logout, password change or reset, account deletion, or expiry: 24 hours, or 30 days with Remember Me (TTL) |
| Beta invites | Until the closed beta ends, then deleted within 30 days; deleted earlier on request or when the invitee deletes their account |
| Measurements | Deletable at any time on their own |
| Profile photos (approved, D-103) | Kept until the user deletes them or revokes retention (then deleted immediately), or deleted automatically after analysis if the user chose that. Deleting a photo removes the stored object and its `userPhotos` record; account deletion must delete every stored object for the user, not only the metadata |
| Photo-derived analysis results (approved, D-103) | Until the user deletes them; not deleted with the photo; on consent revocation the user chooses keep or delete |
| Notifications, recent activity (approved, D-106) | TTL (e.g. 90 days), and with the account |
| Saved items, collections, custom palettes, explicit feedback | Until the user deletes them; all deleted with the account. Undo of a removal is a short client-side window, not a recycle bin |
| Admin account records | While the admin role is held; deleted with the admin's user account |
| Admin audit logs | 1 year (TTL); internal IDs only; not deleted with a user account (security record) |
| Shared catalogue records | Indefinitely; retired content is archived, not deleted, while anything references it |
| Aggregate usage counters | Indefinitely; no personal data |
| Product reports | Until reviewed + 90 days, and with the account |
| `aiCache` | 7 days (TTL); contains no personal data |
| Products | While active; retired products' evidence is deleted within 30 days (D-49) |
| Review evidence | While its product is active; excluded from assessments after 12 months; deleted within 30 days of product removal or on a valid takedown request (D-49) |
| Operational curation notes | 30–60 days, a provisional window still to be confirmed (D-49) |
| Backups | Per the backup retention period (D-79, 30 days, proposed and not yet approved). Backups are not edited when a user deletes data; deleted data disappears when the backups containing it expire. If a backup is restored, deletions made after it are re-applied from tombstones before users are served (D-85) |
| Deletion tombstones | Backup retention period + 7 days (37 days while backup retention is the proposed 30), then TTL deletion |

Migration `001-auth-onboarding` (2026-10-12) marks existing accounts verified from their creation time, adds the new user fields with defaults, derives onboarding progress from existing profiles and deletes legacy `passwordResetTokens`; applied migrations are recorded in `migrations`, so it runs once. Schema changes use versioned migration scripts that keep old and new code working (add first, remove later), so a rollback never needs a restore (D-79).

---

## 11. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-03, D-05, D-07, D-09, D-13, D-16, D-22, D-23, D-49, D-50, D-54, D-58, D-66, D-72, D-73, D-77, D-78, D-79, D-80, D-85, D-87 … D-94, D-102 … D-108, D-110 … D-128.
