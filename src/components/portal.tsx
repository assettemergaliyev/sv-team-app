'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { browserDatabase } from '@/lib/supabase';
import { allRows, emptyBase, emptyEvent, friendlyError, localSessionISO, type BaseData, type EventData, type Club, type Row } from '@/lib/data';
import { maskTime, parseTime, formatTime, attemptsLabel, dateLabel } from '@/lib/time';

type Command = (action: string, payload: Record<string, Json>) => Promise<boolean>;
const labels: Record<string, string> = { DRAFT: 'Черновик', PUBLISHED: 'Опубликована', CANCELLED: 'Удалена', OPEN: 'Старт открыт', CLOSED: 'Старт закрыт' };
const field = (f: FormData, key: string) => String(f.get(key) ?? '').trim();
function ActionForm({ children, onSubmit, disabled, label }: { children: ReactNode; onSubmit: (f: FormData) => Promise<boolean>; disabled: boolean; label: string }) {
  const [error, setError] = useState('');
  return <form onSubmit={async e => { e.preventDefault(); setError(''); const form = e.currentTarget; try { if (await onSubmit(new FormData(form))) form.reset(); } catch (err) { setError(friendlyError(err)); } }}>
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>{children}<button className="primary" type="submit">{label}</button></fieldset>
    {error && <p role="alert" className="notice error">{error}</p>}
  </form>;
}

export default function Portal() {
  const [db, setDb] = useState<SupabaseClient<Database> | null>(null);
  const [checking, setChecking] = useState(true), [email, setEmail] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]), [clubId, setClubId] = useState('');
  const [base, setBase] = useState<BaseData>(emptyBase), [eventId, setEventId] = useState(''), [detail, setDetail] = useState<EventData>(emptyEvent);
  const [tab, setTab] = useState<'events' | 'athletes' | 'catalog'>('events');
  const [sessionId, setSessionId] = useState(''), [saving, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [baseLoading, setBaseLoading] = useState(false), [eventLoading, setEventLoading] = useState(false);
  const busy = saving || baseLoading || eventLoading;
  const lock = useRef(false), generation = useRef(0), requests = useRef(new Map<string, string>());
  const club = clubs.find(c => c.id === clubId), staff = club?.role === 'ADMIN' || club?.role === 'COACH';
  const event = base.events.find(e => e.id === eventId), session = detail.sessions.find(s => s.id === sessionId);

  useEffect(() => {
    let alive = true;
    let unsubscribe = () => {};
    try {
      const client = browserDatabase(); setDb(client);
      const check = async () => {
        const revision = ++generation.current;
        try {
          const { data, error: authError } = await client.auth.getUser();
          if (!alive || revision !== generation.current) return;
          if (authError || !data.user) { setEmail(''); setClubs([]); setClubId(''); setBase(emptyBase); setDetail(emptyEvent); return; }
          const user = data.user;
          const { data: members, error: memberError } = await client.from('club_users').select('*').eq('user_id', user.id).eq('access_status', 'ACTIVE');
          if (memberError) throw new Error(memberError.message);
          const { data: clubRows, error: clubError } = await client.from('clubs').select('*').in('id', (members ?? []).map(m => m.club_id));
          if (clubError) throw new Error(clubError.message);
          if (!alive || revision !== generation.current) return;
          const available = (clubRows ?? []).map(c => ({ ...c, role: members?.find(m => m.club_id === c.id)?.role ?? 'ATHLETE' }));
          setEmail(user.email ?? ''); setClubs(available);
          setClubId(current => available.some(c => c.id === current) ? current : available[0]?.id ?? '');
        } catch (err) { if (alive) { setError(friendlyError(err)); setClubs([]); setClubId(''); setBase(emptyBase); setDetail(emptyEvent); } }
        finally { if (alive) setChecking(false); }
      };
      void check();
      const { data: sub } = client.auth.onAuthStateChange(() => { setTimeout(() => { if (alive) void check(); }, 0); });
      unsubscribe = () => sub.subscription.unsubscribe();
    } catch (err) { setError(friendlyError(err)); setChecking(false); }
    return () => { alive = false; generation.current++; unsubscribe(); };
  }, []);

  const fetchBase = useCallback(async (client: SupabaseClient<Database>, id: string) => {
    const [athletes, definitions, groups, events] = await Promise.all([
      allRows((a, b) => client.from('athletes').select('*').eq('club_id', id).order('last_name').order('id').range(a, b)),
      allRows((a, b) => client.from('test_definitions').select('*').eq('club_id', id).order('id').range(a, b)),
      allRows((a, b) => client.from('sport_groups').select('*').eq('club_id', id).order('name').order('id').range(a, b)),
      allRows((a, b) => client.from('test_events').select('*').eq('club_id', id).order('created_at', { ascending: false }).order('id').range(a, b)),
    ]);
    return { athletes, definitions, groups, events };
  }, []);
  const fetchEvent = useCallback(async (client: SupabaseClient<Database>, id: string, selected: string) => {
    const [sessions, participants, entries, ranks] = await Promise.all([
      allRows((a, b) => client.from('test_sessions').select('*').eq('club_id', id).eq('event_id', selected).order('scheduled_on').order('scheduled_at').order('id').range(a, b)),
      allRows((a, b) => client.from('event_participants').select('*').eq('club_id', id).eq('event_id', selected).order('id').range(a, b)),
      allRows((a, b) => client.from('session_participants').select('*').eq('club_id', id).eq('event_id', selected).order('id').range(a, b)),
      allRows((a, b) => client.from('event_leaderboard').select('*').eq('club_id', id).eq('event_id', selected).order('place').order('athlete_id').range(a, b)),
    ]);
    const attempts: Row<'attempts'>[] = [];
    for (let i = 0; i < entries.length; i += 100) {
      const ids = entries.slice(i, i + 100).map(x => x.id);
      attempts.push(...await allRows((a, b) => client.from('attempts').select('*').eq('club_id', id).in('session_participant_id', ids).order('attempt_no').order('id').range(a, b)));
    }
    return { sessions, participants, entries, attempts, ranks };
  }, []);
  useEffect(() => {
    let current = true; setBase(emptyBase); setDetail(emptyEvent); setEventId(''); setSessionId(''); setBaseLoading(!!(db && clubId));
    if (db && clubId) void fetchBase(db, clubId).then(b => { if (current) setBase(b); }).catch(e => { if (current) setError(friendlyError(e)); }).finally(() => { if (current) setBaseLoading(false); });
    return () => { current = false; };
  }, [db, clubId, fetchBase]);
  useEffect(() => {
    let current = true; setDetail(emptyEvent); setSessionId(''); setEventLoading(!!(db && clubId && eventId));
    if (db && clubId && eventId) void fetchEvent(db, clubId, eventId).then(d => { if (current) { setDetail(d); setSessionId(d.sessions.find(s => s.status !== 'CANCELLED')?.id ?? ''); } }).catch(e => { if (current) setError(friendlyError(e)); }).finally(() => { if (current) setEventLoading(false); });
    return () => { current = false; };
  }, [db, clubId, eventId, fetchEvent]);

  const command: Command = async (action, payload) => {
    if (!db || !clubId || lock.current) return false;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    const key = `${clubId}:${action}:${JSON.stringify(payload)}`;
    const requestId = requests.current.get(key) ?? crypto.randomUUID(); requests.current.set(key, requestId);
    try {
      const { error: rpcError } = await db.rpc('sv_command', { p_club: clubId, p_action: action, p_payload: payload, p_request: requestId });
      if (rpcError) {
        if (rpcError.code && rpcError.code !== '0') requests.current.delete(key);
        if (rpcError.code === '42501') { setClubs([]); setClubId(''); setBase(emptyBase); setDetail(emptyEvent); }
        throw new Error(rpcError.message);
      }
      requests.current.delete(key); setMessage('Сохранено.');
      try {
        setBase(await fetchBase(db, clubId));
        if (eventId) setDetail(await fetchEvent(db, clubId, eventId));
      } catch { setError('Данные сохранены, но список не удалось обновить. Обнови страницу.'); }
      return true;
    } catch (err) { setError(friendlyError(err)); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!db || lock.current) return;
    const f = new FormData(e.currentTarget); lock.current = true; setBusy(true); setError('');
    try { const { error: signError } = await db.auth.signInWithPassword({ email: field(f, 'email'), password: String(f.get('password') ?? '') }); if (signError) throw new Error(signError.message); }
    catch (err) { setError(friendlyError(err)); }
    finally { lock.current = false; setBusy(false); }
  }
  const athleteName = (id: string | null) => { const a = base.athletes.find(a => a.id === id); return a ? `${a.first_name} ${a.last_name}` : 'Спортсмен'; };
  const category = (id: string) => { const d = base.definitions.find(d => d.id === id); return d ? `${d.discipline === 'SWIMMING' ? 'Плавание' : d.discipline === 'RUNNING' ? 'Бег' : d.discipline} · ${d.distance_m} м${d.stroke_code === 'FREESTYLE' ? ' · Кроль' : d.stroke_code === 'BREASTSTROKE' ? ' · Брасс' : d.stroke_code === 'BACKSTROKE' ? ' · На спине' : d.stroke_code === 'BUTTERFLY' ? ' · Баттерфляй' : ''}` : 'Контрольный тест'; };
  const statusAction = (action: string, id: string, revision: number) => command(action, { id, expected_revision: revision });
  if (checking) return <main className="login"><header><span className="brand">SV TEAM</span><h1>Проверяем вход…</h1></header></main>;
  if (!email) return <main className="login"><header><span className="brand">SV TEAM</span><h1>Результаты твоей команды</h1><p>Войди в аккаунт клуба.</p></header><div className="body"><form onSubmit={login}><label>Почта<input name="email" type="email" autoComplete="username" required disabled={busy} /></label><label>Пароль<input name="password" type="password" autoComplete="current-password" required disabled={busy} /></label><button className="primary full" disabled={busy || !db}>{busy ? 'Входим…' : 'Войти'}</button></form>{error && <p className="notice error" role="alert">{error}</p>}<p className="muted">Доступ по приглашению клуба.</p></div></main>;
  return <main><header><div className="row"><span className="brand">SV TEAM</span><button disabled={busy} onClick={async () => { const result = await db?.auth.signOut(); if (result?.error) setError(friendlyError(result.error.message)); }}>Выйти</button></div><h1>{club?.name ?? 'Нет доступа к клубу'}</h1><p>{staff ? 'Контрольные старты и результаты' : 'Опубликованные результаты клуба'}</p><small>{email} · {club?.role === 'ADMIN' ? 'Администратор' : club?.role === 'COACH' ? 'Тренер' : 'Спортсмен'}</small></header><div className="body">
    {!club ? <div className="empty">У аккаунта нет активного доступа. Обратись к администратору клуба.</div> : <>
      {clubs.length > 1 && <label>Клуб<select value={clubId} disabled={busy} onChange={e => setClubId(e.target.value)}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <nav className="tabs" aria-label="Разделы"><button aria-pressed={tab === 'events'} onClick={() => setTab('events')}>Старты</button>{staff && <><button aria-pressed={tab === 'athletes'} onClick={() => setTab('athletes')}>Спортсмены</button><button aria-pressed={tab === 'catalog'} onClick={() => setTab('catalog')}>Тесты и группы</button></>}</nav>
      <div className="working" role="status" aria-live="polite">{busy ? 'Сохраняем…' : message}</div>{error && <p className="notice error" role="alert">{error}</p>}
      {tab === 'athletes' && staff && <><h2>Спортсмены клуба</h2><ul className="list">{base.athletes.map(a => <li key={a.id}>{a.first_name} {a.last_name} <span className="pill">{a.sport_status === 'ACTIVE' ? 'Активен' : 'Неактивен'}</span></li>)}</ul>{!base.athletes.length && <p className="empty">Спортсменов пока нет. Добавь первого участника.</p>}<section className="card"><h3>Добавить спортсмена</h3><ActionForm disabled={busy} label="Добавить" onSubmit={f => command('CREATE_ATHLETE', { first_name: field(f, 'first'), last_name: field(f, 'last'), birth_date: field(f, 'birth') || null, sex: field(f, 'sex') || null })}><div className="row"><label>Имя<input name="first" required maxLength={100} /></label><label>Фамилия<input name="last" required maxLength={100} /></label></div><div className="row"><label>Дата рождения<input name="birth" type="date" /></label><label>Пол<select name="sex"><option value="">Не указан</option><option value="M">Мужской</option><option value="F">Женский</option></select></label></div><p className="muted">Дата рождения доступна тренерам и самому спортсмену.</p></ActionForm></section></>}
      {tab === 'catalog' && staff && <><h2>Тесты и группы</h2><div className="cards"><section className="card"><h3>Контрольные тесты</h3><ul>{base.definitions.map(d => <li key={d.id}>{category(d.id)}</li>)}</ul><ActionForm disabled={busy} label="Добавить тест" onSubmit={f => { const discipline = field(f, 'discipline'); return command('CREATE_DEFINITION', { discipline, distance_m: Number(field(f, 'distance')), stroke_code: discipline === 'RUNNING' ? 'NONE' : field(f, 'stroke'), format_code: 'INDIVIDUAL', environment_code: discipline === 'RUNNING' ? 'TRACK' : 'POOL' }); }}><label>Дисциплина<select name="discipline"><option value="SWIMMING">Плавание в бассейне</option><option value="RUNNING">Бег на стадионе</option></select></label><label>Дистанция, м<input name="distance" type="number" min="0.001" step="0.001" required /></label><label>Стиль плавания<select name="stroke"><option value="FREESTYLE">Кроль</option><option value="BREASTSTROKE">Брасс</option><option value="BACKSTROKE">На спине</option><option value="BUTTERFLY">Баттерфляй</option></select></label></ActionForm></section><section className="card"><h3>Группы</h3><ul>{base.groups.map(g => <li key={g.id}>{g.name}</li>)}</ul><ActionForm disabled={busy} label="Добавить группу" onSubmit={f => command('CREATE_GROUP', { code: field(f, 'code').toUpperCase(), name: field(f, 'name') })}><label>Название<input name="name" required maxLength={80} /></label><label>Короткое обозначение<input name="code" required maxLength={20} placeholder="Например, SWIM" /></label></ActionForm></section></div></>}
      {tab === 'events' && <><h2>Контрольные старты</h2>{!base.events.length && <div className="empty">Стартов пока нет.{staff && <p>Сначала добавь тест в разделе «Тесты и группы», затем создай старт.</p>}</div>}<label>Выбрать старт<select value={eventId} disabled={busy} onChange={e => setEventId(e.target.value)}><option value="">Выбери старт</option>{base.events.map(e => <option key={e.id} value={e.id}>{e.title} — {e.lifecycle === 'CLOSED' ? 'закрыт' : 'открыт'}</option>)}</select></label>
      {staff && <details className="card"><summary>Создать контрольный старт</summary><ActionForm disabled={busy || !base.definitions.length} label="Создать старт" onSubmit={f => command('CREATE_EVENT', { title: field(f, 'title'), definition_id: field(f, 'definition') })}><label>Название<input name="title" required maxLength={160} placeholder="Контрольный старт — октябрь" /></label><label>Тест<select name="definition" required><option value="">Выбери тест</option>{base.definitions.map(d => <option key={d.id} value={d.id}>{category(d.id)}</option>)}</select></label></ActionForm></details>}
      {event && <><section className="card"><h2>{event.title}</h2><p>{category(event.definition_id)}</p><span className="pill">{labels[event.lifecycle]}</span><p className="muted">{event.lifecycle === 'OPEN' ? 'Общий рейтинг предварительный — сессии ещё могут добавляться.' : 'Старт завершён. Исправления результатов сохраняются в истории.'}</p>{staff && (event.lifecycle === 'OPEN' ? <button disabled={busy} onClick={() => void statusAction('CLOSE_EVENT', event.id, event.revision)}>Закрыть старт</button> : <ActionForm disabled={busy} label="Повторно открыть старт" onSubmit={f => command('REOPEN_EVENT', { id: event.id, expected_revision: event.revision, reason: field(f, 'reason') })}><label>Причина повторного открытия<input name="reason" required /></label></ActionForm>)}</section>
      <h2>Сессии старта</h2><div className="cards">{detail.sessions.filter(s => s.status !== 'CANCELLED').map(s => <button key={s.id} disabled={busy} className={`card ${sessionId === s.id ? 'selected' : ''}`} onClick={() => setSessionId(s.id)}><strong>{s.label}</strong><p>{dateLabel(s.scheduled_on)}{s.scheduled_at ? ` · ${new Intl.DateTimeFormat('ru', { timeZone: club.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(s.scheduled_at))}` : ''}</p><span className="pill">{labels[s.status]}</span></button>)}</div>
      {staff && event.lifecycle === 'OPEN' && <details className="card"><summary>Добавить сессию</summary><ActionForm disabled={busy} label="Создать сессию" onSubmit={f => command('CREATE_SESSION', { event_id: event.id, label: field(f, 'label'), scheduled_on: field(f, 'date'), scheduled_at: localSessionISO(field(f, 'date'), field(f, 'time'), club.timezone), group_id: field(f, 'group') || null })}><label>Название<input name="label" required maxLength={80} placeholder="Плавание — утро" /></label><div className="row"><label>Дата<input name="date" type="date" required /></label><label>Время<input name="time" type="time" required /></label></div><label>Группа<select name="group"><option value="">Без группы</option>{base.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label><p className="muted">Время клуба: {club.timezone}.</p></ActionForm></details>}
      {session && session.status !== 'CANCELLED' && <section className="card"><h2>{session.label}</h2><p>{labels[session.status]}</p>{detail.entries.filter(sp => sp.session_id === session.id).map(sp => { const ep = detail.participants.find(p => p.id === sp.event_participant_id); const attempts = detail.attempts.filter(a => a.session_participant_id === sp.id); return <section className="participant" key={sp.id}><h3>{athleteName(ep?.athlete_id ?? null)}</h3><small>{attemptsLabel(attempts.length)}</small>{attempts.map(a => <Attempt key={`${a.id}:${a.revision}`} attempt={a} editable={!!staff} published={session.status === 'PUBLISHED'} busy={busy} command={command} />)}{staff && session.status === 'DRAFT' && event.lifecycle === 'OPEN' && <Attempt key={`new:${sp.id}:${attempts.length}`} entryId={sp.id} nextNo={Math.max(0, ...attempts.map(a => a.attempt_no)) + 1} editable busy={busy} command={command} />}</section>; })}
      {staff && session.status === 'DRAFT' && event.lifecycle === 'OPEN' && <><ActionForm disabled={busy || !base.athletes.length} label="Добавить участника" onSubmit={f => command('REGISTER_PARTICIPANT', { session_id: session.id, athlete_id: field(f, 'athlete') })}><label>Спортсмен<select name="athlete" required><option value="">Выбери спортсмена</option>{base.athletes.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}</select></label></ActionForm><div className="row" style={{ marginTop: 20 }}><button className="primary" disabled={busy} onClick={() => void statusAction('PUBLISH_SESSION', session.id, session.revision)}>Опубликовать сессию</button><button className="danger" disabled={busy} onClick={() => { if (window.confirm('Удалить черновик сессии? Результаты сохранятся для восстановления администратором.')) void statusAction('CANCEL_SESSION', session.id, session.revision); }}>Удалить черновик</button></div></>}
      </section>}
      <h2>Общий рейтинг</h2>{detail.ranks.length ? <table><thead><tr><th>Место</th><th>Спортсмен</th><th>Результат</th></tr></thead><tbody>{detail.ranks.map(r => <tr key={r.athlete_id}><td>{r.place}</td><td>{athleteName(r.athlete_id)}</td><td className="num">{formatTime(r.best_time_cs)}</td></tr>)}</tbody></table> : <p className="empty">Опубликованных результатов пока нет.</p>}<p className="muted">Лучший результат каждого спортсмена среди опубликованных сессий этого старта.</p>
      </>}
      </>}
    </>}
  </div></main>;
}

function Attempt({ attempt, entryId, nextNo, editable, published = false, busy, command }: { attempt?: Row<'attempts'>; entryId?: string; nextNo?: number; editable: boolean; published?: boolean; busy: boolean; command: Command }) {
  const [editing, setEditing] = useState(!attempt), [hours, setHours] = useState((attempt?.time_cs ?? 0) >= 360000);
  const [value, setValue] = useState(attempt ? (attempt.time_cs === null ? '' : formatTime(attempt.time_cs)) : '');
  const [status, setStatus] = useState(attempt?.status === 'DRAFT' ? 'FINISHED' : attempt?.status ?? 'FINISHED');
  const timeValid = parseTime(value) !== null;
  if (!editing) return <div className="attempt row"><span>Попытка {attempt?.attempt_no}: <strong className="num">{attempt?.status === 'FINISHED' ? formatTime(attempt.time_cs) : attempt?.status === 'DRAFT' ? 'Не заполнена' : attempt?.status}</strong></span>{editable && <button disabled={busy} onClick={() => setEditing(true)}>Изменить</button>}</div>;
  return <div className="attempt"><ActionForm disabled={busy} label={attempt ? 'Сохранить исправление' : 'Сохранить попытку'} onSubmit={async f => {
    const cs = status === 'FINISHED' ? parseTime(value) : null;
    if (status === 'FINISHED' && cs === null) throw new Error('Заполни все цифры. Минуты и секунды: 00–59; часы: 00–23. Время должно быть больше нуля.');
    const payload: Record<string, Json> = { status, time_cs: cs };
    if (attempt) Object.assign(payload, { id: attempt.id, expected_revision: attempt.revision, reason: field(f, 'reason') || null });
    else Object.assign(payload, { session_participant_id: entryId!, attempt_no: nextNo! });
    const saved = await command('SAVE_ATTEMPT', payload); if (saved) { setEditing(false); setValue(''); } return saved;
  }}><h3>Попытка {attempt?.attempt_no ?? nextNo}</h3><label>Статус<select value={status} onChange={e => setStatus(e.target.value)}><option value="FINISHED">Финишировал</option><option value="DNS">DNS — не стартовал</option><option value="DNF">DNF — не финишировал</option><option value="DSQ">DSQ — дисквалифицирован</option></select></label>{status === 'FINISHED' && <><label className="check"><input type="checkbox" checked={hours} onChange={e => { const on = e.target.checked; setHours(on); setValue(current => on ? (current ? '00:' + current : '') : current.replace(/^\d{2}:/, '')); }} />Добавить часы</label><label>Время<input aria-invalid={!!value && !timeValid} aria-describedby={`time-help-${attempt?.id ?? entryId}`} inputMode="numeric" placeholder={hours ? 'чч:мм:сс.сс' : 'мм:сс.сс'} value={value} onChange={e => setValue(maskTime(e.target.value, hours))} /></label><small id={`time-help-${attempt?.id ?? entryId}`}>{value && !timeValid ? 'Заполни все цифры; минуты и секунды 00–59, часы 00–23, время больше нуля.' : 'Сотые доли секунды; разделители добавляются автоматически.'}</small></>}{published && <label>Причина исправления<input name="reason" required maxLength={500} /></label>}</ActionForm>{attempt && <button style={{ marginTop: 10 }} disabled={busy} onClick={() => setEditing(false)}>Отмена</button>}</div>;
}
