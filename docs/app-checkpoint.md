# Application checkpoint — 2026-10-02

Implemented Next.js 16.3.8 / React 19.3.0 / TypeScript 7.0.2 browser-rendered portal with Supabase JS 2.117.2. Dependencies are exact versions with package-lock.json. First real club and confirmed Auth administrator now exist in the test project; account identifiers, email and passwords are not embedded in the application or committed configuration.

## Available flow

- Email/password login, session persistence/refresh, logout and active-club membership check.
- ADMIN/COACH: athlete creation with optional DATE birth date; swimming/running test and group creation; event creation; any number of sessions including same-time sessions; participant registration and numbered attempts; time masks, DNS/DNF/DSQ; publication; draft cancellation; closure/reopening; correction of existing published attempts, including CLOSED events, with reason/revision.
- ATHLETE: published sessions/attempts and overall event leaderboard. Draft/private filtering is enforced by existing DB RLS, not just UI buttons.
- New data starts empty: no historical athlete imports or hidden demo seeding. Empty-state explanations guide first use.
- Reads paginate in 500-row pages and scope event details to the selected event. Attempts are fetched in entry-ID batches, not by downloading a club's entire historical attempt table.

All sports writes use `sv_command` with the current user token, request ID and expected revision. No secret/service-role key is used. Request IDs are retained in memory for retry after transport failures; they are not durable across closing/reloading the browser. A successful command followed by a failed list refresh is reported as saved with refresh required, rather than pretending the write failed. Auth/write access denial clears cached club data.

This version intentionally uses browser-rendered authenticated data and Supabase session storage. The Next.js server renders only a public loading shell; it does not authorize or fetch private data. SSR cookies/proxy are unnecessary for this particular boundary and have not been added. If server-rendered authenticated pages or server actions are introduced, add @supabase/ssr and verified server auth at that time. Do not trust getSession as an authorization boundary.

## Checks actually performed

- `npm run typecheck`: passed.
- `npm run build`: production build passed.
- `npm test`: existing prototype scenarios and new application duration/date/timezone/pagination tests passed. These exercise production domain helpers, including invalid minutes/seconds/hours, date-only rendering, local timezone conversion, a DST gap and >1000 rows.
- `npm audit --omit=dev`: zero reported vulnerabilities at this checkpoint; not a permanent security guarantee.
- Real Supabase password endpoint: synthetic nonexistent credentials correctly returned HTTP 400 invalid_credentials. No real administrator password was requested or used.
- Database's audited-command/37-access-assertion checks were previously passed on the real test DB with synthetic transaction rollback fixtures.

## Browser verification limitation

Prepared `tests/browser/portal.spec.ts`: mock Auth/API interaction test for login, time masking, rejecting invalid seconds, attempt save/publication/reload, 16px checkbox, mobile overflow and logout. `npx playwright test --list` discovers it.

It **has not passed**. The standard Chromium download returned an invalid archive. An official Chrome-for-Testing archive was then downloaded successfully, but browser launch was blocked by the execution environment's socket permissions (`Operation not permitted`) before any test steps. This is an environment-blocked run, not verified UI behavior. No screenshot, visual QA, real successful login or real authenticated REST write from the application is claimed.

To run on a normal workstation:

```sh
npm ci
cp .env.example .env.local
# Fill only the project URL and publishable key in .env.local.
npx playwright install chromium
npm run test:browser
```

For an existing locally installed Chrome for Testing binary, the test configuration accepts PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. Never put real credentials into the mock test.

## Next steps

Choose hosting (Vercel remains a candidate), configure its two public Supabase environment variables, then check real administrator login and a disposable session end to end. Historical data import stays separate. Invite delivery/recovery screens, athlete profile/progress pages, catalog editing, cancellation recovery UI, triathlon segment entry and admin role-management UI are still pending. Existing DB operations cover some of those future screens; do not use privileged client writes to bypass them.

The duration input retains the prototype's optional two-digit hours 00–23. This is a UI limitation pending a product rule; the DB stores longer durations in BIGINT hundredths and does not impose that cap. UI labels are currently RU; localization is not complete.

## Mobile interface update — 2026-10-02

- Groups removed from the current portal: no group catalog, fetch, or session selector. New sessions send `group_id: null`; any athlete can join a session. Existing schema/data and historical group links are preserved, with no destructive migration.
- Header uses a 44px logout icon with accessible translated label, alongside a flag + language-code dropdown (RU / Қазақша / English). Email is no longer displayed in the signed-in header.
- ADMIN displays the translated role. COACH displays Auth profile name + role when available, otherwise role. ATHLETE displays the linked athlete first/last name, then profile name, then role as fallback. Display names do not determine authorization.
- Static portal labels, status text, time guidance and known errors translated; language remembered per browser/device. User-entered names/titles stay as entered. The document language and title update with selection. Raw unforeseen server errors may retain their original language.
- Type checks, build and domain tests include translation coverage. Browser scenario extended for mobile logout size, hidden email/groups, three-language switching and reload persistence; execution remains blocked by the previously documented Chromium restrictions in this environment.
- User confirmed using the deployed application on a phone. Hosting is Vercel (`sv-team-app`), backed by the existing Supabase dev project. This update does not import historical athletes/results.
