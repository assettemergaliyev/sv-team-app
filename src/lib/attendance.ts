export type PoolSessionType = 'MORNING' | 'EVENING' | 'TRIAL' | 'UNSPECIFIED';
export const poolSessionTypes: PoolSessionType[] = ['MORNING', 'EVENING', 'TRIAL', 'UNSPECIFIED'];
export type PoolVisit = {
  visited_on: string;
  is_counted: boolean;
  session_type?: string | null;
  athlete_id?: string | null;
  guest_name?: string | null;
};
export type PoolSessionCounts = Record<PoolSessionType, number>;
export type PoolDayCounts = PoolSessionCounts & { date: string; count: number };

export function poolSessionType(visit: PoolVisit): PoolSessionType {
  const type = visit.session_type;
  return type && poolSessionTypes.includes(type as PoolSessionType) ? type as PoolSessionType : 'UNSPECIFIED';
}

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

export function countVisitsBySessionType(visits: PoolVisit[], date?: string): PoolSessionCounts {
  const counts: PoolSessionCounts = { MORNING: 0, EVENING: 0, TRIAL: 0, UNSPECIFIED: 0 };
  for (const visit of visits) {
    if (visit.is_counted && (!date || visit.visited_on === date)) counts[poolSessionType(visit)] += 1;
  }
  return counts;
}

export function countVisitsByDay(visits: PoolVisit[]): PoolDayCounts[] {
  const counts = new Map<string, PoolDayCounts>();
  for (const visit of visits) {
    if (!visit.is_counted) continue;
    const day = counts.get(visit.visited_on) ?? {
      date: visit.visited_on, count: 0, MORNING: 0, EVENING: 0, TRIAL: 0, UNSPECIFIED: 0,
    };
    day.count += 1;
    day[poolSessionType(visit)] += 1;
    counts.set(visit.visited_on, day);
  }
  return [...counts.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type DailyPoolAttendance = PoolVisit & {
  athlete_id?: string | null;
  is_selected: boolean;
};

export function selectedPoolAthletesForDay(visits: DailyPoolAttendance[], date: string, sessionType: PoolSessionType) {
  const selected = visits.filter(visit =>
    visit.athlete_id &&
    visit.visited_on === date &&
    poolSessionType(visit) === sessionType &&
    (visit.is_selected || visit.is_counted)
  );
  return [...new Set(selected.map(visit => visit.athlete_id as string))];
}
