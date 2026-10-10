# StyleMe — Security and Privacy

> Part of the StyleMe documentation baseline. Requirements: [FRD.md](FRD.md), [SRS.md](SRS.md) §4. Environments: [DEPLOYMENT.md](DEPLOYMENT.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Authentication

```
Browser → Next.js / Auth.js (session cookie) → Next.js server (BFF) → Express API (access token) → MongoDB
```

- Passwords: at least 8 characters, stored only as argon2id hashes (D-04), never logged.
- On login the API creates a server-side session record (`sessions`, [DATABASE.md](DATABASE.md) §3.1d) and issues a JWT access token (HS256, `AUTH_ACCESS_TOKEN_SECRET`) carrying the user ID, `tokenVersion` and a random session ID (`sid`, ≥ 128 bits). Token and session record both expire 7 days after login (absolute; not extended by activity). The Auth.js session has the same 7-day maximum (D-05).
- **Every API request is checked against the server:** valid signature and expiry, the user exists and `isActive` is `true`, `tokenVersion` matches, and the session record for `sid` exists. A JWT on its own is never enough, so revocation takes effect on the next request.
- The token lives inside the encrypted Auth.js session cookie. The Next.js server forwards it to the API; browser JavaScript never sees it (D-06). Protected pages call the API on render, so a revoked session can't show protected data; when the API answers `UNAUTHENTICATED`, the web app ends the Auth.js session.
- **Logout** (D-07): the Next.js server calls `POST /v1/auth/logout`, which deletes that session's record, so the token stops working everywhere, including any copy of the cookie; then the Auth.js cookie is cleared. If the API call fails, the cookie is still cleared, the failure is logged without the token, and the record expires with its 7-day limit.
- **Revoking all sessions:** password change and password reset delete all of the user's session records and increment `tokenVersion` (D-83); an admin script can do the same after a security event. Setting `isActive: false` blocks login and rejects every token. Account deletion deletes all session records.
- **Session cookie:** `HttpOnly`; `Secure` with the `__Secure-` name prefix in staging and production (HTTPS); `SameSite=Lax`; `Path=/`; no `Domain` attribute (host-only); maximum age 7 days. Locally, over plain HTTP, `Secure` is off.
- **CSRF:** browsers never call the API directly. State-changing actions are `POST`/`PUT`/`DELETE` requests to the Next.js server (route handlers or server actions), which reject requests whose `Origin` doesn't match the environment's web origin; `SameSite=Lax` stops the cookie being sent on cross-site `POST`s; Auth.js's own CSRF token protects sign-in and sign-out. No state change happens on `GET`.
- **Generic responses:** login gives one message for an unknown email, a wrong password and an inactive account. Registration gives one message for an email that isn't invited and an email that is already registered (FR-AUTH-01). Reset requests always get the same response (FR-AUTH-13).

### 1.1 Password change and recovery (D-83)

- **Change:** requires the current password; revokes all existing tokens; the current session gets a new token (FR-AUTH-11), which the Next.js server writes into the encrypted session cookie with an Auth.js session update. The update is accepted only if the API confirms the new token belongs to the same user.
- **Admin-assisted recovery (closed beta):** the admin verifies the request through a channel tied to the account before issuing anything. The script issues a single-use code shown once for out-of-band delivery; the user sets the new password. The admin never sees, sets or chooses a password, and no shared or temporary passwords are used. Each issuance is logged without the code (FR-AUTH-12).
- **Self-service email reset (required before public launch):** generic response to every request; link sent only to an active account; enabled only after the email provider is chosen at HC-2 (FR-AUTH-13, D-84).
- **Tokens:** at least 128 bits from a cryptographically secure generator; stored only as a SHA-256 hash; single-use, marked used atomically so two concurrent redemptions can't both succeed; expire after 60 minutes (admin-issued) or 30 minutes (emailed); issuing a new one invalidates earlier ones.
- **Leak prevention:** the token travels only in request bodies and in the emailed link's URL fragment (`/reset-password#token=…`), which browsers don't send to servers or in `Referer` headers. The reset page removes it from the address bar on load, sends it in a `POST` body, is served with `Referrer-Policy: no-referrer` and `Cache-Control: no-store`, and loads no third-party scripts, fonts, images or analytics. Admin-issued codes are typed into the form, never put in a URL. Tokens never appear in logs (request bodies aren't logged), analytics, error reports or calls to third parties. Reset emails are sent with the provider's link and open tracking turned off (HC-2).
- **On reset:** password re-hashed with argon2id, `tokenVersion` incremented (all sessions and tokens revoked), the user's other tokens deleted; invalid, used or expired tokens get one generic error (FR-AUTH-14).
- **Rate limits:** see §5.
- **Closed beta (D-63):** registration requires an invite on the admin-managed allow-list while `PUBLIC_SIGNUP_ENABLED` is `false`. It stays `false` until every public-launch blocker in [ImplementationPlan.md](ImplementationPlan.md) §11 is met, including D-74 recorded complete.

## 2. Authorization and Data Isolation

- Every protected route runs authentication middleware before validation and the controller.
- Every query on user-owned data (`sessions`, `profiles`, `appearanceProfiles`, `outfits`, `shortlistItems`, and later `designs`, `chatMessages`) is scoped to the authenticated user; ownership is checked in the service layer, not only in the UI. A request for another user's resource returns `NOT_FOUND`.
- Roles: `user` and `admin` (D-73). There is no admin UI. Content, catalogue and retailer changes go through repository pull requests and server-side scripts with their own credentials.
- Shared product, retailer and evidence data are read-only through the API.

## 3. Secrets

| Rule | Detail |
|---|---|
| Server-side only | All keys and tokens are used only by the API, its scripts, and Auth.js server code |
| No `NEXT_PUBLIC_` secrets | Never |
| `.env` ignored | Only `.env.example` (names, no values) is committed |
| Not in images or logs | Secrets are runtime environment variables, never baked into Docker images or written to logs |
| Per environment | Local, staging and production have different secrets and database credentials (D-78) |
| Provisioned when needed | A key is added only when its feature is enabled |

| Secret | Needed when |
|---|---|
| `MONGODB_URI`, `AUTH_ACCESS_TOKEN_SECRET`, `AUTH_SECRET` (Auth.js) | Stage 1. Local values for development; staging and production values only after the hosting checkpoint (D-81) |
| `GEMINI_API_KEY` | Only if optional AI wording is enabled (D-67) |
| `BFF_SHARED_SECRET` | Stage 1, per environment, on both the web app and the API (§5) |
| `TOMBSTONE_STORE_URI`, `TOMBSTONE_HMAC_KEY` | Stage 1, per environment (D-85). Losing the HMAC key prevents matching restored invite records, so it is stored with the other production secrets |
| Email provider key (name depends on the provider) | Only after the email provider is chosen at HC-2 (D-84) |
| `FLIPKART_AFFILIATE_ID`, `FLIPKART_AFFILIATE_TOKEN` | Only after Flipkart approves access (D-44). The Affiliate API documents one active token per account, so rotation must update the environment at the same time |
| `WEATHER_API_KEY` | Stage 2, only if the chosen provider needs a key (D-60) |
| Cloudinary, Groq, Hugging Face keys | Only for deferred or future features that use them |

## 4. Input and Output Validation

- Every request body and query is validated by Zod schemas from `packages/contracts`.
- All AI output is parsed, Zod-validated and business-validated before use. For the optional wording step, invalid output is discarded and the template text is used.
- All text that came from a user or a retailer is escaped when rendered. No retailer HTML is rendered.
- User-entered shortlist URLs: https only, length-limited (D-80), stored unchanged, rendered as plain outbound links with `rel="noopener noreferrer nofollow"`, never fetched, previewed or modified by the server, so StyleMe makes no outbound request to user-supplied addresses.

## 5. Rate Limiting, Headers and Transport

- Rate limits (D-38): login 5/min per IP, register 3/min per IP, logout 30/min per user, account deletion 3/hour per user, recommendations 20/min per user, feedback 60/min per user, shortlist writes 30/min per user, password change 5/hour per user, reset confirm 10/hour per IP, reset request 3/hour per email and 10/hour per IP. Per-IP limits must see the end user's address, but every API request comes from the Next.js server, so the web app sends the user's IP (from the platform's `X-Forwarded-For`) in `x-styleme-client-ip` together with `x-styleme-bff-key` carrying `BFF_SHARED_SECRET`; the API trusts the forwarded IP only when that secret matches, so a direct caller can't spoof it and otherwise gets limited on its own address. They use an in-memory store until Redis is justified. **Limitation:** in-memory limits are per API instance and reset on restart, so they give the stated protection only with a single API instance; they are not distributed protection. If the hosting decision at HC-1 (D-81) uses more than one instance, a shared store is required.
- HTTPS everywhere. Helmet security headers on the API. CORS allows only each environment's web origin (D-37).

## 6. Personal Data and Privacy (D-49)

**Principle:** collect only what a feature uses, keep it only as long as needed, let users delete it, and never send personal photos, measurements or unnecessary personal information to external AI providers (rule 16).

| Data | Purpose | Collected when | Shared with external AI? | Retention and deletion |
|---|---|---|---|---|
| Email, name, password hash | Account | Stage 1 | No | Until account deletion (immediate) |
| Session records (hashed session ID, user ID, timestamps) | Revocable login sessions | Stage 1, at each login | No | Deleted at logout, password change or reset, account deletion, or 7 days after login (TTL) |
| Deletion tombstones | Re-applying account deletions after a restore | When an account is deleted | No | Backup retention + 7 days (37 days while backups are kept the proposed 30), then deleted; separate store, insert-only for the API |
| Password reset tokens | Password recovery | Stage 1, only when a reset is issued or requested | No | Stored as hashes; deleted on use, when superseded, on expiry (≤ 60 minutes) or with the account |
| Invited email addresses | Closed-beta allow-list | Stage 1 | No | Deleted within 30 days after the beta ends, on request, or when the invitee deletes their account |
| Profile preferences, category sizes, fit | Personalised looks | Stage 1 | No (only rule references and attribute tags reach the optional AI step) | Until the user changes them or deletes the account |
| Self-reported appearance signals | Optional palette and styling signals | Stage 1, only if the user provides them | No | Deletable at any time on their own |
| Saved looks, feedback | History, library improvement | Stage 1 | No | Until the user deletes them; unsaved looks expire after 7 days |
| Budget preference | Comparing totals of user-entered prices with the user's budget | Stage 1, optional | No | Until changed or account deletion |
| Shortlist items, links and entered prices | User's own shopping notes; not verified by StyleMe | Stage 1, optional | No | Until the user deletes them or the account |
| Measurements | Product size guidance | Only with product size charts (product layer) | No | Deletable at any time on their own |
| City / rounded location | Weather | Stage 2, only if enabled | No (conditions only) | City deletable; coordinates never stored |
| Personal photos | Photo analysis (D-76), try-on (D-48) | Not collected until approved, and then only with explicit, withdrawable consent | Not unless rule 16 is satisfied (consent alone is not enough) | Deleted after analysis unless the user chooses to keep them; withdrawing consent deletes kept photos and photo-derived estimates. Storage location and retention of kept photos: D-11, decided with photo analysis |
| Product review evidence | Quality transparency | Product layer | Only as delimited data, if ever needed | While the product is active; no reviewer personal data |
| Operational curation notes | Verification audit | Product layer | No | 30–60 days, provisional (D-49) |

- **Deletion:** users delete individual items and their whole account in the app (FR-AUTH-09). Requests made by other routes are handled within 30 days (D-49). Deleted data ages out of backups within the backup retention period (D-79; 30 days proposed). Each account deletion writes a minimal tombstone (internal ID, keyed email hash, timestamps — no plain email or name) to a separate store, so a restored backup can't bring a deleted account back: deletions are replayed and verified before users are served (D-85).
- **Notices:** a plain-language privacy notice at sign-up states each purpose and how to withdraw or delete. Optional data (signals, budget, shortlist items, and later measurements and location) has its own short explanation at the point of collection; the shortlist explanation states that StyleMe stores the user's entries as given and verifies nothing.
- **Logs** never contain passwords, tokens, reset codes, measurements, appearance signals, photos, precise location or full request bodies (D-17).
- **Legal context (not legal advice):** India's Digital Personal Data Protection Rules, 2025 were notified in November 2025 (secondary sources give 13 or 14 November). Rules 1, 2 and 17–21 applied on publication; consent-manager registration (Rule 4) one year after publication; most substantive obligations, including notice and consent (Rule 3), 18 months after publication, around 13–14 May 2027 (as reported by secondary sources checked on 2026-10-10); the exact dates and their applicability to StyleMe are for the legal review (D-74) to confirm against the Gazette text. Source previously cited: [Delhi IT memo](https://it.delhi.gov.in/sites/default/files/IT/generic_multiple_files/dpdp_om.pdf). These safeguards are designed with that in mind. Documentation alone doesn't guarantee compliance: a qualified legal review (D-74) is a dependency for public launch.

## 7. Data Honesty and Test-Data Separation

| Risk | Control |
|---|---|
| Test data shown to real users | Fixtures only in local, CI and staging databases; production refuses to start with fixtures; ingestion rejects them; tests verify it (D-78; [TESTING.md](TESTING.md) T-29, T-30) |
| Staging mistaken for the product | Staging is access-protected and not for real users; it never connects to the production database |
| Fabricated product information | Only verified products are shown as products; missing values are "Not available"; AI never sets prices, availability or quality |
| User entries mistaken for verified data | Every user-entered item, price and total labelled "not verified by StyleMe"; nothing derived from user links; user and verified prices never combined (FR-LIST-02, FR-BUD-02) |
| Illustrations mistaken for products | Labelled "Style illustration — not a product"; licence recorded for every asset (D-65) |

## 8. Retailer Data and Links (product layer)

| Risk | Control |
|---|---|
| Unpermitted data collection | Only permitted source methods (`affiliate_api`, `partner_feed`, permitted `manual_curation`). No scraping or third-party scraping services. Documented rate limits respected |
| Phishing or open redirect through product links | Every product URL must match its retailer's `domains[]`, checked at ingestion and before it is returned. No redirect endpoint |
| Malicious retailer content | Escaped when rendered; passed to AI only as delimited data |
| Licensing | Retailer images shown only as each retailer's terms permit, never copied or AI-processed without explicit permission (D-47). Name and trademark use as confirmed (D-44) |
| Undisclosed or biased affiliate links | Monetisation off; StyleMe adds no tracking; disclosure when a source link carries tracking (D-46); no commission data stored; ranking-neutrality test |
| Leaking user data to retailers | Outbound links use `rel="noopener noreferrer"` (plus `sponsored` when tracked); no user data is sent to retailers |

## 9. Errors and Logging

- Standard error envelope; no stack traces, secrets, database details or internal errors in responses.
- Structured JSON logs to stdout (D-17), with request IDs and no sensitive fields.

## 10. Database Security

- Separate Atlas databases and least-privilege users per environment (D-20, D-78).
- Network access restricted where the hosting platform supports fixed addresses; otherwise documented as a risk with strong credentials.
- Backups per D-79; restore tested in staging before the Stage 1 closed-beta release (S1.7).
- Tombstone store (D-85): outside the main database's restore scope, its own credentials; the API may only insert, and only the restore and reconciliation scripts may read. A restore always goes into an isolated database, with production in maintenance mode, and users are served only after tombstone replay and verification pass.

## 11. Security Checklist (Stage 1 release)

- [ ] HTTPS on web and API
- [ ] argon2id password hashing; generic login errors
- [ ] Token in the encrypted session cookie only; every API request checks the session record and `tokenVersion`; logout deletes the session record; password change and reset revoke all sessions
- [ ] Session cookie `HttpOnly`, `Secure` (staging and production), `SameSite=Lax`, host-only; `Origin` checked on state-changing requests
- [ ] Generic responses for login, registration and reset requests
- [ ] Reset page: token in the URL fragment only, removed on load, `Referrer-Policy: no-referrer`, no third-party resources; tokens absent from logs
- [ ] Authentication middleware on every protected route
- [ ] User data isolation tested for every user-owned resource
- [ ] Zod validation on every request
- [ ] AI output validation (if the optional wording step is enabled)
- [ ] No secrets in Git, Docker images or logs; `.env` ignored; no `NEXT_PUBLIC_` secrets
- [ ] Separate secrets and databases per environment
- [ ] Rate limits per D-38 on login, registration, password change, reset confirm and request, account deletion, recommendations, feedback and shortlist writes; a single API instance, or a shared store if HC-1 chose more
- [ ] CORS limited to the web origin; Helmet headers
- [ ] Safe error messages
- [ ] Privacy notice and per-field explanations shown
- [ ] Account and per-item deletion work and are tested
- [ ] No personal data sent to any external AI provider
- [ ] No fixtures in production; production startup check enabled
- [ ] Style illustrations labelled; asset licences recorded
- [ ] Shortlist: labels shown, URLs https-only and never fetched, items isolated per user
- [ ] Backups configured and a restore tested, including tombstone replay and verification (D-85)
- [ ] Account deletion writes a tombstone first; tombstone store insert-only for the API
- [ ] Closed-beta registration enforced; `PUBLIC_SIGNUP_ENABLED=false`
- [ ] Password change and admin-assisted recovery tested; reset codes hashed, single-use, expiring, never logged; admin recovery procedure written down
- [ ] Public launch only: self-service email reset live (AC-24) after the email provider decision (D-84)
- [ ] Public launch only: legal review recorded complete (D-74); the founder has been reminded to arrange it

**Product layer additions:** retailer links domain-restricted; permitted sources only; retailer content treated as untrusted; affiliate disclosure where links are tracked; retailer permissions recorded in `retailers.permissions`.

## 12. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-04 … D-07, D-17, D-20, D-37, D-38, D-44, D-46 … D-49, D-63, D-65, D-73, D-74, D-77 … D-86.
