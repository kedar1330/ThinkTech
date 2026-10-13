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
| `aiCache` | Cached optional AI wording | System | 1 (only if AI wording is enabled) |
| `shortlistItems` | Items the user found elsewhere, with prices they entered (not verified by StyleMe) | Per user | 1 (D-77 = B) |
| `retailers` | Retailer registry, access level and disclosure | Shared | Product layer |
| `products` | Verified real product listings | Shared | Product layer |
| `reviewEvidence` | Curated quality evidence | Shared | Product layer |
| `designs`, `chatMessages` | Design Studio, chatbot | Per user | Deferred (D-76) |
| try-on results | Try-on | Per user | Future (D-48) |

The style knowledge base (palettes, rules, templates) is **not** stored in MongoDB. It lives as versioned files in `apps/api/src/style-rules/` (§6).

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
| `city` | city ID from the shared list in `packages/contracts/src/cities.ts`, or `null` (Google sign-ups give it during onboarding) |
| `phone` | `{ e164, verifiedAt }` or `null` (D-92) |
| `consent` | `{ termsVersion, termsAcceptedAt, privacyVersion, privacyAcceptedAt, marketingOptIn, marketingUpdatedAt }` (D-87) |
| `loginSecurity` | `{ failedCount, lockedUntil }` — login lockout (D-90) |
| `onboarding` | `{ styleProfileCompletedAt, appearanceCompletedAt }` — server-authoritative progress (FR-ONB) |
| `role` | `user` \| `admin` (D-73) |
| `isActive` | boolean; set only by admin scripts. When `false`, login fails and existing tokens are rejected (FR-AUTH-08) |
| `tokenVersion` | integer; incremented to revoke all API tokens — on password change or reset, when Google linking discards a pre-registered password, or by admin script (D-05, D-07, D-83, D-88) |
| `passwordChangedAt` | timestamp of the last password change or reset, or `null` |
| `createdAt`, `updatedAt` | timestamps |

### 3.1a `betaInvites`

| Field | Type / rule |
|---|---|
| `email` | string, unique, lower-cased |
| `invitedAt`, `invitedBy` | timestamp; admin user ID |
| `usedAt` | set when the invitee registers, else `null` |

Managed only by a server-side admin script; no API endpoint writes it.

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

**Replay list:** `users` (by `_id`), `sessions`, `profiles`, `appearanceProfiles`, `outfits` (including feedback), `shortlistItems`, `authChallenges` and the legacy `passwordResetTokens` (by `userId`), and `betaInvites` (by matching `emailHmac`). Any new user-owned collection must be added to the replay list and its verification before it ships.

### 3.2 `profiles` (one per user)

| Field | Type / rule |
|---|---|
| `userId` | reference → `users`, unique |
| `department` | `women` \| `men` \| `any` (required) |
| `sizes` | per category group, each optional ([FRD.md](FRD.md) §4.8): `tops` `{ letter: XS…3XL, collarIn? 13–20 in 0.5 steps }`; `bottoms` `{ waistIn: 24–50, lengthIn?: 26–36 }`; `ethnicTops` `{ letter?, numeric?: 28–54 }` (at least one); `ethnicSets` `{ letter?, waistIn? }` (at least one); `shoes` `{ uk: 1–14 }`. Letter sizes: `XS`, `S`, `M`, `L`, `XL`, `2XL`, `3XL`. `dresses` is added with that category in Stage 2. Ranges are defaults (D-54) and can be widened without migration |
| `fitPreferences` | per category group (`tops`, `bottoms`, `ethnicTops`, `ethnicSets`): `slim` \| `regular` \| `relaxed` |
| `likedColors[]`, `dislikedColors[]` | colour IDs from the knowledge base |
| `contrastPreference` | `low` \| `medium` \| `high` \| `no_preference` |
| `silhouettePreferences[]` | enum values (D-09) |
| `coveragePreferences` | the least coverage the user accepts (a hard constraint, FR-LOOK-08): `{ minSleeveLength?, minNecklineCoverage?, minGarmentLength? }`, each from the vocabulary lists ordered least → most coverage |
| `comfortPreferences[]` | comfort options from the vocabulary (e.g. stretch, loose fit, breathable) |
| `fabricPreferences` | `{ liked[], avoided[] }` |
| `preferredStyles[]`, `preferredOccasions[]` | enum values (D-09) |
| `budgetPreference` | optional per-look budget in whole ₹ (1 – 10,00,000). Stage 1: compared only with totals of user-entered prices; never filters generation |
| `measurements` | optional, self-measured; collected only when product size charts exist (product layer). `{ chestCm, waistCm, hipCm, footLengthCm, updatedAt }` |
| `weatherPreferences` | Stage 2: `{ enabled: false, city: { cityId, name } \| null }`; never coordinates |
| `createdAt`, `updatedAt` | timestamps |

**Allowed values (D-09).** Every enumerated field here and in `appearanceProfiles` (department, colour IDs, contrast, silhouettes, coverage, comfort, fabrics, styles, occasions, fit, undertone, Monk range, proportion descriptors) uses the shared vocabulary in `packages/contracts/src/style-vocabulary.ts`, which the style knowledge base uses too. Values are stored as strings, so adding a value needs no migration; IDs are never renamed or removed.

Age range and height are **not collected** in Stage 1: no Stage 1 rule or feature uses them (FR-PROF-04). They are added only when a released rule or feature defines a purpose for them.

### 3.3 `appearanceProfiles` (one per user, D-72)

| Field | Type / rule |
|---|---|
| `userId` | reference → `users`, unique |
| `skinTone` | attribute object (§5); `value` is `{ monkRange: "4-5" }` (tones `a-b`, 1 ≤ a ≤ b ≤ 10, span ≤ 2) |
| `undertone` | attribute object (§5); `value` is `warm` \| `cool` \| `neutral` \| `olive` \| `not_sure` |
| `bodyProportions` | attribute object (§5); `value` is a self-described proportion or silhouette descriptor (D-09) |
| `useInRecommendations` | boolean, default `true`; when `false`, all appearance signals are ignored (they stay stored until cleared) |
| `analysisVersion` | only for photo-analysis estimates (deferred) |
| `createdAt`, `updatedAt` | timestamps |

In Stage 1 every attribute has `source: "self_reported"`. Any attribute can be cleared (set to `null`).

### 3.4 `outfits` (looks)

One document per look. `POST /v1/recommendations` creates up to 5 looks sharing a `recommendationId`.

| Field | Type / rule |
|---|---|
| `userId` | reference → `users` |
| `recommendationId` | groups looks generated by one request |
| `status` | `suggested` \| `saved` (D-23) |
| `expiresAt` | set for `suggested` (7 days, TTL index); removed when saved |
| `request` | snapshot: `{ occasion, style?, paletteMode, budget? (product layer only) }` |
| `templateId`, `paletteId` | knowledge-base references |
| `slots[]` | see below |
| `explanation` | "Why this works" text |
| `explanationRefs` | `{ ruleIds[], attributes[] }` actually used (FR-LOOK-12) |
| `combinationSignature` | hash of template, palette and key attributes |
| `defaultsApplied[]`, `conflicts[]`, `warnings[]` | as returned (FR-LOOK-09, -10) |
| `aiModel` | `null` unless optional AI wording was used |
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

The input to the optional AI wording step contains only rule references and attribute tags, never personal data (AI rule 16), so cached entries hold no personal data.

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

Palettes (`PAL-xxx`), styling/fit rules (`STY-xxx`), fabric rules (`FAB-xxx`) and outfit templates (`OUT-xxx`) live in `apps/api/src/style-rules/` (D-66). They are Zod-validated and linted at startup and in CI. Every record has `id`, `version`, `tags[]`, applicable contexts, user-adjustable preferences, `rationale`, `limitations`, `reviewStatus` (`draft` \| `reviewed` \| `approved` \| `retired`), `reviewedBy` and `reviewedAt`. Type-specific fields: [AI.md](AI.md) §4. Looks reference records by ID, and each template slot carries a `slotId` unique within its template (D-82). IDs use three digits or more (`PAL-001` …) so the library can grow past 100 records per type; the files are loaded once at startup and sized for at least 150 palettes and 150 templates (FR-STY-10).

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
| `aiCache` | 7 days (TTL); contains no personal data |
| Products | While active; retired products' evidence is deleted within 30 days (D-49) |
| Review evidence | While its product is active; excluded from assessments after 12 months; deleted within 30 days of product removal or on a valid takedown request (D-49) |
| Operational curation notes | 30–60 days, a provisional window still to be confirmed (D-49) |
| Backups | Per the backup retention period (D-79, 30 days, proposed and not yet approved). Backups are not edited when a user deletes data; deleted data disappears when the backups containing it expire. If a backup is restored, deletions made after it are re-applied from tombstones before users are served (D-85) |
| Deletion tombstones | Backup retention period + 7 days (37 days while backup retention is the proposed 30), then TTL deletion |

Migration `001-auth-onboarding` (2026-10-12) marks existing accounts verified from their creation time, adds the new user fields with defaults, derives onboarding progress from existing profiles and deletes legacy `passwordResetTokens`; applied migrations are recorded in `migrations`, so it runs once. Schema changes use versioned migration scripts that keep old and new code working (add first, remove later), so a rollback never needs a restore (D-79).

---

## 11. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-03, D-05, D-07, D-09, D-13, D-16, D-22, D-23, D-49, D-50, D-54, D-58, D-66, D-72, D-73, D-77, D-78, D-79, D-80, D-85, D-87 … D-94.
