# SV Team App database — implementation checkpoint 2026-10-01

Test project: `sv-team-app-dev`, ref `qchbyyipfblhrpjtrqfr`, organization SV Team, region Frankfurt (`eu-central-1`). PostgreSQL 17.11 verified. Existing inactive SV Tracker was not changed. Creation cost returned by Supabase: USD 0/month; this is not a guarantee about future usage or plan changes.

Applied migrations:

1. `20261001190100_initial_schema_and_read_access.sql`: 21 application tables plus existing managed `auth.users`, composite tenant/event foreign keys, duration constraints, date-based private athlete data, membership overlap constraint, RLS and security-invoker leaderboard.
2. `20261001190802_audited_sports_commands.sql`: checked transactional write commands, revision checks, request idempotency, append-only audit by restricted command execution, FK indexes. Function bodies were verified against the remote migration history.

Migration filenames were originally created by Supabase CLI 2.119.0 with `migration new`, then aligned to the version IDs returned by remote migration history. Apply the migrations in order. `sql/*_candidate.sql` are working copies of the two applied migrations, not extra migrations to run.

## Security boundary

Three application roles: ADMIN, COACH, ATHLETE. Roles/access are read from current club_users, not user-controlled metadata. No generic browser sports writes or membership updates are granted. RLS restricts SELECT and own language preferences. Import tables are in private schema, have no client grants and explicit deny policies; real imports need an authorized server implementation.

`public.sv_command` is SECURITY INVOKER. It calls a narrow SECURITY DEFINER function in the unexposed private schema. Both revoke PUBLIC/anon execution; the internal function explicitly checks current authenticated membership/role and whitelists commands. No arbitrary SQL/table name is accepted.

Each write holds a club-row lock, then event/session locks where applicable. The club lock is a deliberate MVP choice: simple serialization of role changes and sports writes, at the cost of serializing writes within a club. It needs workload evaluation before scaling. No parallel-client concurrency stress test has been run.

## API

RPC: `sv_command(p_club UUID, p_action TEXT, p_payload JSONB, p_request UUID)`.

Return: `{id, revision}`. UUID request ID is required; retry the same ID and exact payload to receive the prior result. Reusing it for a different command/payload/user fails. Updates require `expected_revision`; conflict SQLSTATE 40001. Published result corrections require `reason`.

Implemented actions:

| Action | Main payload fields | Role |
|---|---|---|
| CREATE_ATHLETE | first_name, last_name, sex?, birth_date?, sport_status? | ADMIN/COACH |
| UPDATE_ATHLETE | id, expected_revision, changed profile fields | ADMIN/COACH |
| CREATE_GROUP | code, name | ADMIN/COACH |
| CREATE_DEFINITION | discipline, distance_m, stroke_code, format_code, environment_code | ADMIN/COACH |
| CREATE_EVENT | definition_id, title | ADMIN/COACH |
| CREATE_SESSION | event_id, scheduled_on, scheduled_at, label, group_id? | ADMIN/COACH |
| REGISTER_PARTICIPANT | session_id, athlete_id | ADMIN/COACH |
| SAVE_RESULT | session_participant_id or id, time_cs; optional triathlon segments; expected_revision and reason for correction | ADMIN/COACH |
| PUBLISH_SESSION / CANCEL_SESSION | id, expected_revision | ADMIN/COACH |
| RESTORE_SESSION | id, expected_revision, reason | ADMIN |
| CLOSE_EVENT / REOPEN_EVENT | id, expected_revision; reopen requires reason | ADMIN/COACH |
| UPDATE_EVENT_TITLE | id, expected_revision, title; closed requires reason | ADMIN/COACH |
| SET_MEMBER | user_id, role, access_status, expected_revision for existing membership | ADMIN |
| LINK_ATHLETE_ACCOUNT | athlete_id, user_id | ADMIN |
| ADD_GROUP_MEMBERSHIP | athlete_id, group_id, valid_from, valid_to? | ADMIN/COACH |
| SET_STAFF_NOTE | attempt_id, note, expected_revision for existing note | ADMIN/COACH |

SAVE_RESULT maintains one current timed result per athlete/session; it cannot move a result to another participant. Existing published results may be corrected in CLOSED events; closed_at/by stay unchanged and the leaderboard recomputes. New participation/results require an OPEN event and DRAFT session. Publication rejects empty sessions and participants without a result. Cancellation only affects drafts, preserves history, and excludes them from rankings. Closing requires at least one published session and no remaining drafts.

Birth date uses PostgreSQL DATE, examples/API YYYY-MM-DD, intended UI DD.MM.YYYY without timezone conversion.

## Verification performed

- `tests/read_access.sql`: 37 assertions passed in the actual test project, including anonymous/nonmember/blocked access, private fields, draft-only participants, tenant/event FK integrity, membership periods, rejected role escalation, MIN/DENSE_RANK and own preference writes.
- `tests/commands.sql`: real command workflow passed: fifth/same-time sessions, athlete DOB roundtrip, revision conflict, publication validation/idempotency, preserved published history, closed-event correction/audit/recalculation, coach reopen, role boundaries, last-active-admin protection and access blocking with old JWT claims.
- Both suites use synthetic fixtures under BEGIN/ROLLBACK. No synthetic users or athletes remain after the tests.
- Security advisor returned no lints after the second migration. Performance advisor has only informational unused-index findings on the new project: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index . Foreign-key index warnings were resolved. Do not remove indexes merely because an empty database has not used them yet.
- Existing prototype validation/analytics/session tests passed. This does not validate the future Next.js UI or invite delivery.

## Still required before real use

- Verify Auth administrator access and a disposable athlete flow in the deployed app before teamwide use.
- Invite generation/acceptance and delivery, Auth signup/anonymous-provider settings, redirect allowlist. Invite-only club membership is enforced by the current DB; Auth registration configuration has not been changed.
- Further administrative/catalog editing commands (renaming groups, editing unused test definitions, ending membership periods), session metadata edits and historical triathlon source reconciliation. Do not bypass the command API with service_role CRUD.
- Historical import is loaded to the development club. For the 2021-05-02 Sprint, 2.5 km running replaced the cancelled swim and 5 km is the RUN stage. The former is stored under SWIM as a substituted stage, with the source row retained in the private import ledger.
- End-to-end REST/Auth session/browser tests and parallel-client stress tests before production.

Source: current Supabase RLS docs via search_docs, changelog index including PostgreSQL minor-upgrade/Data API GRANT changes, checked 2026-10-01. Grant statements are explicit; leaderboard is security_invoker.

## Current result commands (2026-10-03)

`single_session_result` supersedes multi-attempt writes: `SAVE_RESULT` creates or revises one current timed row for each session participation; `SAVE_ATTEMPT` is rejected. `REMOVE_PARTICIPANT` soft-removes one session entry with expected revision and, for published/closed records, a reason. Retired rows and audit history remain. `attempts.is_current` has a partial unique index; `session_participants.removed_at` excludes removed entries from publication checks, athlete reads and event standings. Existing best timed rows become current without deleting history. UI sends no athlete finish/DNS/DNF status.

Triathlon `SAVE_RESULT` accepts an optional `segments` array of `{segment_code,time_cs}` objects with unique `SWIM`, `T1`, `BIKE`, `T2`, and `RUN` codes. Overall time remains `attempts.time_cs` and is the leaderboard value. When segments are supplied, they are validated, replaced atomically with the overall time, and included in audit before/after payloads. `attempt_segments` is readable with the same role-aware rules as attempts.

Run `tests/read_access.sql`, `tests/commands.sql`, `tests/single_result.sql`, and `tests/triathlon_segments.sql` against the current schema; each suite uses synthetic BEGIN/ROLLBACK fixtures. Their assertions cover access, tenant boundaries, single-result writes, stale revisions, slower corrections, removal, re-add, published/closed auditing and triathlon split save/correction/validation.
