# SV Team App

Mobile-first club performance platform for swimming, running and triathlon.

## Current status

Production: [svteam.app](https://svteam.app) on Vercel, backed by Supabase project `qchbyyipfblhrpjtrqfr`. The live app includes club sign-in, admin/coach/athlete roles, athlete invitations, test and start results, and pool attendance. Athlete invitation links return to the app password setup page on the custom domain. The `invite-athlete` Edge Function verifies JWTs and active club permissions. Type checks, app tests and the production build pass. See [project status](docs/status.md), [application checkpoint](docs/app-checkpoint.md), and [database implementation](supabase/README.md).

## Run the application

Use Node.js 24. Run `npm ci`, copy `.env.example` to `.env.local`, and set the Supabase project URL and publishable key. Then run `npm run dev` and open http://localhost:3000. Use your existing club account and application password. Real credentials and `.env.local` must stay out of GitHub.

`npm run typecheck`, `npm test`, and `npm run build` verify code/build/domain logic. Browser tests: `npx playwright install chromium` then `npm run test:browser`. Browser test uses synthetic mocked Auth/API responses; it does not log into a real account.

## Prototype

Open `prototypes/sessions.html` for the multi-session coach flow: four sessions over two days, session publication, one overall result per athlete, and closing the event. State is in memory only.

Open `prototypes/athlete.html` for the athlete demo: category selection, latest official result, PB, progress chart, attempt history and event/all-time rankings. It uses synthetic published events, includes an empty category, and is independent of the coach demo.

Open `prototypes/index.html` in a browser. Demonstration data only; entries disappear on reload. Current coach flow: create test, select/add athlete, enter attempts, review and publish a local leaderboard.

Input masks support minutes/seconds/hundredths and optional hours. Errors identify the invalid segment and participant. Hours 00–23 is a proposed prototype limit, not an approved business rule.

## Requirements

- RU is the default language; RU, KK and EN are available in the live app.
- Invite-only access; athlete record independent of account.
- Keep every attempt; best valid published attempt determines official result.
- PB, history, progress, event leaderboard and all-time records.
- No pool-length distinction in MVP, per product decision.
- Import full sports history after source audit and reconciliation.

## Documentation

- [Notion documentation snapshot](docs/notion/01.md) — sections 01–07, retrieved 2026-09-30; preserves confirmed requirements, proposals and open questions.
- [Project status](docs/status.md)
- [Architecture](docs/architecture.md)
- [Decisions](docs/decisions.md)
- [Notion project hub](https://app.notion.com/p/3eb615d5439e81d19936c7f528e7d409)

## Checks

Run `node tests/time-validation.test.js` and `node tests/athlete-analytics.test.js`. Athlete checks use the same analytics module as the UI and cover publication, best attempts, ties, filtering and empty history. These checks cover parsing boundaries only; browser interaction and mobile layout still require validation.

## Repository structure

`prototypes/`: current standalone preview and archived conversation fragments.
`docs/`: product and technical notes.
`tests/`: current validation checks.
`.github/`: issue and pull request templates.

Production hosting is Vercel at [svteam.app](https://svteam.app). No open-source license has been selected.

### Current mobile workflow (2026-10-02)

Staff: add a test → create an event → add a session → register athletes → enter one time per athlete → publish. Use **Edit** to correct a result, or remove the athlete from that session. Published corrections/removals require a reason and are audited. **Rating** is a separate tab; athlete accounts see only published standings and own results. Creation forms close after saving. Earlier prototype attempt/status controls are superseded by this workflow.
