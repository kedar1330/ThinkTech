# StyleMe — Implementation Plan

> **Sources of truth:** StyleMe Final End-to-End Blueprint (`StyleMe APP.txt`), [MVP.md](MVP.md), and the project docs: [FRD](FRD.md) · [SRS](SRS.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [API](API.md) · [AI](AI.md) · [SECURITY](SECURITY.md) · [TESTING](TESTING.md) · [DEPLOYMENT](DEPLOYMENT.md) · [CONTRIBUTING](CONTRIBUTING.md).
>
> This plan turns the blueprint's development phases (§30), 12-day schedule (§31) and GitHub issues #1–#38 (§33) into an ordered, actionable build plan. It adds no requirements and doesn't change the approved stack. Where the sources are silent, the gap is listed as a **Decision needed (D-xx)** in §5 instead of being assumed.

---

## 1. How to Use This Plan

### 1.1 Terminology
- **Phase 0–13** are *development phases* of the MVP (blueprint §30). They are not product releases.
- **MVP** is everything in [MVP.md](MVP.md) §3 (capabilities MVP-01 … MVP-21).
- **Future scope** is work the blueprint defers until "the actual application requires" it (§37, §56). It is listed separately in §6 and is **not** scheduled in Phases 0–13. This plan doesn't use the label "Phase 2 work" for future scope, because in the blueprint "Phase 2" is *Database + Authentication*.

### 1.2 Working rules for every phase
These apply to every phase and are not repeated in each one:

1. **Workflow** ([CONTRIBUTING.md](CONTRIBUTING.md)): Issue → `feature/*` branch → implementation → local testing → pull request → GitHub Actions (once Phase 13 sets it up) → code review → merge.
2. **Backend pattern:** Route → Authentication middleware → Validation middleware → Controller → Service → Database / Integration → Response.
3. **Contracts first:** each module's Zod schemas and types go in `packages/contracts/src/<module>.ts` before the API and UI use them.
4. **Response envelope:** `{ success: true, data }`, or `{ success: false, error: { code, message } }`. Never leak stack traces, secrets or internals.
5. **AI pipeline:** AI → Parse → Zod → Business validation → Use. If invalid: Retry, Fallback or Clear error. Never fake answers.
6. **Storage:** all user and generated images go to Cloudinary, never to the API filesystem.
7. **Data isolation:** every user-owned query is scoped to the authenticated user.
8. **Per-feature Definition of Done** (§8): UI + API + Validation + Database + Error handling + Authorization + Tests + Documentation. Each phase writes the **unit and API tests for its own features**. Phase 12 adds the cross-cutting E2E, AI-failure and security work and fills any gaps. It does not rewrite earlier tests.

### 1.3 Repository starting point
The monorepo folder structure from blueprint §2 already exists, with empty placeholder files, on `main` in GitHub. The Phase 0 documents already exist in `docs/`.

---

## 2. Phase Overview and Dependencies

| Phase | Name | GitHub issues | Schedule (§31) | Depends on | MVP capabilities |
|---|---|---|---|---|---|
| 0 | Planning | #1 | Pre-Day 1 | — | — |
| 1 | Monorepo Foundation | #2, #3, #4, #5 | Day 1 | 0 | — |
| 2 | Database + Authentication | #6, #7, #8, #9 | Day 1 | 1 | MVP-01 |
| 3 | Profile + Dashboard | #10 | Day 2 | 2 | MVP-02 |
| 4 | Appearance AI (incl. AI & Cloudinary foundations) | #11, #12, #13, #14, #21, #22 | Days 2–3 | 3 | MVP-03 … MVP-08 |
| 5 | Product Catalog | #15, #16, #17 | Day 4 | 2 | MVP-10 (catalog), MVP-14 |
| 6 | Recommendation Engine | #18, #19 | Day 5 | 3, 4, 5 | MVP-09 … MVP-12 |
| 7 | Outfit Experience | #20 | Day 6 | 6 | MVP-13 |
| 8 | AI Try-On | #23 | Day 7 | 4 (Cloudinary), 5 | MVP-15 |
| 9 | 3D Avatar | #24 | Day 8 | 4 (appearance data) | MVP-16 |
| 10 | Design Studio | #25 | Day 9 | 2, 4 (Cloudinary) | MVP-17 |
| 11 | Sketch + Chat + PDF | #26, #27, #28 | Day 10 | 4 (AI foundation), 10 | MVP-18, MVP-19, MVP-20 |
| 12 | Testing + Security | #29, #30, #31, #32 | Day 11 | 1–11 | Cross-cutting |
| 13 | Docker + CI/CD + Deployment | #33 … #38 | Day 12 | 12 | MVP-21 |

### 2.1 Dependency graph

```
P0 Planning
 └─► P1 Monorepo Foundation
      └─► P2 Database + Auth
           ├─► P3 Profile + Dashboard
           │    └─► P4 Appearance AI ──(AI router, Cloudinary, aiCache)──┐
           │         │                                                   │
           ├─► P5 Product Catalog                                        │
           │         │                                                   │
           │    P3 + P4 + P5 ─► P6 Recommendation ─► P7 Outfit Experience│
           │                                                             │
           │    P4 + P5 ─► P8 AI Try-On                                  │
           │    P4      ─► P9 3D Avatar                                  │
           └─► P10 Design Studio (needs P4 Cloudinary) ─► P11 Sketch + Chat + PDF ◄─┘
                                                                  │
                         P1 … P11 ─► P12 Testing + Security ─► P13 Docker + CI/CD + Deploy
```

**Parallel work:** Phase 5 only depends on Phase 2, so it can run alongside Phases 3–4. Phases 8, 9 and 10 depend only on Phase 4/5 foundations and can run in parallel if the team is large enough. The order in §2 is the single-team default from blueprint §31.

### 2.2 Milestones

| Milestone | Reached at end of | Demonstrable outcome |
|---|---|---|
| **M1 — Foundation** | Phase 2 | Monorepo builds. A user can register, log in and log out. Protected pages and protected API work |
| **M2 — Personal Fashion Profile** | Phase 4 | The user completes a profile, uploads photos, sees skin tone / undertone / body shape with confidence, and confirms or edits them |
| **M3 — Recommendations** | Phase 7 | The user picks occasion, style and budget and gets budget-valid outfits with explanations, price breakdown, save and history |
| **M4 — Visualisation** | Phase 9 | AI try-on works (or degrades gracefully). 3D avatar viewer works |
| **M5 — Create & Assist** | Phase 11 | Design Studio, sketch-to-design, fashion chatbot and tailor PDF download work |
| **M6 — Hardened** | Phase 12 | E2E flow passes. AI-failure, auth and authorization tests pass. Security checklist complete |
| **M7 — MVP Live** | Phase 13 | Web on Vercel, API on Render, `/health` green, CI passing, production QA signed off |

---

## 3. MVP Implementation Phases

---

### Phase 0 — Planning
**Issue:** #1 Project documentation · **Status:** documents created in `docs/`.

**Objective:** finalise requirements and design before writing code.

**Scope:** BRD, FRD, SRS, architecture, database design, API specification, AI design, security plan, deployment plan, GitHub repository.

**Tasks**
1. Review the docs in `docs/` with the team (BRD, FRD, SRS, ARCHITECTURE, DATABASE, API, AI, SECURITY, TESTING, DEPLOYMENT, CONTRIBUTING, MVP).
2. Work through the **Decision needed** items in §5 that block Phases 1–4 (at least D-01 … D-08) and record the answers in the relevant docs.
3. Create GitHub issues #2–#38 from blueprint §33 and link each to its phase.
4. Create the `develop` branch (branch strategy: `main`, `develop`, `feature/*`, `fix/*`), subject to D-21.
5. Set up accounts and access: MongoDB Atlas, Cloudinary, Gemini API, Groq API, Hugging Face, Vercel, Render.

**Dependencies:** none.

**Deliverables:** approved docs, issue backlog #2–#38, provider accounts, decisions log.

**Testing / validation:** document review against the blueprint (§29 content checklist per document).

**Completion criteria**
- [ ] All docs reviewed and approved.
- [ ] Phase 1–4 blocking decisions resolved.
- [ ] Issues #2–#38 exist on GitHub.
- [ ] Every provider account needed for development is available.

---

### Phase 1 — Monorepo Foundation
**Issues:** #2 Monorepo setup · #3 Next.js web setup · #4 Express API setup · #5 Shared contracts package

**Objective:** a building, linted, TypeScript pnpm monorepo with web, API and shared contracts wired together.

**Scope:** pnpm workspace, Next.js web, Express API, shared contracts, TypeScript, ESLint, GitHub.

**Tasks**
1. **Workspace (#2):** fill in the root `package.json` and `pnpm-workspace.yaml` (`apps/*`, `packages/*`). Fill in `.gitignore` (including `.env`), `.env.example` (variable names only, see [DEPLOYMENT.md](DEPLOYMENT.md) §6.1) and `README.md`. Run `pnpm install` to generate `pnpm-lock.yaml`.
2. **Contracts (#5):** set up `packages/contracts` with TypeScript and Zod. Export from `src/index.ts`. Create the empty module files `auth.ts`, `profile.ts`, `appearance.ts`, `product.ts`, `outfit.ts`, `design.ts`, `chat.ts`. Add the shared response-envelope schema (error codes and status mapping: D-03).
3. **API (#4):** set up `apps/api` with Express + TypeScript (`tsconfig.json`).
   - `src/app.ts`: Express app, JSON parsing, central error handler that returns the standard error envelope.
   - `src/server.ts`: `const port = Number(process.env.PORT) || 4000;`, bound to `0.0.0.0`.
   - `GET /health`.
   - `src/config/`: environment loading.
   - Create the layer folders (`routes`, `middleware`, `controllers`, `services`, `models`, `validators`, `integrations`, `utils`, `jobs`) as the codebase convention.
   - Logging utility (the API is responsible for logging, see D-17).
4. **Web (#3):** set up `apps/web` with Next.js + TypeScript + Tailwind CSS + shadcn/ui. Write `app/layout.tsx`, `app/page.tsx` and `next.config.ts`, with config to consume the `packages/contracts` workspace package.
5. **Wiring:** the web app and API both import a schema from `packages/contracts` to prove the workspace link works.
6. **Tooling:** ESLint for all packages. Add root scripts for `typecheck`, `lint`, `test` and `build` (test framework: D-02). CI uses them in Phase 13; whether a basic CI workflow should start earlier is D-42.

**Dependencies:** Phase 0.

**Deliverables:** a running web app (`page.tsx`), a running API with `GET /health`, a contracts package used by both, and root `typecheck` / `lint` / `build` scripts.

**Testing / validation**
- `pnpm typecheck`, `pnpm lint` and `pnpm build` pass from the repository root.
- API test: `GET /health` returns success.
- Unit test: response-envelope helper / error handler never exposes a stack trace.

**Completion criteria**
- [ ] Fresh clone → `pnpm install` → web and API both start locally.
- [ ] Shared contracts import works in both apps.
- [ ] Typecheck, lint and build pass.

---

### Phase 2 — Database + Authentication
**Issues:** #6 MongoDB configuration · #7 User model · #8 Auth API · #9 Auth.js integration

**Objective:** secure registration, login and logout, with a protected frontend and protected API.

**Scope:** MongoDB Atlas, Mongoose, User model, Register, Login, Logout, Auth.js, protected frontend, protected API.

**Tasks**
1. **MongoDB (#6):** Mongoose connection in `src/config/` using `MONGODB_URI` from the environment. Atlas access secured (D-20).
2. **User model (#7):** `src/models/` `users`: email, passwordHash, name, role, isActive, createdAt, updatedAt.
3. **Contracts:** `auth.ts` with register, login and `me` schemas.
4. **Auth API (#8):**
   - `POST /v1/auth/register`: validate → hash password (D-04) → create user. Never return `passwordHash`.
   - `POST /v1/auth/login`: validate credentials → compare hash → create API access token signed with `AUTH_ACCESS_TOKEN_SECRET` (format and lifetime: D-05).
   - `GET /v1/auth/me`.
   - **Authentication middleware** that verifies the API access token and attaches the user to the request. It is used by every later protected route.
   - Validation middleware (Zod) shared by all routes.
5. **Auth.js (#9):** `apps/web/auth.ts` and `app/api/auth/` with a credentials login that calls `POST /v1/auth/login` and stores the API access token in the protected session (D-06).
   - `lib/auth/` and `lib/api/`: server-side (BFF) API client that attaches the token.
   - `app/(auth)/login` and `app/(auth)/register` pages with `components/auth/` forms.
   - Route protection for every page except login/register.
   - Logout (API-side behavior: D-07).

**Dependencies:** Phase 1.

**Deliverables:** working register/login/logout, a reusable authentication middleware, a server-side API client, and protected routes.

**Testing / validation**
- Unit: validators, password hash/compare wrapper.
- API: register (success, duplicate, invalid input), login (success, wrong password), `me` (with token, without token → rejected).
- Manual: an unauthenticated browser is redirected away from protected pages.

**Completion criteria**
- [ ] Register → login → see a protected page → logout works.
- [ ] Protected API routes reject requests without a valid token.
- [ ] No plain-text passwords stored. No secrets in Git.
- [ ] **Milestone M1 reached.**

---

### Phase 3 — Profile + Dashboard
**Issue:** #10 Profile module

**Objective:** the user has a dashboard with navigation and a saved fashion profile.

**Scope:** dashboard, navigation, profile page, profile form, profile API, MongoDB persistence.

**Tasks**
1. **Contracts:** `profile.ts` with gender, ageRange, height, size, budget, likedColors[], dislikedColors[], preferredStyles[], preferredOccasions[] (allowed values: D-09).
2. **Model:** `profiles` (userId + the fields above + timestamps).
3. **API:** `GET /v1/profile` and `PUT /v1/profile`, scoped to the authenticated user.
4. **Web:** `app/dashboard/` with navigation to every module (profile, analyze, outfits, products, tryon, avatar, design, chat, tailor). Add `app/profile/` with the profile form in `components/profile/`, using shadcn/ui components.

**Dependencies:** Phase 2.

**Deliverables:** dashboard, navigation shell, profile create/edit with persistence.

**Testing / validation**
- Unit: profile validators.
- API: get/put profile, invalid input rejected, user A cannot read or modify user B's profile.

**Completion criteria**
- [ ] The profile persists across sessions.
- [ ] Navigation reaches every module route (placeholders allowed for later phases).
- [ ] Data isolation verified by test.

---

### Phase 4 — Appearance AI (with AI and Cloudinary foundations)
**Issues:** #11 Cloudinary integration · #12 MediaPipe integration · #13 Appearance analysis · #14 Appearance confirmation · #21 Gemini integration · #22 Groq fallback

> Blueprint Day 2 schedules the "Gemini foundation" and Cloudinary alongside the profile, and undertone (Phase 4) needs AI reasoning. So the shared AI foundation and Cloudinary integration are built **here, once**, and reused by Phases 6, 8, 10 and 11.

**Objective:** the user uploads photos and gets skin tone, undertone and body shape with confidence, which they can confirm or correct.

**Scope:** face upload, full-body upload, Cloudinary, image validation, MediaPipe, skin tone, undertone, body shape, confidence, confirmation. Also the shared AI router (Gemini + Groq), AI output validation and the `aiCache`.

**Tasks**

*4A — Cloudinary foundation (#11)*
1. `apps/api/src/integrations/cloudinary/`: server-side upload using `CLOUDINARY_*` secrets. Add `apps/web/lib/cloudinary/` for any browser-side needs (upload approach: D-10).
2. Image privacy settings for user photos (D-11).

*4B — AI foundation (#21, #22)*
3. `src/integrations/ai/`: Gemini client, Groq client, and an **AI Router** with Gemini primary and Groq fallback (fallback rules: D-12).
4. **AI Service** used by business services: parse → Zod → business validation, retry/fallback/clear error, quota-exhaustion handling, never fake answers.
5. `aiCache` model (cacheKey indexed, provider, model, requestType, response, createdAt, expiresAt) and a cache lookup/store helper (key and expiry: D-13).

*4C — Vision and analysis (#12, #13)*
6. **Upload UI:** `app/analyze/` with `components/analysis/` for face photo + full-body photo.
7. **Quality validation:** reject or flag bad, dark, multiple-people, no-face and partial-body photos with a clear message.
8. **MediaPipe (#12):** face detection → skin region, and Pose → body landmarks. Browser vs. server split: D-14.
9. **Skin tone:** pixel/color analysis → Monk value + range + confidence (mapping: D-15).
10. **Undertone:** skin/color characteristics + AI reasoning through the AI Service → Warm / Cool / Neutral / Olive / Unknown + confidence. Unknown when uncertain.
11. **Body shape:** shoulder/chest/waist/hip/torso/leg proportions → ratios → Rectangle / Triangle / Inverted Triangle / Oval / Hourglass + confidence (thresholds: D-15). No calibrated measurements.
12. **Contracts:** `appearance.ts`. **Model:** `appearanceProfiles` (skinTone, undertone, bodyShape, proportions, userConfirmed=false, analysisVersion).
13. **API:** `POST /v1/appearance/analyze` and `GET /v1/appearance`.

*4D — Confirmation (#14)*
14. Confirmation screen ("Your Style Profile"): each value with its confidence, plus **Confirm** and **Edit**.
15. `PUT /v1/appearance/confirm`: confirmed or corrected values stored with `confidence: 1`, `userConfirmed: true`.
16. Personal fashion profile = profile + confirmed appearance, exposed for later phases (recommendations, chatbot, avatar).

**Dependencies:** Phase 3 (profile, navigation). Provider accounts from Phase 0.

**Deliverables:** Cloudinary integration, AI Router + AI Service + aiCache (reused later), the analysis pipeline, and the confirmation flow.

**Testing / validation**
- Unit: body-shape classification, skin-tone mapping helpers, appearance validators, AI output parsing/validation.
- API: analyze, get, confirm; unauthenticated access rejected; cross-user access rejected.
- AI scenarios (start the suite here, finish it in Phase 12): good photo, bad photo, dark photo, multiple people, no face, partial body, low confidence, invalid AI JSON, Gemini unavailable, Groq unavailable.

**Completion criteria**
- [ ] Photos are stored in Cloudinary only.
- [ ] Results always show confidence. Low-confidence values are never forced. Undertone can be Unknown.
- [ ] Confirm and Edit both persist with `userConfirmed: true`.
- [ ] AI failure gives a fallback or a clear error. No fake output.
- [ ] **Milestone M2 reached.**

---

### Phase 5 — Product Catalog
**Issues:** #15 Product model · #16 Product seed · #17 Product APIs

**Objective:** a reliable, searchable, filterable catalog of 500–2,000 curated products.

**Scope:** product model, seed script, product API, search, filters, product detail.

**Tasks**
1. **Contracts:** `product.ts`.
2. **Model (#15):** `products`: name, brand, category, gender, price, colors[], sizes[], fabric, styles[], occasions[], imageUrl, productUrl, tags[], active, createdAt. Indexes for filter fields (D-16).
3. **Seed (#16):** script in `apps/api/scripts/` that loads 500–2,000 curated products across T-shirts, Shirts, Jeans, Trousers, Kurtas, Kurtis, Sarees, Lehengas, Shoes and Accessories (data source: D-08).
4. **API (#17):** `GET /v1/products` (search + filters, active products only; pagination: D-18) and `GET /v1/products/:id`.
5. **Filter service:** reusable hard-filter functions (gender → category → occasion → size → color → price → style). Phase 6 reuses them, so they are written **once, here**.
6. **Web:** `app/products/` with `components/products/` for listing, search, filters and the product detail view.

**Dependencies:** Phase 2. Can run in parallel with Phases 3–4.

**Deliverables:** seeded catalog, product APIs, reusable filter service, product UI.

**Testing / validation**
- Unit: each filter and filter combinations.
- API: list, filter, search, detail, not-found, inactive products excluded.

**Completion criteria**
- [ ] Seed loads a valid catalog into Atlas.
- [ ] Filters return correct candidates.
- [ ] Product detail page shows stored data, including price in ₹.

---

### Phase 6 — Recommendation Engine
**Issues:** #18 Recommendation engine · #19 Budget engine

**Objective:** personalised, AI-reasoned outfits that are budget-validated in code.

**Scope:** profile loader, appearance loader, product filters, ranking, budget engine, Gemini, Zod, final outfit.

**Tasks**
1. **Budget engine (#19):** a pure function. Total = sum of stored product prices; VALID only if `total <= budget`. No AI involvement.
2. **Loaders:** profile loader and confirmed-appearance loader (from Phases 3–4).
3. **Candidate pipeline:** apply the Phase 5 filter service → candidate products → **ranking** (algorithm: D-19) → top candidates. The full catalog is never sent to AI.
4. **Gemini reasoning:** through the Phase 4 AI Service, send the request (occasion, style, budget), the profile, the confirmed appearance and the top candidates. Get back outfit items + explanation.
5. **Validation:** Zod-validate the AI output, then business validation (items must be real products with prices from the database; AI-supplied prices are ignored). Then run the budget engine. If invalid: retry, fallback or clear error.
6. **Contracts:** `outfit.ts` (request + outfit response).
7. **API:** `POST /v1/recommendations` returns the final outfit(s) with items, totalPrice, explanation and aiModel.
8. **Web:** occasion / style / budget selection in `app/outfits/`.

**Dependencies:** Phase 3 (profile), Phase 4 (confirmed appearance, AI Service, aiCache), Phase 5 (catalog, filters).

**Deliverables:** recommendation service, budget engine, recommendation API, selection UI.

**Testing / validation**
- Unit: budget engine (e.g. ₹699 + ₹999 + ₹699 = ₹2397 ≤ ₹2500 → VALID; over-budget → INVALID), ranking.
- API: recommendation success; invalid AI JSON → retry/fallback/error; AI-invented price ignored; unauthenticated rejected.

**Completion criteria**
- [ ] Every returned outfit satisfies `totalPrice <= budget` using stored prices.
- [ ] Only top candidates are sent to Gemini.
- [ ] Confirmed appearance values (not raw AI estimates) are used when available.

---

### Phase 7 — Outfit Experience
**Issue:** #20 Outfit UI

**Objective:** a clear presentation of outfits, with saving and history.

**Scope:** outfit cards, "Why this works", price breakdown, total price, save outfit, history.

**Tasks**
1. **Model:** `outfits`: userId, occasion, budget, items[], totalPrice, explanation, aiModel, createdAt (items structure: D-22).
2. **API:** `POST /v1/recommendations/:id/save` (meaning of `:id`: D-23) and `GET /v1/outfits`.
3. **Web:** `components/outfits/` with outfit cards, "Why this works", per-item price breakdown, total, a save action, a history view, and links to product detail (Phase 5).

**Dependencies:** Phase 6.

**Deliverables:** outfit UI, save + history APIs.

**Testing / validation**
- API: save, list history, cross-user access blocked.
- Manual: the price breakdown matches the budget-engine total.

**Completion criteria**
- [ ] The user can save outfits and see their history.
- [ ] Totals shown always come from the budget engine.
- [ ] **Milestone M3 reached.**

---

### Phase 8 — AI Try-On
**Issue:** #23 Try-on integration

**Objective:** visualise a garment on the user's photo, degrading gracefully when unavailable.

**Scope:** try-on UI, model integration, result handling, Cloudinary, error handling, caching where useful.

**Tasks**
1. **Integration:** `src/integrations/tryon/` with `leffa.ts`, `huggingface.ts`, `qwen.ts` and `tryon.service.ts` (provider selection: D-24; uses `HF_API_TOKEN`).
2. **Flow:** user photo + garment image → Try-On Service → provider → generated image → Cloudinary → MongoDB result (storage collection: D-25).
3. **API:** `POST /v1/tryon` and `GET /v1/tryon/:id`, owner-only (sync vs. async: D-26).
4. **Failure handling:** if unavailable, return "Try-on is currently unavailable." without affecting any other feature.
5. **Caching** where useful (reuse the Phase 4 cache helper).
6. **Web:** `app/tryon/` with `components/tryon/`, reachable from outfits/products.

**Dependencies:** Phase 4 (Cloudinary, photos), Phase 5 (product/garment images).

**Deliverables:** isolated try-on integration, API, UI, graceful failure.

**Testing / validation**
- API: request, fetch result, unauthorized access blocked, invalid input rejected, provider failure → unavailable message.
- Blueprint DoD for try-on: upload works, API works, auth works, input validated, AI failure handled, result stored, unauthorized access blocked, tests pass.

**Completion criteria**
- [ ] Try-on works end to end, **or** shows the unavailable message while the rest of the app keeps working.
- [ ] Generated images are stored only in Cloudinary.

---

### Phase 9 — 3D Avatar
**Issue:** #24 3D avatar

**Objective:** a simple interactive avatar with approximate proportions.

**Scope:** Three.js, React Three Fiber, GLB model, viewer, rotate, zoom, front/side/back.

**Tasks**
1. Add Three.js, React Three Fiber and @react-three/drei to `apps/web`.
2. Choose and add a GLB/GLTF base model to `public/` (source: D-27).
3. `components/avatar/` viewer with rotate, zoom, and front/side/back presets.
4. Apply **approximate** proportions from the user's appearance profile (method: D-28).
5. `app/avatar/` page.

**Dependencies:** Phase 4 (appearance/proportions data).

**Deliverables:** avatar viewer page.

**Testing / validation**
- Manual: rotate, zoom and front/side/back work, including on mobile.
- Unit: any proportion-mapping helper.

**Completion criteria**
- [ ] The viewer works with approximate proportions. No photorealistic reconstruction attempted.
- [ ] **Milestone M4 reached** (with Phase 8).

---

### Phase 10 — Design Studio
**Issue:** #25 Design studio

**Objective:** users design a garment and save it.

**Scope:** garment selection, color, fabric, neck, sleeve, length, fit, pattern, embroidery, preview, save.

**Tasks**
1. **Contracts:** `design.ts` with the design specification (Garment, Color, Fabric, Neck, Sleeve, Length, Fit, Pattern, Embroidery; allowed values: D-29).
2. **Client state:** Zustand store in `apps/web/stores/` for the in-progress design.
3. **Web:** `app/design/` with `components/design/` for attribute selection and a preview (preview approach: D-30).
4. **Model:** `designs` (fields: D-31). Design images go in Cloudinary.
5. **API:** `POST /v1/design` and `GET /v1/design/:id`, owner-only.

**Dependencies:** Phase 2 (auth), Phase 4 (Cloudinary).

**Deliverables:** Design Studio UI, design persistence and APIs.

**Testing / validation**
- Unit: design validators, store logic.
- API: save, fetch, cross-user access blocked, invalid spec rejected.

**Completion criteria**
- [ ] Temporary design state lives in Zustand. Completed designs persist in MongoDB.

---

### Phase 11 — Sketch + Chat + PDF
**Issues:** #26 Sketch-to-design · #27 Chatbot · #28 PDF generation

**Objective:** turn sketches into structured designs, add the fashion assistant, and produce tailor PDFs.

**Scope:** Sketch AI, fashion chatbot, tailor specification, PDFKit.

**Tasks**

*11A — Sketch-to-design (#26)*
1. Sketch upload → Cloudinary.
2. `POST /v1/design/sketch`: Gemini Vision (through the AI Service) → structured garment JSON → Zod (same `design.ts` schema).
3. User confirmation/edit UI that loads the result into the Phase 10 Design Studio store.
4. `POST /v1/design/generate`: generate a design from the confirmed spec (generation provider: D-32). Design image → Cloudinary.

*11B — Fashion chatbot (#27)*
5. **Contracts:** `chat.ts`. **Model:** `chatMessages` (fields and conversation grouping: D-33).
6. `POST /v1/chat`: Auth → load confirmed profile → relevant conversation context only → Gemini (AI Service) → response → MongoDB.
7. `GET /v1/chat/conversations`.
8. **Web:** `app/chat/` with `components/chat/`.

*11C — Tailor PDF (#28)*
9. `src/integrations/pdf/` using PDFKit: Design → specification JSON → PDF with Garment, Fabric, Color, Neck, Sleeve, Length, Fit, Pattern, Embroidery, Design image and Tailor instructions (content source: D-34).
10. `POST /v1/tailor/pdf` (delivery format: D-35).
11. **Web:** `app/tailor/` with a download action.

**Dependencies:** Phase 4 (AI Service, Cloudinary), Phase 10 (design spec, store, `designs`).

**Deliverables:** sketch-to-design flow, chatbot, tailor PDF download.

**Testing / validation**
- Unit: sketch JSON validation, PDF spec builder.
- API: sketch (valid, invalid AI JSON → retry/fallback/error), generate, chat (success, AI unavailable → real error), conversations, PDF generation, and owner-only access for each.

**Completion criteria**
- [ ] A sketch becomes a validated, user-confirmed design.
- [ ] The chatbot uses only the confirmed profile and relevant context, and never fakes answers.
- [ ] The PDF contains every required field and downloads.
- [ ] **Milestone M5 reached.**

---

### Phase 12 — Testing + Security
**Issues:** #29 Unit tests · #30 API tests · #31 E2E tests · #32 Security hardening

**Objective:** a verified, hardened MVP. This phase adds the cross-cutting testing and security work. Per-feature tests already exist from Phases 1–11.

**Scope:** unit tests, API tests, AI failure tests, E2E, authentication tests, authorization tests, mobile UI, security hardening.

**Tasks**
1. **Coverage audit (#29, #30):** confirm unit tests exist for budget, filters, ranking, validators, body-shape classification and utilities, and API tests exist for auth, profile, appearance, products, recommendations, design, chat and health. Fill gaps only.
2. **AI failure suite:** complete all 10 AI test scenarios from [TESTING.md](TESTING.md) §5, plus try-on unavailable.
3. **E2E (#31):** Register → Login → Profile → Upload photos → Analyze → Confirm → Recommendation → Budget → Product → Try-On → Design → Chat → PDF → Logout (tooling: D-36).
4. **Auth / authorization tests:** unauthenticated access rejected everywhere, and cross-user access blocked for every user-owned resource.
5. **Mobile UI:** check every page on mobile viewports and fix issues.
6. **Security hardening (#32):**
   - Helmet/security headers.
   - CORS configured for the web origin (D-37).
   - Rate limiting on expensive endpoints (list and limits: D-38).
   - Safe error messages audit.
   - Secrets audit (server-side only; no `NEXT_PUBLIC_` secrets; `.env` ignored; nothing in Git).
   - Image privacy review.
   - MongoDB Atlas access review.
7. **Performance and bug fixing** (Day 11).

**Dependencies:** Phases 1–11.

**Deliverables:** complete test suites, hardened API, security checklist completed ([SECURITY.md](SECURITY.md) §11).

**Testing / validation:** all suites pass locally. The security checklist is signed off.

**Completion criteria**
- [ ] All unit, API, AI-failure and E2E tests pass.
- [ ] All 17 security checklist items are checked.
- [ ] Mobile UI verified.
- [ ] **Milestone M6 reached.**

---

### Phase 13 — Docker + CI/CD + Deployment
**Issues:** #33 Docker · #34 GitHub Actions · #35 Vercel deployment · #36 Render deployment · #37 Production environment · #38 Final QA

**Objective:** the MVP live in production with automated checks.

**Scope:** Docker, Docker Compose, GitHub Actions, Vercel, Render, production environment, health check, final QA.

**Tasks**
1. **Docker (#33):** `apps/api/Dockerfile`, multi-stage build: Base Node image → enable pnpm → copy workspace files → install → copy API + contracts → build TypeScript → production image → start Express.
   - Build context = repository root.
   - Secrets kept out of the image.
   - Fill in `.dockerignore`.
   - `docker-compose.yml` for local consistency. MongoDB stays on Atlas, not in Compose. `infra/docker/` holds supporting Docker files.
2. **CI (#34):** `.github/workflows/ci.yml` runs on pull requests and pushes to `main`: Checkout → Setup Node/pnpm → Install → Typecheck → Lint → Unit/API tests → Build → PASS/FAIL (AI mocking in CI: D-39).
3. **Render (#36):** Web Service `styleme-api` from GitHub, branch `main`, Docker runtime, Dockerfile `apps/api/Dockerfile`, root build context, health check `/health`. Fill in `render.yaml`. Set the env vars: NODE_ENV, MONGODB_URI, AUTH_ACCESS_TOKEN_SECRET, GEMINI_API_KEY, GROQ_API_KEY, CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET, HF_API_TOKEN.
4. **Vercel (#35):** import the repo, Next.js preset, Root Directory `apps/web`, `packages/contracts` support enabled. Frontend-safe variables plus the server-side secrets Auth.js needs; never `NEXT_PUBLIC_` for secrets (full variable list: D-40).
5. **Production environment (#37):** HTTPS on both platforms, production CORS origin, production Atlas database, auto-deploy on merge to `main`.
6. **Final QA (#38):** run the full E2E journey against production, verify `/health`, and confirm the try-on degradation path and AI fallback behavior in production.
7. Document the rollback procedure (D-41).

**Dependencies:** Phase 12.

**Deliverables:** API Docker image, CI workflow, live Vercel and Render deployments, QA sign-off.

**Testing / validation:** CI green on `main`, production E2E pass, `/health` passing on Render.

**Completion criteria**
- [ ] Feature branches never deploy directly to production. Merges to `main` trigger the Render deploy after CI.
- [ ] Web is live on Vercel and the API is live on Render.
- [ ] Production QA signed off.
- [ ] **Milestone M7 — MVP Live reached.**

---

## 4. Cross-Phase Traceability

| MVP capability ([MVP.md](MVP.md) §3) | Built in phase |
|---|---|
| MVP-01 Authentication | 2 |
| MVP-02 Style profile | 3 |
| MVP-03 Photo upload | 4 |
| MVP-04 Appearance analysis | 4 |
| MVP-05 Skin tone & undertone | 4 |
| MVP-06 Body shape | 4 |
| MVP-07 Confirmation / correction | 4 |
| MVP-08 Personal fashion profile | 3–4 |
| MVP-09 Occasion / style / budget selection | 6 |
| MVP-10 Product filtering | 5 (filters), 6 (pipeline) |
| MVP-11 AI outfit recommendations | 6 (AI foundation from 4) |
| MVP-12 Budget validation | 6 |
| MVP-13 Outfit suggestions | 7 |
| MVP-14 Product details | 5 |
| MVP-15 AI try-on | 8 |
| MVP-16 3D avatar | 9 |
| MVP-17 Design Studio | 10 |
| MVP-18 Sketch-to-AI design | 11 |
| MVP-19 Fashion chatbot | 11 |
| MVP-20 Tailor PDF | 11 |
| MVP-21 Live deployment | 13 |

**Shared components built once and reused (no duplicated work):**

| Component | Built in | Reused in |
|---|---|---|
| Response envelope + error handler | 1 | All |
| Authentication + validation middleware | 2 | 3–11 |
| Server-side API client (BFF) | 2 | 3–11 |
| Cloudinary integration | 4 | 8, 10, 11 |
| AI Router, AI Service, aiCache | 4 | 6, 8 (cache), 11 |
| Product filter service | 5 | 6 |
| Design spec schema + Zustand store | 10 | 11 |

---

## 5. Decisions Needed (Not Defined in the Sources)

These must be decided by the team; this plan doesn't assume answers. "Blocks" is the earliest phase that needs the answer.

| ID | Decision | Blocks |
|---|---|---|
| D-01 | Node.js and pnpm versions | 1 |
| D-02 | Test frameworks (unit, API) | 1 |
| D-03 | Exact request/response schemas and the error-code list (beyond `INVALID_REQUEST`); HTTP status mapping | 1 |
| D-04 | Password hashing algorithm and parameters | 2 |
| D-05 | API access token format, lifetime, expiry/refresh | 2 |
| D-06 | How Auth.js stores and forwards the API access token | 2 |
| D-07 | Logout behavior on the API side (no logout endpoint is defined) | 2 |
| D-08 | Source of the curated product data | 5 (decide in 0) |
| D-09 | Allowed values for gender, ageRange, size, styles, occasions | 3 |
| D-10 | Image upload approach (through the API, or direct to Cloudinary then send the URL) and upload limits | 4 |
| D-11 | Cloudinary privacy/delivery settings and retention policy for user photos | 4 |
| D-12 | Gemini/Groq model names, retry count, and when the Groq fallback is "appropriate" | 4 |
| D-13 | aiCache key construction and expiry per request type | 4 |
| D-14 | MediaPipe processing split between browser (`apps/web`) and API (`integrations/mediapipe`) | 4 |
| D-15 | Pixel-to-Monk mapping, confidence thresholds for low confidence / Unknown, body-shape ratio thresholds | 4 |
| D-16 | Indexes beyond `aiCache.cacheKey` (e.g. users.email, userId fields, product filter fields) | 2 / 5 |
| D-17 | Logging approach and destination | 1 |
| D-18 | Pagination, sorting and search parameters for list endpoints | 5 |
| D-19 | Candidate ranking algorithm | 6 |
| D-20 | MongoDB Atlas network access configuration and per-environment databases | 2 |
| D-21 | Role of the `develop` branch (PR target, release flow) | 0 |
| D-22 | `outfits.items[]` structure (product references or snapshots) | 7 |
| D-23 | What `:id` refers to in `POST /v1/recommendations/:id/save` | 7 |
| D-24 | Try-on provider selection/order among Leffa, Hugging Face and Qwen | 8 |
| D-25 | Collection for try-on results | 8 |
| D-26 | Synchronous vs. asynchronous try-on (BullMQ only if needed) | 8 |
| D-27 | Source of the GLB/GLTF avatar model | 9 |
| D-28 | How approximate proportions are applied to the avatar | 9 |
| D-29 | Allowed values for design attributes | 10 |
| D-30 | How the Design Studio preview is rendered | 10 |
| D-31 | `designs` collection fields | 10 |
| D-32 | Provider for design generation (`POST /v1/design/generate`) | 11 |
| D-33 | `chatMessages` fields and the conversation model | 11 |
| D-34 | Content and source of "Tailor instructions" in the PDF | 11 |
| D-35 | PDF delivery (binary stream or Cloudinary URL) | 11 |
| D-36 | E2E tool, and whether E2E runs in CI | 12 |
| D-37 | Allowed CORS origins per environment | 12 |
| D-38 | Which endpoints count as "expensive" and their rate limits | 12 |
| D-39 | AI provider mocking strategy in CI | 13 |
| D-40 | Full Vercel environment variable list | 13 |
| D-41 | Rollback procedure for Vercel and Render | 13 |
| D-42 | Whether a basic CI workflow should start before Phase 13 (the blueprint schedules GitHub Actions in Phase 13, but the PR workflow assumes it) | 1 |

---

## 6. Future Scope (Not Part of the MVP Plan)

Introduce these **only when the application actually requires them** (blueprint §37, §38, §56). They aren't scheduled in Phases 0–13.

| Item | Trigger |
|---|---|
| Redis | High-frequency caching, rate-limit counters, temporary state, distributed locks, background jobs |
| BullMQ (`apps/api/src/jobs/`) | Long-running tasks: AI image generation, try-on, large PDF generation, image processing, batch processing |
| Redis in Docker Compose | Once Redis is adopted |
| More advanced AI / image processing | When the application requires it |
| Separately published `packages/contracts` | Only if the API must deploy as an independent repository (§48) |

**Explicitly out of scope:** microservices, Kubernetes, a separate Python service, a separate database per module, complex event architecture, a huge product marketplace, overly complex recommendation ML, unnecessary infrastructure, photorealistic avatar reconstruction, MongoDB in Docker, and exact body measurements without calibration.

---

## 7. Risks and Mitigations (From the Sources)

| Risk | Mitigation built into the plan |
|---|---|
| AI provider quotas are limited | Groq fallback, aiCache, graceful quota handling (Phase 4) |
| Invalid or hallucinated AI output | Zod + business validation, retry/fallback/error (Phases 4, 6, 11) |
| AI inventing prices | Prices only from the database; budget engine in code (Phase 6) |
| Low-quality photos / uncertain vision | Quality validation, confidence, Unknown, user confirmation (Phase 4) |
| Try-on provider unavailable | Isolated integration with an unavailable message (Phase 8) |
| Monorepo deploy breaking the contracts import | Root build context, workspace-aware Vercel/Render config (Phase 13) |
| Secrets leaking | Server-side keys, `.env` ignored, secrets audit (Phases 1, 12) |

---

## 8. Final Definition of Done

### 8.1 Per feature
A feature is **not complete just because the UI works**. Every feature needs:

- [ ] UI
- [ ] API
- [ ] Validation
- [ ] Database
- [ ] Error handling
- [ ] Authorization
- [ ] Tests
- [ ] Documentation (relevant `docs/` updated, including resolved D-xx decisions)

### 8.2 MVP complete
The MVP is complete when:

- [ ] All 22 user capabilities in [MVP.md](MVP.md) §4.1 work in production.
- [ ] The target result works end to end: Register → Profile → Upload photos → Appearance analysis → Confirm result → Personalized recommendations → Real coded budget validation → Product browsing → AI try-on → 3D avatar → Design studio → Sketch AI → Fashion chatbot → Tailor PDF → Live deployment.
- [ ] Deterministic layers (profile, product, budget, validation, security, deployment) are reliable. AI/vision features are handled with confidence, validation, caching, fallbacks and user confirmation.
- [ ] All 12 success criteria in [MVP.md](MVP.md) §13.2 are met.
- [ ] All 10 AI safety rules are enforced and tested.
- [ ] The security checklist is complete.
- [ ] CI passes on `main`. Web is live on Vercel, the API is live on Render, and `/health` passes.
- [ ] Milestones M1–M7 are reached.
