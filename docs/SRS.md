# StyleMe — Software Requirements Specification (SRS)

> Source: StyleMe Final End-to-End Blueprint — §1, §3, §9, §10, §16, §19, §21, §22, §35–§38, §45, §53, §54, §56

---

## 1. Introduction

### 1.1 Purpose
This SRS states the functional and non-functional requirements for the StyleMe MVP, an AI-powered personal fashion stylist for Indian users.

### 1.2 Scope
StyleMe covers authentication, style profiles, photo-based appearance analysis, a curated product catalog, AI recommendations with coded budget validation, outfit history, AI try-on, a 3D avatar, a design studio, sketch-to-design, a fashion chatbot and tailor PDF generation. Business scope is in [BRD.md](BRD.md).

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Monk Skin Tone | Skin tone scale used for skin tone estimates. Reported as a value plus a range |
| Undertone | Warm, Cool, Neutral, Olive or Unknown |
| Body shape | Rectangle, Triangle, Inverted Triangle, Oval or Hourglass |
| Confidence | A probability (0–1, shown as %) attached to an AI/vision result |
| `userConfirmed` | Flag showing the user has confirmed a value. Confirmed values are the source of truth |
| BFF | The Next.js server-side request layer that calls the Express API |
| Contracts | Shared Zod schemas and TypeScript types in `packages/contracts` |

---

## 2. Overall Description

### 2.1 System context

```
Browser
    ↓
Vercel / Next.js
    ↓
Auth.js Session
    ↓
Next.js server-side/BFF request
    ↓
Express API on Render
    ↓
Business Logic
    ↓
MongoDB / AI / Cloudinary / other services
```

### 2.2 Components

| Component | Responsibility |
|---|---|
| `apps/web` | UI, pages, components, forms, navigation, Auth.js, browser/client state, API client, 3D viewer, MediaPipe browser processing |
| `apps/api` | REST API, authentication service, authorization, database, Mongoose models, business logic, AI orchestration, Cloudinary server operations, product filtering, recommendation engine, budget engine, PDF generation, rate limiting, error handling, logging |
| `packages/contracts` | Shared Zod schemas, TypeScript types and request/response contracts |

Full architecture is in [ARCHITECTURE.md](ARCHITECTURE.md).

### 2.3 Design principles

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

## 3. Functional Requirements

The detailed functional requirements are in [FRD.md](FRD.md). Summary:

| Area | FRD IDs |
|---|---|
| Authentication (register, login, logout, session, protected UI/API) | FR-AUTH-01 … 09 |
| Dashboard & profile | FR-PROF-01 … 05 |
| Appearance analysis (skin tone, undertone, body shape, confidence) | FR-APP-01 … 10 |
| Appearance confirmation / correction | FR-CONF-01 … 06 |
| Product catalog, search, filters, detail | FR-PROD-01 … 05 |
| Recommendation engine | FR-REC-01 … 07 |
| Budget engine | FR-BUD-01 … 04 |
| Outfit experience (cards, why-this-works, prices, save, history) | FR-OUT-01 … 07 |
| AI try-on | FR-TRY-01 … 06 |
| 3D avatar | FR-AVT-01 … 05 |
| Design studio | FR-DES-01 … 05 |
| Sketch-to-design | FR-SKT-01 … 05 |
| Fashion chatbot | FR-CHAT-01 … 06 |
| Tailor PDF | FR-PDF-01 … 03 |
| Cross-cutting (response envelope, safe errors, isolation, storage, health) | FR-X-01 … 05 |

---

## 4. Non-Functional Requirements

### 4.1 Reliability and correctness

| ID | Requirement |
|---|---|
| NFR-REL-01 | The core recommendation, profile, product, budget, validation, security and deployment layers are deterministic and reliable. |
| NFR-REL-02 | Budget calculation is pure code. AI cannot invent or override prices. |
| NFR-REL-03 | All AI output goes through: parse → Zod → business validation → use. If it is invalid: retry, fallback, or return a clear error. |
| NFR-REL-04 | AI failures produce real errors or fallbacks, never fake answers. |
| NFR-REL-05 | AI and vision features are treated as probabilistic and handled with confidence, validation, caching, fallbacks and user confirmation. |
| NFR-REL-06 | Low-confidence visual classifications are never forced. The user can correct them. |
| NFR-REL-07 | Exact physical measurements are never claimed without real-world calibration. |

### 4.2 Availability and graceful degradation

| ID | Requirement |
|---|---|
| NFR-AVL-01 | Running out of AI provider quota is handled gracefully. Free tiers are not assumed to be unlimited. |
| NFR-AVL-02 | Groq is the fallback when Gemini is unavailable, where appropriate. |
| NFR-AVL-03 | If try-on is unavailable, the rest of the application keeps working, and the user sees "Try-on is currently unavailable." |
| NFR-AVL-04 | The API exposes `GET /health` for Render health checks. |

### 4.3 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | The full product catalog is never sent to Gemini. Products are hard-filtered and ranked first, and only the top candidates are sent. |
| NFR-PERF-02 | AI responses are cached in the MongoDB `aiCache` collection (indexed on `cacheKey`, with `expiresAt`). |
| NFR-PERF-03 | Only the relevant profile and conversation context is sent to the chatbot AI. |
| NFR-PERF-04 | Try-on results are cached where useful. |
| NFR-PERF-05 | Long-running work (AI image generation, try-on, large PDF generation, image processing, batch processing) may move to BullMQ background jobs when needed. |

### 4.4 Security
Summary only. The full list is in [SECURITY.md](SECURITY.md).

| ID | Requirement |
|---|---|
| NFR-SEC-01 | HTTPS in production. |
| NFR-SEC-02 | Secure authentication with password hashing. |
| NFR-SEC-03 | API authorization, with user-specific data isolated to the authenticated user. |
| NFR-SEC-04 | Input validation and AI output validation with Zod. |
| NFR-SEC-05 | API keys are server-side only. `.env` is ignored by Git. No secrets in Git or Docker images. |
| NFR-SEC-06 | Rate limiting on expensive endpoints. |
| NFR-SEC-07 | CORS configured correctly. Helmet/security headers enabled. |
| NFR-SEC-08 | Safe error messages, with no stack traces, secrets, database details or internal errors. |
| NFR-SEC-09 | Image privacy is considered. Images live in Cloudinary, not on the local filesystem. |
| NFR-SEC-10 | MongoDB access is secured. |

### 4.5 Scalability

| ID | Requirement |
|---|---|
| NFR-SCL-01 | The MVP catalog is 500–2,000 curated products, not millions. |
| NFR-SCL-02 | The API is stateless with respect to files: all persistent images and files go to Cloudinary, never to Render's local filesystem. |
| NFR-SCL-03 | Redis is introduced only when needed: high-frequency caching, rate-limit counters, temporary state, distributed locks, background jobs. |
| NFR-SCL-04 | BullMQ is introduced only when tasks become long-running. |
| NFR-SCL-05 | The system stays a modular monorepo. Microservices, Kubernetes, a separate Python service, per-module databases and complex event architecture are avoided at first. |

### 4.6 Maintainability

| ID | Requirement |
|---|---|
| NFR-MNT-01 | pnpm workspace monorepo with `apps/web`, `apps/api` and `packages/contracts`. |
| NFR-MNT-02 | Shared request/response contracts keep the frontend and backend in sync. |
| NFR-MNT-03 | Backend features follow Route → Auth middleware → Validation middleware → Controller → Service → Database/Integration → Response. |
| NFR-MNT-04 | External providers are isolated under `apps/api/src/integrations/` (ai, cloudinary, mediapipe, tryon, pdf). |
| NFR-MNT-05 | TypeScript throughout. Code passes typecheck and lint in CI. |
| NFR-MNT-06 | API endpoints are versioned under `/v1`. |

### 4.7 Usability

| ID | Requirement |
|---|---|
| NFR-USE-01 | Confidence values are shown to the user for every appearance result. |
| NFR-USE-02 | The UI works on mobile (checked in Phase 12). |

### 4.8 Portability and deployment

| ID | Requirement |
|---|---|
| NFR-DEP-01 | The Express API is containerised with a multi-stage Docker build, using the repository root as build context. |
| NFR-DEP-02 | The API listens on `process.env.PORT` (default 4000) and binds to `0.0.0.0`. |
| NFR-DEP-03 | Web is deployed to Vercel, API to Render (Docker runtime), data to MongoDB Atlas, images to Cloudinary. |

Details are in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 5. Constraints

| Constraint | Detail |
|---|---|
| Technology stack | Fixed. See [ARCHITECTURE.md](ARCHITECTURE.md) §1 |
| AI quotas | Provider free tiers are limited and must be handled gracefully |
| Measurements | No calibration exists, so measurements are ratios and proportions only |
| 3D | MVP avatar is simple (approximate proportions), not photorealistic |
| Delivery | 14 phases (0–13) on a recommended 12-day schedule |

---

## 6. External Interfaces

| Interface | Purpose |
|---|---|
| MongoDB Atlas (Mongoose) | Persistent application data |
| Cloudinary | Persistent image/file storage |
| Gemini API | Primary AI: fashion reasoning, recommendations, chatbot, sketch interpretation, design interpretation |
| Groq API | Fallback AI |
| MediaPipe | Face detection and pose landmarks |
| Hugging Face / Qwen Image Edit / Leffa | AI image generation, editing, try-on |
| PDFKit | Tailor PDF generation |

API contract is in [API.md](API.md). Data model is in [DATABASE.md](DATABASE.md). AI behavior is in [AI.md](AI.md).

---

## 7. Definition of Done

A feature is not complete just because the UI works. A complete feature has:

```
UI + API + Validation + Database + Error handling + Authorization + Tests + Documentation
```

---

## 8. Open Items / To Be Decided

- The blueprint gives no numeric performance targets (response times, throughput, concurrent users).
- It gives no numeric availability/uptime targets.
- It gives no rate-limit thresholds.
- It gives no `aiCache` expiry durations.
- It gives no data retention policy for user photos and generated images.
- It gives no logging format or log destination.
