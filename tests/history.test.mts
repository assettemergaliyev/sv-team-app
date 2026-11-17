import assert from 'node:assert/strict';
import { bestHistoryPerDefinition, buildHistoryResults, denseRank, historyWithPersonalBests, type HistorySource } from '../src/lib/history.ts';

const source: HistorySource = {
  sessions: [
    { id: 's1', event_id: 'e1', scheduled_on: '2025-01-01', status: 'PUBLISHED' },
    { id: 's2', event_id: 'e2', scheduled_on: '2026-01-01', status: 'PUBLISHED' },
    { id: 'draft', event_id: 'e1', scheduled_on: '2026-02-01', status: 'DRAFT' },
  ],
  participants: [{ id: 'p1', athlete_id: 'a1' }, { id: 'p2', athlete_id: 'a2' }],
  entries: [
    { id: 'r1', session_id: 's1', event_participant_id: 'p1', removed_at: null },
    { id: 'r2', session_id: 's2', event_participant_id: 'p1', removed_at: null },
    { id: 'r3', session_id: 's2', event_participant_id: 'p2', removed_at: null },
    { id: 'r4', session_id: 'draft', event_participant_id: 'p2', removed_at: null },
  ],
  attempts: [
    { session_participant_id: 'r1', time_cs: 1200, status: 'FINISHED', is_current: true },
    { session_participant_id: 'r2', time_cs: 1100, status: 'FINISHED', is_current: true },
    { session_participant_id: 'r3', time_cs: 1100, status: 'FINISHED', is_current: true },
    { session_participant_id: 'r4', time_cs: 900, status: 'FINISHED', is_current: true },
  ],
  personalBests: [],
};

const history = buildHistoryResults(source, [
  { id: 'e1', definition_id: 'd1' }, { id: 'e2', definition_id: 'd1' },
]);
assert.equal(history.length, 3);
assert.equal(bestHistoryPerDefinition(history).length, 2);
assert.equal(bestHistoryPerDefinition(history).find(row => row.athleteId === 'a1')?.timeCs, 1100);
const imported = [{ athlete_id: 'a1', definition_id: 'd1', recorded_on: '2023-10-28', time_cs: 7677 }];
const priorAttempt = [{ athleteId: 'a1', eventId: 'old', definitionId: 'd1', date: '2022-10-28', timeCs: 8524 }];
const merged = historyWithPersonalBests(priorAttempt, imported);
assert.equal(merged.find(row => row.athleteId === 'a1')?.timeCs, 7677);
assert.equal(merged.find(row => row.athleteId === 'a1')?.date, '2023-10-28');
const laterFaster = historyWithPersonalBests([...priorAttempt, { athleteId: 'a1', eventId: 'e3', definitionId: 'd1', date: '2026-01-01', timeCs: 7500 }], imported);
assert.equal(laterFaster.find(row => row.athleteId === 'a1')?.timeCs, 7500);
const laterSlower = historyWithPersonalBests([...priorAttempt, { athleteId: 'a1', eventId: 'e3', definitionId: 'd1', date: '2026-01-01', timeCs: 9000 }], imported);
assert.equal(laterSlower.find(row => row.athleteId === 'a1')?.timeCs, 7677);
assert.deepEqual(denseRank([{ timeCs: 1100 }, { timeCs: 1100 }, { timeCs: 1300 }]).map(row => row.place), [1, 1, 2]);
console.log('History ranking tests passed');
