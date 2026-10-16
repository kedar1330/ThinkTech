# StyleMe — Functional Requirements Document (FRD)

> Part of the StyleMe documentation baseline. Business context: [BRD.md](BRD.md). Release scope: [MVP.md](MVP.md). Non-functional requirements: [SRS.md](SRS.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Purpose

This document lists StyleMe's functional requirements, grouped by module. Each requirement has an ID (`FR-<MODULE>-<NN>`) used by [SRS.md](SRS.md), [TESTING.md](TESTING.md) and [ImplementationPlan.md](ImplementationPlan.md).

There is **no demo release**. Every stage is a real product. StyleMe never shows mock, invented or test products as if they were real (§4.9).

---

## 2. Stages and Module Map

| Stage | Meaning |
|---|---|
| **Stage 1** | The first real release: personal styling, plus a shortlist of items the user finds and prices they enter, with budget totals on those prices (D-77 = B). Nothing in it depends on any retailer, weather service or external AI |
| **Product layer** | Real, verified product listings, matching to looks and budgets on verified prices. Ships in Stage 3, once retailer access is authorised (D-43 … D-45) |
| **Stage 2** | The full styling library (at least 100 palettes and 100 outfit templates, D-57; a release requirement) and optional weather |
| **Stage 3** | Authorised retailer-backed shopping: the product layer |
| **Deferred (D-76)** | Approved long-term features whose stage is not yet decided |
| **Future (D-48)** | Generative virtual try-on |

| Module | Prefix | Stage | Web route | API |
|---|---|---|---|---|
| Authentication and account | FR-AUTH | 1 | `(auth)/register`, `login`, `verify-email/*`, `forgot-password/*`, `reset-password`, `settings/email/confirm`; `(app)/settings`; `api/oauth/google/*` | `/v1/auth/*`, `/v1/account/*` |
| Onboarding and navigation | FR-ONB, FR-UI | 1 | `(site)/*` (landing, about, legal), `onboarding/*`, `(app)/home`, `(app)/features/[slug]` | `/v1/onboarding/*` |
| Profile and preferences | FR-PROF | 1 | `(app)/profile`, `onboarding/style-profile` | `/v1/profile` |
| Self-reported appearance signals | FR-SIG | 1 | `profile/` | `/v1/appearance` |
| Style knowledge base | FR-STY | 1 | — (content in the repository) | — |
| Look recommendations | FR-LOOK | 1 | `outfits/` | `/v1/recommendations` |
| Colour palettes | FR-PAL | 1 | `outfits/` | `/v1/style/palettes` |
| Saved looks | FR-OUT | 1 | `outfits/` | `/v1/outfits/*` |
| Category sizing | FR-SIZE | 1 (product-specific guidance with the product layer) | `profile/`, `outfits/` | `/v1/profile`, `/v1/recommendations` |
| Data honesty and provenance | FR-DATA | All | all views | all |
| Shortlist of user-found items | FR-LIST | 1 (D-77 = B) | `outfits/` | `/v1/shortlist*`, `/v1/outfits/:id` |
| Real product catalogue and sourcing | FR-PROD | Product layer | `products/` | `/v1/products*` |
| Matching products to looks | FR-MATCH | Product layer | `outfits/`, `products/` | `/v1/recommendations`, `/v1/products/:id/alternatives` |
| Budget engine | FR-BUD | 1 on user-entered prices; product layer on verified prices | `outfits/`, `profile/` | `/v1/outfits/:id`, `/v1/shortlist` (Stage 1); `/v1/recommendations` (product layer) |
| Product quality evidence | FR-QUAL | Product layer | `products/` | `/v1/products/:id` |
| Optional weather | FR-WX | 2 | `profile/`, `outfits/` | `/v1/weather*` |
| Photo-based appearance analysis | FR-APP | Deferred (D-76) | `analyze/` | `/v1/appearance/analyze`, `/v1/appearance/confirm` |
| 3D avatar | FR-AVT | Deferred (D-76) | `avatar/` | — |
| Design Studio | FR-DES | Deferred (D-76) | `design/` | `/v1/design*` |
| Sketch-to-design | FR-SKT | Deferred (D-76) | `design/` | `/v1/design/sketch`, `/v1/design/generate` |
| Fashion chatbot | FR-CHAT | Deferred (D-76) | `chat/` | `/v1/chat*` |
| Tailor PDF | FR-PDF | Deferred (D-76) | `tailor/` | `/v1/tailor/pdf` |
| Virtual try-on | FR-TRY | Future (D-48) | `tryon/` | `/v1/tryon*` |

The repository already has placeholder route folders for the deferred and future modules (`analyze/`, `avatar/`, `design/`, `chat/`, `tailor/`, `tryon/`). They stay empty until their stage is approved.

---

## 3. User Journeys

### 3.1 Stage 1 journey

```
Landing page → Sign up (email, or Google) → Verify email (code or link; Google: create a password)
→ Style profile (department, category sizes, fit, colours, styles, occasions; Google: city, phone)
→ Optional appearance signals (or skip) → Personalized Home → Request looks (occasion, optional style)
→ Personalised looks with explanations, colour swatches and search phrases
→ Explore palettes, colours and alternatives → Adjust preferences and regenerate
→ Save looks → (optional) add items you found, with your own prices, to a saved look's slots
→ See the look total against your budget, labelled "entered by you — not verified by StyleMe"
→ Revisit or delete saved looks and items → Log out / delete account
```

With the product layer (Stage 3), each look slot can also show a matched, verified real product with its retailer, "Price as of" time and a link to the retailer's listing.

### 3.2 Long-term journey (across all stages)

Stage 1 journey → (product layer) verified products, budgets, quality evidence, comparison, retailer links → (Stage 2) weather-aware suggestions → (D-76) photo-based analysis, chatbot, Design Studio, sketch-to-design, tailor PDF, 3D avatar → (future, D-48) virtual try-on. Not every step ships in Stage 1.

---

## 4. Requirements by Module

### 4.1 Authentication and account (FR-AUTH) — Stage 1

Revised 2026-10-12 by the founder's decisions D-87 … D-94 ([ImplementationPlan.md](ImplementationPlan.md) §8.3).

| ID | Requirement |
|---|---|
| FR-AUTH-01 | **Registration (D-87).** `POST /v1/auth/register` with full name, email, password and confirmation, city (an ID from the shared list of Indian cities), optional Indian mobile number, Terms of Service and Privacy Policy acceptance (required; versions and time recorded), marketing email (separate, optional, off by default) and Remember Me (off by default). Password: at least 8 characters with an upper-case letter, a lower-case letter, a number and a special character; the form shows a live rule checklist (no strength label) and show/hide buttons on both password fields. An already-registered email gets `EMAIL_ALREADY_REGISTERED` with a Log in link; an email not on the invite list gets `NOT_INVITED` (FR-AUTH-10). The account is created unverified and a verification code and link are sent (FR-AUTH-16). A failed or offline submission keeps every entry; non-sensitive fields are also kept as a local draft for 24 hours (never passwords or consent). |
| FR-AUTH-02 | Passwords are stored only as an argon2id hash (D-04). |
| FR-AUTH-03 | **Login (D-90).** `POST /v1/auth/login` with email, password and Remember Me. Wrong passwords and unknown emails get one generic message. 3 wrong passwords lock the account for 30 minutes (`ACCOUNT_LOCKED`, even for the right password) in addition to per-IP rate limits; a successful reset clears the lock. An unverified email gets `EMAIL_NOT_VERIFIED` and no session; the web app shows the verification-required screen, which sends a new code and link. On success the API creates a session record and token (D-05) and returns the next onboarding step; the web app goes there (FR-ONB-02). Login is by email only (never phone). |
| FR-AUTH-04 | **Session cookie (D-06, D-91).** The Next.js server keeps the token in a first-party cookie that is `HttpOnly`, `SameSite=Lax`, host-only and, over HTTPS, `Secure` with the `__Host-` prefix. Without Remember Me it is a browser-session cookie and the API stops accepting the session after 24 hours; with Remember Me both last 30 days. Every API request checks the token against `tokenVersion`, `isActive`, a verified email and the session record. |
| FR-AUTH-05 | An authenticated user can read their identity (`GET /v1/auth/me`): name, email, verification, password and Google status, city, phone, pending email or phone change, marketing choice and onboarding step. |
| FR-AUTH-06 | **Logout** ends the current session only: the Next.js server calls `POST /v1/auth/logout` (deletes that session record), then clears the cookie. Other devices stay signed in. |
| FR-AUTH-07 | Public pages: landing, about, terms, privacy, contact, sign up, log in, email verification, password reset and the email-change confirmation link. Every other page needs a session confirmed with the API when it renders; app pages also need completed onboarding. All API endpoints except registration, login, Google, verification, password reset, the email-change link and `/health` need a valid token with a live session. |
| FR-AUTH-08 | Users have `role` (`user` or `admin`), `isActive` and `tokenVersion`. Incrementing `tokenVersion` revokes all of that user's tokens; a user with `isActive: false` can't log in and their tokens are rejected. Both are changed only by admin scripts in Stage 1. |
| FR-AUTH-09 | **Account deletion (D-94).** Settings → Delete account sends a 6-digit code to the account email; `DELETE /v1/account` needs that code and an explicit confirmation (an acknowledgement checkbox, then a separate confirmation dialog). Deletion is immediate and permanent: all of the user's data (sessions, verification and reset codes, profile, appearance signals, saved looks, feedback, shortlist items and the beta invite record) is deleted from the live database; a minimal deletion tombstone is written first (D-85) and backups age out under D-79. |
| FR-AUTH-10 | **Closed beta (D-63).** While `PUBLIC_SIGNUP_ENABLED` is `false` (the default), registration — by email or Google — succeeds only for an email on the invite allow-list, managed with a server-side script. The setting may be turned on only when every public-launch blocker in [ImplementationPlan.md](ImplementationPlan.md) §11 is met. |
| FR-AUTH-11 | **Password change (D-93).** A signed-in user requests a 6-digit code by email (`POST /v1/auth/password/change-otp`), then submits it with a new password and confirmation (`PUT /v1/auth/password`). On success every other session is revoked, `tokenVersion` is incremented, the current browser gets a new session (keeping its Remember Me choice) and a "password changed" notice is emailed. |
| FR-AUTH-12 | **Admin-assisted recovery (D-83).** For support cases an admin script issues a single-use reset code (valid 60 minutes, stored only as a hash, shown once, never logged) after verifying the request through a channel tied to the account. The user redeems it at `POST /v1/auth/password-reset/confirm` and chooses the password; the admin never sees it. |
| FR-AUTH-13 | **Self-service reset (D-89).** `POST /v1/auth/password-reset/request` with an email and a method: `link` (valid 15 minutes) or `otp` (6-digit code valid 5 minutes, exchanged at `POST /v1/auth/password-reset/verify-otp` for a short-lived reset token). An unregistered email gets "Email not registered" with a Sign up link (founder decision; rate-limited). Resend: 30-second cooldown, at most 5 resends per hour; 3 wrong codes lock code entry for 30 minutes. Link tokens travel in the URL fragment and are handled per [SECURITY.md](SECURITY.md) §1.1. |
| FR-AUTH-14 | **On any successful reset:** the password is hashed, the code or link is consumed, `tokenVersion` is incremented, all sessions are deleted, any login lockout is cleared, and the user is sent to the login page — never logged in automatically. Issuing a new code or link invalidates earlier ones; invalid, used or expired ones get one generic error. |
| FR-AUTH-15 | **Google sign-up and login (D-88).** "Continue with Google" runs the authorization-code flow with PKCE, `state` and `nonce` on the Next.js server. The API verifies the ID token (signature against Google's keys, issuer, audience = `GOOGLE_CLIENT_ID`, nonce) and requires `email_verified`. Sign-up (Terms and Privacy accepted first): creates a verified account, then asks the user to create a StyleMe password (`POST /v1/auth/password/setup`) before anything else; city and optional phone are asked during onboarding. Sign-up with an email that already has an account gets `GOOGLE_ACCOUNT_EXISTS` (log in instead). Login: finds the account by Google ID, otherwise links the account with the same verified email automatically; if that account was never verified, its pre-registered password and sessions are discarded first. Login for an unknown email gets `GOOGLE_NO_ACCOUNT`. Linking never relies on an email supplied by the client. Without configuration the buttons show "not available yet". |
| FR-AUTH-16 | **Email verification (D-89).** Registration sends a 6-digit code (valid 5 minutes) and a link (valid 30 minutes). The code is entered in six boxes (typing, Backspace, arrows and paste all work) and submitted with an explicit Verify button — never automatically. Resend: 30-second cooldown, at most 5 resends per hour; a new code invalidates the old one. 3 wrong codes lock code entry for 30 minutes. The registering browser (identified by an `HttpOnly` pending-registration cookie) can correct its email address, which invalidates the earlier code and link; verifying there signs the user in and shows a success screen. Verifying from another device verifies the account and asks the user to log in. Anyone can request a new verification email by address (one generic response). Expired or used links show a recovery screen. |
| FR-AUTH-17 | **Email change (D-93).** `POST /v1/account/email-change` with the current password and the new address sends a code and a link to the new address; the old address keeps working until the change is confirmed (`POST /v1/account/email-change/verify` signed in, or `POST /v1/account/email-change/confirm` from the link). The old address is then notified. An address already in use is refused. |
| FR-AUTH-18 | **Phone (D-92).** Optional Indian mobile number, verified by a 6-digit SMS code (`PUT /v1/account/phone`, `POST /v1/account/phone/verify`, `DELETE /v1/account/phone`); same resend and lockout rules; never used for login. Without an SMS provider the API returns `PROVIDER_NOT_CONFIGURED` and the UI says phone verification is not available yet. |
| FR-AUTH-19 | **Account details.** `PUT /v1/account/details` changes the full name, city and marketing-email choice (the choice's time is recorded). |

### 4.1a Onboarding and navigation (FR-ONB, FR-UI) — Stage 1

| ID | Requirement |
|---|---|
| FR-ONB-01 | Onboarding is server-authoritative (`GET /v1/onboarding`): `set_password` (Google sign-ups only) → `style_profile` → `appearance` → `complete`. A step is completed only by the API (`POST /v1/onboarding/style-profile/complete` needs a saved profile with a department and a city; `POST /v1/onboarding/appearance/complete` needs the style profile step done). The user may instead skip the style profile (`POST /v1/onboarding/skip`, FR-ONB-05). |
| FR-ONB-02 | Login, verification and Google sign-in send the user to their next incomplete step; signed-in pages redirect users with unfinished onboarding there. Steps already completed redirect forward. |
| FR-ONB-03 | The appearance step is optional: the user may save signals or continue without any (skip). Completing it opens Personalized Home. |
| FR-ONB-05 | **Skip for now.** On the style profile step the user may skip onboarding (`POST /v1/onboarding/skip`): it completes the remaining steps without saving a profile, so neither a department nor a city is needed, and records `onboarding.skippedAt`. It is persisted and idempotent, and Google sign-ups must still create a password first (`PASSWORD_SETUP_REQUIRED`). Home then shows **Complete your profile** listing what is missing — department, city, at least one size, liked colours, occasions, styles and budget per look — with links to where each is added (the city in Settings); the profile menu and mobile menu show the same hint until the profile is complete. Appearance signals and finer preferences never count as missing. Without a department, features give general results across all departments and say that no department filter is applied (`departmentScope` in `@styleme/contracts`). Completing the profile later on Discover My Style still requires a department. |
| FR-UI-01 | Public site: landing page (Hero, How It Works, Personalized Styling, Fashion Categories, Budget-Based Shopping, Upcoming Features, FAQ, Footer) with navigation Home, How It Works, Features, About, Log In, Sign Up and a hamburger menu on small screens. "Get Started" opens Sign Up. Terms and Privacy pages are drafts pending legal review (D-74). |
| FR-UI-02 | Sign up, log in and verification use a split-screen layout with the tagline "Discover the Style That Is You." (compact brand band on small screens). |
| FR-UI-03 | Signed-in pages share a top navigation bar: the StyleMe logo (to Home); the sections Home, Discover My Style (the style profile), My Colour Palette, Outfit Categories, Shop My Look, Virtual Try-On, Design Studio, Style Assistant and Saved Outfits, with the sections that don't fit the width moved into a "More" menu; and an account menu with Settings and Log out (plus "Complete your profile" while the profile is incomplete, FR-ONB-05). Below 640 px a hamburger opens a drawer with every section. Sections not built yet are labelled "Coming soon" and open a description page only (FR-DATA-02). |
| FR-UI-04 | Imagery is licensed (Unsplash License, credited in `apps/web/public/images/CREDITS.md` and on the About page) and used as mood imagery only — never presented as products. |

### 4.2 Profile and preferences (FR-PROF) — Stage 1

| ID | Requirement |
|---|---|
| FR-PROF-01 | After login the user sees a dashboard that links to every Stage 1 feature. |
| FR-PROF-02 | The user can create and edit a profile (`GET`/`PUT /v1/profile`) with: `department` (women, men, any), sizes and fit per category (FR-SIZE), liked and disliked colours, contrast preference, silhouette preferences, coverage preferences, comfort preferences, liked and avoided fabrics, preferred styles, preferred wear types (`indian`, `fusion`, `western`; a soft preference, D-96) and preferred occasions. Allowed values: D-09. |
| FR-PROF-03 | Every field except `department` is optional. Missing fields fall back to documented defaults (FR-LOOK-09). |
| FR-PROF-04 | The profile form explains why each field is asked for and how it is used. Fields with no current use are not shown or stored (data minimisation). Age range and height are therefore not collected in Stage 1, because no Stage 1 rule or feature uses them. |
| FR-PROF-05 | The user may set an optional budget per look (₹). In Stage 1 it is used only to compare against totals of prices the user entered (FR-BUD); it never filters generated looks, which carry no prices. |
| FR-PROF-06 | A user can read and change only their own profile. |

### 4.3 Self-reported appearance signals (FR-SIG) — Stage 1

| ID | Requirement |
|---|---|
| FR-SIG-01 | The user may optionally choose a skin-tone range (Monk scale), an undertone (warm, cool, neutral, olive or "not sure") and body-proportion or silhouette descriptors, or skip all of them. |
| FR-SIG-02 | Each value is stored as `source: "self_reported"`, `userConfirmed: true` (the user entered it) and **no confidence value**; no confidence is shown for it ([DATABASE.md](DATABASE.md) §5). |
| FR-SIG-03 | The signals are used only while "Use in recommendations" is on. The user can edit, turn off or delete them at any time (`PUT /v1/appearance`). |
| FR-SIG-04 | Signals are never inferred from photos in Stage 1, and no photos are collected. |
| FR-SIG-05 | When a signal influences a look, the explanation says so ("suggested because you chose a warm undertone"). |
| FR-SIG-06 | Signals are soft styling inputs. They never restrict what the user can choose, and they never determine clothing size. |
| FR-SIG-07 | Appearance signals are never sent to an external AI provider (AI rule 16). |

### 4.4 Style knowledge base (FR-STY) — Stage 1

| ID | Requirement |
|---|---|
| FR-STY-01 | Styling knowledge is held as four record types: palettes, styling/fit rules, fabric rules and outfit templates ([AI.md](AI.md) §4). Every record has a stable ID, tags, applicable contexts, user-adjustable preferences, rationale, limitations, review status, reviewer and version. |
| FR-STY-02 | Only records with `reviewStatus: approved` are used at runtime. |
| FR-STY-03 | A rule linter runs in CI and at startup. It rejects contradictory effects in the same context, duplicate records, duplicate `slotId`s within a template, references to unknown records or categories, and records without rationale or limitations. |
| FR-STY-04 | Rules only *prefer* or *deprioritise*, with soft weights. They never forbid. |
| FR-STY-05 | Rationale describes effects ("a V-neck creates a longer line"), never judgements, and never claims something is objectively unsuitable for a body shape or skin tone. |
| FR-STY-06 | **Product requirement (D-57):** at least 100 palettes and at least 100 outfit templates (planning range 100–150), 8–12 broad categories (garments are garment types within them, D-97) and a comprehensive rule library (FR-STY-09), completed and approved before the Stage 2 release (content set C2). **Stage 1 release set (C1):** 12–20 palettes and about 20 templates covering the Stage 1 occasions and categories, with rules covering every FR-STY-09 area. A smaller development seed (C0) may be used to build the engine; it is temporary and never release scope ([ImplementationPlan.md](ImplementationPlan.md) §5.2). |
| FR-STY-07 | The founder reviews and approves all styling content ([CONTRIBUTING.md](CONTRIBUTING.md) §6, D-62). |
| FR-STY-08 | The library grows where the evaluation set or user feedback shows gaps (occasions with too few looks, frequent overrides, "not for me" feedback), and only as fast as the founder can review. |
| FR-STY-09 | **Rule coverage.** The rule library covers: **coordination** across a look's slots (colour compatibility using palette combinations and contrast, formality consistency (slot formality `casual` / `smart` / `formal` / `festive`, D-98), print and pattern mixing, proportion balance, footwear and accessory pairing); **occasions** and their dress expectations; **user preferences** (colours, contrast, silhouettes, coverage, comfort, fabrics, styles); **fit** per category; **sizes** (size notes per category; size never changed by styling rules); **budget** where it applies (shortlist totals in Stage 1; a hard constraint with the product layer); and **alternatives** that differ meaningfully (FR-LOOK-14). |
| FR-STY-10 | **Scale.** Record schemas, IDs, loader, linter, in-memory indexes and generator support at least 150 palettes and 150 templates without code changes; content is added as data only. Performance at that size is tested (T-38). |
| FR-STY-11 | **Coverage report.** CI produces a report of the approved library: palettes per undertone affinity and contrast level, templates per occasion × style × department, templates per category, per garment type and per wear type × department (D-100), categories per slot, and rule coverage per FR-STY-09 area, listing empty or thin cells. It drives content planning and the C1 and C2 release gates. |
| FR-STY-12 | **Slot identity (D-82).** Every template slot has a stable, template-defined `slotId` (e.g. `top`, `accessory-1`, `accessory-2`), unique within the template and distinct from its `slot` category/type, so repeated slot types never collide. Generated and saved looks keep each slot's `slotId`. |

### 4.5 Look recommendations (FR-LOOK) — Stage 1

A **look** is a complete outfit suggestion made of slots (for example top, bottom, footwear, accessory). Each slot has a **look specification**: category, colour family, fabric, fit, silhouette and other attributes.

| ID | Requirement |
|---|---|
| FR-LOOK-01 | The user requests looks (`POST /v1/recommendations`) with an occasion (required), and optionally a style, one or more wear types (`wearType`: `indian`, `fusion`, `western`; D-96) and `paletteMode` (`suggested` or `explore`). |
| FR-LOOK-02 | The system loads the user's profile and, if enabled, their self-reported signals. |
| FR-LOOK-03 | Code generates looks deterministically: compatible templates → palettes → styling and fabric rules → look specification per slot. No external AI is involved in generating or selecting looks. |
| FR-LOOK-04 | The response contains up to 5 distinct looks. Each slot shows its look specification, colour swatches, a labelled style illustration where a cleared asset exists (FR-DATA-06), a size note (FR-SIZE-04) and a generic search phrase (FR-LOOK-15). |
| FR-LOOK-05 | Each look has a "Why this works" explanation built from the rationale of the rules that were applied and the attributes that matched (FR-LOOK-12). |
| FR-LOOK-06 | Disliked colours never appear. Liked colours are boosted. |
| FR-LOOK-07 | With `paletteMode: explore`, any colour the user hasn't disliked can appear. |
| FR-LOOK-08 | **Precedence:** (1) hard constraints the user set (disliked colours, avoided fabrics, minimum coverage, department, wear types chosen in the request (D-96), and — with the product layer only — budget); (2) explicit preferences (fit, contrast, silhouettes, liked colours and fabrics, styles, preferred wear types from the profile — never overriding wear types chosen in the request); (3) approved rules; (4) self-reported signals, if enabled; (5) weather, in Stage 2. |
| FR-LOOK-09 | **Missing information:** only the occasion is required. No style means any style; no colours means neutral-led palettes; no signals means signals aren't used; no sizes means the size note asks the user to add one. The response lists the defaults applied (`DEFAULTS_APPLIED`) and never blocks. |
| FR-LOOK-10 | **Conflicting preferences** (e.g. a colour both liked and disliked) are shown to the user. Until they resolve it, the more restrictive choice applies and the explanation says so (`PREFERENCE_CONFLICT`). |
| FR-LOOK-11 | **Too few matches:** only looks that satisfy the hard constraints are returned, even if that is 0–2. The response names the limiting constraint and suggests a relaxation (`INSUFFICIENT_MATCHES`). It is a successful response, not an error, and looks are never padded. |
| FR-LOOK-12 | **Explanation fidelity:** every explanation is built from structured references (rule IDs and matched attribute values) returned with the look. Nothing else is claimed. |
| FR-LOOK-13 | **Diversity:** each look has a combination signature (template, palette, key attributes). A response never repeats a signature. |
| FR-LOOK-14 | **Alternatives:** each slot offers 3–5 alternative variations when enough approved options exist; fewer otherwise, with a message (`ALTERNATIVES_LIMITED`). Never padded (D-53). Each alternative differs meaningfully from the original and from the other alternatives (in colour, fabric, silhouette or category option), satisfies the hard constraints, and stays coordinated with the rest of the look (FR-STY-09); near-duplicates don't count. |
| FR-LOOK-15 | **Search phrase:** each slot has a copyable, generic phrase built from its look specification (e.g. "navy cotton straight-fit kurta") with the note "Search for this style at a store of your choice". It contains no retailer link, price or availability, and doesn't imply a specific product exists. |
| FR-LOOK-16 | **Optional AI wording** (D-67): off by default. If enabled, it may only reword the template explanation from the structured references. Any failure, timeout, rate limit or invalid output means the template text is used, with `AI_ENHANCEMENT_SKIPPED`. The response is never an error because of the AI step. |
| FR-LOOK-17 | Each recommendation's looks are stored as `outfits` documents with `status: "suggested"`, expiring after 7 days unless saved (D-23). |
| FR-LOOK-18 | Generated looks contain **no** products, prices or retailer links. In Stage 1 the only items and prices on a look are those the user adds (FR-LIST), shown with their "not verified" labels. With the product layer, product matching follows FR-MATCH. |
| FR-LOOK-19 | Explanations use inclusive, non-judgemental language. Phrases that judge a body or skin tone are rejected by a check on all explanation text. |

### 4.6 Colour palettes (FR-PAL) — Stage 1

| ID | Requirement |
|---|---|
| FR-PAL-01 | The user can view their suggested palettes (`GET /v1/style/palettes`), ranked by their preferences and enabled signals, each with rationale and limitations. |
| FR-PAL-02 | The user can browse every approved palette (`?view=all`), not only the suggested ones. |
| FR-PAL-03 | Palette suggestions never exclude a colour the user likes. They are guidance, not restriction. |

### 4.7 Saved looks (FR-OUT) — Stage 1

| ID | Requirement |
|---|---|
| FR-OUT-01 | The user can save a suggested look (`POST /v1/outfits/:id/save`). Saving sets `status: "saved"` and removes the expiry. |
| FR-OUT-02 | The user can list saved looks (`GET /v1/outfits`) and open one (`GET /v1/outfits/:id`). An opened look includes the items the user attached to its slots and its price summary (FR-BUD-07). |
| FR-OUT-03 | The user can delete a saved look (`DELETE /v1/outfits/:id`). |
| FR-OUT-04 | The user can give feedback on a look (`POST /v1/outfits/:id/feedback`): "love it" or "not for me", with an optional reason from a fixed list. No free text is collected. |
| FR-OUT-05 | A saved look keeps a snapshot of its slots (including each `slotId`), explanation and references, so it reads the same later even if rules change. |
| FR-OUT-06 | With the product layer, a saved look also shows the current status of any matched product (FR-MATCH-08). |
| FR-OUT-07 | A user can access only their own looks. |

### 4.8 Category sizing (FR-SIZE)

**Size systems (default, D-54):**

| Group | Garment types (D-97) | Size system |
|---|---|---|
| Tops | T-shirts, Shirts; jackets/blazers, Nehru jackets/bandhgalas, shrugs/cardigans | Letter XS–3XL; shirts may also use collar size |
| Bottoms | Jeans, Trousers, Churidars, Salwars, Palazzos; belts | Waist in inches (e.g. 26–44); optional length |
| Ethnic tops | Kurtas, Kurtis, Sherwanis, Anarkalis | Letter XS–3XL, or numeric where the retailer uses it |
| Ethnic sets | Lehengas | Letter or waist size; often semi-stitched |
| Free size | Sarees, dhotis, dupattas/stoles, jewellery, bags, watches, most accessories | No size |
| Shoes | Shoes, juttis, kolhapuris, heels, sneakers, loafers, sandals, formal shoes | UK/India size |
| Dresses | Dresses (Stage 2) | Letter XS–3XL |

Each garment type carries its size group (D-97); the broad category it belongs to (tops, bottoms, ethnic tops, ethnic sets & drapes, layers, footwear, accessories; dresses in Stage 2) doesn't decide the size.

| ID | Requirement | Stage |
|---|---|---|
| FR-SIZE-01 | The profile stores a size per category group, not one universal size. | 1 |
| FR-SIZE-02 | The profile stores a preferred fit per category group (e.g. slim, regular, relaxed). | 1 |
| FR-SIZE-03 | Body shape and appearance signals never determine or change a size. | 1 |
| FR-SIZE-04 | Each look slot shows the user's saved size for that category ("Your saved size: M"), or asks them to add one. Without a product, StyleMe gives no size recommendation beyond this. | 1 |
| FR-SIZE-05 | With the product layer, retailer size charts are stored only where the source permits it, with source and capture time. | Product layer |
| FR-SIZE-06 | With size charts available, the user may optionally enter self-measured measurements. They are labelled as self-measured, used only for size guidance, and deletable at any time. They are **not collected** before size charts exist (data minimisation). | Product layer |
| FR-SIZE-07 | Product size guidance: with a chart and measurements, a suggested size with its basis and confidence; with a chart only, the user's category size plus "check the size chart"; with no chart, "Size guidance unavailable — please choose your size". The user can always choose another size. | Product layer |

### 4.9 Data honesty and provenance (FR-DATA) — all stages

| ID | Requirement |
|---|---|
| FR-DATA-01 | Every piece of information shown belongs to one class, and the UI labels it: **user-provided** (profile, signals, items and prices the user adds — labelled "not verified by StyleMe"), **verified** (real product facts from a permitted source, with source and "as of" time), **derived** (looks, explanations, size notes and totals computed by StyleMe; a total of user-entered prices keeps the "not verified by StyleMe" label), **estimated** (model estimates with confidence; deferred features only), or **unavailable** (shown as "Not available"). |
| FR-DATA-02 | StyleMe never shows mock, invented, illustrative or test products, prices, availability, ratings, reviews, quality evidence, retailer approvals or purchase links as real. |
| FR-DATA-03 | A **verified real product** is one that exists on a retailer's site and was recorded from a permitted source (an authorised API or feed, or manual curation the retailer's terms permit), with the evidence in [DATABASE.md](DATABASE.md) §4.5. Nothing else is shown as a product. |
| FR-DATA-04 | When real product data is unavailable (no source, source down, product expired or out of stock), StyleMe says so and shows the look without a product. It never silently substitutes another product type, a placeholder or a test record. |
| FR-DATA-05 | **Test fixtures** (`isFixture: true`) exist only in local development, CI and staging databases. Production refuses to start if one is present, product ingestion rejects them, and production APIs never return them ([DEPLOYMENT.md](DEPLOYMENT.md) §2). |
| FR-DATA-06 | Style illustrations (garment-type drawings, colour swatches) are labelled "Style illustration — not a product". Every image has a recorded source and licence (D-65). Without a cleared image, a labelled colour swatch is shown. |
| FR-DATA-07 | No accuracy, relevance or performance figure is shown or claimed without an actual test result. |

### 4.10 Shortlist of user-found items (FR-LIST) — Stage 1 (D-77 = B)

The shortlist is the user's own notes about items they found elsewhere. StyleMe stores them and adds up their prices; it verifies nothing about them.

| ID | Requirement |
|---|---|
| FR-LIST-01 | The user can add an item they found elsewhere (`POST /v1/shortlist`): name (required), price they enter in ₹ (required), link (optional, https only) and a short note (optional). The item can be attached to one slot (identified by its `slotId`) of one of their saved looks, or kept unattached. |
| FR-LIST-02 | **Labels.** Each item shows "Added by you — not verified by StyleMe". Each price shows "Price entered by you — not verified by StyleMe". Each total shows "Total of prices you entered — not verified by StyleMe; not a checkout price". The labels are visible without extra clicks. |
| FR-LIST-03 | StyleMe never fetches the link, previews it, checks the price, or shows stock, delivery, ratings, reviews, quality, a retailer name, a logo or an image for a user-entered item. Nothing is derived from the link. |
| FR-LIST-04 | The user can list their items (`GET /v1/shortlist`) and delete any item (`DELETE /v1/shortlist/:id`). To change an item, they delete it and add it again. Deleting a saved look detaches its items; they stay in the shortlist until deleted. |
| FR-LIST-05 | Links are shown as plain outbound links with `rel="noopener noreferrer nofollow"`, opening in a new tab. StyleMe never adds, removes or changes tracking parameters in them, and never presents them as verified retailer listings. |
| FR-LIST-06 | Shortlist items are private to the user, never used for other users' recommendations, never sent to an AI provider, and deleted with the account (FR-AUTH-09). |
| FR-LIST-07 | Validation: name ≤ 120 characters, note ≤ 300 characters, URL ≤ 2,048 characters and `https://`, price > 0 and ≤ ₹10,00,000, currency INR. `outfitId` and `slotId` are given together or not at all. Attached items: at most one per slot of a look, enforced on `{outfitId, slotId}` (D-82). Unattached items: any number; at most 200 items per user (defaults, D-80). |

### 4.11 Real product catalogue and sourcing (FR-PROD) — product layer

| ID | Requirement |
|---|---|
| FR-PROD-01 | The catalogue contains only verified real products (FR-DATA-03) from retailers whose access level is A or B ([BRD.md](BRD.md) §7.3). The starting catalogue is small; the long-term target is 500–1,000 human-reviewed listings (D-58). |
| FR-PROD-02 | A retailer registry (`retailers`) records each retailer's ID, name, allowed domains, access level, source method, status and disclosure text. Only `active` retailers supply products. |
| FR-PROD-03 | Product data comes only from a permitted source method: `affiliate_api`, `partner_feed` or `manual_curation`. No scraping and no third-party scraping services. |
| FR-PROD-04 | Each product stores, when the source provides them: retailer ID and product ID, name, brand, category, department, colours, sizes, fabric, styles, occasions, images (source URLs only), price, MRP, currency, `priceVerifiedAt`, availability and sizes in stock with `verifiedAt`, product URL, link status, rating with source and capture time, and provenance evidence ([DATABASE.md](DATABASE.md) §4.5). Missing values stay `null` and show as "Not available". |
| FR-PROD-05 | Every price shows "Price as of <time>" and a note that the retailer's page is authoritative. Totals are labelled "Estimated items total — not a checkout price". |
| FR-PROD-06 | **Freshness** per source method (D-50): fresh; stale (shown with "Price may have changed"); expired (not recommended, listed for re-verification). |
| FR-PROD-07 | Out-of-stock products, products without the user's size in stock, broken links and expired prices are not recommended. Unknown size availability is allowed with a warning. |
| FR-PROD-08 | Curated listings are imported through a validation script that rejects missing source URL or capture time, a product URL outside the retailer's domains, future dates and fixtures. Each record keeps reviewer, review date and criteria version. |
| FR-PROD-09 | Automated sources are refreshed by a sync script within each provider's rate limits and terms (D-51). A failed sync never breaks the app; data ages into stale and expired. |
| FR-PROD-10 | The user can browse and filter products (`GET /v1/products`) and open product details (`GET /v1/products/:id`). |
| FR-PROD-11 | Each product links to the retailer's listing on an allowed domain, in a new tab. StyleMe adds no affiliate tracking. If the source-supplied link already carries tracking, the D-46 affiliate disclosure appears next to it. No sponsored placements. |

### 4.12 Matching products to looks (FR-MATCH) — product layer

| ID | Requirement |
|---|---|
| FR-MATCH-01 | For each look slot, code searches eligible products that match the slot's look specification and ranks them deterministically. |
| FR-MATCH-02 | **Eligibility:** active retailer, active listing, verified provenance, not a fixture, in stock, user's size in stock (or unknown with a warning), link not broken, price not expired, quality verdict not `rejected`. |
| FR-MATCH-03 | **Suitability and quality first:** ranking orders eligible products by suitability for the slot and the user (look match, size), then evidenced quality, then price. Affiliate status, affiliate tracking and commission are never ranking or quality inputs and are never sent to AI; ranking is identical with or without them. |
| FR-MATCH-04 | **Look match:** each product gets `likely`, `partial` or `uncertain` against its slot's specification, with reasons. Listing-reliability evidence can lower it. It is never "guaranteed". |
| FR-MATCH-05 | If no eligible product matches a slot, the slot shows "No verified product available" with its search phrase. It is never padded with a poorer match. |
| FR-MATCH-06 | **Alternatives:** 3–5 eligible products per slot when enough exist, fewer otherwise; never padded. Each shows retailer, price, price difference, "as of" time, size availability, quality verdict and look match. |
| FR-MATCH-07 | **Cross-retailer comparison** is shown only after the retailers involved have confirmed it is permitted (D-44, D-45). |
| FR-MATCH-08 | Saved looks re-check matched products when viewed: price changes ("was ₹X as of …, now ₹Y as of …"), "No longer available", "Link not working", and the budget re-check. Alternatives are offered for items that are no longer eligible (`GET /v1/products/:id/alternatives`). |

### 4.13 Budget engine (FR-BUD) — Stage 1 on user-entered prices; product layer on verified prices

| ID | Requirement |
|---|---|
| FR-BUD-01 | Budget calculations are pure code. AI never sets, invents or changes a price. |
| FR-BUD-02 | A total is the sum of the prices in a look. Stage 1: only prices the user entered (`priceBasis: user_entered`). Product layer: only verified prices (`priceBasis: verified`). The two bases are never combined into one total; if a look ever had both, each subtotal is shown separately with its label. |
| FR-BUD-03 | A total is within budget only if `total <= budget`. Budget remaining is `budget − total`. With no budget set, only the total is shown. |
| FR-BUD-04 | Totals are always labelled with their basis and never as checkout prices (D-55). User-entered totals use the FR-LIST-02 wording. Verified totals use the current unconditional selling price, never count conditional offers, and show MRP, discounts and known shipping separately. |
| FR-BUD-05 | Product layer: for each alternative, code computes the total and budget remaining if it were chosen instead. |
| FR-BUD-06 | Product layer: if no budget-valid look exists, the response returns no over-budget look and names budget as the limiting constraint (FR-LOOK-11). |
| FR-BUD-07 | **Stage 1 price summary** on a saved look: `itemsTotal`, `pricedSlots` of `totalSlots`, `budget`, `budgetRemaining`, `status` (`within_budget`, `over_budget` or `no_budget`) and `complete` (true only when every slot has a priced item). It is computed when the look is read, not stored, so deleting an item updates it. An incomplete total says how many slots have no price ("2 of 3 slots priced"). |

Example (Stage 1): the user enters ₹699 for a T-shirt, ₹999 for jeans and ₹699 for shoes; budget ₹2,500 → "Total of prices you entered: ₹2,397 (3 of 3 slots) — within your budget, ₹103 remaining. Not verified by StyleMe; not a checkout price."

### 4.14 Product quality evidence (FR-QUAL) — product layer

| ID | Requirement |
|---|---|
| FR-QUAL-01 | Review evidence is curated by hand from permitted sources, one record per piece of evidence, with source URL, capture time and curator. No reviewer personal data and no customer photos are stored (D-49). |
| FR-QUAL-02 | A deterministic quality service gives a verdict (`acceptable`, `caution`, `rejected`, `insufficient_evidence`) with confidence (never 1), per-dimension signals (fabric, fit, stitching, durability, sizing, colour accuracy), reasons, warnings and the evidence used. Thresholds are proposals until calibrated (D-52). |
| FR-QUAL-03 | With too little evidence the verdict is `insufficient_evidence`, shown with a warning. Such products are never described as good quality. |
| FR-QUAL-04 | Seller ratings are a weak signal only. StyleMe states that it cannot reliably detect fake reviews. |
| FR-QUAL-05 | `rejected` products are never recommended. |
| FR-QUAL-06 | Every quality reason cites stored evidence. Affiliate status never affects quality. |

### 4.15 Optional weather (FR-WX) — Stage 2

| ID | Requirement |
|---|---|
| FR-WX-01 | Weather awareness is off by default and controlled by the user. |
| FR-WX-02 | Location comes from a city the user picks, or device location with permission, or another source only if explicitly authorised. Location is never mandatory. |
| FR-WX-03 | When on, the API gets current or forecast conditions from a provider whose commercial terms, pricing and data handling are verified (D-60; none selected). The UI shows conditions with source and time. |
| FR-WX-04 | Conditions map to soft comfort bands (starting values to calibrate: feels-like hot ≥ 32°C, warm 26–31°C, mild 18–25°C, cool 10–17°C, cold < 10°C; humid ≥ 70%; rain likely ≥ 50% or ≥ 1 mm; windy ≥ 30 km/h). |
| FR-WX-05 | Bands adjust ranking softly through fabric and styling rules (breathability, moisture management, quick-drying fabrics, layering, sleeve length, coverage, footwear). Weather never excludes a look, and no rule claims a fabric is always right for a temperature. |
| FR-WX-06 | When off, nothing is fetched, stored or used, and results don't depend on location. |
| FR-WX-07 | When weather is unavailable, the user can enter conditions manually or continue without weather. Recommendations are never blocked. |
| FR-WX-08 | Device coordinates are rounded (about 1 km), used only for the request, and never stored or sent to AI. Only the on/off setting and the chosen city are saved, and both are deletable. |
| FR-WX-09 | Weather never prevents the user from choosing a look they prefer. |

### 4.16 Deferred features (D-76) and future features (D-48)

These are approved parts of the long-term vision. Their stage is not decided, and none is part of Stage 1. Before any of them starts, the requirements below are reviewed again.

**Photo-based appearance analysis (FR-APP).**
- FR-APP-01: the user may upload a face photo and a full-body photo, only with explicit, withdrawable consent. Withdrawing consent deletes any kept photos and the photo-derived estimates (D-11).
- FR-APP-02: photo quality is validated first, and bad, dark, multiple-person, no-face and partial-body photos get clear feedback.
- FR-APP-03: estimates are a Monk skin-tone range, an undertone and a body-shape class, each with the model's confidence. An estimate below the calibrated threshold (D-15) is shown as "not sure" rather than forced into a class. No calibrated measurements are claimed.
- FR-APP-04: processing happens in the browser or on StyleMe's own servers. Personal photos are not sent to external AI providers unless a future explicit founder decision, a privacy review and user consent authorise that specific processing (AI rule 16).
- FR-APP-05: estimates are confirmed or corrected by the user (`PUT /v1/appearance/confirm`). Confirmation never changes the model's confidence, and unconfirmed estimates are never used ([DATABASE.md](DATABASE.md) §5).
- FR-APP-06: photos are deleted after analysis unless the user chooses to keep them; where kept photos are stored and for how long is decided with this feature (D-11).

**3D avatar (FR-AVT).** FR-AVT-01: a GLB/GLTF avatar with front, side and back views, rotate and zoom. FR-AVT-02: approximate proportions only, never used for sizing. FR-AVT-03: no photorealistic reconstruction. It is separate from try-on and from look generation.

**Design Studio (FR-DES).** FR-DES-01: design a garment by choosing garment, colour, fabric, neck, sleeve, length, fit, pattern and embroidery. FR-DES-02: a preview. FR-DES-03: designs are saved to the user's account (`POST /v1/design`, `GET /v1/design/:id`).

**Sketch-to-design (FR-SKT).** FR-SKT-01: upload a sketch (`POST /v1/design/sketch`). FR-SKT-02: AI interprets it into a structured garment specification validated by Zod; a sketch is not a personal photo. FR-SKT-03: the user confirms or edits the result before generation (`POST /v1/design/generate`). FR-SKT-04: AI failure gives a clear error, never a fake design.

**Fashion chatbot (FR-CHAT).** FR-CHAT-01: chat with an assistant (`POST /v1/chat`, `GET /v1/chat/conversations`). FR-CHAT-02: only relevant, minimised profile context is sent to the AI; no photos, measurements or appearance signals. FR-CHAT-03: product facts come only from stored verified data with "as of" times. FR-CHAT-04: AI failure gives a clear error, never a fake answer.

**Tailor PDF (FR-PDF).** FR-PDF-01: generate a tailor specification PDF from a saved design (`POST /v1/tailor/pdf`) with garment, fabric, colour, neck, sleeve, length, fit, pattern, embroidery, design image and tailor instructions. FR-PDF-02: download it.

**Virtual try-on (FR-TRY), future, D-48.**
- FR-TRY-01: the hosted-provider design in earlier drafts (sending the user's photo to Leffa, Hugging Face or Qwen) is **not approved**.
- FR-TRY-02: try-on can only be built after a founder decision, a privacy review and user consent authorise the specific processing (AI rule 16), and after the D-48 conditions are confirmed: image rights, permission for AI processing, retailer restrictions, deletion controls, accuracy, cost and latency.
- FR-TRY-03: fallback when it can't produce a valid result: the authorised product image, a generic styling moodboard or a text description. It never implies a try-on succeeded (D-59).

---

## 5. Cross-Cutting Requirements (FR-X)

| ID | Requirement |
|---|---|
| FR-X-01 | Every API response uses the standard envelope ([API.md](API.md) §1.1). |
| FR-X-02 | Error responses never expose stack traces, secrets, database details or internal errors. |
| FR-X-03 | All user data is isolated to the authenticated user. |
| FR-X-04 | `GET /health` reports API health. |
| FR-X-05 | An optional enhancement failing (AI wording, weather) never blocks the core feature. Errors are returned only when the core operation genuinely can't complete. |
| FR-X-06 | The UI works on mobile and desktop viewports. |

---

## 6. Decisions

All decisions are tracked in the decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-09, D-23, D-46, D-48, D-49, D-50, D-52 … D-55, D-57, D-58, D-60, D-62, D-65, D-63, D-67, D-74, D-76, D-77, D-80, D-82, D-83, D-84, D-86 … D-94.
