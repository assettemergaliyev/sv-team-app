import assert from 'node:assert/strict';
import { maskTime, parseTime, formatTime, attemptsLabel, dateLabel } from '../src/lib/time.ts';
import { allRows, localSessionISO } from '../src/lib/data.ts';

assert.equal(maskTime('003250', false), '00:32.50');
assert.equal(maskTime('01020345', true), '01:02:03.45');
assert.equal(parseTime('00:32.50'), 3250);
assert.equal(parseTime('01:02:03,45'), 372345);
for (const invalid of ['00:69.00', '69:00.00', '99:00:00.00', '00:00.00', '00:32.5']) assert.equal(parseTime(invalid), null);
assert.equal(formatTime(372345), '01:02:03.45');
assert.equal(attemptsLabel(3), '3 попытки');
assert.equal(attemptsLabel(11), '11 попыток');
assert.equal(dateLabel('1992-04-15'), '15.04.1992');
assert.equal(localSessionISO('2026-10-02', '07:00', 'Asia/Almaty'), '2026-10-02T02:00:00.000Z');
assert.throws(() => localSessionISO('2026-03-08', '02:30', 'America/New_York'));
const data = Array.from({ length: 1001 }, (_, id) => ({ id }));
const all = await allRows(async (from, to) => ({ data: data.slice(from, to + 1), error: null }));
assert.equal(all.length, 1001);
assert.equal(all[1000].id, 1000);
await assert.rejects(allRows(async () => ({ data: null, error: { message: 'network test failure' } })));
console.log('App duration, date/timezone and pagination checks passed');

// Every static portal label must have both non-Russian translations.
const { translations, translate } = await import('../src/lib/translations.ts');
const { readFileSync } = await import('node:fs');
const portalSource = readFileSync(new URL('../src/components/portal.tsx', import.meta.url), 'utf8');
for (const match of portalSource.matchAll(/\bt\(["']([^"']+)["']\)/g)) {
  assert.ok(translations[match[1]]?.en, `English translation: ${match[1]}`);
  assert.ok(translations[match[1]]?.kk, `Kazakh translation: ${match[1]}`);
}
assert.equal(translate('Старты', 'en'), 'Events');
assert.equal(translate('Тесты', 'kk'), 'Тесттер');
assert.equal(translate('Администратор', 'ru'), 'Администратор');
assert.equal(translate('A user-entered session title', 'kk'), 'A user-entered session title');
console.log('Russian, Kazakh and English label coverage passed');

