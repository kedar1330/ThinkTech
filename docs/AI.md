# StyleMe — AI and Recommendation Design

> Part of the StyleMe documentation baseline. Requirements: [FRD.md](FRD.md) §4.4–§4.6. Data model: [DATABASE.md](DATABASE.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

---

## 1. Role of AI in StyleMe

StyleMe's core is **deterministic**. Look generation, selection, ranking, explanations, sizing notes, budgets, product eligibility and quality verdicts are computed in code from structured data and reviewed rules. No core feature depends on an external AI service.

| Feature | AI role | Stage |
|---|---|---|
| Look generation, selection and ranking | None | 1 |
| "Why this works" explanations | Built from rule rationale. Optional AI may **reword** them only | 1 (wording optional, off by default) |
| Budget totals on user-entered prices | None | 1 |
| Eligibility, verified-price budgets, quality verdicts, look match | None | Product layer |
| Weather-aware ranking | None (deterministic comfort bands) | 2 |
| Photo-based appearance analysis | Vision estimation, processed on StyleMe's own infrastructure or in the browser | Deferred (D-76) |
| Chatbot, sketch interpretation, design generation | Required by those features | Deferred (D-76) |
| Virtual try-on | Generative image model; not approved | Future (D-48) |

**Providers.** Stage 1 needs **no** AI provider. The optional wording step uses at most one provider, Gemini (D-12); its fallback is the deterministic template text, not a second provider. Gemini with a Groq fallback is a documented option for the AI-required deferred features only. No provider is enabled before its current pricing, limits and data-use terms are checked and recorded (NFR-COST-03); for example, Google's free tier uses submitted content to improve its products and the paid tier does not ([DEPLOYMENT.md](DEPLOYMENT.md) §9.1).

**If every AI provider fails.** Stage 1 is unaffected: looks, ranking, explanations, size notes and budgets are code, and the wording step falls back to template text with `AI_ENHANCEMENT_SKIPPED`. Only the AI-required deferred features (chatbot, sketch interpretation, design generation) stop, with `AI_UNAVAILABLE`, never a fake answer. Hugging Face, Qwen Image Edit and Leffa appear only in the superseded try-on design (§8).

---

## 2. AI Safety and Reliability Rules

1. Never claim exact body measurements without calibration.
2. Never force a low-confidence classification.
3. Show the model's confidence for estimates; never invent a confidence for self-reported or derived data.
4. Let the user correct any estimate.
5. User-confirmed and self-reported values override model estimates.
6. AI never invents or changes product prices.
7. Budgets are validated by code.
8. All AI output is validated with Zod and business rules before use.
9. AI failures produce a deterministic fallback or a clear error, never a fake answer.
10. API keys never leave the server.
11. Never fabricate reviews, ratings, prices, availability, products or quality claims.
12. Every quality claim cites stored evidence; no evidence means "insufficient evidence".
13. Never guarantee that a product will recreate a look.
14. AI never overrides a product's availability, freshness or quality verdict.
15. Never claim a body shape or skin tone makes an outfit objectively unsuitable.
16. Never send personal photographs, measurements or unnecessary personal information to external AI providers, unless a future explicit founder decision, a privacy review and user consent authorise that specific processing.
17. Explanations reflect only the rules and attributes actually used.

---

## 3. Deterministic Look Generation (Stage 1)

```
Request (occasion, style?, paletteMode)
  + profile (department, preferences, sizes, fit)
  + self-reported signals (only if enabled)
        ↓
Compatible outfit templates (occasion, style, department)
        ↓
Palette selection: liked colours boosted, disliked colours excluded,
undertone affinity as a soft signal, "explore" widens to any non-disliked colour
        ↓
Styling, fit and fabric rules applied as soft weights, in precedence order (FR-LOOK-08)
        ↓
Look specification per slot
        ↓
Diversity: unique combination signatures; at most 5 looks
        ↓
Alternatives per slot (3–5 when available, never padded)
        ↓
Explanation from rule rationale + matched attributes (with references)
        ↓
[Product layer only] eligibility → matching → ranking per slot (FR-MATCH)
        ↓
[Optional] AI rewording of the explanation (§5)
```

- **Precedence:** hard user constraints > explicit preferences > approved rules > self-reported signals > weather (Stage 2).
- **Missing data:** defaults are applied and listed. Unknown undertone or switched-off signals mean palettes are chosen from preferences and versatile neutrals.
- **Ranking** (D-19): a weighted sum of approved rule effects and preference matches. Weights live in the knowledge base and are tuned on the evaluation set ([TESTING.md](TESTING.md) §6). Affiliate status is never an input. With the product layer, suitability (hard constraints and look match) and evidenced quality always come before price, and commission never counts (FR-MATCH-03).
- **Inclusive-language check:** all explanation text, templated or AI-worded, is checked against a list of judgemental phrases ("unflattering", "not for your body type", "you should avoid"). Failing text is replaced by the plain rule rationale.

---

## 4. Style Knowledge Base

Records live in `apps/api/src/style-rules/`, are Zod-validated and linted at startup and in CI, and are reviewed by the founder ([CONTRIBUTING.md](CONTRIBUTING.md) §6).

**Common fields:** `id`, `version`, `tags[]`, applicable contexts, user-adjustable preferences, `rationale`, `limitations`, `reviewStatus` (`draft` \| `reviewed` \| `approved` \| `retired`), `reviewedBy`, `reviewedAt`.

| Type | Key fields | Stage 1 release set (C1) | Product requirement (C2, before Stage 2) |
|---|---|---|---|
| Palette `PAL-xxx` | `undertoneAffinity[]` (warm/cool/neutral/olive/any), optional `skinToneRange`, `neutrals[]`, `accents[]`, `combinations[]` with `contrastLevel`, `prints[]`, `occasions[]` | 12–20 | At least 100 (planning range 100–150) |
| Styling/fit rule `STY-xxx` | `type` (silhouette, fit, neckline, sleeve, length, layering, proportion, print-scale, combination), `appliesTo` (categories, occasions, styles, optional proportion descriptors), `effect` (`prefer[]` / `deprioritise[]`, soft `weight` 0–1), `conflictsWith[]` | Rules covering every FR-STY-09 area | Comprehensive library covering every FR-STY-09 area for all categories and occasions |
| Fabric rule `FAB-xxx` | `properties` (breathability, moisture management, quick-dry, warmth, weight, stretch, wrinkle resistance, care), `useCases`, `weatherBands` (Stage 2), `effect`, `practicalityValidated` | Basic rules, no weather | Comprehensive, including weather bands |
| Outfit template `OUT-xxx` | `slots[]` (each with a stable `slotId` unique within the template, a `slot` category/type, category options and attribute constraints), `occasions[]`, `styles[]`, `department`, compatible palettes, rule references | About 20 | At least 100 (planning range 100–150), plus dynamic combinations |

**Linter checks:** contradictory prefer/deprioritise effects on the same attribute and context; duplicate records; duplicate `slotId`s within a template (D-82); references to unknown records or categories; missing rationale or limitations; records that aren't `approved` in the runtime set.

**Coordination rules** (a `STY` rule type) cover how slots work together: colour compatibility from palette combinations and contrast, formality consistency, print and pattern mixing, proportion balance, and footwear and accessory pairing (FR-STY-09).

**Scale.** The loader builds in-memory indexes by occasion, style, department and category once at startup, so generation cost depends on the matching subset, not the library size. The design supports at least 150 palettes and 150 templates without code changes (FR-STY-10); a scale test proves it (T-38). A CI coverage report (FR-STY-11) shows where the library is thin.

The C0 development seed (≥ 6 palettes, ≥ 6 templates) is a temporary input for building the engine, not a release target ([ImplementationPlan.md](ImplementationPlan.md) §5.2). Counts are not claims that any combination suits everyone.

---

## 5. Optional AI Wording Step (Stage 1, D-67)

| Item | Rule |
|---|---|
| Default | **Off.** Enabled only if the evaluation set shows clearer explanations without loss of accuracy |
| Input | Only the structured explanation references: rule IDs, rule rationale text and matched attribute values. **No** identity, profile free text, appearance signals, sizes, measurements or photos |
| Output | Reworded explanation plus the list of reference IDs it used, validated with Zod |
| Validation | Rejected if it mentions any attribute or rule not in its input, contains judgemental language, or fails the schema |
| Failure handling | Disabled, timeout, rate limit, quota exhausted or invalid output → template explanation, `aiModel: null`, warning `AI_ENHANCEMENT_SKIPPED`, and the cause is logged without personal data. Never an error response |
| Caching | `aiCache`, keyed by a hash of the references (D-13). No personal data is cached |
| Prompts | Versioned in the repository with IDs (D-67) |

---

## 6. Confidence and Confirmation

Appearance attributes keep the user's value apart from any model estimate ([DATABASE.md](DATABASE.md) §5). In Stage 1 every value is self-reported and has **no** confidence. When photo analysis is built (D-76):
- estimates carry the model's confidence, shown next to the estimate;
- an estimate below the calibrated threshold (D-15) is shown as "not sure", never forced into a class;
- confirming copies the estimate into the value and never changes the confidence, which is never 1;
- corrections are stored as `user_corrected`, with the original estimate kept;
- unconfirmed estimates are never used;
- withdrawing consent clears photo-derived estimates and values (D-11).

---

## 7. Deferred AI Features (D-76)

| Feature | AI design | Conditions before starting |
|---|---|---|
| Photo-based appearance analysis | MediaPipe face and pose landmarks, processed in the browser where possible or on StyleMe's own servers. Skin-tone and undertone estimates use derived colour values; body-shape class from landmark ratios. All carry confidence; uncertain undertone is `not_sure`/Unknown | Explicit, withdrawable consent; quality validation; deletion after analysis; AI rule 16; privacy review |
| Fashion chatbot | Gemini (Groq fallback) with minimised context; product facts only from stored verified data | No photos, measurements or appearance signals in prompts; AI failure → clear error |
| Sketch-to-design | AI vision interprets a sketch into a Zod-validated garment specification; the user confirms before generation | A sketch is not a personal photo; provider for design generation still to be chosen (D-32) |
| Retailer text in prompts | Product titles, descriptions and review excerpts are untrusted data, passed as delimited data and never as instructions | Applies to any feature that sends retailer text to AI |

---

## 8. Virtual Try-On (Future, D-48)

The earlier design, which sent the user's photo and a garment image to hosted providers (Leffa / Hugging Face / Qwen), is **not approved** and must not be implemented as written. Try-on can only proceed after:
- a founder decision, a privacy review and user consent authorise the specific processing (rule 16);
- confirmed rights to use the garment image, and retailer permission for AI processing and transformation of their images;
- storage and deletion controls for photos and generated images;
- an assessment of accuracy, cost and latency.

Self-hosted processing is a possible option to evaluate then. It is not approved.

**Fallback** (D-59): the authorised product image, a generic styling moodboard or a text description, with the reason. Never an implied success.

---

## 9. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-12, D-13, D-19, D-32, D-48, D-52, D-57, D-59, D-62, D-67, D-76.
