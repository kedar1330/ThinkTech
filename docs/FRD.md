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
| **Future (D-48)** | Photo-based or generative virtual try-on (the 2D illustrative try-on is approved, D-119) |
| **Feature specifications (D-109)** | Discover My Style, My Colour Palette, Outfit Categories, Saved Outfits, Shop My Look, 2D Virtual Try-On and the Admin Panel, specified 2026-10-18 (§4.17 – §4.24) and built into Stage 1 in the order of D-109 |

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
| Virtual try-on (photo-based / generative) | FR-TRY | Future (D-48) | `tryon/` | `/v1/tryon*` |
| Discover My Style | FR-DMS | 1 (D-109) | `(app)/discover` | `/v1/catalogue/*`, `/v1/recommendations`, `/v1/saved-items` |
| My Colour Palette (extended) | FR-PAL-04 … 30 | 1 (D-109) | `(app)/palettes` | `/v1/palettes*`, `/v1/custom-palettes*` |
| Outfit Categories and the shared style catalogue | FR-OCAT | 1 (D-109, D-110 … D-114) | `(app)/categories` | `/v1/catalogue/*` |
| Shop My Look | FR-SHOP | 1 UI and assembly; product layer for real products (D-124) | `(app)/shop` | `/v1/shop/*`, `/v1/products*`, `/v1/shortlist*` |
| Virtual Try-On, 2D illustrative | FR-VTO | 1 (D-119) | `(app)/try-on` | `/v1/try-on/catalogue`, `/v1/saved-items` |
| Saved Outfits | FR-SAVE | 1 (D-116) | `(app)/saved` | `/v1/saved-items*`, `/v1/collections*` |
| Admin Panel | FR-ADM | 1 (D-120) | `(admin)/admin/*` | `/v1/admin/*` |
| Cross-feature connections | FR-CONN | 1 (D-127) | all feature pages | — |

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
| FR-AUTH-08 | Users have `role` (`user` or `admin`), `isActive` and `tokenVersion`. Incrementing `tokenVersion` revokes all of that user's tokens; a user with `isActive: false` can't log in and their tokens are rejected. Both are changed only by admin scripts in Stage 1. *Revised by D-120: a Super Admin can also suspend and reactivate accounts through the admin panel (FR-ADM-06); suspension revokes all sessions.* |
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
| FR-UI-03 | Signed-in pages share a top navigation bar: the StyleMe logo (to Home); the sections Home, Discover My Style (the style profile), My Colour Palette, Outfit Categories, Shop My Look, Virtual Try-On, Design Studio, Style Assistant and Saved Outfits, with the sections that don't fit the width moved into a "More" menu; and an account menu with Settings and Log out (plus "Complete your profile" while the profile is incomplete, FR-ONB-05). Below 640 px a hamburger opens a drawer with every section. Sections not built yet are labelled "Coming soon" and open a description page only (FR-DATA-02). *Revised 2026-10-18 by D-106: replaced by the two-row header of FR-HOME when the Home redesign is built.* |
| FR-UI-04 | Imagery is licensed (Unsplash License, credited in `apps/web/public/images/CREDITS.md` and on the About page) and used as mood imagery only — never presented as products. |

### 4.1b Home dashboard (FR-HOME) — approved 2026-10-18 (D-106), not built

> Consolidated from the Home requirements answered on 2026-10-18 (58 questions). **Approved by the founder on 2026-10-18 (D-106); not built yet.** It replaces FR-UI-03 and the Home part of FR-ONB-05 when built; until then those describe the Home and navigation that exist. Nothing here may present an unbuilt feature as available (FR-DATA-02).

| ID | Requirement |
|---|---|
| FR-HOME-01 | **Data.** Home has no collection or database of its own. It reads the profile, appearance summary, palettes, recommendations, saved outfits, recent designs and profile completion from their own collections, generates personalised looks with the shared recommendation engine, and stores only persistent user actions (recent activity, notification read state). A cache or recommendations collection is added only if measured performance needs it. |
| FR-HOME-02 | **Desktop header — two rows.** Row 1: StyleMe logo (to Home), global search, notification bell, profile/account icon. Row 2: Home, Discover My Style, My Colour Palette, Outfit Categories, Shop My Look, Virtual Try-On, Design Studio, Style Assistant, Saved Outfits — icon and text. |
| FR-HOME-03 | **Mobile header.** ☰ menu button at the top left (opens every feature), logo, search and profile icon; compact icons. |
| FR-HOME-04 | **Global search** covers feature names and navigation, outfit templates and styling ideas, colour palettes, saved outfits and designs, and products from authorised sources when they exist — only content that actually exists is searchable. |
| FR-HOME-05 | **Notification bell** shows an unread count and opens a panel; notifications can be opened and marked read. No promotional notifications; no product-change notices unless that tracking exists. |
| FR-HOME-06 | **Account menu:** My Profile, Settings, Privacy and consent, Sign out. |
| FR-HOME-07 | **Order of content:** (1) welcome and hero banner — first name, a short fashion welcome, a personalised outfit suggestion and an optional prompt for missing profile information; (2) outfit carousel; (3) all eight feature cards; (4) recent activity, continue links, profile-completion chart and quick actions. Balanced length; no other sections. |
| FR-HOME-08 | **Style summary:** preferred styles and occasions only — never measurements or sensitive appearance details. |
| FR-HOME-09 | **Outfit carousel:** several looks shown horizontally, mixing personalised looks (from whatever profile data exists), curated general ideas and seasonal or festive looks when relevant. Selecting a look opens a quick-view panel with a link to full details. |
| FR-HOME-10 | **Feature cards (all eight):** name, short description, fashion image or illustration, icon, clickable card or open action, accurate availability label ("Coming soon" where applicable) and a personalised preview when supported. Selecting an unavailable feature shows a clear "Coming soon" message and an alternative where one exists. |
| FR-HOME-11 | **Quick actions:** Edit My Profile, Explore outfits, View My Colour Palette, Open Saved Outfits, Start a design, Ask Style Assistant, Browse shopping looks — each opens the real feature or its "Coming soon" page. |
| FR-HOME-12 | **Recent activity:** recently visited features and continue links; after login Home opens and keeps useful recent activity. Recently saved outfits appear only if the user has any; otherwise general inspiration and a "save your first look" prompt. |
| FR-HOME-13 | **Profile completion:** percentage and missing sections shown as an attractive progress chart (FR-MYP-14). Profile setup stays optional and Home works for a new user. |
| FR-HOME-14 | **Refresh:** profile changes refresh the relevant Home recommendations automatically, followed by the in-app message "Your recommendations have been updated." Recommendations use saved profile preferences only (feedback-based personalisation is D-108). |
| FR-HOME-15 | **States:** skeleton placeholders while sections load; a failed section shows a retry while navigation and loaded sections stay usable. Unsaved profile edits are handled in My Profile, not on Home. |
| FR-HOME-16 | **Design:** premium editorial layout with modern cards — varied card sizes on desktop, stacked content on mobile; a sophisticated neutral base with one distinctive accent; subtle animations with reduced-motion support; one layout for everyone (no customisation); light, dark and system themes. |
| FR-HOME-17 | **Imagery:** fashion editorial photography across Indian, fusion and Western looks, body types, skin tones, gender expression and age groups where appropriate; licensed only (FR-UI-04, D-65). Default models and body-shape illustrations always wear a plain white shirt and plain white pants (D-103). |
| FR-HOME-18 | **Accessibility and privacy:** keyboard navigation, visible focus, labelled icons, landmarks and headings, readable text and contrast, alt text, touch-friendly controls; a clear route to privacy and consent settings; optional-profile reminders only when relevant. |

### 4.2 Profile and preferences (FR-PROF) — Stage 1

| ID | Requirement |
|---|---|
| FR-PROF-01 | After login the user sees a dashboard that links to every Stage 1 feature. |
| FR-PROF-02 | The user can create and edit a profile (`GET`/`PUT /v1/profile`) with: `department` (women, men, any), sizes and fit per category (FR-SIZE), liked and disliked colours, contrast preference, silhouette preferences, coverage preferences, comfort preferences, liked and avoided fabrics, preferred styles, preferred wear types (`indian`, `fusion`, `western`; a soft preference, D-96) and preferred occasions. Allowed values: D-09. *Revised 2026-10-22 (D-129): My Profile asks only for the Clothing Preference (Women's Wear / Men's Wear, stored as `department`), age group, budget and fabrics; the other preferences are asked per outfit in Discover My Style and Shop My Look (§4.3b).* |
| FR-PROF-03 | Every field except `department` is optional. Missing fields fall back to documented defaults (FR-LOOK-09). |
| FR-PROF-04 | The profile form explains why each field is asked for and how it is used. Fields with no current use are not shown or stored (data minimisation). Age range and height are therefore not collected in Stage 1, because no Stage 1 rule or feature uses them. *Revised 2026-10-18: optional age group and height in My Profile (FR-MYP-03, FR-MYP-07; D-102, D-104 approved; the age group ships only after the D-74 legal review).* |
| FR-PROF-05 | The user may set an optional budget per look (₹). In Stage 1 it is used only to compare against totals of prices the user entered (FR-BUD); it never filters generated looks, which carry no prices. |
| FR-PROF-06 | A user can read and change only their own profile. |

### 4.3 Self-reported appearance signals (FR-SIG) — Stage 1

| ID | Requirement |
|---|---|
| FR-SIG-01 | The user may optionally choose a skin-tone range (Monk scale), an undertone (warm, cool, neutral, olive or "not sure") and body-proportion or silhouette descriptors, or skip all of them. |
| FR-SIG-02 | Each value is stored as `source: "self_reported"`, `userConfirmed: true` (the user entered it) and **no confidence value**; no confidence is shown for it ([DATABASE.md](DATABASE.md) §5). |
| FR-SIG-03 | The signals are used only while "Use in recommendations" is on. The user can edit, turn off or delete them at any time (`PUT /v1/appearance`). |
| FR-SIG-04 | Signals are never inferred from photos in Stage 1, and no photos are collected. *Revised 2026-10-18: optional face and full-body photo analysis with consent (FR-MYP-08 … 11; D-103 approved, behind its release gates). Revised 2026-10-22: built and live with Gemini (§4.3b, D-129).* |
| FR-SIG-05 | When a signal influences a look, the explanation says so ("suggested because you chose a warm undertone"). |
| FR-SIG-06 | Signals are soft styling inputs. They never restrict what the user can choose, and they never determine clothing size. |
| FR-SIG-07 | Appearance signals are never sent to an external AI provider (AI rule 16). *Revised 2026-10-22 (D-129): the user's face and full-body photos are sent to Gemini for analysis after the user agrees; signal values and measurements are not.* |

### 4.3b My Profile redesign (FR-MYP2) — founder decision 2026-10-22 (D-129), built

> Code: contracts `my-profile.ts`, `photos.ts`, `appearance.ts`; API `/v1/profile`, `/v1/appearance` (+ `/confirm`), `/v1/measurements`, `/v1/photos` ([API.md](API.md) §3.9b); web `app/(app)/profile/page.tsx` and `components/profile/*`. Data: [DATABASE.md](DATABASE.md) §3.2, §3.3, §3.7, §3.8.

| ID | Requirement |
|---|---|
| FR-MYP2-01 | **Clothing Preference** (replaces "Department"): two visual cards, **Women's Wear** and **Men's Wear**; required. It decides which measurements and body types are shown. A profile saved earlier with "Show me everything" is asked to choose again. |
| FR-MYP2-02 | My Profile does **not** ask for colours, fit, contrast, silhouettes, coverage, comfort, styles, occasions or letter sizes; saving My Profile clears any such values left from the earlier profile. Fit is asked in Discover My Style and Shop My Look. Kept: optional **age group** (no date of birth), **budget per look**, **fabrics** liked/avoided. |
| FR-MYP2-03 | **Skin tone & undertone — two ways, one at a time.** "Upload my face photo" or "Choose manually"; choosing one hides the other. Manual: select one of the 10 Monk swatches and one of four undertone cards with hand illustrations — **Cool (pinkish), Neutral, Warm (golden), Olive (greenish)**. |
| FR-MYP2-04 | **Face photo analysis.** Upload from the album or device (drag and drop on desktop). The photo is shrunk in the browser (metadata dropped), the user agrees to the photo notice, and Gemini returns a Monk tone (1 – 10) and one of the four undertones, with a High/Medium/Low confidence. Guidance used: overall lightness from several facial regions (forehead, cheeks, jawline); undertone mainly from cheeks and jawline with redness and shadows discounted, forehead for overall colour, under-eye only a weak clue, smile lines ignored, hair and eye colour supporting only; lighting checked. Unusable photos (too dark, too bright, blurry, no face, several people) are refused with the reason. |
| FR-MYP2-05 | **Body type — measurements first.** A step-by-step form (one measurement per step, illustration of a figure in a plain white shirt and pants with the tape, how-to text, cm/inches, Next, dots and a strip of all steps). Women: shoulder circumference, bust, waist, hip, high hip. Men: shoulder circumference, chest, waist, hip. The body type is identified at once: women — Hourglass, Top Hourglass, Bottom Hourglass, Pear, Spoon, Rectangle, Inverted Triangle, Oval, Diamond; men — Rectangle, Triangle, Inverted Triangle, Trapezoid, Oval. |
| FR-MYP2-06 | **Body type — or a full-body photo.** For users without measurements (and for the later 2D/3D try-on), a full-body photo analysed by Gemini, which must choose from the user's Clothing Preference list only. |
| FR-MYP2-07 | **Fit measurements (optional, hidden by default).** Women: underbust, shoulder-to-waist, back width, armhole, upper arm, wrist, sleeve length, neck, waist-to-hip, thigh, knee, calf, inseam, outseam, front and back rise, dress length preference. Men: neck, back width, shoulder-to-waist, armhole, upper arm, wrist, sleeve length, thigh, knee, calf, inseam, outseam, front and back rise, jacket and shirt length preference. Any step can be skipped. |
| FR-MYP2-08 | **Results are stored at once and reviewable.** Every result (photo or measurements) is saved straight away on the user's own records and shown immediately with its source; the user confirms it or corrects it (corrections are recorded as `user_corrected`). Every feature reads skin tone, undertone, body type and measurements from these records. |
| FR-MYP2-09 | **Photos.** Stored privately in MongoDB (newest face photo and newest full-body photo); listed in My Profile with Delete; deleted with the account. Only the photo is sent to Gemini — never the user's name, email, measurements or other data. When no Gemini key is configured, the photo options show "Not available right now" and manual entry still works. |

### 4.3a My Profile (FR-MYP) — approved 2026-10-18 (D-102 … D-105), not built

> **Revised 2026-10-22 by D-129.** Where §4.3b differs from this section, §4.3b applies (built).

> Consolidated from the My Profile requirements answered on 2026-10-18. **Approved by the founder on 2026-10-18; not built yet.** It replaces FR-PROF-04 (no age or height), FR-SIZE-06 (no measurements) and, for photo analysis, FR-SIG-04 and D-76. Release gates: the age group and photo analysis ship only after the privacy review and D-74 legal review; photo upload only once account deletion also deletes stored photos. AI rule 16 still applies: face photos, measurements and appearance details are never sent to an external AI provider; the single exception is full-body photos to Gemini under D-122. Data model: [DATABASE.md](DATABASE.md) §3.2, §3.7, §3.8. Proposed contracts: `packages/contracts/src/my-profile.ts` and `photos.ts` (no endpoint accepts them yet).

| ID | Requirement |
|---|---|
| FR-MYP-01 | **Layout.** Separate sections: Basic information, Skin tone & undertone, Body shape, Body measurements, Style & fit preferences (with colours, occasions and budget). On mobile: stacked sections and easy-to-tap controls. |
| FR-MYP-02 | **Saving.** Each section has its own Edit and Save; **Save all changes** saves the remaining edits; sections already saved stay saved; leaving with unsaved changes asks for confirmation. Each section shows its last-updated date. |
| FR-MYP-03 | **Basic information.** Full name; optional age group (Under 18, 18–24, 25–34, 35–44, 45+ — never a date of birth, D-104); city from a searchable list of Indian cities (optional for completion, used only by location features); clothing preference as Men's / Women's visual cards, changeable at any time with recommendations refreshed. |
| FR-MYP-04 | **Skin tone & undertone.** A face-photo estimate (FR-MYP-08) or manual selection with visual cards, readable labels, guidance and a "Not sure" option. Both optional; the user reviews and corrects any estimate. |
| FR-MYP-05 | **Body shape.** Any of: full-body photo analysis (front and other angles), measurements, or manual visual cards with names and illustrations plus "Not sure"; photos and measurements may be combined. The user reviews and corrects every result, and is never restricted to a body-shape category. Card names need founder approval and the inclusive-language check (D-62). |
| FR-MYP-06 | **Body-shape reliability.** Photo only: a High / Medium / Low confidence label. Measurements: a measurement-informed result, never claimed to be 100 % accurate. Photo and measurements: the evidence is combined. Always reviewable and correctable. |
| FR-MYP-07 | **Measurements — manual entry only** (photos never produce measurements). Essential: height, shoulder width, chest/bust, waist, hips/seat. Detailed (expandable): high hip, neck, arm length, upper arm, wrist, inseam, outseam, thigh, knee, calf, torso length, underbust (where relevant). Fields follow the clothing preference. Body measurements are distinct from garment measurements. Centimetres or inches with automatic conversion (stored in cm) and plausible-range validation that flags missing or unusual values for correction. |
| FR-MYP-08 | **Two separate photo uploads:** a face photo (skin tone and undertone) and full-body photos (body shape). Camera and gallery access is requested only when the user chooses to upload or capture. Before analysis the user can preview, crop, retake or replace a photo, and can replace or retake it later (analysis updates after confirmation). An unclear or unsuitable photo gets an explanation and a retake or manual-selection option. |
| FR-MYP-09 | **Consent.** Explicit consent before the first analysis of each kind, explaining how photos and results are used; revocable at any time in My Profile without deleting the profile. On revocation the user chooses to keep or delete existing photo-derived results; future analysis stops until consent is given again. |
| FR-MYP-10 | **Processing.** On the user's device where feasible; otherwise StyleMe's own secure servers, with clear disclosure and consent. Face photos never go to an external AI provider (AI rule 16). Full-body photos may be analysed by Gemini only under D-122: per-use consent, metadata stripped, paid tier without training or retention, user confirmation, and only after the privacy review. |
| FR-MYP-11 | **Retention and deletion.** The user chooses to keep photos (until they delete them or revoke retention) or to delete them automatically after analysis. Revoking retention deletes stored photos immediately. Photos, photo-derived results and measurements can each be deleted independently, with a clear explanation before confirmation; deleting photos does not delete derived results. Photos are kept in private object storage and are never public. |
| FR-MYP-12 | **Style & fit.** Visual fit options Slim, Regular, Relaxed, Oversized; a default fit plus a fit per category. Visual multi-select style cards. Colours: favourite and avoided swatches with readable labels, plus suggested colours from skin tone, undertone, colour theory and preferences. Occasions: multi-select cards plus custom occasions (labels only; no rules read them). Budget: a default per look plus per-category budgets, temporarily changeable while exploring outfits. |
| FR-MYP-13 | **Using the data.** Saved measurements are reused by every feature that needs them; features ask only for the missing information they require. Fit-based recommendations require the essential measurements; other features work with what is available and label inputs "Required for this feature" or "Optional — improves personalization". |
| FR-MYP-14 | **Completion.** A percentage and the incomplete sections, shown as an attractive progress chart in My Profile and on Home. Core personalisation sections weigh most; optional sections (photos, measurements) also count but are labelled optional, never implied compulsory, and are not needed to complete the core. Optional reminders explain the benefit. |
| FR-MYP-15 | **Updates.** Changes refresh relevant recommendations automatically in the background and show "Your recommendations have been updated." (no push notification). |
| FR-MYP-16 | **Summary and reset.** A private profile summary, visible only to the user (no sharing). **Reset preferences** for selected sections or all of them, keeping basic information; photos and measurements are reset only if explicitly selected; confirmation required. |
| FR-MYP-17 | **Export and deletion.** Download a copy of profile information and measurements as JSON and PDF (D-105). Account deletion explains what is deleted and requires confirmation (FR-AUTH-09, D-94). |
| FR-MYP-18 | **Accessibility.** Every visual card and swatch has a readable label and keyboard-accessible selection. |
| FR-MYP-19 | **Minors.** The Under 18 age group is allowed with privacy protections for minors (D-104); the admin sees aggregated age-group counts only, never an individual's age group. |

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

The full My Colour Palette feature (saving, custom palettes, filters, detail page, feedback) is specified in §4.18 (FR-PAL-04 … 30, D-109).

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
| FR-SIZE-06 | With size charts available, the user may optionally enter self-measured measurements. They are labelled as self-measured, used only for size guidance, and deletable at any time. They are **not collected** before size charts exist (data minimisation). *Revised 2026-10-18: manual body measurements in My Profile for body shape and fit (FR-MYP-07; D-102 approved); size recommendations still only where reliable size charts exist.* | Product layer |
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

**Virtual try-on (FR-TRY), future, D-48.** *These requirements cover photo-based or generative try-on only. The 2D illustrative try-on is approved and specified in §4.21 (FR-VTO, D-119).*
- FR-TRY-01: the hosted-provider design in earlier drafts (sending the user's photo to Leffa, Hugging Face or Qwen) is **not approved**.
- FR-TRY-02: try-on can only be built after a founder decision, a privacy review and user consent authorise the specific processing (AI rule 16), and after the D-48 conditions are confirmed: image rights, permission for AI processing, retailer restrictions, deletion controls, accuracy, cost and latency.
- FR-TRY-03: fallback when it can't produce a valid result: the authorised product image, a generic styling moodboard or a text description. It never implies a try-on succeeded (D-59).

### Feature specifications of 2026-10-18 (D-109 … D-128)

§4.17 – §4.24 consolidate the founder's answers for seven features. Conventions for all of them:
- **Shared data, no copies.** Every feature reads the one shared catalogue (D-110) and user data from its owning collection; features pass stable IDs (FR-CONN-01).
- **Honest states.** Skeleton placeholders while loading; a clear message and **Retry** on failure, keeping the rest of the page usable; a useful empty state with "Clear filters" or related alternatives; a missing illustration shows an honest placeholder, never a broken image or an unrelated picture. An action whose destination or capability doesn't exist yet is hidden or labelled "Not available yet" — never simulated (FR-DATA-02).
- **Guidance, not rules.** Suitability is explained as benefits and trade-offs, never as a guarantee or a judgement of a body or skin tone (FR-STY-05, FR-LOOK-19); users can explore everything.
- **Profile is read, not silently changed.** Missing profile data gives general results, says what is missing and links to the exact My Profile section; browsing, filters, feedback and conversations never change the profile without an explicit action (D-115).
- **Design.** Sophisticated fashion-brand, editorial and magazine-inspired: refined typography, elegant spacing, subtle colours, croquis illustrations (D-113); subtle transitions that respect reduced motion; responsive desktop, tablet and mobile with collapsible filters and touch-friendly cards; the top navigation stays visible on every feature ([UI_DESIGN.md](UI_DESIGN.md) §13).
- **Accessibility.** Readable text and contrast, keyboard navigation with visible focus, labels on every control and swatch, meaningful alt text, and suitability never shown by colour alone.

### 4.17 Discover My Style (FR-DMS) — Stage 1 (D-109)

Explains **which individual garment features suit the user and why** — necklines, sleeves, top lengths, trouser cuts, waistlines, skirts, dress silhouettes, jackets — and lets them pick styles, choose colours and continue to outfits, design, shopping or try-on. Complete outfits are secondary and link to Outfit Categories. Replaces the current use of the "Discover My Style" label for the profile editor, which moves to My Profile (resolves [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #9).

| ID | Requirement |
|---|---|
| FR-DMS-01 | **First view.** A personalised heading, a short introduction and the user's available body-shape, measurement and fit information (or what is missing), then **Recommended for you**. A user with an incomplete profile sees general recommendations and an optional link to the relevant My Profile section; nothing blocks access. |
| FR-DMS-02 | **Sections** (expandable to keep the page manageable): My Style Overview, Recommended for You, Necklines, Sleeves, Tops and Top Lengths, Trousers and Bottom Wear, Dresses and Silhouettes, Jackets and Layers, Skirts and Other Garments, Complete Outfits, Saved Styles. |
| FR-DMS-03 | **Navigation path:** Discover My Style → category (e.g. Tops) → attribute (e.g. Necklines) → illustrated styles (V-neck, scoop, square …) → style details → choose colour → design, outfit or shopping options. |
| FR-DMS-04 | **Inputs, in ranking priority (D-114):** (1) the user's requested garment and styling goal; (2) relevant proportions and measurements — measurements take precedence when sufficient, photo estimates are treated cautiously; (3) preferred fit and comfort; (4) preferred styles and department; (5) occasion and other preferences. Body shape is one factor, never the only one. Weights are configurable in one place, not hard-coded per feature. |
| FR-DMS-05 | **Engine.** Structured, explainable rules first (catalogue styles × suitability rules, D-110 … D-112); no external AI in core suitability. Equally suitable styles are diversified and recently shown ones are not repeated when alternatives exist. |
| FR-DMS-06 | **Style card:** editorial croquis sketch, style name, garment category, suitability or goal tags, a short explanation ("a V-neck creates a longer vertical line"), **View details** and **Save**. Contextual actions live on the detail view, not the card. |
| FR-DMS-07 | **Style detail:** enlarged illustration with available angles, description, proportion and fit guidance, suitable lengths or cuts, benefits and trade-offs, related **similar and contrasting** styles, and the actions in FR-DMS-12. |
| FR-DMS-08 | **No close match:** say so, name the limiting criterion and show clearly labelled related styles or general recommendations; never present an unsuitable style as a match. |
| FR-DMS-09 | **Filters** (optional, never mandatory): clothing category, attribute, body shape or proportion, fit, fashion style, department, Indian / fusion / western, and occasion or colour where relevant. Clear all and per-filter removal. Filters are temporary (D-126). |
| FR-DMS-10 | **Combine selections.** Users can select several styles (e.g. V-neck + three-quarter sleeves + hip length) as a combined preference for an outfit or design. Recommendations are labelled "Suggested for you"; selections "Your choice". Selecting never changes the profile. |
| FR-DMS-11 | **Colour step (separate from choosing a style):** use a colour from My Colour Palette (saved or personalised palettes are offered first), pick any colour with a colour picker, or keep the sketch's original colours. Only illustrations with colourisable layers are recoloured; a line-only sketch keeps its lines and shows the colour as a swatch beside it — never a pretend recolour. Without skin tone or undertone, general palettes and free choice are offered, with an optional My Profile link; photo analysis is never forced. Colour choices stay with the current session unless the user saves a design, outfit or preference. |
| FR-DMS-12 | **Hand-offs from a style (FR-CONN):** Explore Complete Outfits (Outfit Categories with the style as a filter), Customize in Design Studio (style ID, category, compatible attributes, colour; nothing invented), Shop This Style (Shop My Look with category, attributes and colour), Try On (only for eligible complete designs or products, D-119), Save. Each appears only when the destination supports it. |
| FR-DMS-13 | **Saved styles** are references to catalogue records with any explicitly saved customisation; they reopen with the latest catalogue data and the same actions. Retired styles stay readable from their snapshot with a clear notice. |
| FR-DMS-14 | **Feedback:** Like, Not for me (optional reason: fit, comfort, style, occasion), Explore alternatives; undo; never a permanent ban (D-115). |
| FR-DMS-15 | **Profile changes** refresh dependent recommendations; saved items and previous selections are untouched. Opening the page never starts photo analysis; only existing, consented and confirmed results are used. |
| FR-DMS-16 | **State and return.** Selections survive moving to a connected feature and back; every hand-off has a return path to the originating card or category. |
| FR-DMS-17 | **Complete:** users can browse the catalogue with correct illustrations, get rule-based explainable recommendations, filter, open details, save, choose colours and use every supported hand-off; anything unfinished is labelled. |

### 4.18 My Colour Palette (FR-PAL-04 … 30) — Stage 1 (D-109)

Extends FR-PAL-01 … 03. Palettes are ordered **by skin tone and undertone suitability first** (the founder's "most important" categorisation), then the other factors.

| ID | Requirement |
|---|---|
| FR-PAL-04 | **Order of the page:** a very short colour-analysis introduction → header with title, personalised greeting, profile-based explanation and a featured palette → **Recommended for You** → **Explore All Palettes** → **My Saved Palettes** → **Colour theory and learning**. |
| FR-PAL-05 | **Layout:** large featured cards plus smaller grid cards; 12 – 20 cards initially, then Load more; responsive desktop, tablet and mobile. |
| FR-PAL-06 | **Ranking inputs:** skin tone, undertone, appearance suitability, colour harmony, favourite colours, colours to avoid, personal style and clothing preferences, occasion and garment category, explicit likes, dislikes and saved palettes (D-115), seasonal or cultural context. Skin tone and undertone come from saved profile data (photo analysis or manual selection); neither is ever forced. |
| FR-PAL-07 | **Missing tone or undertone:** general palettes, a clear "general, not personalised" label and an optional profile-completion prompt. Results always say whether they use profile details, preferences or general colour harmony. |
| FR-PAL-08 | **Uncertain analysis:** when a skin-tone or undertone result is uncertain, say so and let the user correct it manually (My Profile). |
| FR-PAL-09 | **Explanation:** a very short "why this suits you" from the available profile details and harmony; flexible guidance that also invites personal choice, never a strict rule. |
| FR-PAL-10 | **Corrections:** like, dislike, exclude colours (an explicit update to the profile's avoided colours), request alternatives, and optional "not suitable" feedback (too bright, not my style, I dislike these colours). Removing exclusions and editing preferences refreshes recommendations. |
| FR-PAL-11 | **Catalogue:** 100 – 150 curated, quality-checked palettes (D-57), expandable; plus rule-based personalised combinations derived from approved palettes and the user's undertone and tone. Colour families: neutrals; reds, pinks and maroons; oranges, yellows and golds; greens incl. olive and emerald; blues incl. navy and teal; purples, violets and lilacs; pastels and muted; bright and saturated; earthy; metallic-inspired; traditional and festive; monochrome and tonal; colour-blocking and high-contrast. |
| FR-PAL-12 | **Categories:** skin tone and undertone suitability (first), colour family, warm / cool / neutral, seasonal colour analysis, Indian festive and cultural, office and professional, wedding and celebration, casual and everyday, minimal / elegant / bold / experimental, and monochrome, complementary, analogous, triadic harmony. |
| FR-PAL-13 | **Colour details:** each colour has a name, HEX code, swatch and role (primary, secondary, accent, neutral). |
| FR-PAL-14 | **Card:** name, swatches, a very short description, a very short suitability line when personalised, category tags, save control, preview button. |
| FR-PAL-15 | **Search** over names, colour names, categories and descriptive tags. **Filters:** colour family, warm/cool/neutral, occasion, personal style, skin tone and undertone suitability, saved, recently added. Filters combine, active ones are shown, Clear all resets; recent filters are remembered per device with an easy reset (D-126). |
| FR-PAL-16 | **No results:** explain and offer Clear filters or similar palettes. |
| FR-PAL-17 | **Detail page or panel:** large preview; names and HEX codes; roles; personalised suitability explanation; suggested garment combinations with colour placement; Indian, fusion and western outfit examples; occasion suggestions; Save; Customize. |
| FR-PAL-18 | **Swatch selection** shows the name and HEX code with a copy button; one or several swatches can be selected for "Shop this colour" / "Shop selected colours" (FR-CONN). |
| FR-PAL-19 | **Saving:** save and unsave curated palettes; unsaving removes only the user's saved reference, never the shared palette. Saved palettes can be organised in collections with optional custom names (shared with Saved Outfits collections, D-116). Saved palettes appear only in My Colour Palette (D-117 = a). |
| FR-PAL-20 | **Customise:** replace, add, remove and reorder colours; rename; save as a **separate personal copy** — the curated original is preserved (`customPalettes`). |
| FR-PAL-21 | **Create from scratch** with a colour picker or HEX codes (2 – 12 colours, each with a role). |
| FR-PAL-22 | **No sharing** (D-118). Copying HEX codes is supported. |
| FR-PAL-23 | **Imagery:** swatches plus relevant, licensed, high-quality fashion imagery (D-113). |
| FR-PAL-24 | **Cross-feature actions:** Explore outfits in these colours (Outfit Categories), Use in Design Studio (when available), Shop this palette / colour (Shop My Look), View saved outfits. Choosing a palette for a specific garment happens only inside Design Studio (Q54). |
| FR-PAL-25 | **Cultural use:** Indian festive and cultural combinations alongside fusion and western ones, never restricted by gender or culture. |
| FR-PAL-26 | **Profile updates** refresh relevant recommendations; changing colour preferences, removing exclusions and refreshing are always possible. |
| FR-PAL-27 | **Storage:** a shared palette catalogue (`palettes`) and separate user data — saved palette IDs (`savedItems`), custom palettes, collections and explicit feedback (`userFeedback`). |
| FR-PAL-28 | **Generation:** deterministic colour-theory rules and curated data; optional AI only if separately approved. |
| FR-PAL-29 | **Load failure:** clear error and Retry; cached catalogue data is used only when valid and known to be current. |
| FR-PAL-30 | **First release:** curated catalogue, profile-based matching, filters, palette details, saving and basic customisation. |

### 4.19 Outfit Categories and the shared style catalogue (FR-OCAT) — Stage 1 (D-109 … D-114)

Clothing education, visual examples and personalised recommendations: **which necklines, sleeves, lengths, trouser cuts and silhouettes suit this body and these goals**, organised by category, for women and men. Discover My Style and Outfit Categories share one catalogue: Outfit Categories is category-first browsing (and complete outfits by occasion, garment category and style); Discover My Style is the personal "my style" view across attributes (FR-DMS).

**Catalogue (shared, D-110 … D-113).**

| ID | Requirement |
|---|---|
| FR-OCAT-01 | **Hierarchy:** Women / Men → clothing group → category → subcategory → garment attribute → style, with body-shape suitability as **separate rules linked to styles** (one style serves many shapes; never duplicated per shape). Groups: tops (shirts, T-shirts, blouses, kurtas …), bottoms (jeans, trousers, skirts, shorts …), dresses and one-pieces, Indian ethnic (sarees, salwar suits, lehengas …), fusion and Indo-western, outerwear and layering (jackets, coats, shrugs …), traditional menswear (kurtas, sherwanis …), complete outfits and co-ord sets, sleepwear and loungewear. |
| FR-OCAT-02 | **Attributes catalogued.** Tops: neckline, collar, sleeve length and design, shoulder, top length and hem, fit and silhouette, fabric and drape. Bottoms: rise, waistband and fit, leg shape, pant/jean length and hem, skirt shapes and lengths, shorts lengths, fabric and drape. Dresses, ethnic wear and complete outfits: silhouette and cut, length and proportions, neckline, sleeves and waist placement, traditional variations, layering and dupatta/drape, fabric and structure, occasion. Category-specific attributes only where relevant. |
| FR-OCAT-03 | **Style record:** stable ID, name, description, category, structured attributes, illustration references with rights, suitability-rule references, goals, occasions and preferences, related and alternative styles, try-on support, optional links to authorised products (matched by attributes, never hand-attached fakes), status and version. |
| FR-OCAT-04 | **Suitability rules:** reusable, structured, linked to garment attributes and user factors (body shape, proportions, goals, fit, comfort, coverage); deterministic with explainable rule IDs and reasons; tailored per garment category. Conflicts resolve by garment attributes, explicit user preferences, comfort and safety. Validated in CI and tested against representative profile scenarios; significant changes need human (founder) review (D-62). |
| FR-OCAT-05 | **Illustrations (D-113):** a mix of editorial croquis and technical flats; both garment-only drawings and clothed figures; neckline and collar, sleeve and shoulder, lengths, waist and rise, leg shape, silhouette, drape and layering, subtle proportion guide lines, front and back where relevant; detail level depends on the garment and the question. Reusable base figures per body shape and proportion; extra views only where they explain suitability. Enlarged view with extra angles. Every figure is clothed — by default in a plain white shirt and plain white pants. |
| FR-OCAT-06 | **Rights:** each asset records source, licence or permission, attribution and allowed usage; assets without confirmed rights are never published (enforced in the database). Curated photos are supplementary. |
| FR-OCAT-07 | **Growth:** new categories, attributes, illustrations and rules are added as data without duplicating records; a meaningful, validated starting selection for women and men first, men's to the same depth as women's next (D-111); never filled with unverified recommendations. |

**Body information and personalisation.**

| ID | Requirement |
|---|---|
| FR-OCAT-08 | **Body shapes (D-112):** women — hourglass, pear (triangle), inverted triangle, rectangle, apple (oval); men — rectangle, triangle, inverted triangle, oval; "Not sure" is always available and no label is forced. |
| FR-OCAT-09 | **Sources** (from My Profile, never asked again here): manual selection, measurements where available, and optional photo analysis (D-103; full-body photos may use Gemini under D-122, after the privacy review). Photo estimate and manual choice may disagree: the estimate is shown, the user corrects it, and the confirmed value is used. |
| FR-OCAT-10 | **Proportions considered, only where relevant to the garment:** shoulders vs hips, bust/chest vs waist, hips and thighs, torso-to-leg, height and vertical proportions, arm and leg lengths, overall balance and fit. |
| FR-OCAT-11 | **Styling goals** (selectable, stored in the profile): taller-looking silhouette, more balanced silhouette, define the waist, add or reduce emphasis on selected areas, longer torso or leg line, add structure or volume, relaxed and less body-defining, highlight features I like, no body-related goal. |
| FR-OCAT-12 | **Comfort and fit:** preferred fit, coverage and modesty, mobility and comfort are included in ranking and filters. |
| FR-OCAT-13 | **Ranking:** body shape, proportions, goals, fit and comfort, preferences, garment attributes. **Recommended for you shows only suitable styles (D-114);** when none meets every requirement, say which criteria would need to change, then offer the closest suitable alternatives. |
| FR-OCAT-14 | **Explanations:** benefits and trade-offs, short with optional deeper details; no restrictions; the user decides. |
| FR-OCAT-15 | **Without a profile:** general popular styles and an invitation to personalise; what is missing and the next step are explained. |
| FR-OCAT-16 | **Personalisation controls:** goals, fit, comfort and coverage, preferred lengths and silhouettes, modesty, preferred and avoided styles, occasion and dress code — all adjustable through filters; editable preferences, pause and reset personalisation, and general browsing (D-115). |
| FR-OCAT-17 | **Feedback:** like / dislike with reasons (fit, style, comfort, preference); users control whether feedback affects future recommendations; saved styles are one signal among others. |

**Screens.**

| ID | Requirement |
|---|---|
| FR-OCAT-18 | **Access** from the top navigation; login required. **Order:** personalised overview → 3 – 5 recommended styles → category tiles → searchable, filterable styles → dedicated style detail pages. Women and Men sections; personalised first, then "Explore all styles". |
| FR-OCAT-19 | **Recommendation card:** illustration, style name, why it may suit the selected goals, key attributes (neckline, length, fit), Save to Saved Outfits, Explore details — without overcrowding. |
| FR-OCAT-20 | **Browse:** visual category tiles, expandable navigation, search; progressive loading of large lists. **Filters:** category and subcategory, styling goal, fit and comfort, occasion and dress code, fabric and season, price range only for shopping-linked items — varying by category; applied **within** the suitable set for the recommended view. Reset / Clear all. |
| FR-OCAT-21 | **Natural-language search** ("tops that make my legs look longer"), D-123. |
| FR-OCAT-22 | **Sort:** best personalised match, category/name, recently added, most saved, and relevant attributes such as length or fit. |
| FR-OCAT-23 | **Compare** two or more styles side by side. |
| FR-OCAT-24 | **Style detail:** name, category and description; illustrations and angles; attributes; why it may suit the user's goals; trade-offs and styling tips; fit, comfort and coverage; related suitable styles. |
| FR-OCAT-25 | **Connections (FR-CONN):** My Profile (update the relevant inputs); My Colour Palette (palette-based colour suggestions where relevant, never required); Shop My Look ("Shop similar items", verified products only, otherwise inspiration only); Virtual Try-On (availability explained, alternative offered); Design Studio ("Customize in Design Studio" when supported); Style Assistant (ask about the garment or explanation, when available); Saved Outfits (save and remove). |
| FR-OCAT-26 | **Complete when** the main journeys work end to end, recommendations are explainable, essential tests pass and known limitations are documented. **First release:** representative categories, structured style records, rules-based recommendations, detail pages, search and filters, saved styles; catalogue and integrations expand after the core works. |

### 4.20 Shop My Look (FR-SHOP) — Stage 1 UI; real products with the product layer (D-124)

Real clothing that matches the selected outfit, style, proportions, fit, occasion and budget — **only from authorised sources** (D-43 … D-45). Until a source is authorised, Shop My Look offers the user's own shortlist (FR-LIST) and styling alternatives and says that live shopping results are unavailable. The FR-PROD, FR-MATCH, FR-BUD and FR-QUAL requirements apply unchanged.

| ID | Requirement |
|---|---|
| FR-SHOP-01 | **Entry:** directly (general discovery with search, filters, categories and personalised suggestions when a profile exists — no profile needed) or from Discover My Style, Outfit Categories, My Colour Palette, Design Studio, Saved Outfits and Style Assistant with their context applied (FR-CONN). A clear choice between **shop a complete look** and **shop one garment**. Everyone is served: women's, men's, Indian, western and fusion. |
| FR-SHOP-02 | **Product data:** authorised APIs, approved affiliate feeds or permitted curation only; never scraped. Each product stores name, brand, category, images, verified price, sizes, colours, fit, fabric when available, seller, URL, source and last verification time; variants (colour, size) are grouped where the source supports it, and the chosen variant maps to the correct link and price ([DATABASE.md](DATABASE.md) §4.2). Products and outfit templates are separate catalogues connected by attributes. |
| FR-SHOP-03 | **Ranking:** suitability, size availability, quality evidence, fit and comfort, occasion, colour preferences, budget; commission never overrides suitability (D-46). Structured rules, no external AI in core matching. A concise "why recommended" names only attributes the product data verifies. |
| FR-SHOP-04 | **Filters:** category, occasion, budget, size, colour, style, fit; inherited filters are visible and removable; Reset and per-filter removal; conflicting filters are never silently ignored. Keyword search over product and brand; sort by best match (default) or price; pagination or Load more; filters preserved when opening a product and returning; desktop sidebar or bar, mobile drawer. |
| FR-SHOP-05 | **Sizes** are per category (tops, trousers, dresses, footwear …) from My Profile; unavailable sizes and out-of-stock items are excluded by default and labelled when the user chooses to see them; duplicates removed by source ID, URL and variant. |
| FR-SHOP-06 | **Card:** image, name, brand, verified price, verified sizes, key attributes, retailer link. **Detail:** larger image, verified details, price, sizes, seller, fit information, retailer link. **Compare:** price, size availability, colour, fit, fabric and other available attributes. Real authorised photographs only; croquis sketches are never presented as products. |
| FR-SHOP-07 | **Alternatives:** 3 – 5 when enough eligible products exist; never padded (D-53). No exact match → say so and show the closest verified alternatives, labelled as alternatives, with the original filters kept. |
| FR-SHOP-08 | **Outfit assembly:** tops, bottoms, one-pieces, footwear, accessories and outerwear where appropriate; tops + bottoms or a dress as the core, the rest optional; replace one item without changing the others; user overrides allowed. |
| FR-SHOP-09 | **Budget:** a budget per outfit and per garment; the total is the sum of current verified prices in ₹; shipping and taxes shown separately when known, otherwise stated as unknown or excluded; incomplete totals labelled "partial estimate". Over budget → highlight the excess and suggest lower-cost substitutions; changing the budget recalculates immediately and never replaces items without approval. |
| FR-SHOP-10 | **Temporary selection** persists while browsing within the session, with a Clear selection action; it becomes a saved look only when the user saves it (no cross-session draft unless a draft feature is added). |
| FR-SHOP-11 | **Saving:** individual products and complete looks go to Saved Outfits with product references, variant, size, source context (palette, design, outfit), save date and a price snapshot — always shown as historical, refreshed when the source allows. |
| FR-SHOP-12 | **Purchase:** open the retailer's authorised product page; StyleMe never claims checkout. Links are validated where possible; broken links show a clear message; affiliate disclosures where applicable (D-46). |
| FR-SHOP-13 | **Freshness and failures:** cached data only when its age is known and labelled; products with missing critical data hidden or flagged; never invent prices, sizes, availability or links. |
| FR-SHOP-14 | **Feedback and reports:** "Not interested" with optional reason (style, colour, fit, price), never required; "Report an issue" (broken link, wrong price, wrong image, unavailable size) recorded for authorised review — verified data is never changed by an unverified report. |
| FR-SHOP-15 | **Colour matching:** verified product colours closest to the selected colour or palette; exact matches distinguished from similar colours; users can broaden or remove the colour filter. Multiple selected palette colours → a coordinated outfit attempt; missing pieces are named. |
| FR-SHOP-16 | **Design-based search:** "Shop similar products" / "Shop this design" search by the design's attributes and never imply a custom design is sold as an exact product; changing a major design attribute offers to refresh results. Image-based search is a planned enhancement only. |
| FR-SHOP-17 | **Privacy:** saved products and looks are private; product IDs validated on the server; only authorised processes change catalogue data; no personal photos to external AI. |
| FR-SHOP-18 | **Complete when** users can browse, search, filter and sort eligible products; see verified details and valid links; build an outfit with a calculated total; replace one item; see budget warnings and honest no-result messages; save, reopen and delete products or looks; see unavailable products and historical prices labelled; use desktop and mobile; and access only their own data. A UI alone is not completion. **Scope order:** must — browsing, authorised data, core filters, rule-based matching, price and budget, basic assembly, saving, valid links; if time permits — keyword search, sorting, variant grouping, feedback; deferred — analytics, price-change notifications, advanced learning, full catalogue-management dashboard. |

### 4.21 Virtual Try-On, 2D illustrative (FR-VTO) — Stage 1 (D-119)

A polished, **illustrative** 2D outfit preview built from reusable SVG illustrations. Not photo-based, not realistic fit or drape. FR-TRY (photo or generative try-on) stays future (D-48).

| ID | Requirement |
|---|---|
| FR-VTO-01 | **Rendering:** SVG layers in the browser; reusable, locally stored 2D model and garment illustrations; no AI generation and no external AI. |
| FR-VTO-02 | **First view:** a clothed default model in a plain white shirt and plain white pants and a **Start Styling** action; label "Illustrative 2D preview — not an exact representation of fit, drape or appearance". |
| FR-VTO-03 | **Layout:** large central preview; garment controls on one side; selected items below or beside; tabs Tops, Bottoms, Dresses, Outerwear, Accessories — only categories supported by the selected model and catalogue. |
| FR-VTO-04 | **Models:** a small set of clothed 2D model illustrations with supported body-shape variants and skin-tone shades; the profile's body shape and measurements pick an appropriate variant without claiming a body replica; no photo upload or camera access. |
| FR-VTO-05 | **Garments:** illustrated garment cards; selecting one updates the preview immediately; each selected garment has Change and Remove; garments are the shared catalogue styles with try-on layers (one definition, D-110). |
| FR-VTO-06 | **Compatibility:** garment metadata and rules decide combinations (a top with trousers or a skirt; a dress replaces top and bottom); fixed layer order (body, inner, tops, bottoms, outerwear, accessories) with garment-specific exceptions; incompatible choices are disabled or replace the conflicting item after asking; a garment without a compatible model variant is shown as unavailable for this preview — never a broken render. |
| FR-VTO-07 | **Colour:** recolour compatible layers programmatically with a colour from My Colour Palette or any supported colour; garments that cannot be recoloured show only their supported colours. Colour is optional. |
| FR-VTO-08 | **Controls:** zoom, reset view, change garment, change colour, back to the default model, Undo for recent changes, Reset outfit; rotation only if alternate-view assets exist; optional "Suggest a look" from real compatible catalogue items and preferences; optional occasion and style filters; basic search. |
| FR-VTO-09 | **Summary:** selected garments, colours and style details in a compact panel; compare by saving several looks and switching (side by side if it fits). |
| FR-VTO-10 | **Entry points:** "Try this outfit" from Discover My Style, Outfit Categories, Design Studio (compatible saved designs only; an uploaded sketch is not automatically a wearable layer) and Shop My Look (only products with authorised, compatible images — never all products). Budget appears only when coming from shopping. Contextual actions: Explore more outfits, Edit in Design Studio, View saved outfits, Back to shopping. |
| FR-VTO-11 | **Saving:** Save stores the configuration (model variant, garment IDs, colours, settings) as a `tryon_look` saved item with an optional name (default name otherwise); reopening recreates it; a removed garment shows an unavailable notice, never a substitute. Save failure keeps the preview and offers Retry. |
| FR-VTO-12 | **Download preview** only if reliable image export works; no sharing; no shareable URLs until routing and access control exist. |
| FR-VTO-13 | **Products vs illustrations:** illustration-only items are labelled; a verified product shows price, size and availability only from fresh authorised data, otherwise links to its source without invented details. |
| FR-VTO-14 | **Failures:** empty or failed catalogue → helpful error, Retry, fallback illustrations; incomplete profile → default model plus an optional My Profile link. Session state is kept while navigating; only saved looks persist across sessions. |
| FR-VTO-15 | **Order of work:** responsive page, default model, garment selection, layering, recolouring, reset → model variants, palette integration, connections, saving. Postponed: photo-based try-on, fabric physics, 3D, automatic sketch-to-garment, AI generation. **Done when** a user can select a model, combine supported garments, change colours, correct selections, reset, and save and reopen the same configuration without broken layers or lost settings. |

### 4.22 Saved Outfits (FR-SAVE) — Stage 1 (D-116)

A personal, private collection of styles, outfits, designs, shopping looks, products and try-on looks. Saved palettes use the same save system but appear only in My Colour Palette (D-117 = a). One shared save system serves every feature. Saved Outfits manages the collection; it does not generate recommendations, manage prices or produce try-on images (Q89 – Q92).

| ID | Requirement |
|---|---|
| FR-SAVE-01 | **Item types:** complete outfits (Discover My Style, Outfit Categories), individual styles and garments, custom designs (Design Studio, when available), product-based looks and products (Shop My Look), try-on looks (D-119), palettes (identified as palettes, never treated as outfits). Saving needs no completed profile, photos or measurements. |
| FR-SAVE-02 | **Header:** title "Saved Outfits", "Your personal collection of looks and designs.", search, collection selector, sort; uncluttered. Count of saved items ("12 saved looks"), updated after every change. |
| FR-SAVE-03 | **Sections:** All Saved, Outfits (complete outfits and individual garments) and My Designs. There is no Palettes section, and All Saved excludes palette items (D-117 = a). Shopping looks and try-on looks are item-type filters, not extra tabs. |
| FR-SAVE-04 | **Cards:** responsive gallery (two columns on mobile when space allows, one on narrow screens); the source's best visual — croquis for catalogue items, saved design preview, authorised product images for shopping looks, the try-on configuration rendered for try-on looks — never generic stock; name, type label where not obvious (Custom design, Shopping look, Try-on look, Outfit template), occasion when known, a few actions. Hover may reveal extras, but every essential action works by keyboard, touch and screen reader. |
| FR-SAVE-05 | **Saving from any feature:** one bookmark/heart control on eligible cards and details; brief confirmation; optional naming (useful default such as "Casual College Look"); save to the default collection or optionally pick or create one — no forced dialog. Duplicate saves are detected and shown as "Already saved"; an intentional customised variation is a separate item. The control toggles, and unsaving anywhere updates every indicator. Not signed in → sign in first. An item shows as saved only after the server confirms; failures keep the screen and offer Retry. |
| FR-SAVE-06 | **Organisation:** named collections (College, Office, Wedding ideas …) with mixed types; an item can be in several collections without duplication; Favourites is a status, and favouriting an unsaved item saves it first; occasion filtering from metadata without moving items into user collections. Rename keeps items; deleting a collection asks whether to keep the items in All Saved. Basic bulk move and remove. No manual drag-and-drop ordering initially. |
| FR-SAVE-07 | **Search** names, collection names and labels; **filters** item type, occasion, clothing category, style, colour, collection (only those that apply to the section); **sort** recently saved (default), recently updated, name A–Z. Returning from a detail view preserves search, filters, sort and collection. |
| FR-SAVE-08 | **Detail view** (the default when a card is opened — never jumps to another feature): image or illustration with zoom where resolution allows; name and source; components; colours and patterns; occasion and style; fit or silhouette notes; the original "why it was recommended" when available; saved and updated dates — only data that exists. |
| FR-SAVE-09 | **Editing:** rename, notes ("Wear with white sneakers"), choose a cover from the item's own images, replace one component where the source supports it, change colours through the customisation flow; **Save as New Look** by default, explicit "Update this item" separately; Duplicate. |
| FR-SAVE-10 | **Actions to other features** (only when supported): Customize (Design Studio), Shop / Shop similar / revisit retailer links (Shop My Look), Try on (D-119), Find similar looks and Build an outfit from a saved garment (Discover My Style or Outfit Categories), Ask Style Assistant (when available), Open design. A saved item derived from a palette or design keeps that reference so the inspiration reopens. |
| FR-SAVE-11 | **Changes elsewhere:** a profile change never alters saved items (an optional "find an updated recommendation" is offered); a changed shared template may be offered as "latest version" but never overwrites the saved one; a retired or deleted source stays readable from its permitted snapshot with a consistent placeholder for missing media; a discontinued product or broken link is marked unavailable or unverified with alternatives where verified data exists; current prices are refreshed when possible and old prices are labelled historical. |
| FR-SAVE-12 | **Feedback and suggestions:** saving is a soft preference signal (D-115); "Not for me" on a saved item never deletes it; a small "You may also like" on the detail view uses the shared recommendation logic. |
| FR-SAVE-13 | **Removal:** unsave with a brief Undo; deleting a collection or a separately stored design asks for confirmation; removing a saved item never deletes the shared catalogue record or the design itself. |
| FR-SAVE-14 | **Empty and error states:** first-time empty state with an illustration and **Discover outfits** (opens Discover My Style or Outfit Categories, which work without a profile); "no saved items match" with Clear filters; card skeletons; a failed load shows Retry and never an empty collection. No offline sync. |
| FR-SAVE-15 | **Data:** owner-only access enforced by the API; items persist across sessions and devices; validation of item types, names, collection references and customisations; paginated loading. Personal previews only under the photo consent and retention rules (none exist for the 2D try-on). Account deletion removes saved items and collections; password changes never touch them. |
| FR-SAVE-16 | **Deferred:** social sharing, collaborative collections, drag-and-drop ordering, outfit scheduling, advanced analytics, offline sync, full export (data stays structured for a later export). |
| FR-SAVE-17 | **Accessibility and feedback:** descriptive alt text for every image, labelled buttons, concise confirmations for save, rename, move, duplicate and remove (no disruptive pop-ups). |
| FR-SAVE-18 | **Ready for the closed beta when** items save from their source features, persist across sessions, can be viewed, searched, filtered, sorted and organised, reopen with the right details, customising never overwrites the original, removing never deletes shared sources, product data is never falsely current, collections are isolated per account, failures are honest, and the page is responsive and consistent. |

### 4.23 Admin Panel (FR-ADM) — Stage 1 (D-120)

A professional, moderate admin panel to manage content, users and the catalogue and to troubleshoot, **without unnecessary access to private data**. Same MongoDB database (`styleme`), existing API, existing authentication.

| ID | Requirement |
|---|---|
| FR-ADM-01 | **Access:** a protected `/admin` area in the existing web app calling `/v1/admin/*`; never direct database access from the browser. Requires an authenticated account with `role: admin` **and** an active `adminAccounts` record; every route checks the permission on the server (`ADMIN_ROLE_PERMISSIONS`). Admin registration is never public; the first Super Admin is provisioned securely (D-95 seed). Disabling an admin or changing a role takes effect on the next request. MFA: D-121. |
| FR-ADM-02 | **Roles:** **Super Admin** — everything permitted below. **Content Admin** (designed, not provisioned yet) — catalogue drafts, publishing of founder-approved records, authorised product records, aggregate statistics and non-sensitive errors; never admin accounts, security settings, user accounts, audit logs, private photos or styling approval. |
| FR-ADM-03 | **Dashboard:** total and new registrations, active users over a period, counts of styles, categories, palettes, templates and products, Discover My Style and Shop My Look usage, try-on usage and unsupported combinations (D-128), pending attention items (drafts awaiting approval, assets without verified rights, missing illustrations, invalid or conflicting rules, empty-result rates, failed imports, open product reports). Aggregates only, with simple date filters and basic trends; groups under 10 shown as "fewer than 10" (D-125). No individual age or profile data. |
| FR-ADM-04 | **Fashion Catalogue:** create, edit, preview, publish, unpublish and archive categories, subcategories, attributes, clothing styles, suitability rules, outfit templates and illustrations; arrange the hierarchy; validate references and rules (linter) before publishing; archive rather than delete records still referenced; simple bulk publish or archive with confirmation and per-record validation. Styling content is published only after the founder's approval is recorded (D-62); assets only with verified rights (D-113). Tags and attributes can be managed; matching algorithms, model parameters and schemas cannot. |
| FR-ADM-05 | **Colour Palettes:** swatches, colour names, HEX codes, roles, metadata, suitability tags, categories and status, with the same approval and archive rules. |
| FR-ADM-06 | **Users (Super Admin):** search by name, email or user ID; view account status, registration date and identifiers only; suspend and reactivate (enforced by the API: sessions revoked, `isActive` false); start the existing deletion workflow where authorised. Never view or reset passwords (users use self-service reset), never see measurements, full profiles, preferences, photos or try-on images, never bulk-export personal data or bulk-delete users. |
| FR-ADM-07 | **Shop Products:** add and edit authorised product records only; verified prices, sizes, images and links with last-verified times; mark unavailable or archive; inspect import failures, stale data and broken links; review product reports. No scraping, no invented prices or sizes. |
| FR-ADM-08 | **Try-On Monitoring:** aggregate try-on usage, saves and unsupported combinations; catalogue coverage of try-on layers and model variants; no user images exist to view (D-128). |
| FR-ADM-09 | **Admin Activity (Super Admin):** searchable audit log of suspensions, catalogue edits, approvals, publishing, archiving, deletions and permission changes — who, what (sanitised field changes), when, success or failure, request ID. No passwords, tokens, photos or sensitive profile values. Retained 1 year. |
| FR-ADM-10 | **Safety:** server-side validation, pagination, filters and request limits; confirmation before sensitive changes; no role escalation; safe errors; transactions where multi-document consistency needs them; soft archival and backups for recovery. No settings console, environment variables, credentials or shell access in the UI. No admin notifications initially; clear success and error messages instead. |
| FR-ADM-11 | **Design:** StyleMe's identity — refined typography, clean spacing, neutral backgrounds, restrained accents, responsive sidebar — practical and distinct from the user-facing experience; desktop-first for editing, with monitoring and account actions usable on mobile. |
| FR-ADM-12 | **Out of scope:** approval hierarchies, departments, report builders, predictive analytics, direct database or server access, access to private photos and measurements, individual age groups, payments or commissions, retailer integrations without authorisation, AI training controls, a system-settings console. |

### 4.24 Cross-feature connections and navigation (FR-CONN) — Stage 1 (D-127)

| ID | Requirement |
|---|---|
| FR-CONN-01 | **Stable IDs only.** Features hand each other style (`CST-…`), palette (`PAL-…` or custom palette ID), colour HEX, template (`OUT-…`), look, saved-item, design and product IDs plus relevant settings through documented URL parameters — never duplicated records or display names. Each feature fetches the data from its owner. |
| FR-CONN-02 | **Ownership:** My Profile — style, sizes and preferences; My Colour Palette — personal and curated palettes; Outfit Categories — garment suitability guidance; Discover My Style — outfit inspiration and style selections; Design Studio — custom designs; Shop My Look — authorised products and shopping filters; Virtual Try-On — previews; Style Assistant — conversation context; Saved Outfits — saved products, outfits and references. Others read through shared data and never keep conflicting versions. |
| FR-CONN-03 | **Precedence:** (1) the user's explicit choice in the current action, (2) current filters, (3) context passed from the originating feature, (4) saved profile preferences, (5) general recommendations. Example: default palette blue, user picks burgundy from My Colour Palette → burgundy wins. |
| FR-CONN-04 | **Inherited context** is visible and editable or removable in the destination (e.g. Shop My Look opened from a burgundy swatch preselects burgundy; from an office outfit keeps the office occasion and attributes). |
| FR-CONN-05 | **Back and return:** Back returns to the originating screen with its results, filters, selections and scroll position; a route to Home is always available; returning to Discover My Style keeps its selections. |
| FR-CONN-06 | **Only working actions:** an action appears only when it makes sense for the item and the destination supports it; otherwise it is hidden or explains the limitation and offers an available alternative. |
| FR-CONN-07 | **Navigation:** the top navigation keeps Home, Discover My Style, My Colour Palette, Outfit Categories, Shop My Look, Virtual Try-On, Design Studio, Style Assistant and Saved Outfits, plus the profile icon and notification bell (D-106); a responsive menu on small screens. Actions open a screen, panel or step inside the relevant feature, never a new main tab. |
| FR-CONN-08 | **Supported journeys (each tested end to end):** palette colour → Shop My Look → product → save look; Outfit Categories → Shop similar items → replace garment; Discover My Style → choose colour → Design Studio (when available); Discover My Style → Explore complete outfits; Discover My Style → Shop this look → Virtual Try-On; saved item → reopen → replace unavailable product → save new version; profile update → refreshed recommendations, saved items unchanged; any feature → Shop My Look → Back → original context; Style Assistant → recommendation → open style (when available). A connection is ready only when it opens the right destination, passes the right data, preserves state, handles unavailable capabilities honestly and passes its end-to-end test. |
| FR-CONN-09 | **Notifications** only for events StyleMe can reliably generate and only once implemented (D-106); never promised price alerts. |

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

All decisions are tracked in the decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-09, D-23, D-46, D-48, D-49, D-50, D-52 … D-55, D-57, D-58, D-60, D-62, D-65, D-63, D-67, D-74, D-76, D-77, D-80, D-82, D-83, D-84, D-86 … D-94, D-102 … D-128.
