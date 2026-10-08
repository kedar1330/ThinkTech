# StyleMe — Security

> Source: StyleMe Final End-to-End Blueprint — §3–§6, §8, §10, §21, §22, §27, §35, §36, §38, §42, §44, §56

---

## 1. Authentication

### 1.1 Model

```
Browser
    ↓
Next.js / Auth.js
    ↓
Express Auth API
    ↓
MongoDB
```

- **Auth.js** handles browser/session authentication (Vercel).
- **Express** handles API/business authorization (Render).

### 1.2 Login flow

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

### 1.3 Requirements

- Passwords are stored only as `passwordHash`. Plain-text passwords are never stored or logged.
- An API access token is created on successful login. It is signed with the server-side secret `AUTH_ACCESS_TOKEN_SECRET`.
- Frontend routes other than login/register are protected.
- API routes other than `register`, `login` and `/health` need authentication.
- Users have `role` and `isActive` fields.

---

## 2. Authorization and Data Isolation

- Every protected route passes through **Authentication Middleware** before validation and the controller.
- User-specific data (`profiles`, `appearanceProfiles`, `outfits`, `designs`, `chatMessages`, try-on results) is **isolated by authenticated user**. Users can never read or modify another user's data.
- Resource-by-ID endpoints (`/v1/tryon/:id`, `/v1/design/:id`, `/v1/recommendations/:id/save`) must check ownership.
- Unauthorized access is blocked and tested (see [TESTING.md](TESTING.md)).

---

## 3. Secrets Management

| Rule | Detail |
|---|---|
| API keys server-side | Gemini, Groq, Cloudinary and Hugging Face keys are used only by the API (and Auth.js server code where needed) |
| No `NEXT_PUBLIC_` secrets | Never use the `NEXT_PUBLIC_` prefix for private secrets |
| `.env` ignored | `.env` is in `.gitignore`. Only `.env.example` (no real values) is committed |
| No secrets in Git | Secrets are never committed |
| No secrets in images | Secrets are kept out of Docker images and provided as runtime environment variables |
| Frontend env | Vercel contains only frontend-safe variables plus the server-side secrets Next.js/Auth.js needs |

Server-side secrets (Render):

```
MONGODB_URI
AUTH_ACCESS_TOKEN_SECRET
GEMINI_API_KEY
GROQ_API_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
HF_API_TOKEN
```

---

## 4. Input Validation

- Every request is validated by **Validation Middleware** using **Zod** schemas from `packages/contracts`.
- Uploaded photos go through quality validation before analysis.

## 5. AI Output Validation

- AI output → Parse → Zod → Business validation → Use.
- Invalid output → Retry / Fallback / Clear error.
- AI cannot invent or override prices. Budget validation is done in code.
- Only relevant profile and context data is sent to AI providers (chatbot, recommendations).

---

## 6. Rate Limiting

- Rate limiting is applied to **expensive endpoints**.
- The API is responsible for rate limiting.
- Redis-backed rate-limit counters may be added later, when needed.

---

## 7. CORS and Security Headers

- CORS is configured correctly, allowing the web application's origin.
- Helmet / security headers are enabled on the Express API.
- HTTPS is used in production (Vercel and Render).

---

## 8. Image Privacy

- Face, full-body, profile, try-on, design and sketch images are stored in **Cloudinary**.
- User images and generated images are **never** stored on Render's local filesystem.
- Image privacy must be considered for all stored user photos.
- Images sent to AI providers are limited to what the feature needs (e.g. user photo + garment image for try-on).

---

## 9. Error Handling

- Errors use the standard envelope:
  ```json
  { "success": false, "error": { "code": "INVALID_REQUEST", "message": "Invalid request data" } }
  ```
- Never expose stack traces, secret values, database details or internal errors.
- AI failures produce real errors, not fake answers.

---

## 10. Database Security

- MongoDB Atlas access is secured.
- The connection string (`MONGODB_URI`) is a server-side secret.
- Only the Express API accesses the database.

---

## 11. Pre-Production Security Checklist

- [ ] HTTPS
- [ ] Secure authentication
- [ ] Password hashing
- [ ] API authorization
- [ ] Input validation
- [ ] Zod validation
- [ ] AI output validation
- [ ] API keys server-side
- [ ] .env ignored
- [ ] No secrets in Git
- [ ] Rate limiting for expensive endpoints
- [ ] User data isolation
- [ ] MongoDB access secured
- [ ] Image privacy considered
- [ ] Safe error messages
- [ ] CORS configured correctly
- [ ] Helmet/security headers

---

## 12. Related AI Safety Rules

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

---

## 13. Open Items / To Be Decided

- Password hashing algorithm and parameters.
- Access token format, lifetime and refresh/expiry handling.
- How Auth.js stores the API access token in the session and sends it to Express.
- Logout and token invalidation behavior.
- Rate-limit thresholds and the exact list of expensive endpoints.
- Allowed CORS origins per environment.
- Cloudinary delivery settings for private user images (e.g. signed or restricted URLs).
- Retention and deletion policy for user photos and generated images.
- Upload limits (file size, file types).
- Role values and role-based permissions.
- How MongoDB Atlas network access is configured.
