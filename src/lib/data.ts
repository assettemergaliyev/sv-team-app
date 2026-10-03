import type { Database } from '@/types/database';
export type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Rank = Database['public']['Views']['event_leaderboard']['Row'];
export type Club = Row<'clubs'> & { role: string };
export type BaseData = { athletes: Row<'athletes'>[]; definitions: Row<'test_definitions'>[]; events: Row<'test_events'>[] };
export type EventData = { sessions: Row<'test_sessions'>[]; participants: Row<'event_participants'>[]; entries: Row<'session_participants'>[]; attempts: Row<'attempts'>[]; segments: Row<'attempt_segments'>[]; ranks: Rank[] };
export const emptyBase: BaseData = { athletes: [], definitions: [], events: [] };
export const emptyEvent: EventData = { sessions: [], participants: [], entries: [], attempts: [], segments: [], ranks: [] };
export async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await page(from, from + 499);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export function localSessionISO(date: string, time: string, timezone: string) {
  const target = `${date}T${time}:00`;
  let ms = Date.parse(target + 'Z');
  if (!Number.isFinite(ms)) throw new Error('Проверь дату и время сессии.');
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const local = (instant: number) => {
    const parts = Object.fromEntries(f.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  };
  for (let i = 0; i < 3; i++) ms += Date.parse(target + 'Z') - Date.parse(local(ms) + 'Z');
  if (local(ms) !== target) throw new Error('Такого местного времени нет в часовом поясе клуба.');
  return new Date(ms).toISOString();
}
export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const known: [string, string][] = [
    ['Invalid login credentials', 'Неверная почта или пароль.'],
    ['Result exists', 'Результат уже внесён. Обнови страницу и используй «Изменить».'],
    ['Active participation required', 'Участник уже убран из сессии. Обнови страницу.'],
    ['Positive result required', 'Время должно быть больше нуля.'],
    ['Revision conflict', 'Запись уже изменена. Обнови страницу и повтори исправление.'],
    ['Unfinished entries', 'Внеси время каждому участнику или убери его из сессии перед публикацией.'],
    ['No participants', 'Сначала добавь участников и результаты.'],
    ['finish or cancel drafts', 'Перед закрытием опубликуй или удали оставшиеся черновики.'],
    ['Correction reason', 'Укажи причину исправления опубликованного результата.'],
    ['Access denied', 'Нет доступа. Проверь активность аккаунта в клубе.'],
    ['Admin required', 'Это действие доступно администратору.'],
    ['Failed to fetch', 'Не удалось связаться с сервером. Проверь соединение и повтори.'],
    ['duplicate key', 'Такая запись уже существует. Обнови список.'],
  ];
  return known.find(([match]) => message.includes(match))?.[1] ?? message;
}
