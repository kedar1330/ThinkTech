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
| `POST /v1/auth/register`, `/login`, `/google`, `/email-verification/{otp,link,resend,pending}`, `PUT /v1/auth/email-verification/email`, `POST /v1/auth/password-reset/{request,verify-otp,confirm}`, `POST /v1/account/email-change/confirm`, `GET /health` | No |
| Everything else | Yes. The token's signature, expiry, `tokenVersion`, the user's `isActive` flag, a verified email and the session record are checked on every request ([SECURITY.md](SECURITY.md) §1). Profile, appearance and onboarding-completion endpoints also need a StyleMe password (`PASSWORD_SETUP_REQUIRED` for Google sign-ups that haven't created one). Every request is scoped to the authenticated user |

---

## 2. Endpoint Summary

**Status:** the account, profile and appearance endpoints (#1–#11, #4a, A1–A20) are implemented; the rest are planned. "Stage 1" endpoints are planned for the closed beta; product-layer and Stage 2 endpoints are planned but gated; deferred and future endpoints are not approved for implementation.

| # | Method | Path | Purpose | Stage |
|---|---|---|---|---|
| 1 | POST | `/v1/auth/register` | Register | 1 |
| 2 | POST | `/v1/auth/login` | Log in, get an access token | 1 |
| 3 | GET | `/v1/auth/me` | Current user | 1 |
| 4 | DELETE | `/v1/account` | Delete the account and all user data | 1 |
| 4a | POST | `/v1/auth/logout` | End the current session (deletes its session record) | 1 |
| 5 | PUT | `/v1/auth/password` | Change password with an emailed code (D-93) | 1 |
| 6 | POST | `/v1/auth/password-reset/confirm` | Set a new password with a reset link token, code-exchange token or admin code | 1 |
| 7 | POST | `/v1/auth/password-reset/request` | Send a reset link or code (D-89) | 1 |

Added 2026-10-12 (D-87 … D-94), all Stage 1 and implemented:

| # | Method | Path | Purpose |
|---|---|---|---|
| A1 | POST | `/v1/auth/google` | Google sign-up or login with a verified ID token (D-88) |
| A2 | POST | `/v1/auth/email-verification/otp` | Verify the email with the 6-digit code |
| A3 | POST | `/v1/auth/email-verification/link` | Verify the email with the link token |
| A4 | POST | `/v1/auth/email-verification/resend` | New code and link (pending token: exact feedback; email only: generic) |
| A5 | POST | `/v1/auth/email-verification/pending` | Email and resend wait of the browser's pending registration |
| A6 | PUT | `/v1/auth/email-verification/email` | Correct the email of a pending registration |
| A7 | POST | `/v1/auth/password-reset/verify-otp` | Exchange a reset code for a short-lived reset token |
| A8 | POST | `/v1/auth/password/setup` | Google sign-ups create their StyleMe password |
| A9 | POST | `/v1/auth/password/change-otp` | Email a code for password change |
| A10 | PUT | `/v1/account/details` | Full name, city, marketing choice |
| A11 | POST | `/v1/account/email-change` | Start an email change (current password) |
| A12 | POST | `/v1/account/email-change/verify` | Confirm it with the code (signed in) |
| A13 | POST | `/v1/account/email-change/confirm` | Confirm it with the link (public) |
| A14 | PUT | `/v1/account/phone` | Add or change the phone; sends an SMS code |
| A15 | POST | `/v1/account/phone/verify` | Verify the phone code |
| A16 | DELETE | `/v1/account/phone` | Remove the phone |
| A17 | POST | `/v1/account/deletion-otp` | Email a code for account deletion |
| A18 | GET | `/v1/onboarding` | Current onboarding step |
| A19 | POST | `/v1/onboarding/style-profile/complete` | Complete the style profile step |
| A20 | POST | `/v1/onboarding/appearance/complete` | Complete (or skip) the appearance step |
| A21 | POST | `/v1/onboarding/skip` | Skip the style profile for now (FR-ONB-05) |

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

**Counts:** 38 numbered `/v1` endpoints plus `/health`, and 20 account endpoints added on 2026-10-12 (A1–A20). Stage 1: #1–#21, #4a and A1–A20, plus `/health`. Product layer (gated): 3. Stage 2 (gated on D-60): 2. Deferred (D-76): 9. Future, not approved (D-48): 2.

---

## 3. Endpoint Details

### 3.1 Auth and account (`auth.ts`)

All bodies are validated by the Zod schemas in `packages/contracts/src/auth.ts` (unknown fields rejected). Codes are 6 digits; link and pending tokens are opaque strings. Cooldowns and lockouts return `retryAfterSeconds` in the error and a `Retry-After` header.

**`POST /v1/auth/register`** — input `{ fullName, email, password, confirmPassword, city, phone?, acceptTerms: true, marketingOptIn?, rememberMe? }` (D-87). Creates **no account**: stores a pending registration (argon2id hash, consent versions and time, city, phone) and emails a 6-digit code (no link). Registering again with the same email replaces the pending details and the browser that may verify them (the resend cooldown and hourly limit apply). Returns `201 { email, pendingToken, verificationEmailSent }`; the web app keeps `pendingToken` in an `HttpOnly` cookie. Errors: `INVALID_REQUEST`, `EMAIL_ALREADY_REGISTERED` (409), `NOT_INVITED` (403, only when `PUBLIC_SIGNUP_ENABLED=false`), `RESEND_COOLDOWN` / `RESEND_LIMIT` (429), `RATE_LIMITED`.

**`POST /v1/auth/email-verification/otp`** — `{ email, otp, pendingToken? }`; **`/link`** — `{ token, pendingToken? }`. Verify the email. For a pending registration the code is accepted only with its pending token (the registering browser; otherwise `NOT_FOUND` and no attempt is counted); a correct code creates the verified account and returns `{ verified: true, email, accessToken, onboardingStep }`. Unverified accounts from before this flow are verified by code or link; with the matching pending token the response also has `{ accessToken, onboardingStep }`, otherwise `{ verified: true, email }`. Errors: `OTP_INVALID` (400), `OTP_LOCKED` (429, after 3 wrong codes, 30 minutes), `LINK_INVALID` (400), `RATE_LIMITED`.

**`POST /v1/auth/email-verification/resend`** — `{ email, pendingToken? }`. With the pending token: `202 { accepted, resendAvailableInSeconds }`, `RESEND_COOLDOWN` / `RESEND_LIMIT`, or `SERVICE_UNAVAILABLE` (503) when the email could not be sent. Email only (legacy unverified accounts): always `202 { accepted: true }`. **`/pending`** — `{ pendingToken }` → `{ email, resendAvailableInSeconds, codeExpiresInSeconds }` or `NOT_FOUND`. **`PUT /v1/auth/email-verification/email`** — `{ pendingToken, newEmail }`: changes the unverified address, invalidates the earlier code and link and sends new ones; errors `EMAIL_ALREADY_REGISTERED`, `NOT_INVITED`, `RESEND_COOLDOWN`, `NOT_FOUND`.

**`POST /v1/auth/login`** — `{ email, password, rememberMe? }` → `{ accessToken, onboardingStep }` (D-05, D-91). Errors: `UNAUTHENTICATED` (one generic message), `ACCOUNT_LOCKED` (423, D-90), `EMAIL_NOT_VERIFIED` (403, legacy unverified account), `REGISTRATION_PENDING` (403, a sign-up whose email was never verified, reported only with its correct password), `RATE_LIMITED`.

**`POST /v1/auth/google`** — `{ idToken, nonce, intent: "signup" | "login", rememberMe?, acceptTerms?, marketingOptIn? }` → `{ accessToken, onboardingStep, created, linked }` (D-88). Errors: `UNAUTHENTICATED` (token invalid or nonce mismatch), `FORBIDDEN` (email not verified by Google, or the email's account is linked to another Google identity), `INVALID_REQUEST` (sign-up without accepting the terms), `NOT_INVITED`, `GOOGLE_ACCOUNT_EXISTS` (409), `GOOGLE_NO_ACCOUNT` (404), `ACCOUNT_LOCKED`, `PROVIDER_NOT_CONFIGURED` (503).

**`GET /v1/auth/me`** — `{ id, email, name, role, emailVerified, hasPassword, googleLinked, city, phone: { number, verified } | null, pendingPhone, pendingEmail, marketingOptIn, onboardingStep }`.

**`POST /v1/auth/logout`** — deletes the current session record only; `{ loggedOut: true }` (D-07).

**`POST /v1/auth/password/setup`** — `{ password, confirmPassword }`, only while the account has no password → `{ onboardingStep }`.

**`POST /v1/auth/password/change-otp`** — emails a code → `{ sent, destination (masked), resendAvailableInSeconds }`. **`PUT /v1/auth/password`** — `{ otp, newPassword, confirmPassword }` → `{ accessToken }`; revokes every other session, keeps the current Remember Me choice, emails a notice (D-93).

**`POST /v1/auth/password-reset/request`** — `{ email, method: "link" | "otp" }` → `202 { accepted, method, resendAvailableInSeconds }`. Errors: `EMAIL_NOT_REGISTERED` (404, founder decision D-89), `RESEND_COOLDOWN`, `RESEND_LIMIT`, `RATE_LIMITED`. **`/verify-otp`** — `{ email, otp }` → `{ resetToken }` (10 minutes). **`/confirm`** — `{ token, newPassword, confirmPassword }` → `{ reset: true }`; the token is a link token, a code-exchange token or an admin code (FR-AUTH-12); applies FR-AUTH-14. Errors: `LINK_INVALID`, `INVALID_REQUEST`, `RATE_LIMITED`.

**`PUT /v1/account/details`** — any of `{ fullName, city, marketingOptIn }` → the user. **`POST /v1/account/email-change`** — `{ password, newEmail }` → `{ sent, destination, resendAvailableInSeconds }`; errors `PASSWORD_INCORRECT`, `EMAIL_ALREADY_REGISTERED`, `RESEND_COOLDOWN`. **`/email-change/verify`** — `{ otp }` → the user. **`/email-change/confirm`** (public) — `{ token }` → `{ email }`. The old address is notified after the change.

**`PUT /v1/account/phone`** — `{ phone }` (Indian mobile, normalised to `+91…`) → `{ sent, destination, resendAvailableInSeconds }`; `PROVIDER_NOT_CONFIGURED` without an SMS provider. **`/phone/verify`** — `{ otp }` → the user. **`DELETE /v1/account/phone`** → the user.

**`POST /v1/account/deletion-otp`** — emails a code. **`DELETE /v1/account`** — `{ otp, confirm: true }` → `{ deleted: true }`. Deletes the user, sessions, codes and all their data immediately, after writing the tombstone (D-85); if the tombstone can't be written nothing is deleted (`SERVICE_UNAVAILABLE`).

**`GET /v1/onboarding`** → `{ step }`. **`POST /v1/onboarding/style-profile/complete`** → `{ step }` (needs a saved profile with a department and a city). **`POST /v1/onboarding/appearance/complete`** → `{ step }` (needs the style profile step done; signals optional). **`POST /v1/onboarding/skip`** → `{ step: "complete" }`: finishes onboarding without a profile, department or city and records `onboarding.skippedAt` (only when the style profile step was skipped). Idempotent; needs a StyleMe password (`PASSWORD_SETUP_REQUIRED`).

### 3.2 Profile (`profile.ts`)

**`GET /v1/profile`** — returns the profile, or `null` fields if not yet set.

**`PUT /v1/profile`** — input: the profile fields in [DATABASE.md](DATABASE.md) §3.2. `department` is required; everything else is optional. `budgetPreference` (optional, ₹ > 0) is used only to compare with totals of user-entered prices in Stage 1. `preferredWearTypes` (optional) is a soft ranking preference (D-96). `measurements` is accepted only when the product layer with size charts is active. Fields not sent are unchanged; sending `null` (or an empty list) clears a field. Unknown fields — including `ageRange`, `height` and, in Stage 1, `measurements` — are rejected with `INVALID_REQUEST`. A colour may be both liked and disliked; the generator applies the more restrictive choice (FR-LOOK-10). Returns the saved profile. Before the first save, `GET` returns `department: null` with every list empty.

### 3.3 Appearance (`appearance.ts`)

**`GET /v1/appearance`** — returns `{ skinTone, undertone, bodyProportions, useInRecommendations }`; each attribute uses the model in [DATABASE.md](DATABASE.md) §5.

**`PUT /v1/appearance`** — input: any of `skinTone.value`, `undertone.value`, `bodyProportions.value` (or `null` to clear), and `useInRecommendations`. Stores the values as `source: "self_reported"`, `userConfirmed: true`, with no confidence. Fields not sent are unchanged; an empty body, unknown fields or a `confidence` are rejected with `INVALID_REQUEST`. Values come from the shared vocabulary (`monkRange` as `a-b`, span at most 2 tones). Returns the updated attributes. With no stored signals, `GET` returns all attributes `null` and `useInRecommendations: true`.

### 3.4 Style (`style.ts`)

**`GET /v1/style/palettes`** — query `view=suggested` (default) or `all`. Returns palettes `{ id, name, neutrals[], accents[], combinations[], rationale, limitations, suggestedBecause[] }`. `suggestedBecause` lists the preferences or enabled signals that ranked the palette; it is empty for `view=all`.

### 3.5 Recommendations and looks (`outfit.ts`)

**`POST /v1/recommendations`**
- **Input:** `{ occasion (required), style?, wearType?: ("indian" | "fusion" | "western")[], paletteMode?: "suggested" | "explore" }`. A `wearType` in the request is a hard filter for that request; without it, the profile's preferred wear types only rank results (D-96). Product layer only: optional `budget` (generated looks carry no prices in Stage 1, so budget never filters generation there). Stage 2: optional `weather`.
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
| `PASSWORD_INCORRECT` | 403 | A logged-in user re-entered the wrong password (`POST /v1/account/email-change`). The session stays valid |
| `FORBIDDEN` | 403 | The action isn't allowed (e.g. Google did not verify the email; the account is linked to another Google identity) |
| `EMAIL_ALREADY_REGISTERED` | 409 | Registration, pending-email correction or email change with an address already in use |
| `EMAIL_NOT_REGISTERED` | 404 | Password reset for an unknown email (D-89) |
| `EMAIL_NOT_VERIFIED` | 403 | Login before verifying the email |
| `REGISTRATION_PENDING` | 403 | Login with the password of a sign-up whose email code was never verified |
| `NOT_INVITED` | 403 | Registration while the closed beta is on and the email isn't invited |
| `ACCOUNT_LOCKED` | 423 | 3 wrong passwords; 30 minutes (D-90) |
| `OTP_INVALID` | 400 | Wrong or expired code |
| `OTP_LOCKED` | 429 | 3 wrong codes; 30 minutes |
| `LINK_INVALID` | 400 | Unknown, used or expired link or reset token |
| `RESEND_COOLDOWN` | 429 | A new code was requested within 30 seconds |
| `RESEND_LIMIT` | 429 | More than 5 resends in an hour |
| `PASSWORD_SETUP_REQUIRED` | 403 | A Google sign-up hasn't created a StyleMe password yet |
| `GOOGLE_ACCOUNT_EXISTS` | 409 | Google sign-up for an email that already has an account |
| `GOOGLE_NO_ACCOUNT` | 404 | Google login for an email without an account |
| `PROVIDER_NOT_CONFIGURED` | 503 | Google or SMS isn't configured in this environment |
| `NOT_FOUND` | 404 | Resource doesn't exist or isn't owned by the user |
| `CONFLICT` | 409 | Conflicting state (e.g. a shortlist slot already has an item, the item limit is reached) |
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
- **Rate limits (D-38, revised 2026-10-12):** per IP — login 5/min and 30/hour, register 3/min and 20/hour, Google 10/min, code and link checks 10/min and 30/hour, code sends 10/min and 30/hour, reset confirm 10/hour; per user — logout 30/min, account-security actions (password, email, phone, details) 30/hour, account deletion 5/hour, recommendations 20/min, feedback 60/min, shortlist writes 30/min. Per account or code, on top of these: 3 wrong passwords lock login for 30 minutes (D-90); 3 wrong codes lock that code for 30 minutes; resend cooldown 30 seconds and at most 6 sends (the first plus 5 resends) per hour (D-89).
- **CORS:** only the web origin of each environment (D-37). Security headers via Helmet.
- **Links:** every product URL returned must match its retailer's `domains[]`. User-entered URLs (shortlist) are https-only, never fetched, and labelled as not verified by StyleMe.
- **No live third-party calls on the request path** except the optional, time-limited AI wording and weather calls, whose failure never fails the request.

---

## 6. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-03, D-05, D-07, D-18, D-23, D-37, D-38, D-46, D-48, D-60, D-67, D-69, D-76, D-77, D-80, D-82 … D-84, D-86 … D-94.
