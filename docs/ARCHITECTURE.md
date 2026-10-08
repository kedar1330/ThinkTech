# StyleMe — Architecture

> Source: StyleMe Final End-to-End Blueprint — §1–§6, §9, §11, §22–§25, §37, §41, §47–§51, §56

---

## 1. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB Atlas, Mongoose |
| Authentication | Auth.js (NextAuth) |
| AI | Gemini API (primary), Groq API (fallback) |
| Vision | MediaPipe |
| AI image generation / editing | Hugging Face, Qwen Image Edit, Leffa |
| 3D | Three.js, React Three Fiber, @react-three/drei, GLB/GLTF |
| Storage | Cloudinary |
| Validation | Zod |
| Client state | Zustand |
| Caching / jobs | Redis and BullMQ, **only when needed** (MongoDB cache first) |
| PDF | PDFKit |
| Deployment | Next.js → Vercel, Express API → Render |
| Source control | GitHub |
| CI/CD | GitHub Actions |
| Container | Docker |
| Monorepo tooling | pnpm workspaces |

---

## 2. Monorepo Structure

```
StyleMe/
│
├── apps/
│   │
│   ├── web/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── dashboard/
│   │   │   ├── profile/
│   │   │   ├── analyze/
│   │   │   ├── outfits/
│   │   │   ├── products/
│   │   │   ├── tryon/
│   │   │   ├── avatar/
│   │   │   ├── design/
│   │   │   ├── chat/
│   │   │   ├── tailor/
│   │   │   ├── api/
│   │   │   │   └── auth/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── auth/
│   │   │   ├── profile/
│   │   │   ├── analysis/
│   │   │   ├── outfits/
│   │   │   ├── products/
│   │   │   ├── tryon/
│   │   │   ├── avatar/
│   │   │   ├── design/
│   │   │   └── chat/
│   │   │
│   │   ├── lib/
│   │   │   ├── auth/
│   │   │   ├── api/
│   │   │   ├── cloudinary/
│   │   │   └── utils/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── public/
│   │   ├── auth.ts
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   └── api/
│       ├── src/
│       │   ├── config/
│       │   ├── controllers/
│       │   ├── middleware/
│       │   ├── models/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── validators/
│       │   ├── integrations/
│       │   │   ├── ai/
│       │   │   ├── cloudinary/
│       │   │   ├── mediapipe/
│       │   │   ├── tryon/
│       │   │   └── pdf/
│       │   ├── utils/
│       │   ├── jobs/
│       │   ├── app.ts
│       │   └── server.ts
│       │
│       ├── tests/
│       ├── scripts/
│       ├── Dockerfile
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── contracts/
│       ├── src/
│       │   ├── auth.ts
│       │   ├── profile.ts
│       │   ├── appearance.ts
│       │   ├── product.ts
│       │   ├── outfit.ts
│       │   ├── design.ts
│       │   ├── chat.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docs/
├── infra/
│   └── docker/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .env.example
├── .gitignore
├── .dockerignore
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── render.yaml
└── README.md
```

---

## 3. Responsibilities

### 3.1 `apps/web`: what the user sees
- UI, pages, components, forms, navigation
- Auth.js (browser/session authentication)
- Browser/client state (Zustand)
- API client
- 3D viewer (Three.js / React Three Fiber)
- MediaPipe browser processing

### 3.2 `apps/api`: what the application does
- REST API
- Authentication service and authorization
- Database access through Mongoose models
- Business logic
- AI orchestration
- Cloudinary server operations
- Product filtering, recommendation engine, budget engine
- PDF generation
- Rate limiting, error handling, logging

### 3.3 `packages/contracts`: what frontend and backend agree on
- Shared Zod schemas
- Shared TypeScript types
- Shared request/response contracts
- Keeps the frontend and backend in sync

```
apps/web  ──►  packages/contracts  ◄──  apps/api
```

### 3.4 Ownership summary

| Component | Role |
|---|---|
| apps/web | What the user sees |
| apps/api | What the application does |
| packages/contracts | What frontend and backend agree on |
| MongoDB Atlas | What the application remembers |
| Cloudinary | Where images live |
| Gemini / Groq | AI reasoning |
| MediaPipe | Visual landmarks |
| Hugging Face / Qwen / Leffa | Image generation/editing/try-on |
| Three.js / R3F | 3D |
| Zod | What data is valid |
| Zustand | Browser-side temporary state |
| Docker | Consistent runtime |
| GitHub Actions | Automated code checks |
| Vercel | Web deployment |
| Render | Express API deployment |

---

## 4. Request Architecture

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

The browser talks to Next.js. Next.js calls the Express API from the server side (BFF) using the authenticated session.

---

## 5. Authentication Architecture

```
Browser
    ↓
Next.js / Auth.js
    ↓
Express Auth API
    ↓
MongoDB
```

- **Auth.js** handles browser/session authentication.
- **Express** handles API/business authorization.

Login flow:

```
User enters email/password
    ↓
Next.js/Auth.js
    ↓
Express /v1/auth/login
    ↓
Validate credentials
    ↓
Compare password hash
    ↓
Create API access token
    ↓
Auth.js protected session
```

Security details are in [SECURITY.md](SECURITY.md).

---

## 6. Express Backend Pattern

Every backend feature normally follows:

```
HTTP Request
    ↓
Route
    ↓
Authentication Middleware
    ↓
Validation Middleware
    ↓
Controller
    ↓
Service
    ↓
Database / External Integration
    ↓
Response
```

| Layer | Folder | Responsibility |
|---|---|---|
| Route | `src/routes/` | Maps HTTP method + path to the middleware chain and controller |
| Middleware | `src/middleware/` | Authentication, validation, error handling, rate limiting |
| Validator | `src/validators/` | Zod request validation (using `packages/contracts`) |
| Controller | `src/controllers/` | HTTP concerns |
| Service | `src/services/` | Business logic |
| Model | `src/models/` | Database interaction (Mongoose) |
| Integration | `src/integrations/` | External provider communication |
| Jobs | `src/jobs/` | Background jobs (when BullMQ is introduced) |
| Config | `src/config/` | Configuration |

---

## 7. Data Layer

- **MongoDB Atlas** with **Mongoose**.
- Initial collections: `users`, `profiles`, `appearanceProfiles`, `products`, `outfits`, `designs`, `chatMessages`, `aiCache`.
- User-specific data is isolated by authenticated user.

Full schema is in [DATABASE.md](DATABASE.md).

---

## 8. AI Architecture

```
Application
    ↓
AI Service
    ↓
AI Router
    ├── Gemini
    └── Groq fallback
```

AI output pipeline:

```
AI → Parse → Zod → Business validation → Use result
(If invalid: Retry / Fallback / Clear error)
```

Full AI design is in [AI.md](AI.md).

---

## 9. Vision Architecture

### 9.1 Skin tone
```
Face Photo → Quality Validation → MediaPipe / Face Detection → Skin Region
→ Pixel/Color Analysis → Monk Skin Tone Estimate → Range + Confidence
```

### 9.2 Body shape
```
MediaPipe Pose → Body Landmarks → Shoulder / Chest / Waist / Hip / Torso / Leg proportions
→ Ratios → Body Shape Classification
```

MediaPipe browser processing is listed under `apps/web`, and `integrations/mediapipe/` exists under `apps/api`.

---

## 10. Recommendation and Budget Architecture

```
User Request → Profile → Confirmed Appearance → Hard Filters → MongoDB Products
→ Candidate Ranking → Gemini Reasoning → Zod Validation → Budget Validation → Final Outfit
```

- Product filtering and ranking happen in code before AI is involved. The full catalog is never sent to Gemini.
- The budget engine is pure code.

---

## 11. AI Try-On Architecture

Try-on is isolated:

```
integrations/tryon/
    ├── leffa.ts
    ├── huggingface.ts
    ├── qwen.ts
    └── tryon.service.ts
```

```
User Photo + Garment Image → Try-On Service → Leffa / Hugging Face / Qwen
→ Generated Image → Cloudinary → MongoDB Result → Frontend
```

If it is unavailable: "Try-on is currently unavailable." The rest of the application keeps working.

---

## 12. 3D Avatar Architecture

- Three.js + React Three Fiber + @react-three/drei, rendering a GLB/GLTF model in `apps/web`.
- MVP: front, side, back, rotate, zoom, approximate proportions.
- No photorealistic human reconstruction in the first MVP.

---

## 13. Design Studio, Sketch and PDF Architecture

- **Design state** (Garment, Color, Fabric, Neck, Sleeve, Length, Fit, Pattern, Embroidery) is held in **Zustand** while editing. Completed designs are saved in **MongoDB**.
- **Sketch-to-design:** Sketch → Gemini Vision → Structured Garment JSON → Zod → User Confirmation → Design Generation.
- **Chatbot:** Browser → `POST /v1/chat` → Auth → Load confirmed profile → Relevant context → Gemini → Response → MongoDB.
- **Tailor PDF:** Design → Specification JSON → PDFKit (`integrations/pdf/`) → Tailor PDF.

---

## 14. Storage Architecture

Cloudinary stores all persistent images:

- Profile photos
- Face photos
- Full-body photos
- Generated try-on images
- Design images
- Sketch images

User images and generated images are **never** stored on Render's local filesystem.

---

## 15. Caching and Jobs Strategy

| Stage | Mechanism |
|---|---|
| Start | MongoDB-based AI cache (`aiCache` collection) |
| Later, when needed | Redis for high-frequency caching, rate-limit counters, temporary state, distributed locks, background jobs |
| Later, when tasks become long-running | BullMQ for AI image generation, try-on, large PDF generation, image processing, batch processing |

Redis is not added just because it is on the tech stack.

---

## 16. Deployment Topology

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

| Platform | Responsibilities |
|---|---|
| Vercel | Next.js frontend, web UI, Auth.js, SSR/SEO, frontend deployment |
| Render | Express REST API, Docker container, business logic, AI orchestration, database access, image processing, PDF generation |
| MongoDB Atlas | Persistent application data |
| Cloudinary | Persistent image/file storage |
| AI providers | Gemini, Groq, Hugging Face, Qwen, Leffa |

**Monorepo deployment rule:** both `apps/web` and `apps/api` depend on `packages/contracts`, so the deployment system must have access to the workspace root. Do not configure the backend as if `apps/api` were an independent repository unless the shared package has been published separately.

Deployment procedures are in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 17. Central Data Flow

```
USER
 ↓
AUTH
 ↓
PROFILE
 ↓
PHOTOS
 ↓
CLOUDINARY
 ↓
MEDIAPIPE
 ↓
APPEARANCE ANALYSIS
 ↓
CONFIDENCE
 ↓
USER CONFIRMATION
 ↓
STYLE PROFILE
 ↓
PRODUCT FILTERING
 ↓
RANKING
 ↓
GEMINI
 ↓
ZOD
 ↓
BUDGET ENGINE
 ↓
OUTFIT
 ├── PRODUCT
 ├── TRY-ON
 ├── 3D AVATAR
 └── DESIGN STUDIO
          ↓
      SKETCH AI
          ↓
       CHATBOT
          ↓
       PDFKIT
          ↓
      TAILOR PDF
```

---

## 18. Architecture Decisions and Principles

| Decision | Choice |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | Next.js + TypeScript, Tailwind + shadcn/ui, Zustand, Auth.js |
| Backend | Express + Node.js + TypeScript |
| Database | MongoDB Atlas + Mongoose |
| Shared | `packages/contracts` with Zod |
| AI | Gemini, with Groq fallback |
| Vision | MediaPipe |
| Image AI | Hugging Face, Qwen Image Edit, Leffa |
| 3D | Three.js, React Three Fiber |
| Storage | Cloudinary |
| Cache/jobs | MongoDB cache first; Redis/BullMQ only when needed |
| PDF | PDFKit |
| Container | Docker |
| Source / CI | GitHub / GitHub Actions |
| Deployment | Next.js → Vercel, Express → Render, MongoDB → Atlas, Images → Cloudinary |

**Avoid initially:** microservices, Kubernetes, a separate Python service, a separate database per module, complex event architecture, a huge product marketplace, overly complex recommendation ML, unnecessary infrastructure.

**Core principles:**

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

## 19. Open Items / To Be Decided

- MediaPipe runs both in the browser (`apps/web`) and as an API integration (`apps/api/src/integrations/mediapipe/`). The exact split of vision processing between the two isn't specified.
- The API access token format and how Auth.js passes it to Express aren't specified.
- The source of the GLB/GLTF avatar model and how proportions are applied to it aren't specified.
- How the try-on provider is selected among Leffa, Hugging Face and Qwen (order or criteria) isn't specified.
- What the API uses for logging isn't specified.
