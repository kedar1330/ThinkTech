# End-to-end tests (Playwright)

Real user journeys in a real browser, through the web app, its server actions, the API and MongoDB. Every spec runs
twice: **mobile** (375×812, touch) and **desktop** (1280×800). See `docs/TESTING.md` §7.

## Running

```sh
pnpm exec playwright install chromium   # once per machine (and after a Playwright upgrade)
pnpm e2e                                # builds contracts, API and web, then runs the suite
pnpm e2e:run                            # runs the suite against the existing builds (faster when only specs changed)
pnpm e2e:run auth --project=mobile      # one file, one viewport
pnpm e2e:run --repeat-each=3            # flakiness check before merging a new flow
pnpm e2e:ui                             # Playwright UI mode
pnpm exec playwright show-report        # the HTML report of the last run (playwright-report/)
```

Node 24 is required, as for the rest of the repo. `pnpm e2e:run` needs `pnpm build` to have run after your last change
to the apps; the global setup stops with a clear message when a build is missing.

### What the harness starts

`global-setup.ts` starts a hermetic stack, and `global-teardown.ts` stops it:

1. an in-memory MongoDB (`mongodb-memory-server`, the same binary and cache as the API tests);
2. the built API (`apps/api/dist/server.js`) on port **4100** with `APP_ENV=local`, no SMTP and `DEV_OUTBOX_DIR`
   pointing at `e2e/.outbox/`, so every email is written there as a JSON file;
3. `next start` for the built web app on port **3100**.

Its secrets are random per run; nothing reads your `.env` files. Override the ports with `E2E_WEB_PORT` and
`E2E_API_PORT`. Server output goes to `e2e/.logs/api.log` and `e2e/.logs/web.log`.

### Against another environment (`BASE_URL`)

```sh
BASE_URL=https://staging.example pnpm e2e:run
```

With `BASE_URL` set, no local servers are started. Flows that read an emailed code need that deployment's dev outbox
(`E2E_OUTBOX_DIR=<its DEV_OUTBOX_DIR>`); a deployment that sends real email (staging, production) has none, so those
flows fail with a message saying so. The T-47 cookie test checks `Secure` and the `__Host-` prefix only when `BASE_URL`
is `https://`; the local harness is plain HTTP, where the cookies are correctly non-Secure and unprefixed.

## Layout

| Path                   | What                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `playwright.config.ts` | Projects (viewports), retries (2 in CI), traces on first retry, screenshots on failure    |
| `global-setup.ts`      | MongoDB → API → `next start`; skipped when `BASE_URL` is set                              |
| `global-teardown.ts`   | Stops the servers and the database                                                        |
| `fixtures/auth.ts`     | `test`, `expect`, `newUser()`, `registerUser()`, `verifyEmail()`, `signUp()`, `login()` … |
| `fixtures/outbox.ts`   | `readOtp(email)`, `readLink(email)`, `readEmail(email)` from the dev outbox; `SUBJECT`    |
| `support/settings.ts`  | Ports, URLs and directories (all overridable by environment variables)                    |
| `support/servers.ts`   | Starts, waits for and stops the server processes (logs in `e2e/.logs/`)                   |
| `auth.spec.ts`         | Authentication smoke flow                                                                 |
| `security.spec.ts`     | T-47 (cookies, foreign-origin server action) and T-48 (reset link) in the browser         |
| `discover.spec.ts`     | Discover My Style looks: journey, no department, limited results, responsive widths       |

## Adding a feature flow

1. Create `e2e/<feature>.spec.ts`. Import `test` and `expect` from `./fixtures/auth`, **not** from `@playwright/test`:
   the shared `test` gives each test its own client IP (see below).
2. Start from a fresh user. Most flows need a signed-in user past onboarding:

   ```ts
   import { expect, signUpAndSkipOnboarding, test } from './fixtures/auth';

   test('change my name in Settings', async ({ page }) => {
     await signUpAndSkipOnboarding(page); // signed in, on /home
     await page.goto('/settings');
     const details = page.locator('#details');
     await details.getByLabel('Full name').fill('E2E Tester Renamed');
     await details.getByRole('button', { name: 'Save details' }).click();
     await expect(details.getByText('Your details have been saved.')).toBeVisible();
   });
   ```

   Use `signUp(page)` to stop on the first onboarding step instead, `login(page, user)` / `logout(page)` to switch
   sessions, and `test.step('…', …)` to name the stages of a long journey.

3. Emailed codes: take `const since = Date.now()` **before** the action that sends the email, then
   `await enterCode(page, await readOtp(user.email, { subject: SUBJECT.<kind>, since }))`. `since` and `subject` make
   sure you get this email, not an earlier one. Add new subjects to `SUBJECT` (they come from
   `apps/api/src/services/templates.ts`).
4. Locate elements the way a user finds them: `getByRole`, `getByLabel`, `getByText`. Avoid CSS classes and test IDs
   unless there is no accessible name (and then consider giving the element one). Scope repeated controls to their
   section, e.g. `page.locator('#password').getByRole('button', …)`.
5. Never wait for fixed times. Assert the result (`toHaveURL`, `toBeVisible`); Playwright retries until it holds.
6. The flow must pass at both viewports. If the mobile layout differs (menus, drawers), handle both in the helper, as
   `logout()` does.
7. Run `pnpm e2e:run <feature> --repeat-each=3` before opening the PR.

### Rules

- **Independent tests.** Each test creates its own user (`newUser()` gives a unique email and a policy-compliant
  password); never depend on another test or on data left by one. Tests run in parallel.
- **One visitor per test.** The API rate-limits sign-ups, logins and code checks per client IP. The shared `test`
  sends a random `X-Forwarded-For` address from the 198.18.0.0/15 benchmarking range, which the web app forwards to
  the API as the visitor's IP, exactly as it does behind the hosting proxy. Don't remove it: parallel tests would share
  one IP and hit the limits.
- **No test-only endpoints, no shortcuts through the database.** Drive the UI; read emails from the outbox.
- **Synthetic data only**, `@example.com` addresses. Never real people, products, prices or credentials.
- Don't weaken an assertion or add `test.skip` to get a green run; fix the flow or the app, or raise it in the issue.

## CI

The `e2e` job in `.github/workflows/ci.yml` runs `pnpm e2e` on every pull request and push to `main`, with Chromium
and the MongoDB binary cached. When it fails, it uploads `playwright-report/`, `test-results/` (traces, screenshots)
and `e2e/.logs/` as the `playwright-report` artifact. Download it from the run's summary page and open the report
with `pnpm exec playwright show-report <folder>`, or a trace with `pnpm exec playwright show-trace <trace.zip>`.
