# StyleMe — Functional Requirements Document (FRD)

> Source: StyleMe Final End-to-End Blueprint — Project Overview, §4, §8, §11–§19, §22–§28, §30, §52

---

## 1. Purpose

This document lists the functional requirements, user flows and expected feature behavior of each StyleMe module. Requirement IDs (`FR-<MODULE>-<NN>`) are referenced from [SRS.md](SRS.md) and [TESTING.md](TESTING.md).

---

## 2. Module Overview

| # | Module | Frontend route | API prefix | Phase |
|---|---|---|---|---|
| 1 | Authentication | `(auth)/login`, `(auth)/register` | `/v1/auth/*` | 2 |
| 2 | Dashboard & Profile | `dashboard/`, `profile/` | `/v1/profile/*` | 3 |
| 3 | Appearance Analysis & Confirmation | `analyze/` | `/v1/appearance/*` | 4 |
| 4 | Product Catalog | `products/` | `/v1/products/*` | 5 |
| 5 | Recommendation & Budget | `outfits/` | `/v1/recommendations/*` | 6 |
| 6 | Outfit Experience | `outfits/` | `/v1/outfits/*` | 7 |
| 7 | AI Try-On | `tryon/` | `/v1/tryon/*` | 8 |
| 8 | 3D Avatar | `avatar/` | — | 9 |
| 9 | Design Studio | `design/` | `/v1/design/*` | 10 |
| 10 | Sketch-to-Design | `design/` | `/v1/design/sketch`, `/v1/design/generate` | 11 |
| 11 | Fashion Chatbot | `chat/` | `/v1/chat/*` | 11 |
| 12 | Tailor PDF | `tailor/` | `/v1/tailor/*` | 11 |

---

## 3. End-to-End User Flow

```
Register → Login → Profile → Upload photos → Analyze → Confirm
→ Recommendation → Budget → Product → Try-On → Design → Chat → PDF → Logout
```

---

## 4. Functional Requirements by Module

### 4.1 Authentication (FR-AUTH)

**User flow (login)**

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

| ID | Requirement |
|---|---|
| FR-AUTH-01 | A user can register with email, password and name (`POST /v1/auth/register`). |
| FR-AUTH-02 | The password is stored only as a hash (`passwordHash`). |
| FR-AUTH-03 | A user can log in with email and password (`POST /v1/auth/login`). The API validates the credentials, compares the password hash and creates an API access token. |
| FR-AUTH-04 | Auth.js keeps a protected browser session after a successful login. |
| FR-AUTH-05 | An authenticated user can get their own identity (`GET /v1/auth/me`). |
| FR-AUTH-06 | A user can log out. |
| FR-AUTH-07 | Frontend pages other than login/register are protected and need an authenticated session. |
| FR-AUTH-08 | API endpoints other than register, login and `/health` need authentication. |
| FR-AUTH-09 | Users have a `role` and an `isActive` flag. |

---

### 4.2 Dashboard & Profile (FR-PROF)

| ID | Requirement |
|---|---|
| FR-PROF-01 | After login, the user sees a dashboard with navigation to every module. |
| FR-PROF-02 | The user can create and edit a fashion profile with these fields: gender, ageRange, height, size, budget, likedColors[], dislikedColors[], preferredStyles[], preferredOccasions[]. |
| FR-PROF-03 | The profile is saved in MongoDB (`profiles` collection) and linked to the user by `userId`. |
| FR-PROF-04 | The user can view their profile (`GET /v1/profile`) and update it (`PUT /v1/profile`). |
| FR-PROF-05 | A user can access only their own profile. |

---

### 4.3 Appearance Analysis (FR-APP)

**User flow**

```
Upload face photo + full-body photo
    ↓
Quality validation
    ↓
Cloudinary storage
    ↓
MediaPipe (face detection / pose landmarks)
    ↓
Skin tone + Undertone + Body shape
    ↓
Confidence values
    ↓
Confirmation screen
```

| ID | Requirement |
|---|---|
| FR-APP-01 | The user can upload a face photo. |
| FR-APP-02 | The user can upload a full-body photo. |
| FR-APP-03 | Uploaded photos are stored in Cloudinary, never on the API server's local filesystem. |
| FR-APP-04 | Photos go through quality validation before analysis. Bad, dark, no-face, multiple-people and partial-body photos are handled with clear feedback. |
| FR-APP-05 | **Skin tone.** The system detects the face (MediaPipe), extracts the skin region, analyses pixel colors and estimates a **Monk Skin Tone** value with a **range** and a **confidence**. Example: Monk 5, range 4–5, confidence 84%. |
| FR-APP-06 | **Undertone.** The system combines skin/color characteristics with AI reasoning to return one of: Warm, Cool, Neutral, Olive, Unknown, with a confidence. If uncertain, it returns **Unknown**. |
| FR-APP-07 | **Body shape.** The system uses MediaPipe Pose landmarks to compute shoulder, chest, waist, hip, torso and leg proportions and ratios, then classifies the shape as one of: Rectangle, Triangle, Inverted Triangle, Oval, Hourglass, with a confidence. |
| FR-APP-08 | The system must **not** show exact physical measurements (such as waist or chest) when there is no real-world calibration. |
| FR-APP-09 | The analysis is triggered with `POST /v1/appearance/analyze`, and the stored result is fetched with `GET /v1/appearance`. |
| FR-APP-10 | Results are stored in `appearanceProfiles` with `analysisVersion` and `userConfirmed = false`. |

---

### 4.4 Appearance Confirmation (FR-CONF)

**Confirmation screen**

```
Your Style Profile

Skin Tone
Monk 4–5
Confidence: 84%

Undertone
Warm
Confidence: 78%

Body Shape
Inverted Triangle
Confidence: 81%

[ Confirm ]
[ Edit ]
```

| ID | Requirement |
|---|---|
| FR-CONF-01 | The system shows the user their skin tone, undertone and body shape, each with its confidence value. |
| FR-CONF-02 | The user can **Confirm** the results. |
| FR-CONF-03 | The user can **Edit** (correct) any result. |
| FR-CONF-04 | The system never forces an uncertain visual classification. |
| FR-CONF-05 | On confirmation (`PUT /v1/appearance/confirm`), the stored value becomes `userConfirmed: true` with `confidence: 1`. |
| FR-CONF-06 | Confirmed user values are the source of truth for recommendations and the chatbot. |

---

### 4.5 Product Catalog (FR-PROD)

| ID | Requirement |
|---|---|
| FR-PROD-01 | The system has a curated catalog of 500–2,000 products, loaded by a seed script. |
| FR-PROD-02 | Catalog categories: T-shirts, Shirts, Jeans, Trousers, Kurtas, Kurtis, Sarees, Lehengas, Shoes, Accessories. |
| FR-PROD-03 | Each product has: name, brand, category, gender, price, colors[], sizes[], fabric, styles[], occasions[], imageUrl, productUrl, tags[], active. |
| FR-PROD-04 | The user can browse, search and filter products (`GET /v1/products`). |
| FR-PROD-05 | The user can view product details (`GET /v1/products/:id`). |

---

### 4.6 Recommendation Engine (FR-REC)

**Flow**

```
User Request (occasion + style + budget)
    ↓
Profile
    ↓
Confirmed Appearance
    ↓
Hard Filters
    ↓
MongoDB Products
    ↓
Candidate Ranking
    ↓
Gemini Reasoning
    ↓
Zod Validation
    ↓
Budget Validation
    ↓
Final Outfit
```

| ID | Requirement |
|---|---|
| FR-REC-01 | The user selects occasion, style and budget and asks for recommendations (`POST /v1/recommendations`). |
| FR-REC-02 | The system loads the user's profile and confirmed appearance. |
| FR-REC-03 | The system applies hard filters in this order: gender → category → occasion → size → color → price → style, producing candidate products. |
| FR-REC-04 | Candidates are ranked, and only the **top candidates** go to Gemini. The full catalog is never sent. |
| FR-REC-05 | Gemini returns outfit reasoning, which is parsed and validated with Zod and business validation. |
| FR-REC-06 | Invalid AI output leads to a retry, a fallback or a clear error. Fake results are never returned. |
| FR-REC-07 | The final outfit passes budget validation (FR-BUD) before it is returned. |

---

### 4.7 Budget Engine (FR-BUD)

| ID | Requirement |
|---|---|
| FR-BUD-01 | Budget calculation is pure code. |
| FR-BUD-02 | The total price is the sum of the stored product prices of the outfit items. |
| FR-BUD-03 | An outfit is **VALID** only if `totalPrice <= budget`. |
| FR-BUD-04 | AI must never invent or override product prices. Prices always come from the `products` collection. |

**Example**

```
T-Shirt       ₹699
Jeans         ₹999
Shoes         ₹699
------------------
Total        ₹2397
Budget       ₹2500
2397 <= 2500 → VALID
```

---

### 4.8 Outfit Experience (FR-OUT)

| ID | Requirement |
|---|---|
| FR-OUT-01 | Recommended outfits are shown as outfit cards. |
| FR-OUT-02 | Each outfit shows a "Why this works" explanation. |
| FR-OUT-03 | Each outfit shows a per-item price breakdown and the total price. |
| FR-OUT-04 | The user can save an outfit (`POST /v1/recommendations/:id/save`). |
| FR-OUT-05 | The user can view their outfit history (`GET /v1/outfits`). |
| FR-OUT-06 | The user can open the product details of any outfit item. |
| FR-OUT-07 | A saved outfit stores: userId, occasion, budget, items[], totalPrice, explanation, aiModel. |

---

### 4.9 AI Try-On (FR-TRY)

**Flow**

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

| ID | Requirement |
|---|---|
| FR-TRY-01 | The user can ask for an AI try-on of a garment on their photo (`POST /v1/tryon`). |
| FR-TRY-02 | The generated image is stored in Cloudinary, and the result is stored in MongoDB. |
| FR-TRY-03 | The user can get a try-on result (`GET /v1/tryon/:id`). |
| FR-TRY-04 | If try-on is unavailable, the user sees: **"Try-on is currently unavailable."** |
| FR-TRY-05 | A try-on failure must not affect the rest of the application. |
| FR-TRY-06 | Try-on results may be cached where useful. |

**Definition of done (from the blueprint):** upload works, API works, auth works, input is validated, AI failure is handled, result is stored, unauthorized access is blocked, tests pass.

---

### 4.10 3D Avatar (FR-AVT)

| ID | Requirement |
|---|---|
| FR-AVT-01 | The user can view a 3D avatar rendered from a GLB/GLTF model. |
| FR-AVT-02 | The viewer supports front, side and back views. |
| FR-AVT-03 | The user can rotate and zoom. |
| FR-AVT-04 | The avatar reflects **approximate** proportions. |
| FR-AVT-05 | Photorealistic human reconstruction is out of scope for the MVP. |

---

### 4.11 Design Studio (FR-DES)

| ID | Requirement |
|---|---|
| FR-DES-01 | The user can design a garment by choosing: Garment, Color, Fabric, Neck, Sleeve, Length, Fit, Pattern, Embroidery. |
| FR-DES-02 | The user sees a preview of the design. |
| FR-DES-03 | Design state is temporary client-side state while editing (Zustand). |
| FR-DES-04 | The user can save a completed design, which is stored in MongoDB (`POST /v1/design`). |
| FR-DES-05 | The user can get a saved design (`GET /v1/design/:id`). |

---

### 4.12 Sketch-to-Design (FR-SKT)

**Flow**

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

| ID | Requirement |
|---|---|
| FR-SKT-01 | The user can upload a sketch image (`POST /v1/design/sketch`), which is stored in Cloudinary. |
| FR-SKT-02 | Gemini Vision turns the sketch into structured garment JSON, for example `{ "garment": "kurta", "neck": "mandarin", "sleeve": "full", "length": "knee", "fit": "regular", "fabric": "cotton", "color": "navy" }`. |
| FR-SKT-03 | The JSON is validated with Zod. |
| FR-SKT-04 | The user confirms (or edits) the interpreted design before generation. |
| FR-SKT-05 | The user can generate a design from the confirmed specification (`POST /v1/design/generate`). Generated design images are stored in Cloudinary. |

---

### 4.13 Fashion Chatbot (FR-CHAT)

**Flow**

```
Browser → POST /v1/chat → Auth → Load confirmed profile
→ Relevant conversation context → Gemini → Response → MongoDB
```

| ID | Requirement |
|---|---|
| FR-CHAT-01 | An authenticated user can send a message to the fashion assistant (`POST /v1/chat`). |
| FR-CHAT-02 | The system loads the user's confirmed profile and the relevant conversation context. |
| FR-CHAT-03 | Only the relevant profile and context are sent to the AI. |
| FR-CHAT-04 | Responses are stored in MongoDB (`chatMessages`). |
| FR-CHAT-05 | The user can list their conversations (`GET /v1/chat/conversations`). |
| FR-CHAT-06 | If AI fails, the user gets a real error. Fake answers are never returned. |

---

### 4.14 Tailor Specification PDF (FR-PDF)

**Flow**

```
Design → Specification JSON → PDFKit → Tailor PDF
```

| ID | Requirement |
|---|---|
| FR-PDF-01 | The user can generate a tailor specification PDF from a design (`POST /v1/tailor/pdf`). |
| FR-PDF-02 | The PDF contains: Garment, Fabric, Color, Neck, Sleeve, Length, Fit, Pattern, Embroidery, Design image, Tailor instructions. |
| FR-PDF-03 | The user can download the PDF. |

---

## 5. Cross-Cutting Functional Behavior

| ID | Requirement |
|---|---|
| FR-X-01 | Every API response uses the standard envelope (`success` + `data`, or `success` + `error.code` and `error.message`). |
| FR-X-02 | Error responses never expose stack traces, secrets, database details or internal errors. |
| FR-X-03 | All user-specific data is isolated to the authenticated user. |
| FR-X-04 | All persistent images (profile, face, full-body, try-on, design, sketch) are stored in Cloudinary. |
| FR-X-05 | `GET /health` reports API health. |

---

## 6. Open Items / To Be Decided

- Allowed values for `gender`, `ageRange`, `size`, styles and occasions.
- How users enter and edit design fields (UI controls and allowed values for neck, sleeve and so on).
- What the "Tailor instructions" in the PDF contain and where they come from (user-entered or generated).
- How a design is chosen for try-on, and how outfit items feed into try-on.
- How the 3D avatar's approximate proportions are derived from the appearance profile.
- How the frontend gets the PDF (direct download or a Cloudinary link).
- How conversations are grouped (see `chatMessages` in [DATABASE.md](DATABASE.md)).
- Ranking criteria for candidate products.
