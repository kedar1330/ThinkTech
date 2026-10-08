# StyleMe — AI Design

> Source: StyleMe Final End-to-End Blueprint — §1, §8–§18, §22–§27, §36, §37, §54, §56

---

## 1. Providers and Roles

| Provider | Role | Used for |
|---|---|---|
| **Gemini API** | Primary AI | Fashion reasoning, recommendations, chatbot, sketch interpretation (Gemini Vision), design interpretation |
| **Groq API** | Fallback AI | Fast fallback / alternative AI when appropriate |
| **MediaPipe** | Vision | Face detection (skin region), pose landmarks (body proportions) |
| **Hugging Face** | Image AI | Image generation / editing / try-on |
| **Qwen Image Edit** | Image AI | Image editing / try-on |
| **Leffa** | Image AI | Virtual try-on |

All AI provider calls are made **server-side** from `apps/api/src/integrations/`. API keys never reach the browser.

---

## 2. AI Router

```
Application
    ↓
AI Service
    ↓
AI Router
    ├── Gemini
    └── Groq fallback
```

- Code lives in `apps/api/src/integrations/ai/`. Business services call the AI Service, never a provider directly.
- **Do not assume AI provider free tiers are unlimited.**
- **Handle quota exhaustion gracefully** by falling back to Groq where appropriate, or returning a clear error.
- **Never return fake answers when AI fails.**

---

## 3. Output Validation

AI output is never trusted blindly.

```
AI
    ↓
Parse
    ↓
Zod
    ↓
Business validation
    ↓
Use result
```

If the output is invalid:
1. Retry
2. Fallback
3. Or return a clear error

Business validation examples, taken from the blueprint's rules:
- Prices always come from the database, never from AI output (AI cannot invent or override prices).
- The outfit total must pass the budget engine (`totalPrice <= budget`).
- Sketch JSON must pass the garment schema before the user is asked to confirm it.

---

## 4. Appearance Analysis

### 4.1 Skin tone (Monk Skin Tone)

```
Face Photo
    ↓
Quality Validation
    ↓
MediaPipe / Face Detection
    ↓
Skin Region
    ↓
Pixel/Color Analysis
    ↓
Monk Skin Tone Estimate
    ↓
Range + Confidence
```

Example output: **Monk Tone 5 · Range 4–5 · Confidence 84%**

### 4.2 Undertone

```
Skin/color characteristics
    +
AI reasoning
    ↓
Undertone
```

| Allowed value |
|---|
| Warm |
| Cool |
| Neutral |
| Olive |
| Unknown |

Example: **Undertone Warm · Confidence 78%**. If uncertain, the result is **Unknown**.

### 4.3 Body shape

```
MediaPipe Pose
    ↓
Body Landmarks
    ↓
Shoulder / Chest / Waist / Hip / Torso / Leg proportions
    ↓
Ratios
    ↓
Body Shape Classification
```

| Allowed value |
|---|
| Rectangle |
| Triangle |
| Inverted Triangle |
| Oval |
| Hourglass |

Exact waist or chest measurements are **not** presented unless there is real-world calibration. Only ratios and proportions are used.

### 4.4 Photo quality handling

The system must handle these cases (also AI test scenarios): good photo, bad photo, dark photo, multiple people, no face, partial body, low confidence.

---

## 5. Confidence Model

AI / vision result:

```json
{
  "value": "warm",
  "confidence": 0.78,
  "userConfirmed": false
}
```

After user confirmation:

```json
{
  "value": "warm",
  "confidence": 1,
  "userConfirmed": true
}
```

- Confidence is **always shown** to the user.
- Low-confidence classifications are **never forced**.
- The user can **confirm or edit** every result.
- **Confirmed user values are the source of truth** and override AI estimates in all downstream features (recommendations, chatbot).

Confirmation screen:

```
Your Style Profile

Skin Tone          Monk 4–5            Confidence: 84%
Undertone          Warm                Confidence: 78%
Body Shape         Inverted Triangle   Confidence: 81%

[ Confirm ]  [ Edit ]
```

---

## 6. Recommendation AI

### 6.1 Pre-filtering (no full catalog to AI)

```
10,000 products
    ↓
Gender filter → Category → Occasion → Size → Color → Price → Style
    ↓
Candidate products
    ↓
Ranking
    ↓
Top candidates
    ↓
Gemini reasoning
```

The complete catalog is never sent to Gemini.

### 6.2 Full recommendation flow

```
User Request → Profile → Confirmed Appearance → Hard Filters → MongoDB Products
→ Candidate Ranking → Gemini Reasoning → Zod Validation → Budget Validation → Final Outfit
```

### 6.3 Budget boundary

- AI may **recommend** products.
- **Code decides** whether the final outfit fits the budget.
- AI must **never invent or override product prices**.

```
T-Shirt ₹699 + Jeans ₹999 + Shoes ₹699 = ₹2397
Budget ₹2500 → 2397 <= 2500 → VALID
```

The saved outfit records the `aiModel` that produced it.

---

## 7. Sketch-to-Design AI

```
Sketch
    ↓
Gemini Vision
    ↓
Structured Garment JSON
    ↓
Zod
    ↓
User Confirmation
    ↓
Design Generation
```

Output schema example:

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

The interpreted design is always shown to the user for confirmation before generation.

---

## 8. Fashion Chatbot AI

```
Browser
    ↓
POST /v1/chat
    ↓
Auth
    ↓
Load confirmed profile
    ↓
Relevant conversation context
    ↓
Gemini
    ↓
Response
    ↓
MongoDB
```

- Only the **relevant** profile and context are sent to the AI (data minimisation and cost control).
- Responses are stored in `chatMessages`.

---

## 9. AI Try-On

```
integrations/tryon/
    ├── leffa.ts
    ├── huggingface.ts
    ├── qwen.ts
    └── tryon.service.ts
```

```
User Photo + Garment Image
    ↓
Try-On Service
    ↓
Leffa / Hugging Face / Qwen
    ↓
Generated Image
    ↓
Cloudinary
    ↓
MongoDB Result
    ↓
Frontend
```

- If unavailable, the user sees **"Try-on is currently unavailable."**
- The rest of the application keeps working.
- Results may be cached where useful.
- Generated images go to Cloudinary, never to the local filesystem.

---

## 10. Caching

| Stage | Approach |
|---|---|
| Start | MongoDB-based AI cache: the `aiCache` collection (`cacheKey`, `provider`, `model`, `requestType`, `response`, `createdAt`, `expiresAt`), indexed on `cacheKey` |
| Later | Redis for high-frequency caching, when needed |
| Long-running AI tasks | BullMQ for AI image generation, try-on and image processing, when needed |

---

## 11. Prompts

The blueprint defines the **tasks** each prompt serves but gives no prompt text:

| Prompt | Input (only relevant data) | Output |
|---|---|---|
| Undertone reasoning | Skin/color characteristics | `{ value, confidence }` |
| Outfit recommendation | Request (occasion, style, budget), profile, confirmed appearance, top candidate products | Outfit items (from candidates) + explanation |
| Sketch interpretation | Sketch image | Structured garment JSON |
| Design interpretation | Design specification | Design output |
| Chatbot | Message, confirmed profile, relevant conversation context | Response text |

Every prompt output that the code consumes must have a Zod schema.

---

## 12. AI Safety / Reliability Rules

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

## 13. Model Behavior Summary

- AI and vision features are **probabilistic**. They are handled with confidence, validation, caching, fallbacks and user confirmation.
- Deterministic layers (profile, product, budget, validation, security) **never** depend on AI correctness.
- AI logic is **isolated** behind the AI Service and integrations.

---

## 14. Open Items / To Be Decided

- Prompt text and prompt versioning.
- Specific Gemini / Groq model names.
- Retry count and the exact fallback order (when Groq is "appropriate").
- Confidence thresholds below which a result counts as "low confidence" or becomes **Unknown**.
- How pixel colors map to Monk Skin Tone values.
- The ratio thresholds behind body-shape classification.
- Cache key construction and expiry duration per request type.
- Which provider handles design generation (`POST /v1/design/generate`).
- Selection logic among Leffa, Hugging Face and Qwen for try-on.
- The ranking algorithm for candidate products.
