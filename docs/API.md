# StyleMe — API Specification

> Part of the StyleMe documentation baseline. Requirements: [FRD.md](FRD.md). Data model: [DATABASE.md](DATABASE.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Conventions

| Item | Rule |
|---|---|
| Style | REST over HTTPS, served by Express (`apps/api`) |
| Versioning | Feature endpoints under `/v1/` |
| Caller | The Next.js server (BFF) calls the API with the user's access token. Browsers never call the API with the token directly |
| Validation | Every request and response body has a Zod schema in `packages/contracts` (D-03) |
| Pipeline | Route → authentication → validation → controller → service → database / integration → response |
| Pagination | List endpoints take `page` and `limit` (default 20, maximum 50) (D-18) |
| Timeouts | Any optional external call (AI wording, weather) has a short timeout; on timeout the core result is returned without it |

### 1.1 Response envelope

```json
{ "success": true, "data": {}, "warnings": [] }
```

```json
{ "success": false, "error": { "code": "INVALID_REQUEST", "message": "Invalid request data" } }
```

Errors never expose stack traces, secrets, database details or internal errors. `warnings` is optional and lists informational codes (§4.2).

### 1.2 Authentication

| Endpoints | Auth |
|---|---|
| `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/password-reset/request`, `POST /v1/auth/password-reset/confirm`, `GET /health` | No |
| Everything else | Yes. The token's signature, expiry, `tokenVersion`, the user's `isActive` flag and the session record are checked on every request ([SECURITY.md](SECURITY.md) §1). Every request is scoped to the authenticated user |

---

## 2. Endpoint Summary

**Status:** no endpoint is implemented yet (the repository's code files are empty). "Stage 1" endpoints are planned for the closed beta; product-layer and Stage 2 endpoints are planned but gated; deferred and future endpoints are not approved for implementation.

| # | Method | Path | Purpose | Stage |
|---|---|---|---|---|
| 1 | POST | `/v1/auth/register` | Register | 1 |
| 2 | POST | `/v1/auth/login` | Log in, get an access token | 1 |
| 3 | GET | `/v1/auth/me` | Current user | 1 |
| 4 | DELETE | `/v1/account` | Delete the account and all user data | 1 |
| 4a | POST | `/v1/auth/logout` | End the current session (deletes its session record) | 1 |
| 5 | PUT | `/v1/auth/password` | Change password (current password required) | 1 |
| 6 | POST | `/v1/auth/password-reset/confirm` | Set a new password with a reset code or token | 1 |
| 7 | POST | `/v1/auth/password-reset/request` | Request a reset email (disabled until HC-2) | 1 (public launch) |
| 8 | GET | `/v1/profile` | Get the profile | 1 |
| 9 | PUT | `/v1/profile` | Create or update the profile | 1 |
| 10 | GET | `/v1/appearance` | Get appearance signals | 1 |
| 11 | PUT | `/v1/appearance` | Set, change or clear self-reported signals | 1 |
| 12 | GET | `/v1/style/palettes` | Suggested palettes and all palettes | 1 |
| 13 | POST | `/v1/recommendations` | Generate looks | 1 |
| 14 | GET | `/v1/outfits` | List saved looks | 1 |
| 15 | GET | `/v1/outfits/:id` | Get one look | 1 |
| 16 | POST | `/v1/outfits/:id/save` | Save a suggested look | 1 |
| 17 | POST | `/v1/outfits/:id/feedback` | Give feedback on a look | 1 |
| 18 | DELETE | `/v1/outfits/:id` | Delete a look | 1 |
| 19 | GET | `/v1/shortlist` | List items the user added | 1 |
| 20 | POST | `/v1/shortlist` | Add an item with a user-entered price | 1 |
| 21 | DELETE | `/v1/shortlist/:id` | Remove an item | 1 |
| 22 | GET | `/v1/products` | Browse verified products | Product layer |
| 23 | GET | `/v1/products/:id` | Product detail with provenance and quality | Product layer |
| 24 | GET | `/v1/products/:id/alternatives` | Eligible alternatives for a slot | Product layer |
| 25 | GET | `/v1/weather/locations` | City search | Stage 2 |
| 26 | GET | `/v1/weather` | Conditions for a city or rounded location | Stage 2 |
| 27 | POST | `/v1/appearance/analyze` | Photo-based estimates | Deferred (D-76) |
| 28 | PUT | `/v1/appearance/confirm` | Confirm or correct estimates | Deferred (D-76) |
| 29 | POST | `/v1/design` | Save a design | Deferred (D-76) |
| 30 | GET | `/v1/design/:id` | Get a design | Deferred (D-76) |
| 31 | POST | `/v1/design/sketch` | Interpret a sketch | Deferred (D-76) |
| 32 | POST | `/v1/design/generate` | Generate a design | Deferred (D-76) |
| 33 | POST | `/v1/chat` | Chat message | Deferred (D-76) |
| 34 | GET | `/v1/chat/conversations` | List conversations | Deferred (D-76) |
| 35 | POST | `/v1/tailor/pdf` | Tailor PDF | Deferred (D-76) |
| 36 | POST | `/v1/tryon` | Try-on request | Future (D-48) |
| 37 | GET | `/v1/tryon/:id` | Try-on result | Future (D-48) |
| — | GET | `/health` | Health check | 1 |

**Counts:** 38 `/v1` endpoints plus `/health`. Stage 1 (planned): 22 — #1–#21 and #4a, including the shortlist (D-77 = B), the password endpoints (D-83) and logout (D-07) — plus `/health`; #7 is built in Stage 1 but enabled only at public launch (HC-2). Product layer (gated): 3. Stage 2 (gated on D-60): 2. Deferred (D-76): 9. Future, not approved (D-48): 2.

---

## 3. Endpoint Details

### 3.1 Auth and account (`auth.ts`)

**`POST /v1/auth/register`** — input `{ email, password (≥ 8 chars), name }`; creates the user with an argon2id hash; returns the user without `passwordHash`. During the closed beta (`PUBLIC_SIGNUP_ENABLED=false`, FR-AUTH-10) the email must be on the invite allow-list. Errors: `INVALID_REQUEST`; `FORBIDDEN` with one generic message for both an email that isn't invited and an email that is already registered ("We couldn't create an account with this email. If you already have an account, log in; otherwise contact the StyleMe team."); `RATE_LIMITED`. After public launch the same generic message is used for an email already registered (residual risk and email verification: D-86).

**`POST /v1/auth/login`** — input `{ email, password }`; creates a session record and returns `{ accessToken }` (JWT with `sid`, D-05). Errors: `UNAUTHENTICATED` (one generic message for an unknown email, a wrong password or an inactive account), `RATE_LIMITED`.

**`GET /v1/auth/me`** — returns `{ id, email, name, role }`.

**`POST /v1/auth/logout`** — no input. Deletes the session record for the token's `sid`, so this token is rejected from then on; other sessions of the user are unaffected. Returns `{ loggedOut: true }`; idempotent. The web app calls it before clearing the Auth.js cookie, and clears the cookie even if the call fails (D-07). Errors: `UNAUTHENTICATED` (token already invalid; the web app clears the cookie anyway), `RATE_LIMITED`.

**`PUT /v1/auth/password`** — input `{ currentPassword, newPassword (≥ 8 chars) }`. Verifies the current password, stores the new hash, sets `passwordChangedAt`, deletes outstanding reset tokens, deletes all of the user's session records and increments `tokenVersion` (revoking every existing token and session), then creates a new session and returns `{ accessToken }` so the current browser stays logged in (FR-AUTH-11). Errors: `PASSWORD_INCORRECT` (wrong current password; the session stays valid), `INVALID_REQUEST`, `RATE_LIMITED`.

**`POST /v1/auth/password-reset/confirm`** — input `{ token, newPassword (≥ 8 chars) }`, in the body only (never in the URL). Looks the token up by its SHA-256 hash and marks it used atomically; it must be unused and unexpired. On success applies FR-AUTH-14 and returns `{ reset: true }`; the user then logs in. Used for both admin-issued codes (closed beta) and emailed tokens (public launch). Errors: `INVALID_REQUEST` with one generic message ("This reset code is invalid or has expired") for unknown, used or expired tokens; `RATE_LIMITED`.

**`POST /v1/auth/password-reset/request`** — input `{ email }`. While `PASSWORD_RESET_EMAIL_ENABLED` is `true` (from HC-2): always returns `202 { accepted: true }` whether or not the account exists, and emails a reset link only to an active account (FR-AUTH-13). While it is `false` (closed beta): returns `FORBIDDEN` with "Password reset by email isn't available during the beta — please contact the StyleMe team", and the web app shows the admin-assisted recovery instructions. Errors: `RATE_LIMITED`.

**`DELETE /v1/account`** — input `{ password }`. Deletes the user, their session records and all their data from the live database immediately (backup copies expire under D-79), including shortlist items and the user's beta invite record (FR-AUTH-09), and returns `{ deleted: true }`. Existing tokens then fail because the user no longer exists. A deletion tombstone is written first (D-85); if it can't be written, nothing is deleted and the response is `SERVICE_UNAVAILABLE`. Errors: `PASSWORD_INCORRECT` (wrong password; nothing is deleted and the session stays valid), `RATE_LIMITED`, `SERVICE_UNAVAILABLE`.

### 3.2 Profile (`profile.ts`)

**`GET /v1/profile`** — returns the profile, or `null` fields if not yet set.

**`PUT /v1/profile`** — input: the profile fields in [DATABASE.md](DATABASE.md) §3.2. `department` is required; everything else is optional. `budgetPreference` (optional, ₹ > 0) is used only to compare with totals of user-entered prices in Stage 1. `measurements` is accepted only when the product layer with size charts is active. Sending `null` clears a field. Returns the saved profile.

### 3.3 Appearance (`appearance.ts`)

**`GET /v1/appearance`** — returns `{ skinTone, undertone, bodyProportions, useInRecommendations }`; each attribute uses the model in [DATABASE.md](DATABASE.md) §5.

**`PUT /v1/appearance`** — input: any of `skinTone.value`, `undertone.value`, `bodyProportions.value` (or `null` to clear), and `useInRecommendations`. Stores the values as `source: "self_reported"`, `userConfirmed: true`, with no confidence. Returns the updated attributes.

### 3.4 Style (`style.ts`)

**`GET /v1/style/palettes`** — query `view=suggested` (default) or `all`. Returns palettes `{ id, name, neutrals[], accents[], combinations[], rationale, limitations, suggestedBecause[] }`. `suggestedBecause` lists the preferences or enabled signals that ranked the palette; it is empty for `view=all`.

### 3.5 Recommendations and looks (`outfit.ts`)

**`POST /v1/recommendations`**
- **Input:** `{ occasion (required), style?, paletteMode?: "suggested" | "explore" }`. Product layer only: optional `budget` (generated looks carry no prices in Stage 1, so budget never filters generation there). Stage 2: optional `weather`.
- **Behaviour:** deterministic generation (FR-LOOK-03): templates → palettes → rules → look specifications → diversity check. With the product layer: eligibility, matching and ranking per slot (FR-MATCH). Optional AI wording last, if enabled (FR-LOOK-16).
- **Output:** `{ recommendationId, looks[], defaultsApplied[], conflicts[], limitedBy? }`. Each look: `{ id, status: "suggested", templateId, paletteId, slots[], explanation, explanationRefs, combinationSignature, aiModel, priceSummary? (product layer only) }`. Each slot: `{ slotId, slot, lookSpec, swatches[], illustration? { url, licenceLabel }, searchPhrase, sizeNote, alternatives[], productMatch? (product layer only) }`. Shortlist items are attached later to saved looks and appear only in `GET /v1/outfits/:id`.
- **Without the product layer**, `productMatch` is always absent and no price, retailer or availability appears anywhere in the response.
- **Too few matches:** `200` with fewer looks (possibly none), `limitedBy: { constraint, suggestion }` and the `INSUFFICIENT_MATCHES` warning (FR-LOOK-11).
- **Optional AI step failure:** `200` with template explanations, `aiModel: null` and the `AI_ENHANCEMENT_SKIPPED` warning (FR-LOOK-16).
- **Errors:** only when the core operation can't complete: `INVALID_REQUEST` (e.g. no occasion), `UNAUTHENTICATED`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE` (e.g. the database is unreachable).

**`GET /v1/outfits`** — query `status=saved` (default) or `suggested`. Returns the user's looks, newest first, paginated. With the product layer, each matched product includes `currentStatus` (FR-MATCH-08).

**`GET /v1/outfits/:id`** — returns one look owned by the user, with `userItems[]` (the shortlist items attached to its slots) and, if any are attached, `priceSummary` (FR-BUD-07): `{ priceBasis: "user_entered", itemsTotal, pricedSlots, totalSlots, complete, budget, budgetRemaining, status, label }` plus the `USER_ENTERED_PRICES` warning. Computed on read, never stored. Error: `NOT_FOUND` (also returned for other users' looks, so their existence isn't revealed).

**`POST /v1/outfits/:id/save`** — sets `status: "saved"` and removes the expiry. Returns the look.

**`POST /v1/outfits/:id/feedback`** — input `{ value: "love_it" | "not_for_me", reason?: <fixed list> }`. Returns `{ recorded: true }`.

**`DELETE /v1/outfits/:id`** — deletes the look and detaches any shortlist items from it (the items remain until the user deletes them). Returns `{ deleted: true }`.

### 3.6 Shortlist (`shortlist.ts`) — Stage 1 (D-77 = B)

Everything here is the user's own entry and is returned with `priceBasis: "user_entered"` and `verifiedByStyleMe: false`.

**`GET /v1/shortlist`** — the user's items, newest first, paginated; filter `outfitId?`.

**`POST /v1/shortlist`** — input `{ name, priceEntered, url?, note?, outfitId?, slotId? }`, validated per FR-LIST-07 and D-80. `outfitId` and `slotId` are sent together or not at all: together they must name one of the user's saved looks and one of its slot IDs (D-82); omitted, the item is unattached. The URL is never fetched, previewed or modified. Returns the item. Errors: `INVALID_REQUEST` (validation, non-https URL, only one of `outfitId`/`slotId` sent), `NOT_FOUND` (look not owned or not saved), `CONFLICT` (that `slotId` already has an item, or the 200-item limit is reached).

**`DELETE /v1/shortlist/:id`** — deletes the user's item. Returns `{ deleted: true }`.

### 3.7 Products (`product.ts`) — product layer

**`GET /v1/products`** — filters: `category`, `department`, `colors`, `sizes`, `styles`, `occasions`, `retailerId`, `maxPrice`, `includeUnavailable` (default `false`). Returns only verified, active, non-fixture products from active retailers. Expired, out-of-stock and broken-linked products are hidden by default.

**`GET /v1/products/:id`** — returns:
- the product fields ([DATABASE.md](DATABASE.md) §4.2);
- `provenance` and its label;
- `retailer { retailerId, name, disclosureText }`;
- `freshness` (computed);
- `availability`;
- `rating` or `null`;
- `quality` with its evidence summary;
- `affiliateTracked`;
- `sizeChart` (where permitted);
- `warnings`.

Missing values are `null` and shown as "Not available".

**`GET /v1/products/:id/alternatives`** — query `size`, `maxPrice?`, `limit` (≤ 5). Returns eligible same-slot products ranked by look match, quality and price (never by affiliate status), each with `priceDifference`, `priceVerifiedAt`, `freshness`, size availability, `quality.verdict` and `lookMatch`.

### 3.8 Weather (`weather.ts`) — Stage 2

**`GET /v1/weather/locations?q=`** — city search via the chosen provider (D-60).

**`GET /v1/weather?cityId=` or `?lat=&lon=` (rounded)** — returns `{ source, observedAt, temperatureC, feelsLikeC, humidityPct, precipitationProbabilityPct, windKph, bands }`. On provider failure, returns `200` with `available: false` and `WEATHER_UNAVAILABLE`. It never blocks recommendations.

### 3.9 Deferred (D-76) and future (D-48) endpoints

These are specified only at the level needed for planning. Their full contracts are written when their stage is approved.

| Endpoint | Summary and conditions |
|---|---|
| `POST /v1/appearance/analyze` | Photos (with explicit consent) → estimates with confidence. Photos processed in the browser or on StyleMe's own servers; not sent to external AI providers unless AI rule 16 is satisfied |
| `PUT /v1/appearance/confirm` | `action: confirm \| correct` per attribute; confidence never changes ([DATABASE.md](DATABASE.md) §5) |
| `POST /v1/design`, `GET /v1/design/:id` | Save and read designs |
| `POST /v1/design/sketch`, `POST /v1/design/generate` | Sketch → structured specification (Zod) → user confirmation → generation. AI failure → clear error |
| `POST /v1/chat`, `GET /v1/chat/conversations` | Minimised context; product facts only from stored verified data; AI failure → clear error |
| `POST /v1/tailor/pdf` | PDF from a saved design |
| `POST /v1/tryon`, `GET /v1/tryon/:id` | **Not approved.** The earlier design (user photo + `consent: true` → Leffa / Hugging Face / Qwen) is superseded by AI rule 16. Consent alone does not authorise sending a personal photo to an external provider. Requires D-48 |

### 3.10 Health

**`GET /health`** — returns `{ status: "ok", version, time }` without authentication (D-69). Used by the hosting platform's health check. In maintenance mode (`MAINTENANCE_MODE=true`, used during a restore, D-85) it returns `{ status: "maintenance", version, time }`, and every `/v1` endpoint returns `SERVICE_UNAVAILABLE`.

---

## 4. Codes

### 4.1 Error codes (D-03)

| Code | HTTP | When |
|---|---|---|
| `INVALID_REQUEST` | 400 | Input fails validation |
| `UNAUTHENTICATED` | 401 | Missing, expired or revoked token; wrong credentials at login. On an authenticated endpoint the web app ends the session (D-05), so this code is never used for a wrong re-entered password |
| `PASSWORD_INCORRECT` | 403 | A logged-in user re-entered the wrong password (`PUT /v1/auth/password`, `DELETE /v1/account`). The session stays valid |
| `FORBIDDEN` | 403 | The action isn't allowed: registration refused (one generic message for not invited and already registered); a reset-email request while self-service reset is disabled |
| `NOT_FOUND` | 404 | Resource doesn't exist or isn't owned by the user |
| `CONFLICT` | 409 | Conflicting state (e.g. a shortlist slot already has an item, the item limit is reached). Not used for registration, which gives a generic `FORBIDDEN` |
| `PRODUCT_UNAVAILABLE` | 409 | Product layer: product inactive, expired, out of stock, broken-linked or rejected |
| `RATE_LIMITED` | 429 | Rate limit exceeded (D-38) |
| `INTERNAL_ERROR` | 500 | Unexpected server error (no details exposed) |
| `SERVICE_UNAVAILABLE` | 503 | A core dependency (e.g. the database) is unreachable |
| `AI_UNAVAILABLE` | 503 | Only for deferred features that **require** AI (chatbot, sketch). Never for recommendations |

### 4.2 Warning codes (in `warnings`; the request still succeeds)

| Code | Meaning | Stage |
|---|---|---|
| `DEFAULTS_APPLIED` | Optional inputs were missing; defaults used (listed) | 1 |
| `PREFERENCE_CONFLICT` | Two explicit preferences conflict; the more restrictive applied | 1 |
| `INSUFFICIENT_MATCHES` | Fewer looks than usual; limiting constraint and relaxation named | 1 |
| `ALTERNATIVES_LIMITED` | Fewer than 3 suitable alternatives | 1 |
| `AI_ENHANCEMENT_SKIPPED` | Optional AI wording was off or failed; template text used | 1 |
| `NO_VERIFIED_PRODUCT` | No eligible real product matched a slot | Product layer |
| `PRICE_STALE` | Price older than the warning threshold | Product layer |
| `PRICE_NOT_RECENTLY_VERIFIED` | Shown on saved looks or product detail for expired prices | Product layer |
| `SIZE_AVAILABILITY_UNKNOWN` | The source doesn't report the user's size | Product layer |
| `SIZE_GUIDANCE_UNAVAILABLE` | No size chart; the user chooses the size | Product layer |
| `INSUFFICIENT_QUALITY_EVIDENCE` | Too little quality evidence | Product layer |
| `QUALITY_CAUTION` | Mixed evidence or a recurring minor complaint | Product layer |
| `LISTING_IMAGE_DISCREPANCY_REPORTED` | Evidence says the item differs from its pictures | Product layer |
| `SHIPPING_EXCLUDED` | Verified totals exclude shipping and conditional offers | Product layer |
| `MAY_EXCEED_BUDGET_WITH_SHIPPING` | Known shipping would exceed the budget | Product layer |
| `USER_ENTERED_PRICES` | The total uses only prices the user entered; not verified by StyleMe | 1 |
| `WEATHER_UNAVAILABLE` | Weather couldn't be fetched; manual entry offered | Stage 2 |

---

## 5. Cross-Cutting Rules

- **Authorization:** users read and change only their own data. Product, retailer and evidence data are read-only through the API and written only by server-side scripts.
- **Rate limits (D-38):** login 5/min per IP, register 3/min per IP, logout 30/min per user, account deletion 3/hour per user, recommendations 20/min per user, feedback 60/min per user, shortlist writes 30/min per user, password change 5/hour per user, reset confirm 10/hour per IP, reset request 3/hour per email and 10/hour per IP.
- **CORS:** only the web origin of each environment (D-37). Security headers via Helmet.
- **Links:** every product URL returned must match its retailer's `domains[]`. User-entered URLs (shortlist) are https-only, never fetched, and labelled as not verified by StyleMe.
- **No live third-party calls on the request path** except the optional, time-limited AI wording and weather calls, whose failure never fails the request.

---

## 6. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-03, D-05, D-07, D-18, D-23, D-37, D-38, D-46, D-48, D-60, D-67, D-69, D-76, D-77, D-80, D-82 … D-84, D-86.
