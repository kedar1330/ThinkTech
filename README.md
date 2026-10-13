# StyleMe

Personal styling for users in India: explained, deterministic look suggestions, with a shortlist and budget on prices the user enters. Stage 1 ships as an invite-only closed beta.

The specifications are in [`docs/`](docs/). Start with [MVP.md](docs/MVP.md) and the [Implementation Plan](docs/ImplementationPlan.md), which also holds the decision register (§8).

## Repository

| Path                 | Contents                                                     |
| -------------------- | ------------------------------------------------------------ |
| `apps/web`           | Next.js web app (session cookie, server-side API calls)      |
| `apps/api`           | Express API, MongoDB models, operator scripts                |
| `packages/contracts` | Zod schemas and types shared by web and API                  |
| `docs/`              | Requirements, architecture, security, testing and deployment |

## Prerequisites

- Node.js 24 LTS (`.nvmrc`) and pnpm 10 (`corepack enable`, or `npm i -g pnpm@10`)
- A local MongoDB on `mongodb://127.0.0.1:27017` to run the app. The tests use `mongodb-memory-server` and need no database.

## Local development

```sh
pnpm install
```

Create `apps/api/.env` and `apps/web/.env.local` from the names in [`.env.example`](.env.example). Generate each secret with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`BFF_SHARED_SECRET` must have the same value in both files.

```sh
pnpm dev:api          # API on http://localhost:4000
pnpm dev:web          # web app on http://localhost:3000
```

### Sign-up with email verification

Anyone can sign up (`PUBLIC_SIGNUP_ENABLED=true`, the default). Signing up sends a 6-digit code to the email address; the account is created only when that code is entered on the verification page (in the same browser) within 5 minutes. Until then the sign-up waits in `pendingRegistrations` with a password hash and is removed automatically after 24 hours. After verifying, the user is signed in and continues to onboarding; they can then log out and log in with their email and password.

Limits (server-side): 3 wrong codes lock verification for 30 minutes; resend after 30 seconds, at most 6 codes per hour; 3 registrations per minute per IP. Each new code invalidates the previous one.

**Sending real email.** Without `SMTP_URL`, local development writes each email to `apps/api/.dev-outbox/` and prints the code in the API terminal (`DEV_ECHO_MESSAGES=true`). To deliver to real inboxes, set in `apps/api/.env` (Gmail shown; any SMTP provider works):

```sh
SMTP_URL=smtps://you%40gmail.com:<16-char-app-password>@smtp.gmail.com:465
EMAIL_FROM="StyleMe <you@gmail.com>"
DEV_ECHO_MESSAGES=false   # optional: stop printing codes in the terminal
```

Gmail needs 2-Step Verification and an App Password (Google Account → Security → App passwords). Restart the API after changing `.env`; it logs `"email":"smtp"` on start.

**Diagnosing delivery.** A provider failure is logged as `verification_email_failed` with the provider's reason (never the code), the sign-up page shows "We could not send the verification email", and resend returns `503`. Common causes: a wrong App Password (`535 Authentication failed`), an `@` in the user name not written as `%40`, port 465 blocked (try `smtp://…:587`), or the message in the spam folder.

To run as an invite-only closed beta instead, set `PUBLIC_SIGNUP_ENABLED=false` and invite addresses:

```sh
pnpm --filter @styleme/api admin invite-add you@example.com
```

Registration only creates user accounts. Create the admin with the seed script: set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `apps/api/.env`, then run the command below. The admin then logs in directly at `/login`. There is no invite, verification or onboarding step, and Google sign-in is not available to admins (D-95). Re-running the seed changes nothing; `--reset-password` replaces the password.

```sh
pnpm --filter @styleme/api seed
```

Other operator commands (issue a reset code, revoke sessions, deactivate an account, set a role) are listed at the top of [`apps/api/scripts/admin.ts`](apps/api/scripts/admin.ts).

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

CI runs the same checks on every pull request and push to `main` ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Docker

The API image builds from the repository root:

```sh
docker build -f apps/api/Dockerfile -t styleme-api .
docker compose up --build    # API in Docker against the MongoDB on your machine
```

## Hosting

Nothing is deployed. Hosting accounts, plans and costs are decided at the hosting checkpoint HC-1 (D-81); `render.yaml` is a definition only and isn't connected to any account.
