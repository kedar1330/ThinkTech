# StyleMe — Testing Strategy

> Source: StyleMe Final End-to-End Blueprint — §2, §23, §30 (Phase 12), §31 (Day 11), §33, §34, §35, §40, §53

---

## 1. Objectives

- Make the deterministic layers (profile, product, budget, validation, security) **reliable**.
- Make AI and vision features **fail safely**: real errors or fallbacks, never fake answers.
- Enforce authentication, authorization and user data isolation.
- Meet the Definition of Done for every feature.

Tests live in `apps/api/tests/` for the API. They run in GitHub Actions on every pull request and every push to `main`.

---

## 2. Test Levels

| Level | Scope | GitHub issue |
|---|---|---|
| Unit tests | Pure logic | #29 |
| API tests | HTTP endpoints | #30 |
| AI tests | Vision and AI failure/edge cases | covered under Phase 12 "AI failure tests" |
| End-to-end | Full user journey through the UI | #31 |
| Security tests | Authentication, authorization | Phase 12, #32 |
| Mobile UI | Responsive UI check | Phase 12 |

---

## 3. Unit Tests

| Target | What to verify |
|---|---|
| Budget calculation | Total = sum of stored product prices, and an outfit is VALID only if `total <= budget` (e.g. ₹699 + ₹999 + ₹699 = ₹2397 ≤ ₹2500 → VALID) |
| Filters | Gender → category → occasion → size → color → price → style filtering produces the right candidates |
| Ranking | Candidate ranking produces the top candidates |
| Validators | Zod schemas accept valid input and reject invalid input |
| Body-shape classification | Ratios map to Rectangle / Triangle / Inverted Triangle / Oval / Hourglass |
| Utility functions | Shared helpers |

---

## 4. API Tests

| Area | Endpoints |
|---|---|
| Auth | `POST /v1/auth/register`, `POST /v1/auth/login`, `GET /v1/auth/me` |
| Profile | `GET /v1/profile`, `PUT /v1/profile` |
| Appearance | `POST /v1/appearance/analyze`, `GET /v1/appearance`, `PUT /v1/appearance/confirm` |
| Products | `GET /v1/products`, `GET /v1/products/:id` |
| Recommendations | `POST /v1/recommendations`, `POST /v1/recommendations/:id/save`, `GET /v1/outfits` |
| Design | `POST /v1/design`, `GET /v1/design/:id`, `POST /v1/design/sketch`, `POST /v1/design/generate` |
| Chat | `POST /v1/chat`, `GET /v1/chat/conversations` |
| Health | `GET /health` |

Every API test also checks:
- the standard response envelope (`success` / `data` / `error.code` / `error.message`),
- that errors never expose stack traces, secrets, database details or internal errors,
- that protected endpoints reject unauthenticated requests.

---

## 5. AI Tests

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | Good photo | Analysis returns skin tone, undertone and body shape with confidence |
| 2 | Bad photo | Rejected by quality validation with a clear error |
| 3 | Dark photo | Handled with a clear error or low confidence. Not forced |
| 4 | Multiple people | Handled with a clear error |
| 5 | No face | Handled with a clear error |
| 6 | Partial body | Handled with a clear error or low confidence. Not forced |
| 7 | Low confidence | Low confidence is shown. Undertone may be Unknown. User can correct |
| 8 | Invalid AI JSON | Zod rejects it → retry / fallback / clear error |
| 9 | Gemini unavailable | Groq fallback where appropriate, or a clear error. No fake answer |
| 10 | Groq unavailable | Clear error. No fake answer |

Also covered:
- Try-on unavailable → "Try-on is currently unavailable." The rest of the app keeps working.
- AI cannot change product prices. The budget result comes only from code.

---

## 6. Authentication and Authorization Tests

- Register, login and logout work.
- Protected frontend pages need a session.
- Protected API endpoints reject requests without valid authentication.
- A user cannot access another user's profile, appearance, outfits, try-ons, designs or chats.
- Unauthorized access to try-on results is blocked (part of Try-On's Definition of Done).

---

## 7. End-to-End Test Flow

```
Register
 ↓
Login
 ↓
Profile
 ↓
Upload photos
 ↓
Analyze
 ↓
Confirm
 ↓
Recommendation
 ↓
Budget
 ↓
Product
 ↓
Try-On
 ↓
Design
 ↓
Chat
 ↓
PDF
 ↓
Logout
```

---

## 8. Mobile UI

The UI is checked on mobile viewports during Phase 12.

---

## 9. CI Integration

GitHub Actions pipeline (runs on pull requests and pushes to `main`):

```
Checkout → Setup Node/pnpm → Install → Typecheck → Lint → Unit/API tests → Build → PASS / FAIL
```

A failing test fails the pipeline. See [DEPLOYMENT.md](DEPLOYMENT.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 10. Definition of Done

A feature is complete only with:

```
UI + API + Validation + Database + Error handling + Authorization + Tests + Documentation
```

Example: Try-On is not complete until:
- Upload works
- API works
- Auth works
- Input is validated
- AI failure is handled
- Result is stored
- Unauthorized access is blocked
- Tests pass

---

## 11. Open Items / To Be Decided

- Test frameworks and tools (unit, API, E2E). The blueprint names none.
- Coverage targets.
- How AI providers are mocked or stubbed in CI.
- Test database strategy (a separate Atlas database or an in-memory alternative).
- Test fixtures for the photo scenarios.
- Where web/frontend tests live (the blueprint lists only `apps/api/tests/`).
- Whether E2E tests run in CI.
- Which devices and viewports count for the mobile UI check.
