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

Invite delivery/recovery screens, athlete profile/progress pages, broader catalog editing, cancellation recovery UI and admin role-management UI are still pending. Existing DB operations cover some of those future screens; do not use privileged client writes to bypass them.

The duration input retains the prototype's optional two-digit hours 00–23. This is a UI limitation pending a product rule; the DB stores longer durations in BIGINT hundredths and does not impose that cap. UI labels are currently RU; localization is not complete.

## Mobile interface update — 2026-10-02

- Groups removed from the current portal: no group catalog, fetch, or session selector. New sessions send `group_id: null`; any athlete can join a session. Existing schema/data and historical group links are preserved, with no destructive migration.
- Header uses a 44px logout icon with accessible translated label, alongside a flag + language-code dropdown (RU / Қазақша / English). Email is no longer displayed in the signed-in header.
- ADMIN displays the translated role. COACH displays Auth profile name + role when available, otherwise role. ATHLETE displays the linked athlete first/last name, then profile name, then role as fallback. Display names do not determine authorization.
- Static portal labels, status text, time guidance and known errors translated; language remembered per browser/device. User-entered names/titles stay as entered. The document language and title update with selection. Raw unforeseen server errors may retain their original language.
- Type checks, build and domain tests include translation coverage. Browser scenario extended for mobile logout size, hidden email/groups, three-language switching and reload persistence; execution remains blocked by the previously documented Chromium restrictions in this environment.
- User confirmed using the deployed application on a phone. Hosting is Vercel (`sv-team-app`), backed by the existing Supabase dev project. This update does not import historical athletes/results.

## One result per athlete/session — 2026-10-02

This section supersedes earlier multiple-attempt UI descriptions.

- One current timed result per athlete/session, with editing instead of adding attempts. No FINISHED/DNS/DNF/DSQ selector or attempt counts/headings in the portal. Legacy rows remain in `attempts` for history; a partial unique index enforces one `is_current` row per participation. Existing best timed row becomes current during migration. A correction replaces the current time even when slower, so obsolete better results cannot affect standings.
- `SAVE_RESULT` replaces `SAVE_ATTEMPT` (old command rejected). New times require an open event and draft session. ADMIN/COACH can correct existing published times in closed events with reason/revision/audit. Internal state is FINISHED; fill missing times or remove participants before publishing. Session lifecycle statuses remain for draft/publication.
- `REMOVE_PARTICIPANT` soft-removes only that session entry and retires its current result. Audit before-payload includes the result. Published/closed removal requires a reason. Draft re-registration retains identity/history without restoring the old time. RLS denies athletes access to removed entries and retired results.
- Rating is a separate default tab. Athletes receive only published event selection, standings and their own results (own row highlighted), with no staff tabs/session editor. Staff have Rating / Events / Athletes / Tests. Create forms close on success, remain open on error, and select new events/sessions. Visual event workspace contains sessions and participant rows.
- Verification: transactional single-result suite tests duplicates, idempotency, slower corrections, revisions, published/closed removals, retained history, draft re-add and role boundaries. Updated 37 read-access assertions and command workflows also pass; fixtures roll back and real result count remains 1. Types generated from actual database. Browser scenario updated; Chromium execution remains blocked in this environment.
- Security advisor reports no database/RLS/function warnings. Existing Auth leaked-password protection is disabled: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No Auth plan/settings changed in this update.

## 2026-10-03 historical workbook import

Optional athlete surnames are now represented by an empty string; first names remain required. Staff can edit both names from the Athletes tab. Empty surnames are omitted in athlete labels. Existing athlete sex values are unchanged.

The supplied workbook roster is imported to the club: 167 athlete records total, including the pre-existing admin athlete. `#N/A` aliases were mapped to confirmed roster IDs 143 and 164. Coaches remain athletes in the roster and have the COACH role independently. Historical timed results with resolvable athlete, date, discipline, distance, stroke and time were loaded into closed, published archive sessions grouped by date and test. Conditions are marked unspecified when absent from the workbook. Import is recorded in the private import ledger and audited. Thirteen conflicting athlete/date/test groups were resolved by choosing the first listed result.

The 2021-05-02 Sprint uses 2.5 km running as a replacement for the cancelled swim; 5 km is the running stage. The 20 stage rows are linked to the matching athlete result, with 2.5 km stored as SWIM (substituted stage) and 5 km as RUN. Raw source rows remain in the private import ledger. Archive event grouping is provisional (one archive event per date and test), because the source does not reliably distinguish multiple sessions on one date.

## Triathlon total and stage history — 2026-10-03

The app stores each triathlon result as one overall time plus optional SWIM, T1, BIKE, T2 and RUN splits. The leaderboard ranks by total time; session result cards show any available stages. Staff can create Sprint and Olympic triathlon tests, enter the total and splits together, and correct them with revision checks and one audit record.

The workbook contributes 90 overall results across eight archived starts and 445 stage records after mapping the 2021-05-02 Sprint rows: the 2.5 km run replaced the cancelled swim and the 5 km run is the RUN stage. These 2.5 km times are stored as SWIM-stage substitutes, preserving the source distance in provenance; there is no separate swim measurement for that event. One Olympic participant from June 26, 2022 has only an overall time in the workbook. Typecheck, app tests, production build and rollback-only synthetic database tests passed. Browser visual verification remains unavailable due to execution environment restrictions.
