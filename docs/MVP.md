# StyleMe — Minimum Viable Product (MVP)

> Source of truth: StyleMe Final End-to-End Blueprint (`StyleMe APP.txt`). Main sections used: Project Overview, §1, §8–§28, §34–§38, §52–§56.
>
> Related documents: [BRD](BRD.md) · [FRD](FRD.md) · [SRS](SRS.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [API](API.md) · [AI](AI.md) · [SECURITY](SECURITY.md) · [TESTING](TESTING.md) · [DEPLOYMENT](DEPLOYMENT.md) · [CONTRIBUTING](CONTRIBUTING.md)

> **Terminology note:** in the blueprint, "Phase 0–13" are **development phases** of building this MVP (for example, Phase 2 = Database + Authentication). They are not product releases. In this document, **"Future scope"** means anything the blueprint defers until "the actual application requires" it (§37, §56), or explicitly excludes from the first MVP.

---

## 1. MVP Overview and Objective

### 1.1 Overview
StyleMe is an **AI-powered personal fashion stylist focused on Indian users**. The MVP takes a user from account creation, through photo-based appearance analysis and budget-validated outfit recommendations, to AI visualisation, custom garment design and a downloadable tailor specification.

### 1.2 Objective
> At the end of the project, StyleMe should be a **working MVP, not just a UI demo** (§54).

The MVP must:

1. Deliver the full end-to-end user journey (§4) **live in production**: web on Vercel, API on Render.
2. Keep the core layers **deterministic and reliable**: recommendation, profile, product, budget, validation, security and deployment.
3. Treat AI and vision features as **probabilistic**, and handle them with **confidence, validation, caching, fallbacks and user confirmation**.
4. Stay a **modular monorepo** without over-engineering (§56).

---

## 2. Problem and Target Users

### 2.1 Problem
Users who want personal fashion guidance need recommendations that take into account their **appearance** (skin tone, undertone, body shape), their **preferences**, the **occasion**, and a **real budget**, linked to actual products they can browse. StyleMe brings these together in one guided journey. It also lets users visualise outfits and design custom garments for a tailor.

### 2.2 Target users

| Attribute | MVP definition |
|---|---|
| Market | Indian users |
| Currency | Indian Rupee (₹) |
| Wardrobe | Western and Indian wear: T-shirts, Shirts, Jeans, Trousers, Kurtas, Kurtis, Sarees, Lehengas, Shoes, Accessories |
| Profile captured | Gender, age range, height, size, budget, liked/disliked colors, preferred styles, preferred occasions |
| Core need | Personalised, budget-valid outfit suggestions for a chosen occasion and style |

---

## 3. MVP Features and Scope

### 3.1 Included in the MVP

Every capability below is **in scope** for the MVP (§52, §54).

| ID | Capability | MVP scope (what is delivered) | Phase | FRD ref |
|---|---|---|---|---|
| MVP-01 | **Account creation / authentication** | Register, login, logout. Auth.js session on the web, API access token checked by Express. Protected pages and protected API | 2 | FR-AUTH |
| MVP-02 | **Style profile creation** | Dashboard + navigation. Profile form: gender, ageRange, height, size, budget, likedColors, dislikedColors, preferredStyles, preferredOccasions. Saved in MongoDB | 3 | FR-PROF |
| MVP-03 | **Face and full-body photo upload** | Upload both photos, run image quality validation, store in Cloudinary | 4 | FR-APP-01…04 |
| MVP-04 | **Appearance analysis** | MediaPipe face detection and pose landmarks drive the analysis pipeline | 4 | FR-APP |
| MVP-05 | **Skin tone and undertone** | Monk Skin Tone value + range + confidence. Undertone (Warm / Cool / Neutral / Olive / Unknown) + confidence | 4 | FR-APP-05, 06 |
| MVP-06 | **Body shape analysis** | Proportion ratios → Rectangle / Triangle / Inverted Triangle / Oval / Hourglass + confidence. No calibrated measurements | 4 | FR-APP-07, 08 |
| MVP-07 | **User confirmation / correction** | Confirmation screen with confidence values and Confirm / Edit. Confirmed values stored with `confidence: 1` and `userConfirmed: true` | 4 | FR-CONF |
| MVP-08 | **Personal fashion profile** | Profile + confirmed appearance together form the source of truth for recommendations and chat | 3–4 | FR-PROF, FR-CONF-06 |
| MVP-09 | **Occasion / style / budget selection** | The user picks occasion, style and budget for a recommendation request | 6 | FR-REC-01 |
| MVP-10 | **Product filtering** | Curated catalog of 500–2,000 products, loaded by a seed script. Search and filters. Hard filters: gender → category → occasion → size → color → price → style | 5–6 | FR-PROD, FR-REC-03 |
| MVP-11 | **AI outfit recommendations** | Candidate ranking → top candidates → Gemini reasoning (Groq fallback) → Zod validation | 6 | FR-REC |
| MVP-12 | **Budget validation** | Pure-code budget engine: `totalPrice <= budget`, using only stored product prices | 6 | FR-BUD |
| MVP-13 | **Outfit suggestions** | Outfit cards, "Why this works", price breakdown, total price, save outfit, outfit history | 7 | FR-OUT |
| MVP-14 | **Product details** | Product detail view (`GET /v1/products/:id`) | 5 | FR-PROD-05 |
| MVP-15 | **AI try-on** | User photo + garment image → Leffa / Hugging Face / Qwen → generated image in Cloudinary → result in MongoDB. Fails gracefully | 8 | FR-TRY |
| MVP-16 | **3D avatar** | GLB/GLTF avatar in Three.js / React Three Fiber / drei. Front, side and back views, rotate, zoom, approximate proportions | 9 | FR-AVT |
| MVP-17 | **Design Studio** | Choose Garment, Color, Fabric, Neck, Sleeve, Length, Fit, Pattern, Embroidery. Preview. Zustand state while editing, saved to MongoDB | 10 | FR-DES |
| MVP-18 | **Sketch-to-AI design** | Sketch → Gemini Vision → structured garment JSON → Zod → user confirmation → design generation | 11 | FR-SKT |
| MVP-19 | **Fashion chatbot** | Authenticated chat that uses the confirmed profile and relevant context with Gemini. Messages stored in MongoDB | 11 | FR-CHAT |
| MVP-20 | **Tailor specification PDF** | Design → specification JSON → PDFKit → downloadable PDF | 11 | FR-PDF |
| MVP-21 | **Live deployment** | Docker (API), GitHub Actions CI, Vercel (web), Render (API), `/health`, production QA | 13 | — |

### 3.2 MVP boundaries per capability

| Capability | Included | Not in MVP |
|---|---|---|
| Product catalog | 500–2,000 curated, high-quality products | Millions of records, a huge marketplace |
| Body analysis | Ratios and shape class, with confidence | Exact waist/chest measurements without calibration |
| Undertone | Five values including **Unknown** | Forcing a value when uncertain |
| Recommendation | Hard filters + ranking + Gemini reasoning | Overly complex recommendation ML |
| 3D avatar | Simple GLB model, approximate proportions, front/side/back, rotate, zoom | Photorealistic human reconstruction |
| Try-on | Integrated, with graceful degradation ("Try-on is currently unavailable.") | Breaking the rest of the app when try-on fails |
| Caching | MongoDB `aiCache` | Redis (until needed) |
| Background jobs | — | BullMQ (until tasks become long-running) |

---

## 4. End-to-End User Journey

```
Create Account
    ↓
Create Style Profile
    ↓
Upload Face + Full-Body Photos
    ↓
Appearance Analysis
    ↓
Skin Tone + Undertone + Body Shape
    ↓
Confidence Score
    ↓
User Confirms / Corrects
    ↓
Personal Fashion Profile
    ↓
Select Occasion + Style + Budget
    ↓
Product Filtering
    ↓
AI Recommendation
    ↓
Budget Validation
    ↓
Outfit Suggestions
    ↓
Product Details
    ↓
AI Try-On
    ↓
3D Avatar
    ↓
Design Studio
    ↓
Sketch → AI Design
    ↓
Fashion Chatbot
    ↓
Tailor Specification PDF
```

### 4.1 User capability checklist (§52)

A user of the MVP must be able to:

1. Register
2. Login
3. Create fashion profile
4. Upload face photo
5. Upload full-body photo
6. Run appearance analysis
7. See skin tone, undertone, body shape
8. See confidence values
9. Confirm or edit results
10. Select style/occasion/budget
11. Receive personalized outfit recommendations
12. Verify that the outfit fits the budget
13. View product details
14. Try AI visualization
15. View 3D avatar
16. Create a garment design
17. Upload a sketch
18. Convert sketch to structured design
19. Chat with the fashion assistant
20. Generate a tailor specification
21. Download the PDF
22. Logout

---

## 5. Functional Requirements (MVP)

Requirement IDs match [FRD.md](FRD.md). This section lists the MVP-critical behavior of each capability.

### 5.1 Authentication (MVP-01)
- Register (`POST /v1/auth/register`) with email, password and name. Only the password hash is stored.
- Login (`POST /v1/auth/login`): validate credentials → compare password hash → create API access token → Auth.js protected session.
- Current user (`GET /v1/auth/me`). Logout.
- All pages except login/register, and all endpoints except register, login and `/health`, require authentication.

### 5.2 Profile (MVP-02, MVP-08)
- `GET /v1/profile`, `PUT /v1/profile`. The profile is saved in `profiles` for the authenticated user only.

### 5.3 Photo upload and appearance analysis (MVP-03 – MVP-06)
- Face and full-body photos are stored in **Cloudinary**, never on the API server's filesystem.
- **Quality validation** comes first. Bad, dark, multiple-people, no-face and partial-body photos are handled clearly.
- **Skin tone:** face detection → skin region → pixel/color analysis → Monk estimate + range + confidence (e.g. Monk 5, range 4–5, 84%).
- **Undertone:** skin/color characteristics + AI reasoning → Warm / Cool / Neutral / Olive / **Unknown** (when uncertain) + confidence.
- **Body shape:** MediaPipe Pose landmarks → shoulder/chest/waist/hip/torso/leg proportions → ratios → shape class + confidence.
- Endpoints: `POST /v1/appearance/analyze`, `GET /v1/appearance`.

### 5.4 Confirmation / correction (MVP-07)
- Show each result with its confidence. **Confirm** or **Edit**.
- `PUT /v1/appearance/confirm` stores `{ value, confidence: 1, userConfirmed: true }`.
- Uncertain classifications are never forced. Confirmed values override AI estimates everywhere downstream.

### 5.5 Recommendation, filtering and budget (MVP-09 – MVP-12)
```
User Request → Profile → Confirmed Appearance → Hard Filters → MongoDB Products
→ Candidate Ranking → Gemini Reasoning → Zod Validation → Budget Validation → Final Outfit
```
- The full catalog is **never** sent to Gemini. Only the top ranked candidates are.
- The budget is computed in code from stored prices. An outfit is **VALID** only if `totalPrice <= budget`.
- AI never invents or overrides prices.
- Endpoint: `POST /v1/recommendations`.

### 5.6 Outfits and products (MVP-10, MVP-13, MVP-14)
- Outfit cards with "Why this works", per-item price breakdown and total.
- Save (`POST /v1/recommendations/:id/save`) and history (`GET /v1/outfits`).
- Product browsing, search and filters (`GET /v1/products`), and product detail (`GET /v1/products/:id`).

### 5.7 AI try-on (MVP-15)
- `POST /v1/tryon`, `GET /v1/tryon/:id`. The generated image goes to Cloudinary and the result to MongoDB.
- If unavailable, show **"Try-on is currently unavailable."** The rest of the app keeps working.

### 5.8 3D avatar (MVP-16)
- GLB/GLTF model viewer: front, side, back, rotate, zoom, approximate proportions.

### 5.9 Design Studio and sketch-to-design (MVP-17, MVP-18)
- Design attributes: Garment, Color, Fabric, Neck, Sleeve, Length, Fit, Pattern, Embroidery. Preview. Save.
- `POST /v1/design`, `GET /v1/design/:id`, `POST /v1/design/sketch`, `POST /v1/design/generate`.
- Sketch output example: `{ "garment": "kurta", "neck": "mandarin", "sleeve": "full", "length": "knee", "fit": "regular", "fabric": "cotton", "color": "navy" }`. The user confirms it before generation.

### 5.10 Fashion chatbot (MVP-19)
- `POST /v1/chat`, `GET /v1/chat/conversations`.
- Auth → load confirmed profile → relevant context only → Gemini → response → MongoDB.

### 5.11 Tailor PDF (MVP-20)
- `POST /v1/tailor/pdf`. The PDF contains Garment, Fabric, Color, Neck, Sleeve, Length, Fit, Pattern, Embroidery, Design image and Tailor instructions. The user can download it.

### 5.12 Cross-cutting
- Standard response envelope: `{ success: true, data }`, or `{ success: false, error: { code, message } }`.
- `GET /health` for health checks.

---

## 6. AI Capabilities (MVP)

| Capability | Provider(s) | MVP safeguard |
|---|---|---|
| Face detection / skin region | MediaPipe | Quality validation, confidence, user confirmation |
| Pose landmarks / body proportions | MediaPipe Pose | Ratios only (no calibration), confidence, user confirmation |
| Undertone reasoning | Gemini (Groq fallback) | "Unknown" when uncertain, confidence, user confirmation |
| Outfit reasoning | Gemini (Groq fallback) | Pre-filtered candidates only, Zod, coded budget check |
| Sketch interpretation | Gemini Vision | Zod garment schema, user confirmation before generation |
| Design interpretation | Gemini | Zod validation. The provider for design **generation** isn't specified in the blueprint (open item) |
| Fashion chatbot | Gemini (Groq fallback) | Confirmed profile + relevant context only, no fake answers |
| Virtual try-on | Leffa / Hugging Face / Qwen Image Edit | Isolated in `integrations/tryon/`, graceful "unavailable" message |

### 6.1 AI rules the MVP must enforce (§36)
1. Never claim exact visual measurements without calibration.
2. Never force low-confidence classifications.
3. Show confidence.
4. Allow user correction.
5. User-confirmed data overrides AI estimation.
6. AI cannot invent product prices.
7. Budget is validated by code.
8. AI JSON is validated using Zod.
9. AI failures produce real errors/fallbacks.
10. Never expose API keys.

### 6.2 AI reliability pattern
```
AI → Parse → Zod → Business validation → Use result
If invalid → Retry / Fallback / Clear error
```
- Gemini is primary and Groq is the fallback, through a single **AI Router**.
- Free tiers are **not** unlimited, so quota exhaustion must be handled gracefully.
- AI responses are cached in MongoDB `aiCache`.

Full details are in [AI.md](AI.md).

---

## 7. Technical Requirements

| Layer | MVP technology |
|---|---|
| Monorepo | pnpm workspaces: `apps/web`, `apps/api`, `packages/contracts` |
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui, Zustand |
| Authentication | Auth.js (NextAuth) + Express auth API |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB Atlas + Mongoose |
| Shared contracts | Zod schemas + TypeScript types in `packages/contracts` |
| AI | Gemini API (primary), Groq API (fallback) |
| Vision | MediaPipe |
| Image AI / try-on | Hugging Face, Qwen Image Edit, Leffa |
| 3D | Three.js, React Three Fiber, @react-three/drei, GLB/GLTF |
| Storage | Cloudinary |
| PDF | PDFKit |
| Container | Docker (API, multi-stage build, repository-root build context), Docker Compose |
| CI | GitHub Actions: typecheck → lint → unit/API tests → build |
| Hosting | Vercel (web, root `apps/web`), Render (API, Docker, `apps/api/Dockerfile`, health `/health`) |

**Backend pattern (every feature):**
```
Route → Authentication Middleware → Validation Middleware → Controller → Service
→ Database / External Integration → Response
```

**API runtime:** `const port = Number(process.env.PORT) || 4000;` bound to `0.0.0.0`.

**MVP starting set (§56):** Next.js, Express, MongoDB, Mongoose, Auth.js, Zod, Cloudinary, Gemini, MediaPipe, Zustand, Three.js/R3F, PDFKit. Groq and the try-on providers (Hugging Face / Qwen / Leffa) are added in their phases (Groq fallback is issue #22, try-on Phase 8).

Details are in [ARCHITECTURE.md](ARCHITECTURE.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 8. Data / Backend Requirements

### 8.1 Collections

| Collection | MVP purpose | Key fields |
|---|---|---|
| `users` | Accounts | email, passwordHash, name, role, isActive, createdAt, updatedAt |
| `profiles` | Fashion profile | userId, gender, ageRange, height, size, budget, likedColors[], dislikedColors[], preferredStyles[], preferredOccasions[] |
| `appearanceProfiles` | Analysis results | userId, skinTone{monkValue, range, confidence}, undertone{value, confidence}, bodyShape{value, confidence}, proportions, userConfirmed, analysisVersion |
| `products` | Curated catalog | name, brand, category, gender, price, colors[], sizes[], fabric, styles[], occasions[], imageUrl, productUrl, tags[], active |
| `outfits` | Saved outfits | userId, occasion, budget, items[], totalPrice, explanation, aiModel |
| `designs` | Saved designs | Fields to be defined (see [DATABASE.md](DATABASE.md)) |
| `chatMessages` | Chat history | Fields to be defined |
| `aiCache` | AI response cache | cacheKey (indexed), provider, model, requestType, response, createdAt, expiresAt |

### 8.2 Backend responsibilities (`apps/api`)
REST API · authentication service · authorization · Mongoose models · business logic · AI orchestration · Cloudinary server operations · product filtering · recommendation engine · budget engine · PDF generation · rate limiting · error handling · logging.

### 8.3 API surface
All 22 `/v1` endpoints plus `GET /health`, as listed in [API.md](API.md), are part of the MVP.

### 8.4 Seed data
A seed script loads **500–2,000** curated products across the ten categories. The goal is good filtering, useful recommendations and reliable product data.

---

## 9. Security and Privacy

| Area | MVP requirement |
|---|---|
| Transport | HTTPS |
| Authentication | Secure authentication, password hashing |
| Authorization | API authorization on every protected route |
| Data isolation | User-specific data isolated by authenticated user |
| Input validation | Zod validation of all requests |
| AI output | Zod + business validation of all AI output |
| Secrets | API keys server-side only. `.env` git-ignored. No secrets in Git or Docker images. Never `NEXT_PUBLIC_` for secrets |
| Abuse control | Rate limiting on expensive endpoints |
| Web security | CORS configured correctly. Helmet / security headers |
| Image privacy | All user and generated images in Cloudinary, never on Render's filesystem. Image privacy considered |
| AI data minimisation | Only relevant profile/context is sent to AI (chatbot, recommendations) |
| Errors | Safe messages. No stack traces, secrets, database details or internal errors |
| Database | MongoDB Atlas access secured |

Full checklist in [SECURITY.md](SECURITY.md).

---

## 10. Non-Functional Requirements

| Category | MVP requirement |
|---|---|
| Reliability | Deterministic core layers (profile, product, budget, validation, security, deployment) |
| Correctness | Budget is code-validated. Prices come only from the database |
| Graceful degradation | AI quota/outage → fallback or clear error. Try-on outage does not affect the rest of the app |
| Performance | Catalog pre-filtering before AI. MongoDB AI cache. Minimal AI context. Try-on caching where useful |
| Scalability | Modular monorepo. Stateless file handling (Cloudinary). Redis/BullMQ deferred until needed |
| Maintainability | TypeScript, shared contracts, layered backend, isolated integrations, `/v1` versioning |
| Usability | Confidence always shown. User can correct results. Mobile UI checked |
| Observability | `/health` endpoint. Logging in the API |
| Deployability | Docker image for the API. CI on PRs and pushes to `main`. No direct feature-branch deploys to production |

Full list in [SRS.md](SRS.md).

---

## 11. MVP Exclusions / Future Scope

### 11.1 Explicitly excluded from the MVP (§24, §56)
- Microservices
- Kubernetes
- Separate Python service
- Separate database per module
- Complex event architecture
- Huge product marketplace
- Overly complex recommendation ML
- Unnecessary infrastructure
- Photorealistic human reconstruction for the 3D avatar
- MongoDB running in Docker
- Exact physical body measurements without real-world calibration

### 11.2 Future scope (introduced only when the application requires it, §37, §38, §56)

| Item | Introduced when needed for |
|---|---|
| Redis | High-frequency caching, rate-limit counters, temporary state, distributed locks, background jobs |
| BullMQ | Long-running tasks: AI image generation, try-on, large PDF generation, image processing, batch processing |
| Redis in Docker Compose | Once Redis is adopted |
| More advanced AI / image processing | When the application requires it |
| A separately published `packages/contracts` | Only if the API ever needs to deploy as an independent repository (§48) |

---

## 12. Definition of Done

A feature is **not complete only because the UI works** (§53). Each MVP capability (MVP-01 … MVP-21) is done only when it has:

- [ ] UI
- [ ] API
- [ ] Validation
- [ ] Database
- [ ] Error handling
- [ ] Authorization
- [ ] Tests
- [ ] Documentation

**Reference example: AI Try-On is done when:**
- Upload works
- API works
- Auth works
- Input is validated
- AI failure is handled
- Result is stored
- Unauthorized access is blocked
- Tests pass

---

## 13. MVP Success Criteria

The MVP is successful when **all** of the following are true:

### 13.1 Journey completeness
The target result (§54) works end-to-end in production:

```
User → Register → Profile → Upload photos → Appearance analysis → Confirm result
→ Personalized recommendations → Real coded budget validation → Product browsing
→ AI try-on → 3D avatar → Design studio → Sketch AI → Fashion chatbot → Tailor PDF
→ Live deployment
```

### 13.2 Verifiable acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| 1 | All 22 user capabilities in §4.1 work | E2E test flow ([TESTING.md](TESTING.md) §7) |
| 2 | Every recommended outfit satisfies `totalPrice <= budget`, using stored prices only | Budget unit tests + API tests |
| 3 | Appearance results always show confidence and can be confirmed or edited. Confirmed values persist with `userConfirmed: true` | API + E2E tests |
| 4 | Bad, dark, no-face, multiple-people and partial-body photos are handled without forced results | AI tests |
| 5 | Invalid AI JSON, Gemini unavailable and Groq unavailable produce fallbacks or clear errors, never fake answers | AI failure tests |
| 6 | Try-on outage shows "Try-on is currently unavailable." and the rest of the app works | AI / E2E tests |
| 7 | Unauthenticated and cross-user access is blocked | Authentication / authorization tests |
| 8 | Error responses never leak stack traces, secrets or internals | API tests |
| 9 | The security checklist (§35) is complete | [SECURITY.md](SECURITY.md) §11 |
| 10 | CI (typecheck, lint, tests, build) passes on `main` | GitHub Actions |
| 11 | Web is live on Vercel, API is live on Render, and `/health` passes | Production QA |
| 12 | Every MVP capability meets the Definition of Done | Feature review |

---

## 14. Open Items Affecting the MVP

These are not defined in the blueprint and must be decided during implementation. The full lists are in each document's "Open Items" section.

- Fields for the `designs` and `chatMessages` collections, the conversation model, and how try-on results are stored.
- Exact request/response schemas (Zod contracts) and the error code list.
- Confidence thresholds for "low confidence" / Unknown, and the ratio rules behind body-shape classification.
- The candidate ranking algorithm.
- Rate-limit thresholds, token lifetime, password-hash algorithm, and logout handling on the API side.
- Test frameworks and the rollback procedure.
- Content and source of the "Tailor instructions" in the PDF.
- Which provider performs design generation (`POST /v1/design/generate`).
- How the 3D avatar's approximate proportions are derived.
