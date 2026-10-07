import assert from 'node:assert/strict';
import { countVisits, countVisitsByDay, monthBounds } from '../src/lib/attendance.ts';

const visits = Array.from({ length: 12 }, (_, i) => ({
  visited_on: `2026-10-${String(i + 1).padStart(2, '0')}`,
  is_counted: true,
}));
visits.push({ visited_on: '2026-10-04', is_counted: false });

assert.equal(countVisits(visits), 12, 'monthly total counts every visit and excludes uncounted corrections');
assert.deepEqual(countVisitsByDay(visits).find(day => day.date === '2026-10-04'), { date: '2026-10-04', count: 1 });
assert.deepEqual(monthBounds('2026-10'), { start: '2026-10-01', end: '2026-11-01' });
assert.deepEqual(monthBounds('2026-12'), { start: '2026-12-01', end: '2027-01-01' });
console.log('Pool attendance checks passed.');
