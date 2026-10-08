# StyleMe — Deployment

> Source: StyleMe Final End-to-End Blueprint — §1, §2, §29, §37–§48, §51, §55

---

## 1. Targets

| Component | Platform |
|---|---|
| Next.js web (`apps/web`) | Vercel |
| Express API (`apps/api`) | Render (Docker runtime) |
| Database | MongoDB Atlas |
| Images / files | Cloudinary |
| Source | GitHub |
| CI | GitHub Actions |

```
                    INTERNET
                       │
                       ▼
               Vercel / Next.js
                       │
                     Auth.js
                       │
                       ▼
              Render / Express API
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
 MongoDB Atlas     Cloudinary      Gemini/Groq
                                      │
                                      ▼
                               Hugging Face
                               Qwen / Leffa
```

---

## 2. Local Development

- pnpm workspace monorepo (`pnpm-workspace.yaml`, `pnpm-lock.yaml`).
- Environment variables come from a local `.env` (git-ignored), based on `.env.example`.
- The local API connects to **MongoDB Atlas**. MongoDB is **not** run in Docker at first.

```
Local Docker
    ↓
MongoDB Atlas
```

---

## 3. Docker

### 3.1 Strategy
- Containerise the **Express API**.
- Use a **multi-stage** production Docker build.
- Keep **secrets outside the image**.
- Use **Docker Compose** (`docker-compose.yml`) for local consistency.
- Do **not** run MongoDB in Docker at first.
- Redis can be added to Compose later, when needed.
- Files: `apps/api/Dockerfile`, `.dockerignore`, `infra/docker/`.

### 3.2 API build flow

```
Base Node image
    ↓
Enable pnpm
    ↓
Copy workspace files
    ↓
Install dependencies
    ↓
Copy API + contracts
    ↓
Build TypeScript
    ↓
Production image
    ↓
Start Express
```

**Build context must be the repository root**, because `apps/api` depends on `packages/contracts`.

### 3.3 Runtime port

```ts
const port = Number(process.env.PORT) || 4000;
```

- Bind to `0.0.0.0`, not only to localhost.
- Health endpoint: `GET /health`.

---

## 4. Monorepo Deployment Rule

```
apps/web  ──►  packages/contracts
apps/api  ──►  packages/contracts
```

The deployment system must have access to the **workspace root**. Do not configure the backend as if `apps/api` were an independent repository unless the shared package has been published separately.

---

## 5. Vercel (Web)

1. Push the monorepo to GitHub.
2. Open Vercel.
3. Import the StyleMe repository.
4. Select Next.js.
5. Set Root Directory: `apps/web`.
6. Make sure the shared package is supported: `packages/contracts`.
7. Configure environment variables.
8. Deploy.

**Environment rules**
- Only frontend-safe variables, plus the server-side secrets Next.js/Auth.js needs.
- **Never** use `NEXT_PUBLIC_` for private secrets.

---

## 6. Render (API)

| Setting | Value |
|---|---|
| Create | New → Web Service → GitHub → StyleMe |
| Service name | `styleme-api` |
| Branch | `main` |
| Runtime | Docker |
| Dockerfile | `apps/api/Dockerfile` |
| Build context | Repository root |
| Health check path | `/health` |
| Blueprint file | `render.yaml` (in repository root) |

### 6.1 Render environment variables

```
NODE_ENV=production

MONGODB_URI=...

AUTH_ACCESS_TOKEN_SECRET=...

GEMINI_API_KEY=...
GROQ_API_KEY=...

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

HF_API_TOKEN=...
```

Real values are never committed. `.env.example` lists names only.

---

## 7. CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

**Triggers:** pull requests, and pushes to `main`.

```
Checkout
    ↓
Setup Node/pnpm
    ↓
Install
    ↓
Typecheck
    ↓
Lint
    ↓
Unit/API tests
    ↓
Build
    ↓
PASS / FAIL
```

Do **not** deploy feature branches directly to production.

---

## 8. Auto-Deploy Flow (Render)

```
Developer
    ↓
Feature branch
    ↓
Pull Request
    ↓
GitHub Actions
    ↓
Review
    ↓
Merge to main
    ↓
Render detects update
    ↓
Docker build
    ↓
Deploy
    ↓
Health check
    ↓
LIVE
```

## 9. End-to-End Deployment Flow

```
Local Development
      ↓
Feature Branch
      ↓
GitHub Pull Request
      ↓
GitHub Actions
      ├── Typecheck
      ├── Lint
      ├── Test
      └── Build
      ↓
Code Review
      ↓
Merge main
      ↓
      ┌───────────────────────┐
      ▼                       ▼
   Vercel                  Render
   Next.js                Express API
      └───────────┬───────────┘
                  ▼
            MongoDB Atlas
                  │
        ┌─────────┼──────────┐
        ▼         ▼          ▼
   Cloudinary   Gemini      Groq
                            │
                            ▼
                       Image AI Models
                  Hugging Face / Qwen / Leffa
                  │
                  ▼
              Production QA
                  │
                  ▼
             STYLEME LIVE
```

---

## 10. Platform Responsibilities

| Platform | Responsibilities |
|---|---|
| Vercel | Next.js frontend, web UI, Auth.js, SSR/SEO, frontend deployment |
| Render | Express REST API, Docker container, business logic, AI orchestration, database access, image processing, PDF generation |
| MongoDB Atlas | Persistent application data |
| Cloudinary | Persistent image/file storage (never Render's local filesystem) |
| AI providers | Gemini, Groq, Hugging Face, Qwen, Leffa |

---

## 11. Production Readiness (Phase 13)

- [ ] Docker
- [ ] Docker Compose
- [ ] GitHub Actions
- [ ] Vercel
- [ ] Render
- [ ] Production environment
- [ ] Health check
- [ ] Final QA
- [ ] Security checklist complete (see [SECURITY.md](SECURITY.md))

---

## 12. Rollback

The blueprint lists rollback as a required topic of this document but doesn't define a procedure. See Open Items.

---

## 13. Open Items / To Be Decided

- Rollback procedure for Vercel and Render.
- The full list of Vercel environment variables (Auth.js secret, API base URL, Cloudinary public settings, etc.).
- Contents of `render.yaml` and `docker-compose.yml`.
- Node.js and pnpm versions.
- Whether the web app is containerised for local Compose (the blueprint containerises the API).
- Staging/preview environments, and the role of the `develop` branch in deployments.
- Whether Vercel deploys automatically on merge to `main`.
- Separate MongoDB Atlas databases per environment.
- Monitoring and alerting.
