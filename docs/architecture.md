# Architecture draft — updated 2026-10-01

TestDefinition → TestEvent → TestSession. TestEvent groups multiple sessions of the same test across days/times. EventParticipant is unique on event_id + athlete_id. SessionParticipant is unique on session_id + event_participant_id. Attempt belongs to SessionParticipant; attempt_no is unique within it. All references must belong to the same club and event.

A session has its actual date/time, group label and draft/published state. Event open/closed is independent of session publication. Publication contributes results immediately to the event leaderboard; closing makes that leaderboard final. Group label is context, not ownership or a restriction on athlete access.

Event results: minimum valid published attempt across all sessions per event/athlete, never one leaderboard row per session. Every attempt retains its session and actual date/time. PB uses valid published attempts in comparable categories, including open events; the PB effect of later corrections remains an open workflow. Do not timestamp an attempt with the event closing date. Same-time chronology and timezone policy remain open.

Athletes can exist without accounts. Times stored as integer hundredths. Triathlon attempts may have segments. Club access, athlete activity and membership plans are separate concepts.

Prototype-only choices: close requires every session published; published sessions are read-only; hours limited to 23; tied ranks use competition rank. Draft cancellation, reopening and corrections are not implemented or approved. Data is synthetic, in memory; no backend guarantees.

Server design still needs atomic publication, revision checks, authorization, audit and import idempotency. Previous snapshots under docs/notion preserve the design at retrieval time; this document supersedes their single-date event model.
