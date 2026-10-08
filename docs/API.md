# StyleMe — API Specification

> Source: StyleMe Final End-to-End Blueprint — §3, §4, §5, §6, §8, §16–§18, §20–§28, §35, §45

---

## 1. Conventions

| Item | Rule |
|---|---|
| Style | REST, served by Express (`apps/api`) |
| Versioning | All feature endpoints are under `/v1/` |
| Caller | The Next.js server side (BFF) calls the API with the user's authenticated session/API access token |
| Validation | Every request is validated with Zod (shared schemas in `packages/contracts`) |
| Pipeline | Route → Authentication middleware → Validation middleware → Controller → Service → Database / Integration → Response |
| Port | `process.env.PORT`, default `4000`, bound to `0.0.0.0` |

### 1.1 Response envelope

**Success**

```json
{
  "success": true,
  "data": {}
}
```

**Error**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request data"
  }
}
```

Error responses must **not** expose stack traces, secret values, database details or internal errors.

### 1.2 Authentication requirement

| Endpoint group | Auth required |
|---|---|
| `POST /v1/auth/register`, `POST /v1/auth/login` | No |
| `GET /health` | No |
| All other endpoints | Yes. Requests are scoped to the authenticated user |

---

## 2. Endpoint Summary

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/v1/auth/register` | Register a new user | No |
| POST | `/v1/auth/login` | Validate credentials, return API access token | No |
| GET | `/v1/auth/me` | Current authenticated user | Yes |
| GET | `/v1/profile` | Get current user's fashion profile | Yes |
| PUT | `/v1/profile` | Create/update current user's fashion profile | Yes |
| POST | `/v1/appearance/analyze` | Run appearance analysis on uploaded photos | Yes |
| GET | `/v1/appearance` | Get current user's appearance profile | Yes |
| PUT | `/v1/appearance/confirm` | Confirm or correct appearance results | Yes |
| GET | `/v1/products` | List/search/filter products | Yes |
| GET | `/v1/products/:id` | Product details | Yes |
| POST | `/v1/recommendations` | Generate outfit recommendations | Yes |
| POST | `/v1/recommendations/:id/save` | Save a recommended outfit | Yes |
| GET | `/v1/outfits` | Saved outfit history | Yes |
| POST | `/v1/tryon` | Request an AI try-on | Yes |
| GET | `/v1/tryon/:id` | Get a try-on result | Yes |
| POST | `/v1/design` | Save a design | Yes |
| GET | `/v1/design/:id` | Get a design | Yes |
| POST | `/v1/design/sketch` | Interpret a sketch into structured garment JSON | Yes |
| POST | `/v1/design/generate` | Generate a design from a confirmed specification | Yes |
| POST | `/v1/chat` | Send a message to the fashion chatbot | Yes |
| GET | `/v1/chat/conversations` | List the user's conversations | Yes |
| POST | `/v1/tailor/pdf` | Generate a tailor specification PDF | Yes |
| GET | `/health` | Health check (used by Render) | No |

---

## 3. Endpoint Details

> The blueprint defines endpoints, flows and data fields but not exact request/response bodies. The inputs and outputs below are drawn only from the blueprint's flows and models. The exact schemas will be defined as Zod contracts in `packages/contracts/src/*.ts` (see Open Items).

### 3.1 Auth (`packages/contracts/src/auth.ts`)

#### `POST /v1/auth/register`
- **Input:** email, password, name.
- **Behavior:** validate input, hash the password, create a `users` document.
- **Output:** the created user (never `passwordHash`).

#### `POST /v1/auth/login`
- **Input:** email, password.
- **Behavior:** validate credentials → compare password hash → create API access token.
- **Output:** API access token (used by Auth.js to set up the protected session).

#### `GET /v1/auth/me`
- **Output:** the authenticated user's identity (`email`, `name`, `role`).

### 3.2 Profile (`profile.ts`)

#### `GET /v1/profile`
- **Output:** the user's `profiles` document.

#### `PUT /v1/profile`
- **Input:** gender, ageRange, height, size, budget, likedColors[], dislikedColors[], preferredStyles[], preferredOccasions[].
- **Output:** the saved profile.

### 3.3 Appearance (`appearance.ts`)

#### `POST /v1/appearance/analyze`
- **Input:** face photo and full-body photo (stored in Cloudinary).
- **Behavior:** quality validation → MediaPipe face detection / pose → skin tone, undertone, body shape → confidence.
- **Output:**
  - `skinTone`: `{ monkValue, range, confidence }`
  - `undertone`: `{ value, confidence }`, where value is Warm, Cool, Neutral, Olive or Unknown
  - `bodyShape`: `{ value, confidence }`, where value is Rectangle, Triangle, Inverted Triangle, Oval or Hourglass
  - `proportions`, `userConfirmed: false`, `analysisVersion`
- **Errors:** bad, dark, no-face, multiple-people or partial-body photos produce a clear error instead of a forced result.

#### `GET /v1/appearance`
- **Output:** the stored appearance profile.

#### `PUT /v1/appearance/confirm`
- **Input:** confirmed or corrected values for skin tone, undertone and body shape.
- **Behavior:** confirmed values are stored with `confidence: 1`, `userConfirmed: true`.
- **Output:** the updated appearance profile.

### 3.4 Products (`product.ts`)

#### `GET /v1/products`
- **Input (query):** search and filter criteria based on product fields (category, gender, price, colors, sizes, styles, occasions …).
- **Output:** a list of active products.

#### `GET /v1/products/:id`
- **Output:** a single product: name, brand, category, gender, price, colors[], sizes[], fabric, styles[], occasions[], imageUrl, productUrl, tags[].

### 3.5 Recommendations & Outfits (`outfit.ts`)

#### `POST /v1/recommendations`
- **Input:** occasion, style, budget.
- **Behavior:**
  ```
  Profile → Confirmed Appearance → Hard Filters → MongoDB Products → Candidate Ranking
  → Gemini Reasoning → Zod Validation → Budget Validation → Final Outfit
  ```
- **Output:** outfit(s) with items[] (using stored product prices), totalPrice, explanation ("why this works"), aiModel.
- **Rules:** the total is computed in code, and an outfit is valid only if `totalPrice <= budget`. AI cannot set prices.
- **Errors:** if the AI fails or returns invalid output after retry/fallback, the endpoint returns a clear error.

#### `POST /v1/recommendations/:id/save`
- **Behavior:** saves the outfit to `outfits` for the current user.
- **Output:** the saved outfit.

#### `GET /v1/outfits`
- **Output:** the current user's saved outfit history.

### 3.6 Try-On

#### `POST /v1/tryon`
- **Input:** user photo + garment image.
- **Behavior:** Try-On Service → Leffa / Hugging Face / Qwen → generated image → Cloudinary → MongoDB result.
- **Output:** the try-on result (or its ID).
- **Errors:** if unavailable, returns an error with the message **"Try-on is currently unavailable."** Other endpoints are unaffected.

#### `GET /v1/tryon/:id`
- **Output:** the try-on result, including the generated image URL.

### 3.7 Design (`design.ts`)

#### `POST /v1/design`
- **Input:** Garment, Color, Fabric, Neck, Sleeve, Length, Fit, Pattern, Embroidery.
- **Output:** the saved design.

#### `GET /v1/design/:id`
- **Output:** the design (owned by the current user).

#### `POST /v1/design/sketch`
- **Input:** sketch image (stored in Cloudinary).
- **Behavior:** Gemini Vision → structured garment JSON → Zod.
- **Output (example):**
  ```json
  {
    "garment": "kurta",
    "neck": "mandarin",
    "sleeve": "full",
    "length": "knee",
    "fit": "regular",
    "fabric": "cotton",
    "color": "navy"
  }
  ```
  The user confirms or edits this before generating.

#### `POST /v1/design/generate`
- **Input:** a user-confirmed design specification.
- **Output:** the generated design (design image stored in Cloudinary).

### 3.8 Chat (`chat.ts`)

#### `POST /v1/chat`
- **Input:** user message.
- **Behavior:** Auth → load confirmed profile → relevant conversation context → Gemini → response → MongoDB.
- **Output:** the assistant's response.
- **Errors:** a real error if AI is unavailable. Fake answers are never returned.

#### `GET /v1/chat/conversations`
- **Output:** the current user's conversations.

### 3.9 Tailor

#### `POST /v1/tailor/pdf`
- **Input:** a design (specification JSON).
- **Behavior:** Specification JSON → PDFKit → Tailor PDF.
- **Output:** a downloadable PDF containing Garment, Fabric, Color, Neck, Sleeve, Length, Fit, Pattern, Embroidery, Design image, Tailor instructions.

### 3.10 Health

#### `GET /health`
- **Output:** API health status. Used as the Render health check path.

---

## 4. Cross-Cutting Rules

- **Authorization:** users can only read or modify their own data (profiles, appearance, outfits, try-ons, designs, chats).
- **Rate limiting:** applied to expensive endpoints. The exact list and limits are an open item.
- **CORS:** configured correctly for the web origin.
- **Security headers:** Helmet.
- **Error format:** always the standard error envelope.

See [SECURITY.md](SECURITY.md).

---

## 5. Open Items / To Be Decided

- Exact request/response schemas for each endpoint (to be written as Zod contracts in `packages/contracts`).
- The full list of error `code` values beyond `INVALID_REQUEST`.
- HTTP status code mapping.
- How images are uploaded to the API (multipart, base64, or a direct Cloudinary upload followed by sending the URL).
- Pagination, sorting and search parameters for `GET /v1/products` and `GET /v1/outfits`.
- Whether `POST /v1/tryon` is synchronous or job-based (BullMQ only when needed).
- What the `:id` in `/v1/recommendations/:id/save` refers to (a recommendation result identifier).
- Logout handling on the API side (Phase 2 lists Logout, but there's no logout endpoint).
- How `/v1/tailor/pdf` returns the PDF (a binary stream or a URL).
- Which endpoints count as "expensive" for rate limiting, and their limits.
- Contents of the `/health` response.
