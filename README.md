# SV Team App

Mobile-first club performance platform for swimming, running and triathlon.

## Current status

Discovery documented; interactive coach prototype available. No production app, database, authentication or historical import yet.

## Prototype

Open `prototypes/index.html` in a browser. Demonstration data only; entries disappear on reload. Current coach flow: create test, select/add athlete, enter attempts, review and publish a local leaderboard.

Input masks support minutes/seconds/hundredths and optional hours. Errors identify the invalid segment and participant. Hours 00–23 is a proposed prototype limit, not an approved business rule.

## Requirements

- RU (default), KK and EN planned; prototype currently Russian.
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

Run `node tests/time-validation.test.js`. These checks cover parsing boundaries only; browser interaction and mobile layout still require validation.

## Repository structure

`prototypes/`: current standalone preview and archived conversation fragments.
`docs/`: product and technical notes.
`tests/`: current validation checks.
`.github/`: issue and pull request templates.

Next.js, TypeScript and Supabase were proposed; final stack and hosting remain unconfirmed. No open-source license has been selected.
