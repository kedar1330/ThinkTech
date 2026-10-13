# StyleMe — Business Requirements Document (BRD)

> Part of the StyleMe documentation baseline. Release scope: [MVP.md](MVP.md). Requirements: [FRD.md](FRD.md). Plan and decisions: [ImplementationPlan.md](ImplementationPlan.md) (decision register §8).

---

## 1. Business Problem

People in India who want personal fashion guidance have no single tool that brings together:
- their **preferences** (colours they like and dislike, styles, occasions, fit, comfort, coverage);
- their **sizes**, which differ by clothing category;
- optional **appearance signals** they choose to share (skin-tone range, undertone, proportions);
- and, eventually, **real products** they can buy from retailers they already use, within a **budget**.

Shoppers on large marketplaces also struggle to judge listing quality (fabric, fit, stitching, durability, sizing) and whether the item matches its pictures.

StyleMe starts with what it can deliver honestly today — explained, personalised styling, plus a shortlist where users record items they find and the prices they enter, totalled against their budget and clearly marked as not verified by StyleMe. Verified real products follow when StyleMe has an authorised source for them.

---

## 2. Target Users

| Attribute | Description |
|---|---|
| Market | India |
| Need | Personalised, explained outfit ideas for an occasion; keeping their own finds within a budget; later, verified real products |
| Wardrobe scope | Western and Indian wear. Stage 1 covers a manageable subset of: T-shirts, Shirts, Jeans, Trousers, Kurtas, Kurtis, Sarees, Lehengas, Shoes, Accessories. Dresses is added in Stage 2 |
| Currency | Indian Rupee (₹) |
| Where they shop | Indian online retailers. Flipkart and Meesho are the intended first retailers, but neither has approved StyleMe (§7) |

---

## 3. Product Vision

StyleMe is a personal styling platform that grows into a styling-and-shopping platform. Over time it should support:
- personalised colour palettes and complete look suggestions;
- skin tone and undertone as optional styling signals, never restrictions;
- fit preferences and category-specific sizing;
- categories, silhouettes, necklines, sleeves, patterns, fabrics and accessories;
- real product discovery from authorised retailers, with honest prices, availability and quality evidence;
- budget-aware shopping on verified prices;
- optional weather-aware suggestions;
- later, if approved: photo-based appearance analysis, a 3D avatar, a Design Studio, sketch-to-design, a fashion chatbot and a tailor specification PDF (D-76);
- virtual try-on only if D-48 is resolved;
- a styling engine that generates many combinations from reusable, reviewed rules rather than a fixed menu.

**Priorities, in order:** (1) user value and recommendation quality; (2) correctness, trust and honest information; (3) legal permissions, privacy and security; (4) a feasible first release; (5) low operating costs; (6) extensibility. Feature count never outranks quality or feasibility.

### 3.1 Value propositions

| Value | Stage |
|---|---|
| **Explained, personal looks.** Complete looks for an occasion, built from the user's preferences and reviewed styling rules, each with "Why this works" | 1 |
| **User control.** Every input is optional except the occasion and department; appearance signals are self-reported, switchable and deletable; users can explore any colour | 1 |
| **A large, coordinated styling library.** 100+ palettes and 100+ outfit templates with rules for coordination, occasions, preferences, fit, sizes and alternatives, combined dynamically | 1 (starting set), 2 (full library) |
| **Sizing per category.** Tops, bottoms, ethnic wear and shoes each have their own size; body shape never sets size | 1 |
| **Honesty.** No invented products, prices, reviews or confidence; missing data shown as "Not available" | All |
| **Real products and trustworthy budgets.** Verified listings with "Price as of" times, availability, quality evidence and budget totals computed in code | Product layer |
| **Budgeting on your own finds.** Add items you found, with your own prices, to a look and see the total against your budget — always labelled "entered by you, not verified by StyleMe" | 1 |
| **Optional weather awareness** | 2 |

---

## 4. Release Scope

### 4.1 Stages

| Stage | What it is | Key dependencies |
|---|---|---|
| **Stage 1 — Personal Styling** | The first real release ([MVP.md](MVP.md)), including a shortlist with budget totals on user-entered prices (D-77 = B); a closed beta until the legal review | Founder content (C1); hosting decision when needed (D-81). Public launch also needs the legal review (D-74) recorded complete and self-service email password reset, with the email provider chosen at HC-2 (D-84); full list in [ImplementationPlan.md](ImplementationPlan.md) §11 |
| **Product layer** (Stage 3) | Verified products, matching, verified-price budgets, quality evidence | An authorised source (D-43 … D-45); D-74; D-46 |
| **Stage 2 — Expanded Styling** | The full styling library (100+ palettes, 100+ templates); optional weather | Founder content capacity; D-60 for weather |
| **Stage 3 — Authorised Shopping** | Product layer release; more retailers | As for the product layer |
| **Deferred / Future** | D-76 features; try-on (D-48) | Founder decisions |

**Styling content requirement (D-57):** at least 100 colour palettes and at least 100 outfit templates (planning range 100–150), 8–12 categories and a comprehensive styling-rule library, complete before the Stage 2 release. Stage 1 releases with a smaller approved set (12–20 palettes, about 20 templates) as a closed beta. Product catalogue target (product layer): 500–1,000 human-reviewed listings.

### 4.2 Boundaries

- **No demo release.** Every release is real and is used by real people.
- **Shopping:** StyleMe links out to retailers. No cart, checkout, payments or order handling.
- **Products:** only verified real products from authorised sources are ever shown as products (§6, rule 7).
- **Measurements:** no claimed body measurements without calibration. Self-measured values are collected only when product size charts make them useful.
- **Infrastructure:** simple (§5).

---

## 5. Non-Goals

Microservices; Kubernetes; a separate Python service; a database per module; complex event architecture; a marketplace (cart, checkout, payments, mirrored retailer catalogues); complex recommendation ML; unnecessary infrastructure; photorealistic 3D reconstruction; scraping; price-drop alerts; click-out tracking.

---

## 6. Business Rules

1. Looks, rankings, explanations, size notes and budgets are computed in code. No core feature depends on external AI.
2. AI never invents or changes prices, availability, products or quality claims.
3. Budget totals are computed in code from user-entered prices (Stage 1) or verified prices (product layer), never combined, always labelled with their basis, and never presented as checkout prices. User-entered items and prices are always labelled as not verified by StyleMe.
4. When an optional enhancement fails, the core result is returned without it. When a core operation fails, the user gets a clear error, never a fake answer.
5. Reviews, ratings, prices, availability and quality claims are never fabricated. Missing data is shown as "Not available".
6. Every verified price shown carries the time it was verified, and the retailer's page is authoritative. Prices the user enters are labelled as entered by them and not verified by StyleMe.
7. Only verified real products are shown as products. Mock, illustrative and test records are never shown to users. Test fixtures never exist in production.
8. Retailer data comes only through permitted access methods. No scraping.
9. StyleMe never guarantees that a product will recreate a look.
10. Products with serious, evidenced quality problems are not recommended.
11. Suitability for the user and evidenced quality always outrank commercial considerations. Affiliate monetisation is off by default; affiliate status and commission never influence ranking or quality.
12. If a product link carries affiliate tracking, a disclosure is shown next to it (D-46).
13. Styling signals are suggestions, never restrictions. StyleMe never claims an outfit is objectively unsuitable for a body or skin tone.
14. Body shape never determines clothing size.
15. Weather is optional and off by default; location is never mandatory; precise location is never stored.
16. Personal photographs, measurements and unnecessary personal information are never sent to external AI providers, unless a future explicit founder decision, a privacy review and user consent authorise that specific processing.
17. Users can always override recommendations and explore any colour, fit or style.
18. Users can delete their data and their account.
19. Accounts are protected and in the user's control: every email address is verified (or verified by Google), passwords follow a clear policy, a forgotten password is reset by the user without anyone at StyleMe seeing or choosing it, and the account can be deleted immediately and permanently (D-83, D-86 … D-94).

---

## 7. Retailer Access, Constraints and Assumptions

### 7.1 Constraints

- No AI provider free tier is assumed to be unlimited; Stage 1 doesn't need one.
- Hosting accounts, plans and costs are decided later, at the hosting checkpoint (D-81). No account, paid plan or free tier is assumed. As checked on 2026-10-10, some free tiers don't fit a commercial product: Vercel Hobby is for non-commercial personal use only, Render's free services sleep when idle and Atlas free clusters have no backups ([DEPLOYMENT.md](DEPLOYMENT.md) §9.1).
- Retailer APIs, live prices, reviews and inventory are **not** assumed to be accessible.
- The technology stack is in [ARCHITECTURE.md](ARCHITECTURE.md).
- Estimates are in [ImplementationPlan.md](ImplementationPlan.md) §5.1. They are estimates, not commitments.

### 7.2 Retailer access (as researched on 2026-10-09; not legal advice)

| Retailer | What was found | Gap or risk | Status |
|---|---|---|---|
| Flipkart | [API Terms of Use](https://affiliate.flipkart.com/api-docs/af_tou.html): use "solely in conjunction with Flipkart's platform"; a restriction on use "in a similar or competitive platform"; a restriction on "derivative works" whose scope (API materials or product images) is unclear; restrictions on using Flipkart's name and trademarks (e.g. "You shall not use the name or trademarks of Flipkart in Your advertising"; whether written consent can be obtained is unconfirmed); caching not addressed; 20 calls/second; termination at any time. [Affiliate API](https://affiliate.flipkart.com/api-docs/af_prod_ref.html) for registered affiliates: product feed, delta feed, keyword search, product-ID search; fields include MRP, selling and special prices, stock, images, size, colour, product URL with affiliate ID, and seller ratings | No product-level reviews in the API reference, so review evidence must be curated. Field meanings (`inStock`, special price) unclear | No access approved (D-44) |
| Meesho | No public product API found; the supplier API serves sellers' own catalogues | Terms of Use not retrieved | No access (D-45) |
| Amazon.in | PA-API is being replaced by the [Creators API](https://affiliate-program.amazon.in/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi) | Eligibility and fields not verified for StyleMe | Not evaluated further |
| Others (Myntra, Ajio, …) | Not verified | — | Not evaluated |

These clauses neither clearly permit nor clearly forbid cross-retailer comparison or AI processing of product images. Both stay undecided until confirmed in writing. Written confirmation from each retailer and a legal review (D-74) are needed before any retailer is enabled.

### 7.3 Access levels

| Level | Meaning | What StyleMe may show | Counts toward budgets? |
|---|---|---|---|
| A | Approved API or feed, within its terms | Data the terms permit, with timestamps | Yes |
| B | Permitted manual curation | Facts recorded by a curator with source URL and capture time; images only by the retailer's own URL if permitted | Yes |
| C | Link-only (no data rights confirmed) | Not used for products. Stage 1 search phrases are generic and name no retailer | No |
| D | Disabled | Nothing | No |

Every retailer starts at D and moves up only when its access is confirmed. The product layer needs at least one retailer at level A or B.

### 7.4 Affiliate programmes

- Monetisation is off by default; StyleMe adds no tracking of its own.
- An affiliate programme may be used only as a data-access route, subject to approval and its terms.
- Source-supplied links that already carry tracking (Flipkart's do) are marked `affiliateTracked` and disclosed.
- Affiliate status and commission are never ranking inputs, never sent to AI and never stored as commission data.
- Advertising-disclosure rules in India (ASCI guidance was cited in earlier research but not re-verified in this audit) may require affiliate links to be disclosed; the D-46 wording and its legal basis are for the legal review (D-74).

---

## 8. Success Measures

- **Stage 1 release:** the acceptance criteria in [MVP.md](MVP.md) §5.1 and §5.2 and the evaluation set ([TESTING.md](TESTING.md) §6).
- **Business KPIs** (e.g. returning users, saved looks per user, "love it" rate) are defined before the closed beta ends (D-71). No figures are claimed until measured.

---

## 9. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-43 … D-48, D-58, D-61, D-63, D-71, D-74, D-76, D-77, D-83, D-84, D-86 … D-94.
