# StyleMe

Personal styling for users in India: explained, deterministic look suggestions built from a curated, founder-approved style knowledge base, with a shortlist and budget on prices the user enters. StyleMe is a styling guide, not a shop — it never invents products, prices or availability.

Stage 1 is planned as a closed beta (D-63); see [PROJECT_OVERVIEW.md §15](docs/PROJECT_OVERVIEW.md#15-conflicts-and-missing-decisions) for the open question about the public sign-up default.

## Why StyleMe

People know the occasion they are dressing for, but not how to put an outfit together: which colours and cuts suit them, what fabrics fit the occasion, what to search for, and how to stay within budget. StyleMe answers "what should I wear?" with complete looks and the reasons behind them, for everyday, work, festive, wedding, party, date, travel and formal occasions across Indian, fusion and western wear. Appearance details are optional, self-reported and deletable; there is no photo analysis.

Full product description and intended behaviour of every section: [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md).

## Features and current status

Verified against the code on `main` (`5b65b5c`, 2026-10-18). ✅ built · 🟡 partial · ⬜ placeholder ("Coming soon" page only) · ⛔ waits for a founder decision or approval.

| Section                                                                                               | Status | Notes                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Sign-up, email verification, login, password reset, Google sign-in                                    | ✅     | Account created only after the emailed 6-digit code is verified                                                                      |
| Onboarding, Home, profile completeness                                                                | ✅     | Set up now or **Skip for now**; "Complete your profile" on Home                                                                      |
| Style profile and appearance signals (labelled Discover My Style)                                     | ✅     | Self-reported; signals can be switched off or cleared                                                                                |
| Settings, consent, account deletion                                                                   | ✅     | Data export approved (D-105), not built                                                                                              |
| Shared styling database, rules and engine                                                             | 🟡     | Tooling and shared contracts built; **no content on `main`** (C0 drafts awaiting founder approval in PR #68); engine not built (#33) |
| Discover My Style — look recommendations                                                              | ⬜     | Needs the styling content and engine                                                                                                 |
| My Colour Palette                                                                                     | ⬜     |                                                                                                                                      |
| Outfit Categories                                                                                     | ⬜     | Specified 2026-10-18 (FRD §4.19, D-110 … D-114); not built                                                                           |
| Saved Outfits and feedback                                                                            | ⬜     |                                                                                                                                      |
| Shop My Look (shortlist of items you found, budget)                                                   | ⬜     | Real retailer products ⛔ until a retailer authorises StyleMe                                                                        |
| Design Studio, Style Assistant                                                                        | ⛔     | Deferred (D-76)                                                                                                                      |
| Virtual Try-On                                                                                        | ⬜     | 2D illustrative try-on approved (D-119), not built; photo-based try-on ⛔ (D-48)                                                     |
| Weather-aware styling                                                                                 | ⛔     | Stage 2; provider not chosen (D-60)                                                                                                  |
| My Profile redesign (measurements, face and body photo analysis, age group, export) and Home redesign | ⬜     | Approved 2026-10-18 (D-102 … D-106, [FRD §4.1b, §4.3a](docs/FRD.md)); dormant schema only; photo analysis after the privacy review   |

Build order and milestone status: [docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md).

## Team

| Member     | Primary ownership                                                                       |
| ---------- | --------------------------------------------------------------------------------------- |
| **Shreya** | Shared styling database, rules, matching/ranking engine and common contracts            |
| **Johita** | Discover My Style and Outfit Categories                                                 |
| **Ankita** | My Colour Palette, Saved Outfits and feedback                                           |
| **Kedar**  | Shop My Look and Design Studio after approval; later Virtual Try-On subject to approval |

Responsibilities, shared-file owners and how we coordinate: [docs/TEAM_TASK_ASSIGNMENTS.md](docs/TEAM_TASK_ASSIGNMENTS.md). Every open task with its issue, owner, dependencies and acceptance criteria: [docs/TODO.md](docs/TODO.md).

## Tech stack

| Layer   | Technology                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web     | Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix UI primitives, lucide-react icons; server-side API calls (BFF) with an HttpOnly session cookie |
| API     | Node.js 24, Express 5, Mongoose 9 on MongoDB, Zod 4, argon2 password hashing, pino logging, nodemailer (SMTP)                                           |
| Shared  | `packages/contracts` — Zod schemas and types used by web and API                                                                                        |
| Tests   | Vitest 5, Testing Library and jsdom (web), Supertest and `mongodb-memory-server` (API)                                                                  |
| Tooling | pnpm 10 workspaces, TypeScript 5.9, ESLint 10, Prettier 3, GitHub Actions CI, Docker (API image)                                                        |

## Repository

| Path                 | Contents                                                                                |
| -------------------- | --------------------------------------------------------------------------------------- |
| `apps/web`           | Next.js web app (session cookie, server-side API calls)                                 |
| `apps/api`           | Express API, MongoDB models, style knowledge base (`src/style-rules`), operator scripts |
| `packages/contracts` | Zod schemas and types shared by web and API                                             |
| `docs/`              | Requirements, architecture, security, testing, deployment and team documents            |

## Prerequisites

- Node.js 24 LTS (`.nvmrc`) and pnpm 10 (`corepack enable`, or `npm i -g pnpm@10`)
- A local MongoDB on `mongodb://127.0.0.1:27017` to run the app. The tests use `mongodb-memory-server` and need no database.

## Local setup

```sh
git clone https://github.com/kedar1330/ThinkTech.git
cd ThinkTech
pnpm install
```

Create `apps/api/.env` and `apps/web/.env.local` from the names in [`.env.example`](.env.example). Both files are git-ignored; never commit them. Generate each secret with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`BFF_SHARED_SECRET` must have the same value in both files.

```sh
pnpm dev:api          # API on http://localhost:4000
pnpm dev:web          # web app on http://localhost:3000
```

### Database

- **Collections and indexes** are created by Mongoose when the API starts.
- **Migrations** run with `pnpm --filter @styleme/api migrate` before a new API version takes traffic (one so far: `001-auth-onboarding`).
- **Admin account:** `pnpm --filter @styleme/api seed` (see below). It is the only seed command.
- **Styling content** (palettes, templates, rules) is not seeded into MongoDB: it lives in `apps/api/src/style-rules/data/*.json`, is founder-approved, and is loaded and checked when the API starts. Check it with:

```sh
pnpm --filter @styleme/api style-rules lint        # validate and lint the styling data
pnpm --filter @styleme/api style-rules coverage    # coverage report of approved records
```

### Sign-up with email verification

Anyone can sign up (`PUBLIC_SIGNUP_ENABLED=true`, the default). Signing up sends a 6-digit code to the email address; the account is created only when that code is entered on the verification page (in the same browser) within 5 minutes. Until then the sign-up waits in `pendingRegistrations` with a password hash and is removed automatically after 24 hours. After verifying, the user is signed in and continues to onboarding — set up the style profile now or skip it — and can then log out and log in with their email and password.

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

CI runs these, plus the style-rule linter, the coverage report and a Docker image build, on every pull request and push to `main` ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Working on an assigned issue

1. Find your issue on GitHub (Issues → filter by assignee) and read its "Depends on" list.
2. Agree any change to a shared file with its owner first ([TEAM_TASK_ASSIGNMENTS.md §2](docs/TEAM_TASK_ASSIGNMENTS.md#2-owners-of-shared-files)).
3. Branch from the latest `main`: `feature/<issue>-<short-description>`.
4. Implement with tests, run the checks above, and open a pull request that says `Closes #<issue>`.

The full workflow, PR requirements and rules for shared files, migrations and secrets: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) §10–§14.

## Documentation

| Document                                                                                                    | What it covers                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PROJECT_OVERVIEW](docs/PROJECT_OVERVIEW.md)                                                                | Every section's purpose, flow, states and verified status; open decisions                                                                                                 |
| [DEVELOPMENT_ROADMAP](docs/DEVELOPMENT_ROADMAP.md)                                                          | Milestones, dependencies, approvals and parallel work                                                                                                                     |
| [TODO](docs/TODO.md)                                                                                        | Consolidated task list: stable IDs, issues, owners, dependencies, acceptance criteria                                                                                     |
| [TEAM_TASK_ASSIGNMENTS](docs/TEAM_TASK_ASSIGNMENTS.md) · [PROPOSED_ISSUES](docs/PROPOSED_ISSUES.md)         | Who owns what; the original issue proposals (historical) mapped to GitHub issues                                                                                          |
| [CHANGELOG](docs/CHANGELOG.md)                                                                              | Merged pull requests, newest first                                                                                                                                        |
| [CONTRIBUTING](docs/CONTRIBUTING.md)                                                                        | Workflow, Definition of Done, rules, styling-content review                                                                                                               |
| [MVP](docs/MVP.md) · [BRD](docs/BRD.md) · [FRD](docs/FRD.md) · [SRS](docs/SRS.md)                           | Scope, business and functional requirements, acceptance criteria                                                                                                          |
| [SPECS](docs/SPECS.md)                                                                                      | Technical specification: verified stack and versions, conventions, module status, knowledge base and engine, technical acceptance, traceability, open technical decisions |
| [UI_DESIGN](docs/UI_DESIGN.md)                                                                              | The current UI: design tokens, typography, layouts, navigation, components and every page, with source paths                                                              |
| [ARCHITECTURE](docs/ARCHITECTURE.md) · [API](docs/API.md) · [DATABASE](docs/DATABASE.md) · [AI](docs/AI.md) | Technical design, endpoints, collections, the look engine and knowledge base                                                                                              |
| [SECURITY](docs/SECURITY.md) · [TESTING](docs/TESTING.md) · [DEPLOYMENT](docs/DEPLOYMENT.md)                | Security and privacy, test strategy, environments                                                                                                                         |
| [ImplementationPlan](docs/ImplementationPlan.md)                                                            | Detailed plan and the decision register (§8)                                                                                                                              |

## Docker

The API image builds from the repository root:

```sh
docker build -f apps/api/Dockerfile -t styleme-api .
docker compose up --build    # API in Docker against the MongoDB on your machine
```

## Hosting

Nothing is deployed. Hosting accounts, plans and costs are decided at the hosting checkpoint HC-1 (D-81); `render.yaml` is a definition only and isn't connected to any account.
