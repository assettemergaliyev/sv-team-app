# SV Team App database — implementation checkpoint 2026-10-01

Test project: `sv-team-app-dev`, ref `qchbyyipfblhrpjtrqfr`, organization SV Team, region Frankfurt (`eu-central-1`). PostgreSQL 17.11 verified. Existing inactive SV Tracker was not changed. Creation cost returned by Supabase: USD 0/month; this is not a guarantee about future usage or plan changes.

Applied migrations:

1. `20261001190100_initial_schema_and_read_access.sql`: 21 application tables plus existing managed `auth.users`, composite tenant/event foreign keys, duration constraints, date-based private athlete data, membership overlap constraint, RLS and security-invoker leaderboard.
2. `20261001190802_audited_sports_commands.sql`: checked transactional write commands, revision checks, request idempotency, append-only audit by restricted command execution, FK indexes. Function bodies were verified against the remote migration history.

Migration filenames were originally created by Supabase CLI 2.119.0 with `migration new`, then aligned to the version IDs returned by remote migration history. Apply the migrations in order. Working SQL drafts are excluded from this publication; only applied migrations are included.

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
| SAVE_ATTEMPT (new) | session_participant_id, attempt_no, status, time_cs?, occurred_at? | ADMIN/COACH |
| SAVE_ATTEMPT (update) | id, expected_revision, status, time_cs?, occurred_at?, reason for published | ADMIN/COACH |
| PUBLISH_SESSION / CANCEL_SESSION | id, expected_revision | ADMIN/COACH |
| RESTORE_SESSION | id, expected_revision, reason | ADMIN |
| CLOSE_EVENT / REOPEN_EVENT | id, expected_revision; reopen requires reason | ADMIN/COACH |
| UPDATE_EVENT_TITLE | id, expected_revision, title; closed requires reason | ADMIN/COACH |
| SET_MEMBER | user_id, role, access_status, expected_revision for existing membership | ADMIN |
| LINK_ATHLETE_ACCOUNT | athlete_id, user_id | ADMIN |
| ADD_GROUP_MEMBERSHIP | athlete_id, group_id, valid_from, valid_to? | ADMIN/COACH |
| SET_STAFF_NOTE | attempt_id, note, expected_revision for existing note | ADMIN/COACH |

SAVE_ATTEMPT cannot move an existing attempt to another participant. Existing published attempts may be corrected in CLOSED events; closed_at/by stay unchanged and the leaderboard recomputes. New participation/attempts require an OPEN event and DRAFT session. Publication rejects empty sessions, missing attempts and DRAFT attempts. Cancellation only affects drafts, preserves attempts, and excludes them from rankings. Closing requires at least one published session and no remaining drafts.

Birth date uses PostgreSQL DATE, examples/API YYYY-MM-DD, intended UI DD.MM.YYYY without timezone conversion.

## Verification performed

- `tests/read_access.sql`: 37 assertions passed in the actual test project, including anonymous/nonmember/blocked access, private fields, draft-only participants, tenant/event FK integrity, membership periods, rejected role escalation, MIN/DENSE_RANK and own preference writes.
- `tests/commands.sql`: real command workflow passed: fifth/same-time sessions, athlete DOB roundtrip, revision conflict, publication validation/idempotency, preserved published history, closed-event correction/audit/recalculation, coach reopen, role boundaries, last-active-admin protection and access blocking with old JWT claims.
- Both suites use synthetic fixtures under BEGIN/ROLLBACK. No synthetic users or athletes remain after the tests.
- Security advisor returned no lints after the second migration. Performance advisor has only informational unused-index findings on the new project: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index . Foreign-key index warnings were resolved. Do not remove indexes merely because an empty database has not used them yet.
- Existing prototype validation/analytics/session tests passed. This does not validate the future Next.js UI or invite delivery.

## Still required before real use

- First real club + Auth administrator bootstrap with a verified email; no real accounts or club memberships were seeded.
- Next.js/TypeScript application scaffold and Auth integration; project currently has standalone prototypes, not a Next.js production app.
- Invite generation/acceptance and delivery, Auth signup/anonymous-provider settings, redirect allowlist. Invite-only club membership is enforced by the current DB; Auth registration configuration has not been changed.
- Further administrative/catalog editing commands (renaming groups, editing unused test definitions, ending membership periods), session metadata edits and triathlon segment writes as needed by UI. Current commands cover the first persistent results workflow; do not bypass them with service_role CRUD to add missing features.
- Authorized admin import implementation, source audit, mappings and reconciliation. No real data imported yet.
- End-to-end REST/Auth session/browser tests and parallel-client stress tests before production.

Source: current Supabase RLS docs via search_docs, changelog index including PostgreSQL minor-upgrade/Data API GRANT changes, checked 2026-10-01. Grant statements are explicit; leaderboard is security_invoker.
