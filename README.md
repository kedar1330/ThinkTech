# StyleMe

Personal styling for users in India: explained, deterministic look suggestions, with a shortlist and budget on prices the user enters. Stage 1 ships as an invite-only closed beta.

The specifications are in [`docs/`](docs/). Start with [MVP.md](docs/MVP.md) and the [Implementation Plan](docs/ImplementationPlan.md), which also holds the decision register (§8).

## Repository

| Path                 | Contents                                                     |
| -------------------- | ------------------------------------------------------------ |
| `apps/web`           | Next.js web app (Auth.js session, server-side API calls)     |
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

Registration is invite-only during the closed beta (D-63). Invite an email address, then register with it in the web app:

```sh
pnpm --filter @styleme/api admin invite-add you@example.com
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
