# StyleMe — UI Design

> The user interface **as it exists in `apps/web` today**: design tokens, typography, layout, components, every page, navigation, states, responsive behaviour and accessibility, with source paths. It documents the current UI, not a redesign. Where a section of the product is not built, this document says so and shows what the user actually sees (a "Coming soon" page).
>
> **Verified 2026-10-18** against the source on `main` at `5b65b5c` (no web changes on `feature/styling-foundation`). The public pages were also loaded on a local dev server (all returned `200`; signed-in pages redirected to `/login` without a session). Signed-in pages were not inspected visually: on the current branch the API does not start (draft styling records fail the startup linter, [TODO.md](TODO.md) TD-DOC-04), and no test account was created. Screenshots are not part of this document.
>
> Related: requirements FR-UI-01 … 04 and FR-ONB in [FRD.md](FRD.md); usability NFRs in [SRS.md](SRS.md) §4.7; technical conventions in [SPECS.md](SPECS.md) §3.3.

**Labels used here:** **Live** (working page) · **Placeholder** ("Coming soon" description page only) · **Not built** (no UI at all) · **Unused** (component exists but no page uses it).

---

## 1. Design principles visible in the code

1. **Fashion-brand look, not a dashboard.** Deep aubergine and champagne gold on warm ivory; a serif display face for headings; licensed fashion photography on public and auth pages (`globals.css`, `lib/brand/images.ts`).
2. **Honesty in the UI.** Features that aren't built are labelled "Coming soon" everywhere they appear (nav, Home, landing) and open a description page — never a mock-up (`app/(app)/features/[slug]/page.tsx`, FR-UI-03, D-94). Photos are mood imagery, never products (FR-UI-04, D-65).
3. **Optional data, explained.** Every profile section says why it is asked and how it is used ("why" text in `ProfileForm.tsx`); appearance signals can be switched off and cleared.
4. **Indian, fusion and western** shown side by side (landing hero and "Fashion categories" section).
5. **Accessible by default.** Skip link, visible focus rings, labelled controls, 44 px targets, reduced motion (§8).

## 2. Design tokens

Source: `apps/web/app/globals.css` (CSS custom properties exposed to Tailwind 4 through `@theme inline`). There is one light theme; **no dark mode**. The file's comment references a "FRONTEND.md" that does not exist — this document is that reference ([TODO.md](TODO.md) TD-DOC-07).

### 2.1 Colour

| Token (Tailwind) | Value | Role |
|---|---|---|
| `background` | `#fbf8f3` | Page background (ivory) |
| `surface` | `#ffffff` | Cards, inputs, menus |
| `surface-muted` | `#f4eee6` | Alternate sections, hover (sand) |
| `foreground` | `#1f1a1d` | Body text (charcoal) |
| `muted-foreground` | `#5f5559` | Secondary text |
| `primary` | `#4a1f45` | Brand, primary buttons, top nav, footer (aubergine) |
| `primary-hover` | `#3a1736` | Primary hover; category cards on dark |
| `primary-foreground` | `#fdfaf5` | Text on primary |
| `plum` | `#7a3b6f` | Eyebrows, links, active icons, focus ring |
| `accent` | `#c8a45c` | Champagne gold: active nav, "Me" in the logo, accent buttons, progress |
| `accent-soft` | `#f3e8d2` | Badges, active menu rows, completeness card |
| `accent-foreground` | `#3a2a0c` | Text on accent |
| `destructive` / `-foreground` | `#b42318` / `#ffffff` | Delete actions, errors |
| `success` / `success-soft` | `#1f7a4d` / `#e7f4ec` | Success alerts |
| `warning-soft` | `#fdf3e1` | Info alerts |
| `error-soft` | `#fdecea` | Error alerts |
| `border` / `input` | `#e6ddd2` / `#d8ccbf` | Dividers / input borders |
| `ring` | `#7a3b6f` | Focus outline (gold on dark surfaces, `.on-dark`) |

The CSS states that every text/background pair used for body copy meets WCAG AA (4.5:1). `viewport.themeColor` is `#4a1f45` (`app/layout.tsx`).

Colour data shown to users comes from the shared vocabulary, not from the theme: 63 colour swatches (`COLORS` in `packages/contracts/src/style-vocabulary.ts`, "hex values approximate the named colour and are not product colours") and the 10 Monk Skin Tone swatches (`MONK_TONES`).

### 2.2 Typography

| Use | Font | Source |
|---|---|---|
| Body, UI (`font-sans`) | Inter (variable 100–900) | `app/fonts/inter-latin-wght-normal.woff2`, `next/font/local`, `--font-inter` |
| Headings, logo (`font-display`) | Playfair Display (400–900, normal + italic) | `app/fonts/playfair-display-*.woff2`, `--font-playfair` |

Fonts are bundled (SIL OFL licences in `app/fonts/`), so pages never contact Google Fonts. `h1`–`h3` use `text-wrap: balance`.

| Pattern | Classes (as used) | Example |
|---|---|---|
| Eyebrow | `text-xs font-medium uppercase tracking-[0.3em] text-plum` | "Personalized home", "Discover My Style" |
| Page title | `font-display text-4xl text-primary` | "Hello, {first name}", "Settings" |
| Landing hero | `font-display text-5xl sm:text-6xl leading-[1.05]` with italic gold "You" | Landing |
| Section title | `font-display text-2xl text-primary` (app), `text-4xl` (landing) | "Your style profile" |
| Body | `text-sm` / default; secondary `text-muted-foreground` | — |
| Micro label | `text-[10px]`/`[9px] uppercase tracking-wider` | "Soon" pill in the nav |

### 2.3 Shape, spacing and elevation

* Radius base `--radius: 0.75rem` → `rounded-sm` (6 px), `-md` (10 px), `-lg` (12 px), `-xl` (18 px). Buttons and pills are `rounded-full`; cards `rounded-xl`; landing images `rounded-[2rem]`.
* Spacing: Tailwind default scale. App content column `max-w-6xl` with `px-4 sm:px-6 lg:px-8` and `py-6 sm:py-8 lg:py-10` (`AppShell.tsx`); public sections `py-16`–`py-24`; stacks use `space-y-*`.
* Elevation: `shadow-sm` on cards and buttons, `shadow-xl` on menus and landing images, `shadow-2xl` on the mobile drawer.

### 2.4 Motion

`menu-in` (0.14 s fade/slide), `drawer-in` (0.22 s slide from the right), `overlay-in` (0.22 s fade), image `scale-105` on hover in landing category cards, chevron rotation. All animations and transitions are reduced to 0.01 ms under `prefers-reduced-motion: reduce`.

## 3. Layouts

| Layout | Source | Used by | Structure |
|---|---|---|---|
| Root | `app/layout.tsx` | All | `lang="en-IN"`, fonts, "Skip to content" link to `#main`, title template `%s · StyleMe` |
| Public site | `app/(site)/layout.tsx` | Landing, About, Contact, Privacy, Terms | `SiteHeader` (switches to "My StyleMe" when a session cookie exists — cookie check only), `<main>`, `SiteFooter` |
| Auth split screen | `components/site/AuthSplitLayout.tsx` | Sign up, log in, verify email, forgot/reset password, email-change confirm | ≥ 1024 px: photo (gold lehenga) with aubergine gradient, logo, tagline "Discover the Style That Is You." and photo credit on the left, form (max 28 rem) on the right. Below 1024 px: the photo as a 13–16 rem banner with logo and tagline above the form |
| Onboarding frame | `components/app/OnboardingFrame.tsx` | `/onboarding/*` | Plain header (logo, "Log out"), 4-step progress bar (Account → Style profile → Appearance → Your home), title and intro, `max-w-3xl` |
| Signed-in app | `app/(app)/layout.tsx` → `components/app/AppShell.tsx` | Home, profile, settings, feature placeholders | `requireOnboarded()` guard; sticky `TopNav`; centred `max-w-6xl` content column |
| Prose page | `components/site/ProsePage.tsx` | About, Privacy, Terms, Contact | Eyebrow, title, optional "Version …", optional draft notice ("This is a draft pending legal review…", D-74), `max-w-3xl` article |

## 4. Navigation

### 4.1 Public header — `components/site/SiteHeader.tsx`

Sticky, translucent ivory with blur. Logo; links **Home, How It Works, Features, About** (≥ 768 px); **Log In** (ghost) and **Sign Up** (primary), or **My StyleMe** when signed in. Below 768 px a hamburger toggles a stacked menu (Escape closes it).

### 4.2 Signed-in top navigation — `components/app/TopNav.tsx`

Replaced the earlier sidebar (PR #26). Sticky aubergine bar, 64 px high, gold hairline below, safe-area insets respected.

| Element | Behaviour |
|---|---|
| Logo | Links to `/home` |
| Items (priority order) | Home · Discover My Style · My Colour Palette · Outfit Categories · Shop My Look · Virtual Try-On · Design Studio · Style Assistant · Saved Outfits (`NAV_ITEMS` from `lib/features.ts`) |
| "Soon" pill | Gold outlined pill plus screen-reader text "(coming soon)" on every item without an `href` — today all except Home and Discover My Style |
| Active item | Gold text and a 2 px gold underline; `aria-current="page"` |
| Overflow (≥ 640 px) | Item widths are measured off-screen; items that don't fit move into a **More** menu (w-72) that opens towards the side with room. Before measuring (server render) only the first two items show |
| Account menu | Avatar circle with initials (gold); name shown from 1280 px. Menu: name and email, **Complete your profile** (only when incomplete), **Settings**, **Log out**. A small dot on the avatar marks an incomplete profile |
| Mobile (< 640 px) | Hamburger opens a right-hand drawer (w-80, max 85 vw) with every item, "Signed in as …", Complete your profile, Settings, Log out. Focus moves into the drawer, Tab is trapped, Escape and the overlay close it, focus returns to the trigger, body scroll is locked; the drawer closes automatically if the window widens past 640 px |
| Dismissal | Escape (focus back to trigger) or a click outside closes More and the account menu; any route change closes all menus |

**Not built:** there is **no notification bell** and no notifications feature in the code. The profile entry is the initials avatar described above; it has no separate "Profile" page — profile data is edited at `/profile` and account data at `/settings`.

### 4.3 Footer — `components/site/SiteFooter.tsx`

Aubergine, four columns from 768 px: logo and tagline; **Explore** (How It Works, Features, FAQ, About); **Company** (Terms of Service, Privacy Policy, Contact); copyright line with the Unsplash credit note.

## 5. Component inventory

### 5.1 UI kit — `apps/web/components/ui/`

| Component | File | Variants / behaviour | Used in |
|---|---|---|---|
| Button | `button.tsx` (cva, Radix `Slot` for `asChild`) | variants `default` (aubergine), `accent` (gold), `destructive`, `outline`, `ghost`, `link`; sizes `default` (h-11), `sm` (h-9), `lg` (h-12), `icon` (40 px), `full` | Everywhere |
| Badge | `badge.tsx` | Gold-outlined pill on `accent-soft` | "Coming soon" labels |
| Card | `card.tsx` | `rounded-xl border bg-surface p-6 shadow-sm` | Home, profile, placeholders |
| Alert | `alert.tsx` | tones `error` (`role="alert"`), `success`, `info` (`role="status"`), with lucide icon | Form results, welcome messages |
| Input | `input.tsx` | h-11, plum focus border, `aria-invalid` styling | Forms |
| Field | `field.tsx` | Label + control + hint/error with `-hint` / `-error` IDs; "(optional)" marker | Forms |
| Label | `label.tsx` | Radix Label | Forms |
| Checkbox | `checkbox.tsx` | Native checkbox with label | Register, settings |
| PasswordInput | `password-input.tsx` | Show/hide toggle | Auth, settings |
| PasswordChecklist | `password-checklist.tsx` | Live checklist (8+ chars, upper, lower, number, special), no strength label (D-87) | Register, reset, settings |
| OtpInput | `otp-input.tsx` | Six boxes in a labelled group; "Digit n of 6" labels; paste, Backspace and arrow support; no auto-submit (D-89) | Verification, reset, settings |
| CityCombobox | `city-combobox.tsx` | ARIA combobox over the Indian city list (`packages/contracts/src/cities.ts`), keyboard navigable | Register, onboarding (Google), settings |
| Dialog | `dialog.tsx` | Native `<dialog>`: browser focus trap, Escape closes; `tone="danger"` | Account deletion confirmation |
| Spinner | `spinner.tsx` | `Loader2` spinning icon | Pending buttons |
| Divider | `divider.tsx` | Horizontal rule with a centred label | Auth forms |

### 5.2 Feature components

| Area | Components |
|---|---|
| Site | `Logo` ("Style" + italic gold "Me"; `light` variant), `SiteHeader`, `SiteFooter`, `AuthSplitLayout`, `ProsePage` |
| Auth | `RegisterForm`, `LoginForm`, `VerifyEmailPanel`, `CodeForm`, `RecoveryForms`, `LinkHandler`, `shared.tsx` (`FormMessage`, `SubmitButton`, `GoogleButton` — disabled with "Google login is not available yet." when not configured) |
| App | `AppShell`, `TopNav`, `ProfileCompletenessCard` (full and `compact`), `OnboardingFrame`, `OnboardingForms` (`SkipStyleProfile`, `FinishAppearanceButtons`), `SettingsForms` (`DetailsForm`, `EmailChangeForm`, `PasswordChangeForm`, `PhoneForm`, `DeleteAccountForm`) |
| Profile | `ProfileForm`, `AppearanceForm` |
| Empty placeholder folders | `components/{analysis,avatar,chat,design,outfits,products,tryon}/` (only `.gitkeep`) |

## 6. Page inventory

### 6.1 Public pages — Live

| Route | Source | Content |
|---|---|---|
| `/` | `app/(site)/page.tsx` | **Hero** ("Discover the Style That Is *You*.", Get Started → `/register`, How it works; two portrait images, Indian and western, with an "Indian · Fusion · Western" chip) · **How it works** (4 numbered steps) · **Personalized styling** (image + 4 profile benefits; "Available today: style profile and optional appearance signals.") · **Fashion categories** (Indian / Fusion / Western image cards on aubergine) · **Budget-based shopping** ("Shop My Look — coming soon" badge) · **Upcoming features** (6 cards, each "Coming soon") · **FAQ** (6 `<details>` items) · closing CTA. Shows a success alert after account deletion (`?deleted=1`) |
| `/about` | `app/(site)/about/page.tsx` | Prose page; image credits |
| `/privacy`, `/terms` | `app/(site)/{privacy,terms}/page.tsx` | Prose pages with the draft-pending-legal-review notice |
| `/contact` | `app/(site)/contact/page.tsx` | Closed-beta contact text; says a public support address will be published before public launch |

**Copy inconsistency (verified):** the hero says "Closed beta · registration by invitation", while the FAQ says "Can anyone sign up? Yes." The code's default allows public sign-up. The policy is an open founder decision ([PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #1, [TODO.md](TODO.md) TD-DOC-03).

### 6.2 Authentication pages — Live (split-screen layout)

| Route | Title on page | Notes |
|---|---|---|
| `/register` | Create your account | Full name, email, password + confirmation with checklist, city (combobox; hint "Used for weather- and region-aware styling." — weather is Stage 2, TD-DOC-08), mobile (optional), terms (required), marketing (optional, off), Remember me; Google button; non-secret fields kept as a 24-hour local draft |
| `/verify-email` | Verify your email | Six-box code, resend with cooldown, correct the email; redirects to `/verify-email/required` without a pending registration |
| `/verify-email/required`, `/link`, `/success` | Verify your email to continue · Verifying your email · Email verified successfully | Legacy accounts, link handling, confirmation |
| `/login` | Welcome back | Email, password, Remember me, Google; lockout and expiry messages (`?expired=1`) |
| `/forgot-password`, `/forgot-password/code`, `/reset-password` | Reset your password · Enter your reset code · Choose a new password | Link or code; "Email not registered" with a Sign up link (D-89) |
| `/settings/email/confirm` | Confirming your new email | Public link target |

Token pages send no Referer and are not cached (`next.config.ts`).

### 6.3 Onboarding — Live

| Route | Title | Behaviour |
|---|---|---|
| `/onboarding` | — | Redirects to the next incomplete step (server-authoritative, FR-ONB-01/02) |
| `/onboarding/password` | Create your StyleMe password | Google sign-ups only |
| `/onboarding/style-profile` | Tell us about your style | `ProfileForm` (department required; city asked here for Google sign-ups) **or Skip for now** ("…You can finish your profile anytime from Home or your profile menu.") → `/home?skipped=1` |
| `/onboarding/appearance` | Appearance signals (optional) | `AppearanceForm` + finish/skip → `/home?welcome=1` |

### 6.4 Signed-in pages

| Route | Status | Source | Content |
|---|---|---|---|
| `/home` | **Live** | `app/(app)/home/page.tsx` | Welcome alert (`?welcome` / `?skipped`); eyebrow "Personalized home", "Hello, {first name}"; **Complete your profile** card (only if incomplete: "n of 7 done", progress bar, links to each missing item); **Your style profile** card (department — or "Not set" with "Showing all departments — no department filter applied" — city, budget per look in ₹ `en-IN` format, number of occasions, liked-colour chips with swatches, Edit); **Discover My Style** aubergine card → `/profile`; **Coming soon** grid of the seven unbuilt sections |
| `/profile` | **Live** | `app/(app)/profile/page.tsx` | Page title "Your style profile" under the eyebrow "Discover My Style"; in-page pills (Style profile, Appearance signals); compact completeness card; `ProfileForm` sections: Department (required) · Sizes (tops letter + collar, bottoms waist + length, kurtas letter/numeric, lehengas letter/waist, shoes UK/India) · Fit (tops, bottoms, kurtas, lehengas) · Colours (Like / Avoid / — per colour, with swatches) · Contrast · Silhouettes · Coverage (shortest sleeve, neckline at least, shortest length) · Comfort · Fabrics (Like / Avoid) · Styles · Occasions · Budget per look (₹, optional); each section explains why it is asked. `AppearanceForm` card: Monk scale strip (1–10) with From/To tone selects (span ≤ 3 tones), undertone radios, proportion descriptors, "use in recommendations" checkbox, Save and Clear |
| `/settings` | **Live** | `app/(app)/settings/page.tsx` | Sections with anchors: Your details (`#details`), Email address, Password (emailed code), Phone number (add, verify by SMS code, remove; without an SMS provider the API answers `PROVIDER_NOT_CONFIGURED` and the form shows the error), Delete account (`#delete`, red heading: emailed code + confirmation checkbox + danger dialog "Delete your account permanently?") |
| `/features/[slug]` | **Placeholder** | `app/(app)/features/[slug]/page.tsx` | For `colour-palette`, `outfit-categories`, `shop-my-look`, `virtual-try-on`, `design-studio`, `style-assistant`, `saved-outfits`: "Coming soon" badge, title, hourglass card with the feature summary and "This feature is not available yet…", buttons **Update my style profile** and **Back to home**. Unknown slugs → 404; a slug that has an `href` redirects to it |
| `/dashboard` | Redirect | `app/(app)/dashboard/page.tsx` | → `/home` (old address) |

### 6.5 The eight product sections in the UI today

| Section | What the user sees | Real feature status |
|---|---|---|
| Discover My Style | `/profile` (style-profile editor) | Profile editing live; **look recommendations not built** (#45, #47). Specified 2026-10-18 as its own page (§13.2); the profile editor moves to My Profile |
| My Colour Palette | Placeholder | Not built (#39, #40); specified (§13.3) |
| Outfit Categories | Placeholder | Not built; specified 2026-10-18 (§13.4) |
| Shop My Look | Placeholder | Not built (#37, #38, #43); specified (§13.5); real products blocked |
| Virtual Try-On | Placeholder | 2D illustrative version specified and approved (D-119, §13.6); photo-based try-on deferred (D-48) |
| Design Studio | Placeholder | Deferred (D-76) |
| Style Assistant | Placeholder | Deferred (D-76) |
| Saved Outfits | Placeholder | Not built (#41); specified (§13.7) |

Planned pages have no route yet; the empty `apps/web/app/{outfits,products,analyze,avatar,chat,design,tailor,tryon}/` folders hold only `.gitkeep`.

## 7. States and feedback

| State | Pattern in the code |
|---|---|
| Loading (forms) | Submit buttons disabled with pending labels ("Saving…", "Skipping…") via `useActionState` / `SubmitButton` |
| Loading (pages) | Server-rendered; no skeletons and no `loading.tsx`, `error.tsx` or `not-found.tsx` files exist today (Next.js defaults apply) |
| Success | `Alert tone="success"` (profile saved, welcome, account deleted) |
| Error | `Alert tone="error"` (`role="alert"`); field errors under inputs via `Field` (`aria-invalid`); API errors mapped to plain messages |
| Info | `Alert tone="info"` (skipped onboarding, draft legal notice) |
| Empty | Home: "None yet — add some" for colours, "None chosen yet" for occasions, "Not set" fields; completeness card lists what's missing |
| Not available | "Coming soon" badges and placeholder pages; disabled Google button with its reason; SMS-provider error on phone verification |
| Destructive | Confirmation checkbox + danger `Dialog` with Cancel autofocused |
| Auth redirects | No session → `/login`; expired session → `/login?expired=1`; unfinished onboarding → next step |
| Profile fetch failure in the shell | Navigation simply shows no "incomplete" hint instead of failing the page (`(app)/layout.tsx`) |

Look, palette, saved-outfit and shortlist states (`INSUFFICIENT_MATCHES`, `ALTERNATIVES_LIMITED`, "not verified by StyleMe" labels, empty collections) are specified in [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §6–§10 but **have no UI yet**. The labels to use are fixed in `USER_ENTERED_LABELS` (`packages/contracts/src/product.ts`).

## 8. Responsive behaviour and accessibility

| Breakpoint | Change |
|---|---|
| < 640 px (`sm`) | Top nav collapses to the drawer; single-column grids |
| ≥ 640 px | Inline nav with measured overflow into "More"; 2-column grids (Home "Coming soon", profile like/avoid lists) |
| ≥ 768 px (`md`) | Public header links inline; landing hero and sections become 2–3 columns; footer 4 columns |
| ≥ 1024 px (`lg`) | Auth split screen; Home 3-column grid (profile card spans 2) |
| ≥ 1280 px (`xl`) | User name next to the avatar |

Targets from the team's acceptance criteria: usable from **320 px** to desktop, checked at 320, 390, 768 and 1366 px ([TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md) §4.2). Earlier manual checks at 375 px and 1280–1440 px found no horizontal overflow ([TESTING.md](TESTING.md) §5); this is not automated (Playwright, #36).

**Accessibility features in the code:** skip link; `:focus-visible` 2 px plum outline (gold on dark); `aria-current` on active links and steps; `aria-expanded` / `aria-controls` on menus; screen-reader text for "(coming soon)"; labelled OTP digits and combobox; decorative icons `aria-hidden`; `min-h-11` (44 px) touch targets in menus; `role="progressbar"` with values on the completeness bar; alerts with `role="alert"` / `role="status"`; `lang="en-IN"`; reduced-motion support; image `alt` text describes each outfit.

**Known gaps:** colour like/avoid uses one native `<select>` per colour (39 rows) — functional and accessible, but long; swatches carry no text beyond the colour name; no dark theme.

## 9. Imagery and assets

Seven Unsplash-licensed photographs in `apps/web/public/images/` (credits in `CREDITS.md` and `lib/brand/images.ts`, each with a crop focus): auth (gold lehenga), hero Indian (red lehenga), hero western (cream suit), styling (red bandhgala), category Indian (bridal lehenga), category fusion (ikat co-ord), category western (checked blazer). They are mood imagery for StyleMe's own pages and never shown as products. No icons beyond `lucide-react`; no illustrations; no logo image file (the logo is typographic).

## 10. User flows (implemented)

```
Landing → Sign up → Verify email (6-digit code) → Style profile ──► Appearance (optional) → Home (?welcome)
                                                   └─ Skip for now ─────────────────────► Home (?skipped)
Login → next incomplete onboarding step, or Home
Home → Complete your profile → /profile#style-profile (or /settings#details for city)
Nav → any "Soon" item → /features/<slug> → Update my style profile / Back to home
Account menu → Settings → Delete account → code + checkbox + dialog → / (?deleted)
```

Flows for looks, palettes, saving and shopping are specified in [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) and not built.

## 11. Guidance for new UI work

* Reuse the tokens and `components/ui` kit; don't add colours outside `globals.css`.
* Follow `components/profile/AppearanceForm.tsx` for forms and `app/actions/appearance.ts` for server actions.
* Turn a section on by giving its `lib/features.ts` entry an `href` only when the page works; the nav, Home grid and placeholder update automatically.
* Use `departmentScope()` to show "no department filter applied", `USER_ENTERED_LABELS` for user-entered prices, and honest empty states — never placeholder products, prices or images.
* Keep every new page usable at 320 px and keyboard operable.

---

## 12. Approved target design — not built (D-102 … D-106, approved 2026-10-18)

Everything in this section comes from the My Profile and Home requirements of 2026-10-18 ([FRD.md](FRD.md) FR-MYP, FR-HOME), approved by the founder on 2026-10-18. **None of it exists in the code**; §1–§11 above remain the description of the real UI until the work is done ([TODO.md](TODO.md) §6a).

### 12.1 Header and navigation (FR-HOME-02, -03, -06)

```
Desktop                                                                    Mobile
┌──────────────────────────────────────────────────────────────────┐      ┌───────────────────────────────┐
│ StyleMe          [ Search outfits, palettes, saved… ]   🔔3  (SS) │      │ ☰  StyleMe        🔍  (SS)    │
├──────────────────────────────────────────────────────────────────┤      └───────────────────────────────┘
│ ⌂ Home  ✦ Discover My Style  ◐ My Colour Palette  ▣ Outfit Categories   ☰ opens every section
│ 🛍 Shop My Look  ◎ Virtual Try-On  ✎ Design Studio  💬 Style Assistant  ♡ Saved Outfits
└──────────────────────────────────────────────────────────────────┘
Account menu (SS): My Profile · Settings · Privacy & consent · Sign out
```

Replaces today's single-row bar with "More" (§4.2). Unavailable sections keep their "Coming soon" label and open a message with an alternative.

### 12.2 Home (FR-HOME-07 … 18)

```
┌ Hero: "Hello, Shreya" · short fashion welcome · personalised look · optional "complete your profile" ┐
├ Outfit carousel  ◀ [look][look][look][look] ▶   → quick-view panel → full details                     ┤
├ Eight feature cards (editorial grid, varied sizes): image · icon · name · description · status · preview ┤
├ Recent activity & continue links │ Quick actions │ Profile completion chart (e.g. 70 %) + missing sections┤
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Style summary: preferred styles and occasions only. Skeletons per section; a failed section shows Retry. Light, dark and system themes (dark tokens to be added to `globals.css`, AA contrast in both). Editorial photography across Indian, fusion and Western looks, body types, skin tones and ages; default models and body-shape illustrations always in a plain white shirt and plain white pants.

### 12.3 My Profile (FR-MYP-01 … 19)

```
My Profile                                   [ Completion 70 % ◔ ]  [ Save all changes ]
┌ Basic information          Last updated 12 Oct   [Edit] [Save] ┐  name · age group (optional) · city (optional) · Men's / Women's cards
├ Skin tone & undertone      Optional — improves personalization ┤  Upload face photo  │ or choose cards · "Not sure"
├ Body shape                 Optional                            ┤  Upload full-body photos (front/side/back) │ cards · "Not sure" · confidence
├ Body measurements          Required for fit-based looks        ┤  cm ⇄ in · essential 5 · ▸ detailed measurements
├ Style & fit                                                     ┤  Slim/Regular/Relaxed/Oversized per category · style cards · colours · occasions (+ custom) · budgets
└ Privacy: consent per photo kind · retention · delete photos / results / measurements · reset preferences · export JSON/PDF ┘
```

Each section saves on its own; leaving with unsaved edits asks first. Labels distinguish **Required for this feature** from **Optional — improves personalization**. Every visual card and swatch has a text label and keyboard selection. Camera and gallery permissions are requested only on upload or capture; photos can be previewed, cropped, retaken or replaced.

Data: [DATABASE.md](DATABASE.md) §3.2, §3.7 – §3.9. Endpoints: [API.md](API.md) §3.9a.

---

## 13. Feature designs — specified 2026-10-18, not built (D-109 … D-128)

From the founder's feature specifications ([FRD.md](FRD.md) §4.17 – §4.24). **None of it exists in the code yet**; §1 – §11 still describe the real UI. Built with the existing tokens and `components/ui` kit; new shared components are listed in §13.9.

### 13.1 Shared visual direction

- **Editorial fashion brand, magazine-inspired:** Playfair display headings, Inter body, generous spacing, ivory and white surfaces, aubergine and champagne accents, no dashboard look.
- **Croquis illustrations (D-113)** are the primary visual language: elongated figures, ink strokes, light watercolour, on ivory cards with a thin border; technical flats beside them where they explain construction. Every figure is clothed — a plain white shirt and plain white pants by default. Licensed photography only as supplementary context.
- **Cards:** large featured cards plus smaller grid cards; image or swatch strip on top, serif name, one short line of explanation, small tag chips, primary actions as icon buttons with text labels (Save, View details).
- **Motion:** 150 – 250 ms fades and lifts on cards, panels sliding in from the side; all disabled under `prefers-reduced-motion`.
- **States:** card-shaped skeletons; per-section error with Retry; empty states with a small croquis and one clear action; "Not available yet" chips for unsupported actions — never mock content.
- **Top navigation** stays visible on every feature page; detail views open as pages or side panels within the feature (D-127).
- **Responsive:** desktop multi-column grids with a filter sidebar; tablet two columns; mobile one or two columns, filters in a bottom drawer, 44 px targets.

### 13.2 Discover My Style (FR-DMS)

```
Discover My Style
┌ My Style Overview ─────────────────────────────────────────────────────────────┐
│ "Your style, Shreya"  · body shape: Rectangle (from your profile) · fit: Regular │
│ Missing: measurements — Add in My Profile (optional, improves fit advice)        │
└──────────────────────────────────────────────────────────────────────────────────┘
Recommended for you   [croquis][croquis][croquis][croquis]   ← 3–5 cards, "Suggested for you"
▸ Necklines  ▸ Sleeves  ▸ Tops & lengths  ▸ Trousers & bottoms  ▸ Dresses & silhouettes
▸ Jackets & layers  ▸ Skirts & more  ▸ Complete outfits  ▸ Saved styles      (expandable)
Selected: V-neck · ¾ sleeves · hip length  [Choose colour] [Explore outfits] [Customize ▸ Not available yet]
```

Style detail: large croquis with angle thumbnails → description → "Why it may suit you" (benefits, trade-offs) → fit and length guidance → similar and contrasting styles → actions (Explore complete outfits, Shop this style, Try on, Customize in Design Studio, Save) shown only when supported. Colour step: palette swatches first, then a picker, then "Keep sketch colours"; a line-only sketch shows the chosen colour as a swatch beside it.

### 13.3 My Colour Palette (FR-PAL-04 … 30)

```
My Colour Palette
"Colour suits you best when it echoes your undertone." (one-line intro, link to learn more)
┌ Hello Shreya — warm undertone, deep-medium tone (from your profile)  ┌──────────────┐ ┐
│ These palettes are ranked for you.                                  │ Featured       │ │
└─────────────────────────────────────────────────────────────────── │ ■■■■■ Spice    │ ┘
Recommended for you  [■■■■■ large][■■■■ ][■■■■ ][■■■■ ]   · Load more
Explore all palettes  [Search]  Filters: family · warm/cool · occasion · style · suitability · saved · new   [Clear all]
My saved palettes  (collections)          Colour theory & learning
```

Palette detail panel: full-width swatch band; each swatch shows name, HEX and role with a Copy button; selecting swatches enables **Shop this colour / Shop selected colours**; garment combinations with colour placement; Indian, fusion and western example croquis; occasions; Save; Customize (editor: add, remove, replace, drag to reorder, rename, colour picker or HEX) → Save as my palette. "General, not personalised" badge when tone or undertone is missing.

### 13.4 Outfit Categories (FR-OCAT)

```
Outfit Categories                 [ Women | Men ]          [ Search: "tops that make my legs look longer" ]
Your overview: Pear (triangle) · goals: longer leg line, define the waist · Edit in My Profile
Recommended for you  [croquis card ×3–5: name · why · neckline/length chips · ♡ · Explore]
Categories  [Tops][Bottoms][Dresses][Indian ethnic][Fusion][Outerwear][Menswear trad.][Co-ords][Lounge]
Styles  ┌ Filters (sidebar / drawer) ┐  [grid of croquis cards]   Sort: Best match ▾   [Compare (2)]
        │ category · goal · fit · occasion · fabric & season · price* │
```

Style detail page: enlarged illustration with front/back and detail views (zoom), annotated guide lines where useful (never "good/bad" labels), attributes table, "Why it may suit your goals", trade-offs and tips, fit, comfort and coverage, related suitable styles, actions. Compare view: two to four columns with the same rows. When nothing qualifies: "No style meets all your requirements — relaxing *coverage: full sleeve* would show 4 more" plus the closest suitable styles.

### 13.5 Shop My Look (FR-SHOP)

```
Shop My Look       ( ) Shop a complete look   (•) Shop one garment
Inherited: [burgundy ×] [office ×] [V-neck ×]                       Sort: Best match ▾
┌ Filters ┐  [product card: image · name · brand · ₹ verified price · sizes · "Price as of …" · retailer ↗]
│ category │
│ occasion │  Your outfit (this session)   Top ✓  Bottom ✓  Shoes —     Total ₹3,450 (partial estimate)
│ budget   │  Budget ₹3,000 — ₹450 over · [See lower-cost options]  · shipping and taxes not included
│ size …   │  [Save look]  [Try on (eligible items)]  [Clear selection]
```

Without an authorised source the grid area says "Live shopping results aren't available yet" with styling alternatives and the user's own shortlist — no placeholder products.

### 13.6 Virtual Try-On, 2D (FR-VTO)

```
┌ Garments ──────────────┐ ┌ Preview ───────────────────────────┐ ┌ Your look ─────────────┐
│ Tops Bottoms Dresses   │ │  (model in white shirt & pants)     │ │ Top: V-neck kurta  ✎ ✕ │
│ Outerwear Accessories  │ │                                     │ │ Bottom: straight trouser│
│ [card][card][card]     │ │  zoom ± · reset view · undo · reset │ │ Colour ■ burgundy       │
│ colour: palette ■■■ ⊕  │ │ "Illustrative 2D preview — not an   │ │ [Save look] [Suggest]   │
└────────────────────────┘ │  exact representation of fit"       │ └────────────────────────┘
Model: [variant ▾] [skin shade ▾]
```

Mobile: preview on top, garment tabs in a bottom sheet, summary as a collapsible bar.

### 13.7 Saved Outfits (FR-SAVE)

```
Saved Outfits — Your personal collection of looks and designs.     [Search]  [Collection ▾]  [Sort ▾]
All saved (24) · Outfits (15) · My designs (0)                    Filters: type · occasion · category · style · colour
[card: best visual · name · type label · occasion · ♡ · ⋯]  [card] [card] [card]
Empty: croquis + "Nothing saved yet" + [Discover outfits]
```

Detail page: image with zoom, components, colours, occasion and style, "Why it was recommended", dates, notes; actions Rename, Notes, Duplicate, Save as new look, Customize, Shop similar, Try on, Find similar looks, Move to collection, Remove (with Undo). No Palettes tab: saved palettes appear only in My Colour Palette (D-117 = a).

### 13.8 Admin Panel (FR-ADM)

```
┌ StyleMe Admin ─┐ ┌ Dashboard ─────────────────────────────────────────────────────────────┐
│ Dashboard      │ │ Registrations · Active users · Styles · Palettes · Products · Try-on use │
│ Users          │ │ Needs attention: 6 drafts awaiting approval · 3 assets without rights   │
│ Catalogue      │ │ · 2 rules conflicting · empty results 4 % (Outfit Categories)            │
│ Colour palettes│ └────────────────────────────────────────────────────────────────────────┘
│ Shop products  │  Tables: search · filters · status chips (draft / published / archived) · bulk publish/archive
│ Try-on         │  Record editor: form + live preview + validation panel + Approve (Super Admin) + Publish
│ Activity       │
└────────────────┘
```

Neutral surfaces, restrained accent, dense but readable tables; distinct from the user-facing editorial pages. Desktop-first; on mobile the sidebar becomes a menu and only monitoring and account actions are offered.

### 13.9 New shared components (to build in `components/ui` or feature folders)

`IllustrationCard` (croquis with fallback placeholder and alt text) · `SwatchStrip` / `SwatchChip` (name, HEX, role, copy) · `ColourPicker` (palette-first, then picker or HEX) · `SaveToggle` (heart/bookmark, optimistic only after server confirmation) · `FilterPanel` (sidebar ↔ drawer, active chips, Clear all) · `InheritedFilters` (removable context chips) · `CompareTable` · `SkeletonCard` · `SectionError` (message + Retry) · `NotAvailableYet` (chip and explanation) · `ExplanationBlock` (benefits, trade-offs, "based on your profile / preferences / general") · `TryOnCanvas` (SVG layer stack) · `AdminTable` and `AdminRecordEditor`.
