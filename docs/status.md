# Status — 2026-09-30

## Latest checkpoint — 2026-10-02: application integration

Configured first real administrator and SV Team club in the separate test project. Added Next.js application with password login, user-token/RLS data access, athlete/test/group creation, events/sessions/attempts, publication, draft cancellation, event closure/reopening and audited corrections of closed-event results. See app-checkpoint.md for scope and limitations.

Production build, TypeScript and domain tests passed. Browser test exists but was blocked before launch by environment socket restrictions; no verified successful real-user UI flow or mobile screenshot. Hosting and real import remain pending.

## Current checkpoint — 2026-10-01: database foundation

Next.js + TypeScript + Supabase stack and database structure approved. Roles: ADMIN, COACH, ATHLETE; no HEAD_COACH. ADMIN/COACH may correct published results in CLOSED events without reopening, with reason and audit. Vercel remains a hosting candidate.

Created separate Supabase test project sv-team-app-dev (Frankfurt, PostgreSQL 17.11). Applied 21 application tables, tenant/event FKs, read RLS, dense-rank leaderboard and checked audited command API. See ../supabase/README.md for implemented operations and remaining scope. 37 read-access assertions and the command workflow passed against the actual DB; fixtures rolled back. Security advisor clean; informational unused-index notices only.

No real accounts/data seeded; no historical import or UI connection yet. Next: verified initial administrator, Auth/Next.js integration, first persistent UI flow, then audited trial import. New database implementation files are not yet published to the public repository.

The dated sections below are historical checkpoints, not current approval state.

Completed: Discovery v0.1, draft model, coach prototype and athlete results/ranking prototype (synthetic data).
Athlete prototype: category selection, latest result, PB, progress chart with selectable points, period filter, attempt history, event/all-time rankings, sex filter and empty state. Analytical checks passed; browser QA status recorded separately below.
Next: source-data audit, confirm stack and permissions, database schema and first persistent end-to-end flow.
Repository: https://github.com/assettemergaliyev/sv-team-app (public, explicitly approved by the owner on 2026-09-30).
Initial source import: coach prototypes, validation checks, project notes and Notion documentation snapshot.
Notion sections 01–06 and Stage 1 Design read and captured in docs/notion on 2026-09-30.
Validation: node tests/time-validation.test.js passed (7 checks); these tests duplicate parsing logic and do not verify browser behavior.
No real athlete data or credentials are included.

Athlete validation: 8 analytics checks passed. Browser QA was blocked: no installed Chromium; browser download returned an invalid archive. Mobile visual layout and interactions still require verification.

## 2026-10-01 — multi-session coach prototype
Implemented prototypes/sessions.html with four synthetic sessions over two days, add-session and participant flows, attempt entry, publication, combined leaderboard and event closure. Original coach flow remains available; athlete prototype has not yet been wired to this model. Session analytics scenario checks passed. No persistence or server permissions. Browser visual QA remains unverified.

### 2026-10-02 — mobile simplification and languages

Current Next.js portal removes groups from athlete/session workflows, replaces full-width logout with an accessible header icon, hides email, displays role or available name, and supports RU/KK/EN with device-local language persistence. Historical group schema and links are retained. See `docs/app-checkpoint.md` for scope and verification limits.

### 2026-10-02 — one result and separate standings

Current Next.js app now uses one timed result per athlete/session, with editing and audited participant removal. Athlete finish/DNS/DNF selectors removed. Rating is a separate default tab; athlete accounts see published standings and own results only. Creation forms close on success and select newly created events/sessions. See `docs/app-checkpoint.md` for migration and verification.

### 2026-10-02 — shirt-inspired branding

Replaced duplicated header titles with a single typographic SV TEAM lockup, TRIATHLON–SWIM and KAZAKHSTAN. White header, teal primary buttons, yellow selection accents, near-black text, and a small colour stripe on login. Palette and wordmark approximate the supplied shirt photograph; no official vector asset is available. Compact language/logout controls and account identity retained. Typecheck, domain tests and production build passed. Browser visual verification remains blocked by the existing Chromium runtime restriction; mobile appearance needs review on the deployed app. No data model or permissions changes.


### 2026-10-03 — historical roster and results import

Imported the roster from the supplied workbook into the development club, matching the existing administrator and confirmed aliases for IDs 143 and 164. Added a reversible migration allowing an empty surname, then imported IDs 144 and 152 as first-name-only athletes. Athlete roster now supports editing names.

Loaded 1,451 unambiguous historical timed results into closed, published archive events/sessions. Each result keeps source workbook rows in the private import ledger and has an audit entry. Test definitions retain unspecified course/conditions rather than guessing. Thirteen conflicting athlete/date/test groups and 535 triathlon composite/stage records are preserved as pending raw source records and are not included in rankings. Dates are represented as one archive event per date and test because the source does not reliably identify event/session boundaries. Names, sex and birth dates remain as in the roster source; unknown sex remains UNKNOWN.

The re-runnable import batch is fingerprinted and keyed by source rows. Verification: 167 athletes, 1451 imported archive results, 117 closed published archive events/sessions, and no published session without a result. Full-browser verification remains unavailable.
