# Contributing to StyleMe

> Source: StyleMe Final End-to-End Blueprint — §2, §3, §6, §30–§33, §40, §53, §56

---

## 1. Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production branch. Merges trigger Render deployment |
| `develop` | Integration branch |
| `feature/*` | New features |
| `fix/*` | Bug fixes |

Feature branches are **never** deployed directly to production.

---

## 2. Workflow

```
Issue
    ↓
Feature Branch
    ↓
Implementation
    ↓
Local Testing
    ↓
Pull Request
    ↓
GitHub Actions
    ↓
Code Review
    ↓
Merge
```

1. Start from a GitHub issue (see §6).
2. Create a `feature/*` or `fix/*` branch.
3. Implement the change, following the coding principles (§4).
4. Test locally.
5. Open a pull request.
6. GitHub Actions must pass: **typecheck, lint, unit/API tests, build**.
7. Get a code review.
8. Merge.

---

## 3. Definition of Done

A feature is not complete just because the UI works. Every feature needs:

- [ ] UI
- [ ] API
- [ ] Validation
- [ ] Database
- [ ] Error handling
- [ ] Authorization
- [ ] Tests
- [ ] Documentation

---

## 4. Coding Principles

### 4.1 Where code goes

| Location | Contains |
|---|---|
| `apps/web` | What the user sees: UI, pages, components, forms, navigation, Auth.js, client state (Zustand), API client, 3D viewer, MediaPipe browser processing |
| `apps/api` | What the application does: REST API, auth, authorization, models, business logic, AI orchestration, Cloudinary, filtering, recommendation, budget, PDF, rate limiting, error handling, logging |
| `packages/contracts` | What frontend and backend agree on: shared Zod schemas, TypeScript types, request/response contracts |

### 4.2 Backend pattern

```
Route → Authentication Middleware → Validation Middleware → Controller → Service
→ Database / External Integration → Response
```

- **Controller:** HTTP concerns only.
- **Service:** business logic.
- **Model:** database interaction.
- **Integration:** external provider communication (`src/integrations/ai | cloudinary | mediapipe | tryon | pdf`).

### 4.3 Rules

- TypeScript everywhere.
- Shared request/response types and schemas go in `packages/contracts`. Never duplicate them.
- Version API routes under `/v1`.
- Use the standard response envelope, and never leak internals in errors.
- Validate all input and all AI output with Zod.
- Budget and price logic is pure code. AI never sets prices.
- Keep AI logic isolated behind the AI Service and integrations.
- Store files in Cloudinary, never on the local filesystem.
- Keep secrets server-side. Never commit `.env`, and never use `NEXT_PUBLIC_` for secrets.
- Don't add Redis or BullMQ until they're actually needed.
- Avoid initially: microservices, Kubernetes, a separate Python service, per-module databases, complex event architecture, a huge marketplace, complex recommendation ML, unnecessary infrastructure.

### 4.4 Core principles

```
KEEP DETERMINISTIC LOGIC DETERMINISTIC.
KEEP AI LOGIC ISOLATED.
VALIDATE ALL AI OUTPUTS.
LET USERS CONFIRM UNCERTAIN VISION RESULTS.
KEEP SECRETS SERVER-SIDE.
KEEP FILES IN CLOUD STORAGE.
KEEP FRONTEND AND BACKEND CONTRACTS SHARED.
DEPLOY WEB TO VERCEL AND API TO RENDER.
```

---

## 5. Development Phases

| Phase | Name | Scope |
|---|---|---|
| 0 | Planning | BRD, FRD, SRS, architecture, database design, API specification, AI design, security plan, deployment plan, GitHub repository |
| 1 | Monorepo Foundation | pnpm workspace, Next.js web, Express API, shared contracts, TypeScript, ESLint, GitHub |
| 2 | Database + Authentication | MongoDB Atlas, Mongoose, user model, register, login, logout, Auth.js, protected frontend, protected API |
| 3 | Profile + Dashboard | Dashboard, navigation, profile page, profile form, profile API, MongoDB persistence |
| 4 | Appearance AI | Face upload, full-body upload, Cloudinary, image validation, MediaPipe, skin tone, undertone, body shape, confidence, confirmation |
| 5 | Product Catalog | Product model, seed script, product API, search, filters, product detail |
| 6 | Recommendation Engine | Profile loader, appearance loader, product filters, ranking, budget engine, Gemini, Zod, final outfit |
| 7 | Outfit Experience | Outfit cards, why this works, price breakdown, total price, save outfit, history |
| 8 | AI Try-On | Try-on UI, model integration, result handling, Cloudinary, error handling, caching where useful |
| 9 | 3D Avatar | Three.js, React Three Fiber, GLB model, viewer, rotate, zoom, front/side/back |
| 10 | Design Studio | Garment selection, color, fabric, neck, sleeve, length, fit, pattern, embroidery, preview, save |
| 11 | Sketch + Chat + PDF | Sketch AI, fashion chatbot, tailor specification, PDFKit |
| 12 | Testing + Security | Unit tests, API tests, AI failure tests, E2E, authentication tests, authorization tests, mobile UI, security hardening |
| 13 | Docker + CI/CD + Deployment | Docker, Docker Compose, GitHub Actions, Vercel, Render, production environment, health check, final QA |

### 5.1 Recommended 12-day schedule

| Day | Work |
|---|---|
| 1 | Monorepo, Next.js, Express, MongoDB, shared contracts, auth foundation |
| 2 | Profile, Cloudinary, MediaPipe, Gemini foundation |
| 3 | Appearance AI, confidence, user confirmation |
| 4 | Product catalog, search, filters |
| 5 | Recommendation, ranking, budget engine |
| 6 | Outfit experience, save/history |
| 7 | AI Try-On |
| 8 | 3D Avatar |
| 9 | Design Studio |
| 10 | Sketch AI, chatbot, PDF |
| 11 | Testing, security, performance, bug fixing |
| 12 | Docker, GitHub Actions, Vercel, Render, production QA |

---

## 6. GitHub Issue Breakdown

| # | Issue | # | Issue |
|---|---|---|---|
| 1 | Project documentation | 20 | Outfit UI |
| 2 | Monorepo setup | 21 | Gemini integration |
| 3 | Next.js web setup | 22 | Groq fallback |
| 4 | Express API setup | 23 | Try-on integration |
| 5 | Shared contracts package | 24 | 3D avatar |
| 6 | MongoDB configuration | 25 | Design studio |
| 7 | User model | 26 | Sketch-to-design |
| 8 | Auth API | 27 | Chatbot |
| 9 | Auth.js integration | 28 | PDF generation |
| 10 | Profile module | 29 | Unit tests |
| 11 | Cloudinary integration | 30 | API tests |
| 12 | MediaPipe integration | 31 | E2E tests |
| 13 | Appearance analysis | 32 | Security hardening |
| 14 | Appearance confirmation | 33 | Docker |
| 15 | Product model | 34 | GitHub Actions |
| 16 | Product seed | 35 | Vercel deployment |
| 17 | Product APIs | 36 | Render deployment |
| 18 | Recommendation engine | 37 | Production environment |
| 19 | Budget engine | 38 | Final QA |

---

## 7. Documentation

Update the relevant document in `docs/` with every feature (it's part of the Definition of Done):

[BRD](BRD.md) · [FRD](FRD.md) · [SRS](SRS.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [API](API.md) · [AI](AI.md) · [SECURITY](SECURITY.md) · [TESTING](TESTING.md) · [DEPLOYMENT](DEPLOYMENT.md)

---

## 8. Open Items / To Be Decided

- How `develop` is used relative to `main` (PR target branch, release process).
- Commit message convention.
- PR template and number of required reviewers.
- Branch protection rules.
- ESLint configuration and any formatter (the blueprint names ESLint only).
- Issue labels and milestones.
