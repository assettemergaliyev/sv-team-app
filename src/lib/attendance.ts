export type PoolVisit = { visited_on: string; is_counted: boolean };

export function formatPoolDate(date: string) {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}.${month}.${year}` : '';
}

export function maskPoolDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export function parsePoolDate(value: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText), month = Number(monthText), year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

export function monthLabel(month: string, locale: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) return month;
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function currentDateInTimezone(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) throw new Error('Invalid month');
  const start = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
  const end = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return { start, end };
}

export function countVisits(visits: PoolVisit[]) {
  return visits.reduce((total, visit) => total + (visit.is_counted ? 1 : 0), 0);
}

export function countVisitsByDay(visits: PoolVisit[]) {
  const counts = new Map<string, number>();
  for (const visit of visits) {
    if (visit.is_counted) counts.set(visit.visited_on, (counts.get(visit.visited_on) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
}

export type DailyPoolAttendance = PoolVisit & {
  athlete_id: string;
  is_selected: boolean;
};

export function selectedPoolAthletesForDay(visits: DailyPoolAttendance[], date: string) {
  return [...new Set(visits
    .filter(visit => visit.visited_on === date && (visit.is_selected || visit.is_counted))
    .map(visit => visit.athlete_id))];
}

