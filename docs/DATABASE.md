# StyleMe — Database Design

> Source: StyleMe Final End-to-End Blueprint — §1, §7, §8, §14, §19, §25, §27, §38, §56

---

## 1. Overview

| Item | Value |
|---|---|
| Database | MongoDB Atlas |
| ODM | Mongoose (models in `apps/api/src/models/`) |
| Access | Only through the Express API (`apps/api`) |
| Isolation | User-specific data is isolated by authenticated user |
| Local development | Connects to MongoDB Atlas. MongoDB is **not** run in Docker at first |

> The blueprint lists field **names** only. Where it doesn't say, field types, required flags and allowed values are recorded as open items (§7) rather than assumed.

---

## 2. Collections

| Collection | Purpose | Owner |
|---|---|---|
| `users` | Accounts and credentials | System (per user) |
| `profiles` | Fashion/style preferences | Per user |
| `appearanceProfiles` | Skin tone, undertone, body shape results with confidence | Per user |
| `products` | Curated product catalog | Shared (global) |
| `outfits` | Recommended/saved outfits | Per user |
| `designs` | Completed garment designs | Per user |
| `chatMessages` | Fashion chatbot messages | Per user |
| `aiCache` | Cached AI responses | System |

---

## 3. Collection Schemas

### 3.1 `users`

| Field | Notes |
|---|---|
| `email` | Login identifier |
| `passwordHash` | Hashed password. The plain password is never stored |
| `name` | Display name |
| `role` | User role |
| `isActive` | Account active flag |
| `createdAt` | Timestamp |
| `updatedAt` | Timestamp |

### 3.2 `profiles`

| Field | Notes |
|---|---|
| `userId` | Reference → `users` |
| `gender` | |
| `ageRange` | |
| `height` | |
| `size` | |
| `budget` | |
| `likedColors[]` | Array |
| `dislikedColors[]` | Array |
| `preferredStyles[]` | Array |
| `preferredOccasions[]` | Array |
| `createdAt` | Timestamp |
| `updatedAt` | Timestamp |

### 3.3 `appearanceProfiles`

| Field | Sub-field | Notes |
|---|---|---|
| `userId` | | Reference → `users` |
| `skinTone` | `monkValue` | Monk Skin Tone estimate (e.g. 5) |
| | `range` | Estimated range (e.g. 4–5) |
| | `confidence` | 0–1 |
| `undertone` | `value` | Warm / Cool / Neutral / Olive / Unknown |
| | `confidence` | 0–1 |
| `bodyShape` | `value` | Rectangle / Triangle / Inverted Triangle / Oval / Hourglass |
| | `confidence` | 0–1 |
| `proportions` | | Body proportion ratios (not calibrated measurements) |
| `userConfirmed` | | `false` after analysis, `true` after the user confirms |
| `analysisVersion` | | Version of the analysis that produced the result |
| `createdAt` | | Timestamp |
| `updatedAt` | | Timestamp |

### 3.4 `products`

| Field | Notes |
|---|---|
| `name` | |
| `brand` | |
| `category` | T-shirts, Shirts, Jeans, Trousers, Kurtas, Kurtis, Sarees, Lehengas, Shoes, Accessories |
| `gender` | |
| `price` | Source of truth for price (₹). AI must never invent or override it |
| `colors[]` | Array |
| `sizes[]` | Array |
| `fabric` | |
| `styles[]` | Array |
| `occasions[]` | Array |
| `imageUrl` | |
| `productUrl` | |
| `tags[]` | Array |
| `active` | Whether the product is active |
| `createdAt` | Timestamp |

### 3.5 `outfits`

| Field | Notes |
|---|---|
| `userId` | Reference → `users` |
| `occasion` | |
| `budget` | Budget used for validation |
| `items[]` | Outfit items (products) |
| `totalPrice` | Calculated in code from product prices |
| `explanation` | "Why this works" text |
| `aiModel` | AI model that produced the recommendation |
| `createdAt` | Timestamp |

### 3.6 `designs`

The blueprint lists this collection but doesn't define its fields. The Design Studio state it must persist is:

| Design attribute (blueprint §25 / §28) |
|---|
| Garment |
| Color |
| Fabric |
| Neck |
| Sleeve |
| Length |
| Fit |
| Pattern |
| Embroidery |

Design images and sketch images are stored in Cloudinary. Field names, ownership reference and image URL fields are open items (§7).

### 3.7 `chatMessages`

The blueprint lists this collection but doesn't define its fields. It stores chatbot messages and responses (blueprint §27), and backs `GET /v1/chat/conversations`. Field definitions are an open item (§7).

### 3.8 `aiCache`

| Field | Notes |
|---|---|
| `cacheKey` | Unique key of the cached request |
| `provider` | AI provider (e.g. Gemini, Groq) |
| `model` | Model name |
| `requestType` | Type of AI request |
| `response` | Cached response |
| `createdAt` | Timestamp |
| `expiresAt` | Expiry timestamp |

---

## 4. Confidence Model

AI or vision result (stored after analysis):

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

Confirmed user values are the source of truth.

---

## 5. Indexes and Relationships

### 5.1 Indexes

| Collection | Index | Source |
|---|---|---|
| `aiCache` | `cacheKey` | Recommended in blueprint §8 |

### 5.2 Relationships

```
users ──── profiles             via profiles.userId
users ──── appearanceProfiles   via appearanceProfiles.userId
users ──── outfits              via outfits.userId   (one user, many outfits: history)
outfits.items[] ────► products
users ──── designs              (field not yet defined)
users ──── chatMessages         (field not yet defined)
aiCache                         (no user relationship)
```

`GET /v1/profile` and `GET /v1/appearance` return a single resource for the current user. Whether these are strictly one-to-one is listed under Open Items.

### 5.3 Data isolation rule

Every query on user-specific collections (`profiles`, `appearanceProfiles`, `outfits`, `designs`, `chatMessages`) is scoped to the authenticated user's ID.

---

## 6. Seed Data

| Item | Guidance |
|---|---|
| Size | 500–2,000 high-quality, curated products |
| Categories | T-shirts, Shirts, Jeans, Trousers, Kurtas, Kurtis, Sarees, Lehengas, Shoes, Accessories |
| Goal | Good filtering, useful recommendations, reliable product data. Not millions of records |
| Mechanism | Seed script (Phase 5, issue #16), under `apps/api/scripts/` |

---

## 7. Open Items / To Be Decided

- Field types, required flags, defaults and enum values for every collection.
- Whether a user has one `appearanceProfiles` document (updated in place) or many (one per analysis).
- Fields of the `designs` collection, including the user reference, image URLs and the link to tailor PDFs.
- Fields of the `chatMessages` collection, and how messages are grouped into conversations.
- How try-on results are stored ("MongoDB Result" in §23). No collection is named.
- How face and full-body photo Cloudinary references are stored. No field is named.
- Structure of `outfits.items[]` (product references or embedded snapshots).
- Indexes beyond `aiCache.cacheKey` (e.g. `users.email`, `*.userId`, product filter fields, a TTL on `aiCache.expiresAt`).
- `aiCache` expiry duration per `requestType`.
