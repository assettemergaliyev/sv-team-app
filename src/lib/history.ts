import type { Database } from '@/types/database';

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type HistorySource = {
  sessions: Pick<Row<'test_sessions'>, 'id' | 'event_id' | 'scheduled_on' | 'status'>[];
  participants: Pick<Row<'event_participants'>, 'id' | 'athlete_id'>[];
  entries: Pick<Row<'session_participants'>, 'id' | 'session_id' | 'event_participant_id' | 'removed_at'>[];
  attempts: Pick<Row<'attempts'>, 'session_participant_id' | 'time_cs' | 'status' | 'is_current'>[];
  personalBests: Pick<Row<'personal_best_records'>, 'athlete_id' | 'definition_id' | 'recorded_on' | 'time_cs'>[];
};
export type HistoryResult = { athleteId: string; eventId: string; definitionId: string; date: string; timeCs: number };
export type HistoryDefinition = Pick<Row<'test_definitions'>, 'id'>;
export type HistoryEvent = Pick<Row<'test_events'>, 'id' | 'definition_id'>;

export function buildHistoryResults(source: HistorySource, events: HistoryEvent[]): HistoryResult[] {
  const publishedSessions = new Map(source.sessions.filter(s => s.status === 'PUBLISHED').map(s => [s.id, s]));
  const eventById = new Map(events.map(e => [e.id, e]));
  const athleteByEntry = new Map<string, string>();
  const entryById = new Map(source.entries.filter(e => !e.removed_at).map(e => [e.id, e]));
  const athleteByParticipant = new Map(source.participants.map(p => [p.id, p.athlete_id]));
  for (const entry of entryById.values()) {
    const athleteId = athleteByParticipant.get(entry.event_participant_id);
    if (athleteId) athleteByEntry.set(entry.id, athleteId);
  }
  const results: HistoryResult[] = [];
  for (const attempt of source.attempts) {
    if (!attempt.is_current || attempt.status !== 'FINISHED' || attempt.time_cs == null) continue;
    const entry = entryById.get(attempt.session_participant_id);
    const athleteId = athleteByEntry.get(attempt.session_participant_id);
    const session = entry && publishedSessions.get(entry.session_id);
    const event = session && eventById.get(session.event_id);
    if (!entry || !athleteId || !session || !event) continue;
    const row = { athleteId, eventId: event.id, definitionId: event.definition_id, date: session.scheduled_on, timeCs: Number(attempt.time_cs) };
    results.push(row);
  }
  return results;
}

export function bestHistoryPerDefinition(rows: HistoryResult[]): HistoryResult[] {
  const best = new Map<string, HistoryResult>();
  for (const row of rows) {
    const key = `${row.definitionId}:${row.athleteId}`;
    const previous = best.get(key);
    if (!previous || row.timeCs < previous.timeCs || (row.timeCs === previous.timeCs && row.date > previous.date)) best.set(key, row);
  }
  return [...best.values()];
}

export function historyWithPersonalBests(rows: HistoryResult[], personalBests: HistorySource['personalBests']): HistoryResult[] {
  const best = new Map(bestHistoryPerDefinition(rows).map(row => [`${row.definitionId}:${row.athleteId}`, row]));
  for (const record of personalBests) {
    const row: HistoryResult = {
      athleteId: record.athlete_id,
      eventId: '',
      definitionId: record.definition_id,
      date: record.recorded_on,
      timeCs: Number(record.time_cs),
    };
    const key = `${row.definitionId}:${row.athleteId}`;
    const current = best.get(key);
    // The imported Boolean=1 record is the source of truth for historical PBs.
    // Only a later, faster app result may supersede it.
    if (!current || !(current.date > row.date && current.timeCs < row.timeCs)) best.set(key, row);
  }
  return [...best.values()];
}

export function denseRank<T extends { timeCs: number }>(rows: T[]): Array<T & { place: number }> {
  const sorted = [...rows].sort((a, b) => a.timeCs - b.timeCs);
  let place = 0;
  let previous: number | undefined;
  return sorted.map(row => {
    if (row.timeCs !== previous) { place++; previous = row.timeCs; }
    return { ...row, place };
  });
}
