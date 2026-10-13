# StyleMe — Security and Privacy

> Part of the StyleMe documentation baseline. Requirements: [FRD.md](FRD.md), [SRS.md](SRS.md) §4. Environments: [DEPLOYMENT.md](DEPLOYMENT.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Authentication

Revised 2026-10-12 (D-06, D-07, D-87 … D-94).

```
Browser → Next.js server (BFF, first-party HttpOnly session cookie) → Express API (access token) → MongoDB
```

- **Passwords (D-87):** at least 8 characters with an upper-case letter, a lower-case letter, a number and a special character (at most 128); checked by the shared Zod schema on the web server and again by the API. Stored only as argon2id hashes (D-04), never logged. Login and re-authentication accept any stored password, so accounts created under the older rule still work.
- **Sessions (D-05, D-91):** on login the API creates a session record (`sessions`) and issues a JWT (HS256, `AUTH_ACCESS_TOKEN_SECRET`) carrying the user ID, `tokenVersion`, a random session ID (`sid`, 256 bits) and the Remember Me flag. Token and record expire together: 30 days with Remember Me, otherwise 24 hours. Not extended by activity.
- **Every API request is checked against the server:** signature and expiry, the user exists and is active, the email is verified, `tokenVersion` matches and the session record exists. Revocation takes effect on the next request.
- **Session cookie (D-06):** the Next.js server stores the token in its own cookie — `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`; over HTTPS `Secure` with the `__Host-` prefix (`__Host-styleme_session`). Without Remember Me it has no `Max-Age` (ends when the browser closes); with it, 30 days. Browser JavaScript and browser storage never see the token. Protected pages confirm the session with the API on every render; a `401` clears it.
- **Other credential cookies**, same attributes: `styleme_pending` (pending-registration token, 24 hours), `styleme_pending_email` (email typed on the verification-recovery screen), `styleme_oauth` (Google `state`, PKCE verifier and nonce, 10 minutes, deleted on use), `styleme_reset` (email or short-lived reset token between the code and new-password steps, 10 minutes).
- **Logout (D-07):** ends this browser's session only — the record is deleted, then the cookie. Other devices stay signed in.
- **Revoking sessions:** password change revokes every other session and the browser continues with a new one; password reset, Google linking of an unverified account (D-88), account deletion and the admin script revoke all of them and increment `tokenVersion`. `isActive: false` blocks login and every token.
- **CSRF:** browsers never call the API directly. State-changing actions are server actions or route handlers on the Next.js server, which reject requests whose `Origin` isn't the web origin (`AUTH_URL`); `SameSite=Lax` keeps the cookie off cross-site `POST`s; the Google flow is protected by `state`. No state changes on `GET`.
- **Login lockout (D-90):** 3 wrong passwords lock the account for 30 minutes, even for the right password; unknown emails take the same time (a dummy argon2 verification) and get the same message. Accepted risk: anyone who knows an email can keep that account locked; mitigated by per-IP limits and because a reset clears the lock.
- **Responses:** login is generic for unknown emails and wrong passwords. By founder decision, registration says when an email is already registered (with a Log in link) and password reset says "Email not registered" (with a Sign up link); both are rate-limited per IP, and the enumeration risk is accepted (D-87, D-89). Verification recovery by email alone is always generic.

### 1.1 Codes, links and recovery (D-83, D-89, D-93)

- **Codes:** 6 digits from a cryptographically secure generator, valid 5 minutes, stored as HMAC-SHA-256 keyed with `AUTH_ACCESS_TOKEN_SECRET` and bound to the user and purpose, compared in constant time. 3 wrong codes lock that purpose for 30 minutes; failed attempts survive a resend.
- **Links:** 256-bit random tokens stored as SHA-256; verification and email-change links 30 minutes, reset links 15 minutes, admin codes 60 minutes. Consumed atomically, so two concurrent redemptions can't both succeed.
- **Sending:** 30-second cooldown and at most 6 sends (first + 5 resends) per user and purpose per hour; a new code or link invalidates the earlier one.
- **Leak prevention:** link tokens travel only in the URL fragment (`#token=…`), which browsers don't send to servers or in `Referer`; the page removes it from the address bar on load and sends it in a `POST` body. Token pages (`/reset-password`, `/forgot-password/code`, `/verify-email`, `/verify-email/link`, `/settings/email/confirm`) send `Referrer-Policy: no-referrer` and `Cache-Control: no-store`. Codes, tokens, passwords and session tokens never appear in logs (request bodies aren't logged; the dev outbox logs only that a message was written), URLs, analytics or error responses.
- **Self-service reset:** link or code; after a code is verified the API issues a 10-minute reset token. A reset re-hashes the password, increments `tokenVersion`, deletes all sessions and other challenges, clears any login lockout and sends the user to log in (no automatic login).
- **Admin-assisted reset:** the admin verifies the request through a channel tied to the account; the script shows a single-use code once; the user chooses the password; issuance is logged without the code (FR-AUTH-12).
- **Password change:** an emailed code instead of the current password (founder decision D-93); a notice goes to the account address afterwards.
- **Email change:** current password first; the new address must prove ownership; the old address stays active until then and is notified afterwards.
- **Phone:** optional, SMS code; never a login factor (D-92).
- **Deletion:** emailed code plus an explicit confirmation (D-94).

### 1.2 Google sign-in (D-88)

- Authorization-code flow with PKCE (S256), a random `state` (checked in constant time) and a `nonce`, all kept in the short-lived `HttpOnly` OAuth cookie; the client secret stays on the Next.js server.
- The API verifies the ID token itself: signature against Google's published keys, issuer, audience = `GOOGLE_CLIENT_ID`, expiry and nonce, and requires `email_verified: true`. The client never supplies the email.
- Accounts are found by Google ID first. Linking by email happens only on login with a Google-verified email. If the matching account never verified its email, its password, sessions and pending codes are discarded first, so someone who pre-registered another person's address can't keep access. A Google ID can belong to one account only (unique index).
- Sign-up with an existing email is refused (log in instead). Google sign-ups must create a StyleMe password before using the app.

### 1.3 Closed beta (D-63)

Registration — by email or Google — requires an invite while `PUBLIC_SIGNUP_ENABLED` is `false`. It stays `false` until every public-launch blocker in [ImplementationPlan.md](ImplementationPlan.md) §11 is met, including D-74 recorded complete.

## 2. Authorization and Data Isolation

- Every protected route runs authentication middleware before validation and the controller.
- Every query on user-owned data (`sessions`, `profiles`, `appearanceProfiles`, `outfits`, `shortlistItems`, and later `designs`, `chatMessages`) is scoped to the authenticated user; ownership is checked in the service layer, not only in the UI. A request for another user's resource returns `NOT_FOUND`.
- Roles: `user` and `admin` (D-73). There is no admin UI. Content, catalogue and retailer changes go through repository pull requests and server-side scripts with their own credentials.
- Shared product, retailer and evidence data are read-only through the API.

## 3. Secrets

| Rule | Detail |
|---|---|
| Server-side only | All keys and tokens are used only by the API, its scripts, and Next.js server code |
| No `NEXT_PUBLIC_` secrets | Never |
| `.env` ignored | Only `.env.example` (names, no values) is committed |
| Not in images or logs | Secrets are runtime environment variables, never baked into Docker images or written to logs |
| Per environment | Local, staging and production have different secrets and database credentials (D-78) |
| Provisioned when needed | A key is added only when its feature is enabled |

| Secret | Needed when |
|---|---|
| `MONGODB_URI`, `AUTH_ACCESS_TOKEN_SECRET` | Stage 1. Local values for development; staging and production values only after the hosting checkpoint (D-81) |
| `GEMINI_API_KEY` | Only if optional AI wording is enabled (D-67) |
| `BFF_SHARED_SECRET` | Stage 1, per environment, on both the web app and the API (§5) |
| `TOMBSTONE_STORE_URI`, `TOMBSTONE_HMAC_KEY` | Stage 1, per environment (D-85). Losing the HMAC key prevents matching restored invite records, so it is stored with the other production secrets |
| `SMTP_URL` (includes the provider credentials), `EMAIL_FROM` | Before the closed beta: staging and production refuse to start without them (D-84, now at HC-1) |
| `GOOGLE_CLIENT_ID` (API and web), `GOOGLE_CLIENT_SECRET` (web only) | When Google sign-in is configured (D-88) |
| SMS provider credentials | Only after an SMS provider is chosen (D-92) |
| `FLIPKART_AFFILIATE_ID`, `FLIPKART_AFFILIATE_TOKEN` | Only after Flipkart approves access (D-44). The Affiliate API documents one active token per account, so rotation must update the environment at the same time |
| `WEATHER_API_KEY` | Stage 2, only if the chosen provider needs a key (D-60) |
| Cloudinary, Groq, Hugging Face keys | Only for deferred or future features that use them |

## 4. Input and Output Validation

- Every request body and query is validated by Zod schemas from `packages/contracts`.
- All AI output is parsed, Zod-validated and business-validated before use. For the optional wording step, invalid output is discarded and the template text is used.
- All text that came from a user or a retailer is escaped when rendered. No retailer HTML is rendered.
- User-entered shortlist URLs: https only, length-limited (D-80), stored unchanged, rendered as plain outbound links with `rel="noopener noreferrer nofollow"`, never fetched, previewed or modified by the server, so StyleMe makes no outbound request to user-supplied addresses.

## 5. Rate Limiting, Headers and Transport

- Rate limits (D-38, revised 2026-10-12): per IP — login 5/min and 30/hour, register 3/min and 20/hour, Google 10/min, code and link checks 10/min and 30/hour, code sends 10/min and 30/hour, reset confirm 10/hour; per user — logout 30/min, account-security actions 30/hour, account deletion 5/hour, recommendations 20/min, feedback 60/min, shortlist writes 30/min. Per account and code: login lockout (D-90), code lockout and resend limits (§1.1). Limits are in memory, so a single API instance is assumed until HC-1.
- HTTPS everywhere. Helmet security headers on the API. CORS allows only each environment's web origin (D-37).

## 6. Personal Data and Privacy (D-49)

**Principle:** collect only what a feature uses, keep it only as long as needed, let users delete it, and never send personal photos, measurements or unnecessary personal information to external AI providers (rule 16).

| Data | Purpose | Collected when | Shared with external AI? | Retention and deletion |
|---|---|---|---|---|
| Email, full name, password hash, city, optional phone | Account (city: region-aware styling; phone: optional contact, never login) | Stage 1 | No | Until account deletion (immediate) |
| Consent records (terms and privacy versions and times, marketing choice and time) | Proof of acceptance; marketing only if opted in | Stage 1, at sign-up | No | With the account |
| Google account ID | Google sign-in | Only if the user uses Google | No | With the account |
| Session records (hashed session ID, user ID, Remember Me, timestamps) | Revocable login sessions | Stage 1, at each login | No | Deleted at logout, password change or reset, account deletion, or expiry (24 hours, or 30 days with Remember Me) |
| Deletion tombstones | Re-applying account deletions after a restore | When an account is deleted | No | Backup retention + 7 days (37 days while backups are kept the proposed 30), then deleted; separate store, insert-only for the API |
| Codes and links (`authChallenges`) | Verification, recovery and account changes | When requested | No | Stored only as hashes; unusable once used, superseded or expired (5–60 minutes); record removed 24 hours after the last send or with the account |
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
- [ ] Token in the first-party `HttpOnly` session cookie only; every API request checks the session record, `tokenVersion` and a verified email; logout ends the current session; password change revokes other sessions, reset all
- [ ] Credential cookies `HttpOnly`, `Secure` with `__Host-` (staging and production), `SameSite=Lax`, host-only; browser-session cookie without Remember Me; `Origin` checked on state-changing requests
- [ ] Generic login errors and verification-recovery responses; the founder-approved "already registered" and "Email not registered" messages rate-limited; login lockout after 3 wrong passwords
- [ ] Token pages: token in the URL fragment only, removed on load, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`; codes and tokens absent from logs
- [ ] Google: PKCE, `state`, nonce; ID token verified by the API (signature, issuer, audience, nonce, `email_verified`); unverified-account linking discards the old password
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
- [ ] Verification, reset (link and code), password change, email change, phone and deletion codes tested: hashed, single-use, expiring, rate-limited, never logged; admin recovery procedure written down
- [ ] Email provider configured (D-84, now needed before the closed beta); self-service reset and verification work in production (AC-24)
- [ ] Public launch only: legal review recorded complete (D-74); the founder has been reminded to arrange it

**Product layer additions:** retailer links domain-restricted; permitted sources only; retailer content treated as untrusted; affiliate disclosure where links are tracked; retailer permissions recorded in `retailers.permissions`.

## 12. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-04 … D-07, D-86 … D-94, D-17, D-20, D-37, D-38, D-44, D-46 … D-49, D-63, D-65, D-73, D-74, D-77 … D-86.
