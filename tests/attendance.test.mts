import assert from 'node:assert/strict';
import { countVisits, countVisitsByDay, formatPoolDate, maskPoolDate, monthBounds, monthLabel, parsePoolDate } from '../src/lib/attendance.ts';

const visits = Array.from({ length: 12 }, (_, i) => ({
  visited_on: `2026-10-${String(i + 1).padStart(2, '0')}`,
  is_counted: true,
}));
visits.push({ visited_on: '2026-10-04', is_counted: false });

assert.equal(countVisits(visits), 12, 'monthly total counts every visit and excludes uncounted corrections');
assert.deepEqual(countVisitsByDay(visits).find(day => day.date === '2026-10-04'), { date: '2026-10-04', count: 1 });
assert.deepEqual(monthBounds('2026-10'), { start: '2026-10-01', end: '2026-11-01' });
assert.deepEqual(monthBounds('2026-12'), { start: '2026-12-01', end: '2027-01-01' });
assert.equal(formatPoolDate('2026-10-07'), '07.10.2026');
assert.equal(maskPoolDate('07102026'), '07.10.2026');
assert.equal(maskPoolDate('07.10.2026'), '07.10.2026');
assert.equal(parsePoolDate('07.10.2026'), '2026-10-07');
assert.equal(parsePoolDate('29.02.2024'), '2024-02-29');
assert.equal(parsePoolDate('29.02.2026'), null, 'rejects invalid calendar dates');
assert.equal(parsePoolDate('31.13.2026'), null, 'rejects invalid months');
assert.equal(monthLabel('2026-10', 'en'), 'October 2026');
console.log('Pool attendance checks passed.');
