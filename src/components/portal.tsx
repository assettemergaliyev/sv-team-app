'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { LanguageProvider, LanguagePicker, useLanguage } from '@/components/language';
import { browserDatabase } from '@/lib/supabase';
import { allRows, emptyBase, emptyEvent, friendlyError, localSessionISO, type BaseData, type EventData, type Club, type Row } from '@/lib/data';
import { maskTime, parseTime, formatTime, dateLabel } from '@/lib/time';

// Typographic adaptation of the club shirt; replace with the official vector when available.
function Brand() {
  return <div className="brand-lockup" role="img" aria-label="SV Team — Triathlon–Swim, Kazakhstan">
    <span className="brand-wordmark" aria-hidden="true"><span className="brand-sv">SV</span><span className="brand-team">TEAM</span></span>
    <span className="brand-discipline" aria-hidden="true">TRIATHLON–SWIM</span>
    <span className="brand-country" aria-hidden="true">KAZAKHSTAN</span>
  </div>;
}

type Command = (action: string, payload: Record<string, Json>) => Promise<boolean>;
const statusLabels: Record<string, string> = { DRAFT: 'Черновик', PUBLISHED: 'Опубликована', CANCELLED: 'Удалена', OPEN: 'Старт открыт', CLOSED: 'Старт закрыт' };
const field = (f: FormData, key: string) => String(f.get(key) ?? '').trim();
function ActionForm({ children, onSubmit, disabled, label }: { children: ReactNode; onSubmit: (f: FormData) => Promise<boolean>; disabled: boolean; label: string }) {
  const { t } = useLanguage();
  const [error, setError] = useState('');
  return <form onSubmit={async e => { e.preventDefault(); setError(''); const form = e.currentTarget; try { if (await onSubmit(new FormData(form))) { form.reset(); form.closest('details')?.removeAttribute('open'); } } catch (err) { setError(friendlyError(err)); } }}>
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>{children}<button className="primary" type="submit">{label}</button></fieldset>
    {error && <p role="alert" className="notice error">{t(error)}</p>}
  </form>;
}

export default function Portal() { return <LanguageProvider><ClubPortal /></LanguageProvider>; }
function ClubPortal() {
  const { t, locale } = useLanguage();
  const labels = Object.fromEntries(Object.entries(statusLabels).map(([k, v]) => [k, t(v)]));
  const [userId, setUserId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [accountLinks, setAccountLinks] = useState<Row<'athlete_accounts'>[]>([]);
  const [db, setDb] = useState<SupabaseClient<Database> | null>(null);
  const [checking, setChecking] = useState(true), [email, setEmail] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]), [clubId, setClubId] = useState('');
  const [base, setBase] = useState<BaseData>(emptyBase), [eventId, setEventId] = useState(''), [detail, setDetail] = useState<EventData>(emptyEvent);
  const [tab, setTab] = useState<'events' | 'athletes' | 'catalog' | 'rating'>('rating');
  const [newTestDiscipline, setNewTestDiscipline] = useState('SWIMMING');
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
          if (authError || !data.user) { setEmail(''); setUserId(''); setProfileName(''); setAccountLinks([]); setClubs([]); setClubId(''); setBase(emptyBase); setDetail(emptyEvent); return; }
          const user = data.user;
          const { data: members, error: memberError } = await client.from('club_users').select('*').eq('user_id', user.id).eq('access_status', 'ACTIVE');
          if (memberError) throw new Error(memberError.message);
          const { data: clubRows, error: clubError } = await client.from('clubs').select('*').in('id', (members ?? []).map(m => m.club_id));
          if (clubError) throw new Error(clubError.message);
          if (!alive || revision !== generation.current) return;
          const available = (clubRows ?? []).map(c => ({ ...c, role: members?.find(m => m.club_id === c.id)?.role ?? 'ATHLETE' }));
          setEmail(user.email ?? ''); setUserId(user.id);
          setProfileName(typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : '');
          const { data: links, error: linkError } = await client.from('athlete_accounts').select('*').eq('user_id', user.id);
          if (linkError) throw new Error(linkError.message);
          if (!alive || revision !== generation.current) return;
          setAccountLinks(links ?? []); setClubs(available);
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
    const [athletes, definitions, events] = await Promise.all([
      allRows((a, b) => client.from('athletes').select('*').eq('club_id', id).order('last_name').order('id').range(a, b)),
      allRows((a, b) => client.from('test_definitions').select('*').eq('club_id', id).order('id').range(a, b)),
      allRows((a, b) => client.from('test_events').select('*').eq('club_id', id).order('created_at', { ascending: false }).order('id').range(a, b)),
    ]);
    return { athletes, definitions, events };
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
      attempts.push(...await allRows((a, b) => client.from('attempts').select('*').eq('club_id', id).eq('is_current', true).in('session_participant_id', ids).order('attempt_no').order('id').range(a, b)));
    }
    const segments: Row<'attempt_segments'>[] = [];
    for (let i = 0; i < attempts.length; i += 100) {
      const ids = attempts.slice(i, i + 100).map(x => x.id);
      segments.push(...await allRows((a, b) => client.from('attempt_segments').select('*').eq('club_id', id).in('attempt_id', ids).range(a, b)));
    }
    return { sessions, participants, entries, attempts, segments, ranks };
  }, []);
  useEffect(() => {
    let current = true; setBase(emptyBase); setDetail(emptyEvent); setEventId(''); setSessionId(''); setBaseLoading(!!(db && clubId));
    if (db && clubId) void fetchBase(db, clubId).then(b => { if (current) { setBase(b); setEventId(b.events[0]?.id ?? ''); } }).catch(e => { if (current) setError(friendlyError(e)); }).finally(() => { if (current) setBaseLoading(false); });
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
      const { data: result, error: rpcError } = await db.rpc('sv_command', { p_club: clubId, p_action: action, p_payload: payload, p_request: requestId });
      if (rpcError) {
        if (rpcError.code && rpcError.code !== '0') requests.current.delete(key);
        if (rpcError.code === '42501') { setClubs([]); setClubId(''); setBase(emptyBase); setDetail(emptyEvent); }
        throw new Error(rpcError.message);
      }
      requests.current.delete(key); setMessage("Сохранено.");
      try {
        setBase(await fetchBase(db, clubId));
        if (eventId) setDetail(await fetchEvent(db, clubId, eventId));
        const created = result as { id?: string } | null;
        if (action === 'CREATE_EVENT' && created?.id) { setEventId(created.id); setTab('events'); }
        if (action === 'CREATE_SESSION' && created?.id) setSessionId(created.id);
      } catch { setError("Данные сохранены, но список не удалось обновить. Обнови страницу."); }
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
  const athleteName = (id: string | null) => { const a = base.athletes.find(a => a.id === id); return a ? [a.first_name, a.last_name].filter(Boolean).join(' ') : t("Спортсмен"); };
  const category = (id: string) => { const d = base.definitions.find(d => d.id === id); return d ? `${d.discipline === 'SWIMMING' ? t("Плавание") : d.discipline === 'RUNNING' ? t("Бег") : d.discipline === 'TRIATHLON' ? t("Триатлон") : d.discipline} · ${d.discipline === 'TRIATHLON' ? `${(d.distance_m / 1000).toLocaleString(locale)} ${t("км")}` : `${d.distance_m} ${t("м")}`}${d.stroke_code === 'FREESTYLE' ? t(" · Кроль") : d.stroke_code === 'BREASTSTROKE' ? t(" · Брасс") : d.stroke_code === 'BACKSTROKE' ? t(" · На спине") : d.stroke_code === 'BUTTERFLY' ? t(" · Баттерфляй") : ''}${d.discipline === 'TRIATHLON' ? ` · ${d.format_code === 'OLYMPIC' ? t('Олимпийская') : t('Спринт')}` : d.format_code === 'KICK_ONLY' ? t(' · Только ноги') : ''}${d.environment_code === 'UNSPECIFIED' ? t(' · Условия не указаны') : d.environment_code === 'INDOOR_TRACK' ? t(' · Манеж') : ''}` : t("Контрольный тест"); };
  const linkedAthlete = base.athletes.find(a => a.id === accountLinks.find(l => l.club_id === clubId && l.user_id === userId)?.athlete_id);
  const identity = club?.role === 'ADMIN' ? t('Администратор') : club?.role === 'COACH' ? (profileName ? `${profileName} · ${t('Тренер')}` : t('Тренер')) : linkedAthlete ? [linkedAthlete.first_name, linkedAthlete.last_name].filter(Boolean).join(' ') : profileName || t('Спортсмен');
  const statusAction = (action: string, id: string, revision: number) => command(action, { id, expected_revision: revision });
  const visibleTab = staff ? tab : 'rating';
  const activeEntries = detail.entries.filter(sp => !sp.removed_at);
  const registeredAthletes = new Set(activeEntries.filter(sp => sp.session_id === sessionId).map(sp => detail.participants.find(p => p.id === sp.event_participant_id)?.athlete_id));
  if (checking) return <main className="login"><header><div className="header-toolbar"><Brand /><LanguagePicker /></div><h1>{t("Проверяем вход…")}</h1></header></main>;
  if (!email) return <main className="login"><header><div className="header-toolbar"><Brand /><LanguagePicker /></div><h1>{t("Результаты твоей команды")}</h1><p>{t("Войди в аккаунт клуба.")}</p></header><div className="body"><form onSubmit={login}><label>{t("Почта")}<input name="email" type="email" autoComplete="username" required disabled={busy} /></label><label>{t("Пароль")}<input name="password" type="password" autoComplete="current-password" required disabled={busy} /></label><button className="primary full" disabled={busy || !db}>{busy ? t("Входим…") : t("Войти")}</button></form>{error && <p className="notice error" role="alert">{t(error)}</p>}<p className="muted">{t("Доступ по приглашению клуба.")}</p></div></main>;
  return <main><header><div className="header-toolbar"><Brand /><div className="header-actions"><LanguagePicker /><button className="icon-button" aria-label={t("Выйти")} title={t("Выйти")} disabled={busy} onClick={async () => { const result = await db?.auth.signOut(); if (result?.error) setError(friendlyError(result.error.message)); }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h10" /></svg></button></div></div><h1 className="portal-heading">{club ? (staff ? t("Контрольные старты и результаты") : t("Опубликованные результаты клуба")) : t("Нет доступа к клубу")}</h1><small className="account-identity">{identity}</small></header><div className="body">
    {!club ? <div className="empty">{t("У аккаунта нет активного доступа. Обратись к администратору клуба.")}</div> : <>
      {clubs.length > 1 && <label>{t("Клуб")}<select value={clubId} disabled={busy} onChange={e => setClubId(e.target.value)}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <nav className="tabs" aria-label={t("Разделы")}><button aria-pressed={visibleTab === 'rating'} onClick={() => setTab('rating')}>{t("Рейтинг")}</button>{staff && <><button aria-pressed={visibleTab === 'events'} onClick={() => setTab('events')}>{t("Старты")}</button><button aria-pressed={visibleTab === 'athletes'} onClick={() => setTab('athletes')}>{t("Спортсмены")}</button><button aria-pressed={visibleTab === 'catalog'} onClick={() => setTab('catalog')}>{t("Тесты")}</button></>}</nav>
      <div className="working" role="status" aria-live="polite">{busy ? t("Сохраняем…") : t(message)}</div>{error && <p className="notice error" role="alert">{t(error)}</p>}
      {visibleTab === 'athletes' && staff && <><h2>{t("Спортсмены клуба")}</h2><ul className="list">{base.athletes.map(a => <li key={a.id}><div className="participant-heading"><strong>{[a.first_name, a.last_name].filter(Boolean).join(' ')}</strong><span className="pill">{a.sport_status === 'ACTIVE' ? t("Активен") : t("Неактивен")}</span></div><details><summary>{t("Изменить")}</summary><ActionForm disabled={busy} label={t("Сохранить изменения")} onSubmit={f => command('UPDATE_ATHLETE', { id: a.id, expected_revision: a.revision, first_name: field(f, 'first'), last_name: field(f, 'last') })}><div className="row"><label>{t("Имя")}<input name="first" required maxLength={100} defaultValue={a.first_name} /></label><label>{t("Фамилия")}<input name="last" maxLength={100} defaultValue={a.last_name} /></label></div><p className="muted">{t("Фамилию можно добавить позже.")}</p></ActionForm></details></li>)}</ul>{!base.athletes.length && <p className="empty">{t("Спортсменов пока нет. Добавь первого участника.")}</p>}<details className="card"><summary>{t("Добавить спортсмена")}</summary><ActionForm disabled={busy} label={t("Добавить")} onSubmit={f => command('CREATE_ATHLETE', { first_name: field(f, 'first'), last_name: field(f, 'last'), birth_date: field(f, 'birth') || null, sex: field(f, 'sex') || null })}><div className="row"><label>{t("Имя")}<input name="first" required maxLength={100} /></label><label>{t("Фамилия")}<input name="last" maxLength={100} /></label></div><div className="row"><label>{t("Дата рождения")}<input name="birth" type="date" /></label><label>{t("Пол")}<select name="sex"><option value="">{t("Не указан")}</option><option value="M">{t("Мужской")}</option><option value="F">{t("Женский")}</option></select></label></div><p className="muted">{t("Фамилию можно добавить позже.")} {t("Дата рождения доступна тренерам и самому спортсмену.")}</p></ActionForm></details></>}
      {visibleTab === 'catalog' && staff && <>
        <h2>{t("Тесты")}</h2>
        <div className="cards"><section className="card">
          <h3>{t("Контрольные тесты")}</h3>
          <ul>{base.definitions.map(d => <li key={d.id}>{category(d.id)}</li>)}</ul>
          <details><summary>{t("Добавить тест")}</summary>
            <ActionForm disabled={busy} label={t("Добавить тест")} onSubmit={f => {
              const discipline = field(f, 'discipline'), triathlon = discipline === 'TRIATHLON';
              return command('CREATE_DEFINITION', {
                discipline, distance_m: Number(field(f, 'distance')),
                stroke_code: discipline === 'SWIMMING' ? field(f, 'stroke') : 'NONE',
                format_code: triathlon ? field(f, 'triathlon_format') : 'INDIVIDUAL',
                environment_code: discipline === 'SWIMMING' ? 'POOL' : discipline === 'RUNNING' ? 'TRACK' : 'UNSPECIFIED'
              });
            }}>
              <label>{t("Дисциплина")}<select name="discipline" value={newTestDiscipline} onChange={e => setNewTestDiscipline(e.target.value)}>
                <option value="SWIMMING">{t("Плавание в бассейне")}</option>
                <option value="RUNNING">{t("Бег на стадионе")}</option>
                <option value="TRIATHLON">{t("Триатлон")}</option>
              </select></label>
              <label>{t("Дистанция, м")}<input name="distance" type="number" min="0.001" step="0.001" required /></label>
              {newTestDiscipline === 'SWIMMING' && <label>{t("Стиль плавания")}<select name="stroke">
                <option value="FREESTYLE">{t("Кроль")}</option><option value="BREASTSTROKE">{t("Брасс")}</option>
                <option value="BACKSTROKE">{t("На спине")}</option><option value="BUTTERFLY">{t("Баттерфляй")}</option>
              </select></label>}
              {newTestDiscipline === 'TRIATHLON' && <label>{t("Формат триатлона")}<select name="triathlon_format">
                <option value="SPRINT">{t("Спринт")}</option><option value="OLYMPIC">{t("Олимпийская")}</option>
              </select></label>}
            </ActionForm>
          </details>
        </section></div>
      </>}
      {(visibleTab === 'events' || visibleTab === 'rating') && <><label>{t("Выбрать старт")}<select value={eventId} disabled={busy} onChange={e => setEventId(e.target.value)}><option value="">{t("Выбери старт")}</option>{base.events.map(e => <option key={e.id} value={e.id}>{e.title} — {e.lifecycle === 'CLOSED' ? t("закрыт") : t("открыт")}</option>)}</select></label></>}
      {visibleTab === 'rating' && <><h2>{t("Общий рейтинг")}</h2>{!event ? <p className="empty">{t("Выбери старт для просмотра результатов.")}</p> : <section className="card"><h3>{event.title}</h3><p>{category(event.definition_id)}</p>{detail.ranks.length ? <table><thead><tr><th>{t("Место")}</th><th>{t("Спортсмен")}</th><th>{t("Результат")}</th></tr></thead><tbody>{detail.ranks.map(r => <tr key={r.athlete_id} className={r.athlete_id === linkedAthlete?.id ? 'own-result' : ''}><td>{r.place}</td><td>{athleteName(r.athlete_id)}</td><td className="num">{formatTime(r.best_time_cs)}</td></tr>)}</tbody></table> : <p className="empty">{t("Опубликованных результатов пока нет.")}</p>}<p className="muted">{t("Лучший результат каждого спортсмена среди опубликованных сессий этого старта.")}</p>{!staff && <><h3>{t("Мои результаты")}</h3>{activeEntries.filter(sp => detail.participants.find(ep => ep.id === sp.event_participant_id)?.athlete_id === linkedAthlete?.id).map(sp => { const ownSession = detail.sessions.find(x => x.id === sp.session_id); const result = detail.attempts.find(a => a.session_participant_id === sp.id && a.is_current); return ownSession?.status === 'PUBLISHED' && result?.time_cs ? <p key={sp.id}>{dateLabel(ownSession.scheduled_on)} · {ownSession.label}: <strong className="num">{formatTime(result.time_cs)}</strong></p> : null; })}</>}</section>}</>}
      {visibleTab === 'events' && staff && <><h2>{t("Контрольные старты")}</h2>{!base.events.length && <div className="empty">{t("Стартов пока нет.")}{staff && <p>{t("Сначала добавь тест в разделе «Тесты», затем создай старт.")}</p>}</div>}
      {staff && <details className="card"><summary>{t("Создать контрольный старт")}</summary><ActionForm disabled={busy || !base.definitions.length} label={t("Создать старт")} onSubmit={f => command('CREATE_EVENT', { title: field(f, 'title'), definition_id: field(f, 'definition') })}><label>{t("Название")}<input name="title" required maxLength={160} placeholder={t("Контрольный старт — октябрь")} /></label><label>{t("Тест")}<select name="definition" required><option value="">{t("Выбери тест")}</option>{base.definitions.map(d => <option key={d.id} value={d.id}>{category(d.id)}</option>)}</select></label></ActionForm></details>}
      {event && <div className="event-workspace"><p className="hierarchy">{t("Старт → сессия → участники и результаты")}</p><section className="card"><h2>{event.title}</h2><p>{category(event.definition_id)}</p><span className="pill">{labels[event.lifecycle]}</span><p className="muted">{event.lifecycle === 'OPEN' ? t("Общий рейтинг предварительный — сессии ещё могут добавляться.") : t("Старт завершён. Исправления результатов сохраняются в истории.")}</p>{staff && (event.lifecycle === 'OPEN' ? <button disabled={busy} onClick={() => void statusAction('CLOSE_EVENT', event.id, event.revision)}>{t("Закрыть старт")}</button> : <ActionForm disabled={busy} label={t("Повторно открыть старт")} onSubmit={f => command('REOPEN_EVENT', { id: event.id, expected_revision: event.revision, reason: field(f, 'reason') })}><label>{t("Причина повторного открытия")}<input name="reason" required /></label></ActionForm>)}</section>
      <h2>{t("Сессии старта")}</h2><div className="cards">{detail.sessions.filter(s => s.status !== 'CANCELLED').map(s => <button key={s.id} disabled={busy} className={`card ${sessionId === s.id ? 'selected' : ''}`} onClick={() => setSessionId(s.id)}><strong>{s.label}</strong><p>{dateLabel(s.scheduled_on)}{s.scheduled_at ? ` · ${new Intl.DateTimeFormat(locale, { timeZone: club.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(s.scheduled_at))}` : ''}</p><span className="pill">{labels[s.status]}</span></button>)}</div>
      {staff && event.lifecycle === 'OPEN' && <details className="card"><summary>{t("Добавить сессию")}</summary><ActionForm disabled={busy} label={t("Создать сессию")} onSubmit={f => command('CREATE_SESSION', { event_id: event.id, label: field(f, 'label'), scheduled_on: field(f, 'date'), scheduled_at: localSessionISO(field(f, 'date'), field(f, 'time'), club.timezone), group_id: null })}><label>{t("Название")}<input name="label" required maxLength={80} placeholder={t("Плавание — утро")} /></label><div className="row"><label>{t("Дата")}<input name="date" type="date" required /></label><label>{t("Время")}<input name="time" type="time" required /></label></div><p className="muted">{t("Время клуба:")} {club.timezone}.</p></ActionForm></details>}
      {session && session.status !== 'CANCELLED' && <section className="card session-workspace"><p className="section-label">{t("Сессия")}</p><h2>{session.label}</h2><p>{labels[session.status]}</p>{activeEntries.filter(sp => sp.session_id === session.id).map(sp => { const ep = detail.participants.find(p => p.id === sp.event_participant_id); const result = detail.attempts.find(a => a.session_participant_id === sp.id && a.is_current); return <section className="participant" key={sp.id}><div className="participant-heading"><h3>{athleteName(ep?.athlete_id ?? null)}</h3>{session.status === 'PUBLISHED' || event.lifecycle === 'CLOSED' ? <details className="remove-form"><summary>{t("Убрать")}</summary><ActionForm disabled={busy} label={t("Убрать из сессии")} onSubmit={f => command('REMOVE_PARTICIPANT', { id: sp.id, expected_revision: sp.revision, reason: field(f, 'reason') })}><label>{t("Причина удаления участника")}<input name="reason" required maxLength={500} /></label></ActionForm></details> : <button className="remove-participant" disabled={busy} aria-label={`${t("Убрать из сессии")}: ${athleteName(ep?.athlete_id ?? null)}`} onClick={() => void command('REMOVE_PARTICIPANT', { id: sp.id, expected_revision: sp.revision })}>{t("Убрать")}</button>}</div><ResultEditor key={`${result?.id ?? sp.id}:${result?.revision ?? sp.revision}`} result={result} segments={detail.segments.filter(seg => seg.attempt_id === result?.id)} triathlon={base.definitions.find(d => d.id === event.definition_id)?.discipline === 'TRIATHLON'} entryId={sp.id} published={session.status === 'PUBLISHED'} canCreate={session.status === 'DRAFT' && event.lifecycle === 'OPEN'} busy={busy} command={command} /></section>; })}
      {session.status === 'DRAFT' && event.lifecycle === 'OPEN' && <><details className="add-participant"><summary>{t("Добавить участника")}</summary><ActionForm disabled={busy || !base.athletes.some(a => !registeredAthletes.has(a.id))} label={t("Добавить")} onSubmit={f => command('REGISTER_PARTICIPANT', { session_id: session.id, athlete_id: field(f, 'athlete') })}><label>{t("Спортсмен")}<select name="athlete" required><option value="">{t("Выбери спортсмена")}</option>{base.athletes.filter(a => !registeredAthletes.has(a.id)).map(a => <option key={a.id} value={a.id}>{[a.first_name, a.last_name].filter(Boolean).join(' ')}</option>)}</select></label></ActionForm></details><div className="row session-actions"><button className="primary" disabled={busy} onClick={() => void statusAction('PUBLISH_SESSION', session.id, session.revision)}>{t("Опубликовать сессию")}</button><button className="danger" disabled={busy} onClick={() => { if (window.confirm(t("Удалить черновик сессии? Результаты сохранятся для восстановления администратором."))) void statusAction('CANCEL_SESSION', session.id, session.revision); }}>{t("Удалить черновик")}</button></div></>}
      </section>}

      </div>}
      </>}
    </>}
  </div></main>;
}

function ResultEditor({ result, segments, triathlon, entryId, published, canCreate, busy, command }: { result?: Row<'attempts'>; segments: Row<'attempt_segments'>[]; triathlon: boolean; entryId: string; published: boolean; canCreate: boolean; busy: boolean; command: Command }) {
  const { t } = useLanguage();
  const stageLabels: Record<string, string> = { SWIM: t('Плавание'), T1: 'T1', BIKE: t('Велосипед'), T2: 'T2', RUN: t('Бег') };
  const [editing, setEditing] = useState(false), [hours, setHours] = useState((result?.time_cs ?? 0) >= 360000);
  const [value, setValue] = useState(result?.time_cs ? formatTime(result.time_cs) : '');
  const [stageValues, setStageValues] = useState<Record<string, string>>(() => Object.fromEntries(segments.map(s => [s.segment_code, formatTime(s.time_cs)])));
  const timeValid = parseTime(value) !== null;
  const hasTime = result?.time_cs != null;
  if (!editing) return <div className="result-line"><strong className="num">{hasTime ? formatTime(result.time_cs) : t("Результат ещё не внесён")}</strong>{triathlon && segments.length > 0 && <ul className="result-segments">{segments.map(s => <li key={s.segment_code}><span>{stageLabels[s.segment_code] ?? s.segment_code}</span><strong className="num">{formatTime(s.time_cs)}</strong></li>)}</ul>}{(result || canCreate) && <button disabled={busy} onClick={() => setEditing(true)}>{hasTime ? t("Изменить") : t("Внести время")}</button>}</div>;
  return <div className="result-editor"><ActionForm disabled={busy} label={t("Сохранить результат")} onSubmit={async f => {
    const cs = parseTime(value);
    if (cs === null) throw new Error("Заполни все цифры. Минуты и секунды: 00–59; часы: 00–23. Время должно быть больше нуля.");
    const payload: Record<string, Json> = { time_cs: cs };
    if (triathlon) {
      const parsed = Object.entries(stageValues).flatMap(([segment_code, input]) => {
        if (!input.trim()) return [];
        const time_cs = parseTime(input);
        if (time_cs === null) throw new Error("Проверь время этапов: укажи полное время в формате мм:сс.сс или чч:мм:сс.сс.");
        return [{ segment_code, time_cs }];
      });
      Object.assign(payload, { segments: parsed as unknown as Json });
    }
    if (result) Object.assign(payload, { id: result.id, expected_revision: result.revision, reason: field(f, 'reason') || null });
    else Object.assign(payload, { session_participant_id: entryId });
    const saved = await command('SAVE_RESULT', payload); if (saved) setEditing(false); return saved;
  }}><label className="check"><input type="checkbox" checked={hours} onChange={e => { const on = e.target.checked; setHours(on); setValue(current => on ? (current ? '00:' + current : '') : current.replace(/^\d{2}:/, '')); }} />{t("Добавить часы")}</label><label>{t("Время")}<input aria-invalid={!!value && !timeValid} aria-describedby={`time-help-${entryId}`} inputMode="numeric" placeholder={hours ? t("чч:мм:сс.сс") : t("мм:сс.сс")} value={value} onChange={e => setValue(maskTime(e.target.value, hours))} /></label><p className="muted" id={`time-help-${entryId}`}>{value && !timeValid ? t("Заполни все цифры; минуты и секунды 00–59, часы 00–23, время больше нуля.") : t("Сотые доли секунды; разделители добавляются автоматически.")}</p>{triathlon && <fieldset className="stage-editor"><legend>{t('Этапы триатлона')}</legend>{(['SWIM', 'T1', 'BIKE', 'T2', 'RUN'] as const).map(code => <label key={code}>{stageLabels[code]}<input inputMode="numeric" placeholder={t('мм:сс.сс')} value={stageValues[code] ?? ''} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); const withHours = digits.length > 6; setStageValues(v => ({ ...v, [code]: maskTime(e.target.value, withHours) })); }} /></label>)}</fieldset>}{published && <label>{t("Причина исправления")}<input name="reason" required maxLength={500} /></label>}</ActionForm><button style={{ marginTop: 10 }} disabled={busy} onClick={() => { setEditing(false); setValue(result?.time_cs ? formatTime(result.time_cs) : ''); setHours((result?.time_cs ?? 0) >= 360000); setStageValues(Object.fromEntries(segments.map(s => [s.segment_code, formatTime(s.time_cs)]))); }}>{t("Отмена")}</button></div>;
}
