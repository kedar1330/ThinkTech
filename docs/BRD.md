# StyleMe — Business Requirements Document (BRD)

> Source: StyleMe Final End-to-End Blueprint — Project Overview, §19, §29, §37, §52, §54, §56

---

## 1. Business Problem

Indian users who want personal fashion guidance have no single tool that brings these together:

- their **appearance** (skin tone, undertone, body shape),
- their **preferences** (liked/disliked colors, preferred styles, occasions, size),
- their **budget**, and
- products they can actually browse and buy.

StyleMe solves this with an **AI-powered personal fashion stylist** that gives recommendations matched to the user's appearance and occasion, and checks every outfit against the user's real budget.

---

## 2. Target Users

| Attribute | Description |
|---|---|
| Market | Indian users |
| Need | Personalised outfit recommendations for a given occasion, style and budget |
| Wardrobe scope | Western and Indian wear, matching the catalog categories: T-shirts, Shirts, Jeans, Trousers, Kurtas, Kurtis, Sarees, Lehengas, Shoes, Accessories |
| Currency | Indian Rupee (₹) |
| Profile data captured | Gender, age range, height, size, budget, liked/disliked colors, preferred styles, preferred occasions |

---

## 3. Solution

StyleMe is a web application (a Next.js web app plus an Express API) that takes the user through this journey:

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

### Key value propositions

- **Appearance-aware styling.** The app estimates Monk skin tone, undertone and body shape from the user's photos, and **shows how confident it is in each value**.
- **User control.** The user can confirm or correct any visual classification. Confirmed values become the source of truth.
- **Trustworthy budgets.** Budget checks run in deterministic code. AI never invents or overrides prices.
- **Visualisation.** Users can see outfits through AI try-on and a simple 3D avatar.
- **Custom design.** Users can design garments in a Design Studio, turn sketches into structured designs, and download a tailor specification PDF.
- **Conversational help.** A fashion chatbot answers questions using the user's confirmed profile.

---

## 4. MVP Scope

At the end of the project StyleMe must be a **working MVP, not just a UI demo**.

### 4.1 MVP user capabilities

A user must be able to:

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

### 4.2 MVP boundaries

- **Product catalog:** a manageable, curated catalog of **500–2,000 high-quality products**, not millions of records.
- **3D avatar:** front, side and back views, with rotate, zoom and approximate proportions. Photorealistic human reconstruction is out of scope for the first MVP.
- **Measurements:** no exact physical body measurements, because there is no real-world calibration.
- **Infrastructure:** keep it simple. See §6, Non-Goals.

### 4.3 Target result (success criteria)

```
User
→ Register
→ Profile
→ Upload photos
→ Appearance analysis
→ Confirm result
→ Personalized recommendations
→ Real coded budget validation
→ Product browsing
→ AI try-on
→ 3D avatar
→ Design studio
→ Sketch AI
→ Fashion chatbot
→ Tailor PDF
→ Live deployment
```

- The core recommendation, profile, product, budget, validation, security and deployment layers must be **deterministic and reliable**.
- AI and vision features are probabilistic. They must be handled with **confidence, validation, caching, fallbacks and user confirmation**.
- The application must be **live**: web on Vercel, API on Render.

---

## 5. Future Scope

These are introduced **only when the application actually needs them**:

| Item | Trigger for introduction |
|---|---|
| Redis | High-frequency caching, rate-limit counters, temporary state, distributed locks, background jobs |
| BullMQ | Long-running tasks: AI image generation, try-on, large PDF generation, image processing, batch processing |
| More advanced AI/image processing | When the application requires it |
| Redis in Docker Compose | When Redis is introduced |

---

## 6. Non-Goals (Avoid Initially)

- Microservices
- Kubernetes
- Separate Python service
- Separate database per module
- Complex event architecture
- Huge product marketplace
- Overly complex recommendation ML
- Unnecessary infrastructure
- Photorealistic 3D human reconstruction (first MVP)

---

## 7. Business Rules

1. Budget calculation is pure code. AI may recommend products, but **code decides** whether an outfit fits the budget.
2. AI must never invent or override product prices.
3. Uncertain visual classifications are never forced. The user can always correct them.
4. Values the user confirms override AI estimates.
5. When AI fails, the user gets a real error or a fallback. No fake answers.
6. User images and generated images are stored in cloud storage (Cloudinary).

---

## 8. Constraints and Assumptions

- AI provider free tiers are **not** assumed to be unlimited. Running out of quota must be handled gracefully.
- Delivery follows phases 0–13 on a recommended 12-day schedule (see [CONTRIBUTING.md](CONTRIBUTING.md)).
- Technology stack is fixed (see [ARCHITECTURE.md](ARCHITECTURE.md)).

---

## 9. Related Documents

[FRD.md](FRD.md) · [SRS.md](SRS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 10. Open Items / To Be Decided

- The blueprint doesn't define quantitative business KPIs, such as user numbers, conversion or retention targets.
- It doesn't specify a monetisation model or partner/retailer relationships for `productUrl` links.
- It doesn't specify where the product data comes from beyond "curated catalog" and a seed script.
