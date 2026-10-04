'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { LanguageProvider, useLanguage } from '@/components/language';
import { ThemeProvider, useTheme } from '@/components/theme';
import { browserDatabase } from '@/lib/supabase';
import { allRows, emptyBase, emptyEvent, friendlyError, localSessionISO, type BaseData, type EventData, type Club, type Row } from '@/lib/data';
import { maskTime, parseTime, formatTime, dateLabel } from '@/lib/time';
import { bestHistoryPerDefinition, buildHistoryResults, denseRank, historyWithPersonalBests, type HistoryResult, type HistorySource } from '@/lib/history';

// Typographic adaptation of the club shirt; replace with the official vector when available.
function Brand() {
  return <div className="brand-lockup" role="img" aria-label="SV Team — Triathlon–Swim, Kazakhstan">
    <span className="brand-wordmark" aria-hidden="true"><span className="brand-sv">SV</span><span className="brand-team">TEAM</span></span>
    <span className="brand-discipline" aria-hidden="true">TRIATHLON–SWIM</span>
    <span className="brand-country" aria-hidden="true">KAZAKHSTAN</span>
  </div>;
}

function RatingAthleteName({ firstName, lastName }: { firstName?: string; lastName?: string }) {
  return <>{lastName && <span className="athlete-last-name">{lastName}</span>}{lastName && firstName ? ' ' : ''}{firstName && <span>{firstName}</span>}</>;
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

function AccountMenu({ onLogout, disabled = false }: { onLogout?: () => void; disabled?: boolean }) {
  const { t, locale, setLocale } = useLanguage();
  const { choice, setChoice } = useTheme();
  const [dialog, setDialog] = useState<'theme' | 'language' | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const themes = [{ value: 'system', label: t('Как в системе') }, { value: 'light', label: t('Светлая') }, { value: 'dark', label: t('Тёмная') }] as const;
  const languages = [
    { code: 'ru', label: 'Русский' },
    { code: 'kk', label: 'Қазақша' },
    { code: 'en', label: 'English' },
  ] as const;
  const openDialog = (next: 'theme' | 'language') => {
    menuRef.current?.removeAttribute('open');
    setDialog(next);
  };

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current?.open) menuRef.current.open = false;
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return <>
    <details className="account-menu" ref={menuRef}>
      <summary aria-label={t('Меню')} title={t('Меню')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></summary>
      <div className={`account-menu-panel${onLogout ? ' has-logout' : ''}`}>
        <button type="button" className="account-menu-action" onClick={() => openDialog('theme')}>{t('Тема')}</button>
        <button type="button" className="account-menu-action" onClick={() => openDialog('language')}>{t('Язык приложения')}</button>
        {onLogout && <button type="button" className="account-menu-logout" aria-label={t('Выйти')} title={t('Выйти')} disabled={disabled} onClick={onLogout}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg></button>}
      </div>
    </details>
    {dialog && <div className="account-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDialog(null); }} onKeyDown={e => { if (e.key === 'Escape') setDialog(null); }}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <h2 id="account-modal-title">{dialog === 'language' ? t('Выберите язык') : t('Выберите тему')}</h2>
        <div className="account-modal-options">{dialog === 'language' ? languages.map(language => <button type="button" key={language.code} lang={language.code} aria-pressed={locale === language.code} onClick={() => { setLocale(language.code); setDialog(null); }}>{language.label}</button>) : themes.map(theme => <button type="button" key={theme.value} aria-pressed={choice === theme.value} onClick={() => { setChoice(theme.value); setDialog(null); }}>{theme.label}</button>)}</div>
      </section>
    </div>}
  </>;
}

export default function Portal() { return <LanguageProvider><ThemeProvider><ClubPortal /></ThemeProvider></LanguageProvider>; }
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
  const [historySource, setHistorySource] = useState<HistorySource>({ sessions: [], participants: [], entries: [], attempts: [], personalBests: [] });
  const [ratingSelection, setRatingSelection] = useState('__ALL_HISTORY__');
  const [historyDiscipline, setHistoryDiscipline] = useState('');
  const [historyDistance, setHistoryDistance] = useState('');
  const [historySex, setHistorySex] = useState('');
  const [historyType, setHistoryType] = useState('');
  const [historyAthleteId, setHistoryAthleteId] = useState('');
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [editAthleteId, setEditAthleteId] = useState('');
  const [tab, setTab] = useState<'events' | 'athletes' | 'catalog' | 'rating'>('rating');
  const [newTestDiscipline, setNewTestDiscipline] = useState('SWIMMING');
  const [sessionId, setSessionId] = useState(''), [saving, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [baseLoading, setBaseLoading] = useState(false), [eventLoading, setEventLoading] = useState(false);
  const busy = saving || baseLoading || eventLoading;
  const lock = useRef(false), generation = useRef(0), requests = useRef(new Map<string, string>());
  const athleteHistoryRef = useRef<HTMLElement | null>(null);
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
  const fetchHistory = useCallback(async (client: SupabaseClient<Database>, id: string): Promise<HistorySource> => {
    const [sessions, participants, entries, attempts, personalBests] = await Promise.all([
      allRows((a, b) => client.from('test_sessions').select('id,event_id,scheduled_on,status').eq('club_id', id).order('scheduled_on', { ascending: false }).range(a, b)),
      allRows((a, b) => client.from('event_participants').select('id,athlete_id').eq('club_id', id).range(a, b)),
      allRows((a, b) => client.from('session_participants').select('id,session_id,event_participant_id,removed_at').eq('club_id', id).is('removed_at', null).range(a, b)),
      allRows((a, b) => client.from('attempts').select('session_participant_id,time_cs,status,is_current').eq('club_id', id).eq('is_current', true).eq('status', 'FINISHED').range(a, b)),
      allRows((a, b) => client.from('personal_best_records').select('athlete_id,definition_id,recorded_on,time_cs').eq('club_id', id).range(a, b)),
    ]);
    return { sessions, participants, entries, attempts, personalBests };
  }, []);
  const fetchEvent = useCallback(async (client: SupabaseClient<Database>, id: string, selected: string) => {
    const [sessions, participants, entries, ranks] = await Promise.all([
      allRows((a, b) => client.from('test_sessions').select('*').eq('club_id', id).eq('event_id', selected).order('scheduled_on', { ascending: false }).order('scheduled_at', { ascending: false }).order('id').range(a, b)),
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
    let current = true; setBase(emptyBase); setDetail(emptyEvent); setHistorySource({ sessions: [], participants: [], entries: [], attempts: [], personalBests: [] }); setEventId(''); setRatingSelection('__ALL_HISTORY__'); setSessionId(''); setBaseLoading(!!(db && clubId));
    if (db && clubId) void Promise.all([fetchBase(db, clubId), fetchHistory(db, clubId)]).then(([b, h]) => { if (current) { setBase(b); setHistorySource(h); setEventId(b.events[0]?.id ?? ''); } }).catch(e => { if (current) setError(friendlyError(e)); }).finally(() => { if (current) setBaseLoading(false); });
    return () => { current = false; };
  }, [db, clubId, fetchBase, fetchHistory]);
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
        const [updatedBase, updatedHistory] = await Promise.all([fetchBase(db, clubId), fetchHistory(db, clubId)]);
        setBase(updatedBase);
        setHistorySource(updatedHistory);
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
  const category = (id: string) => { const d = base.definitions.find(d => d.id === id); return d ? `${d.discipline === 'SWIMMING' ? t("Плавание") : d.discipline === 'RUNNING' ? t("Бег") : d.discipline === 'TRIATHLON' ? t("Триатлон") : d.discipline} · ${d.discipline === 'TRIATHLON' ? `${(d.distance_m / 1000).toLocaleString(locale)} ${t("км")}` : `${d.distance_m} ${t("м")}`}${d.stroke_code === 'FREESTYLE' ? t(" · Кроль") : d.stroke_code === 'BREASTSTROKE' ? t(" · Брасс") : d.stroke_code === 'BACKSTROKE' ? t(" · На спине") : d.stroke_code === 'BUTTERFLY' ? t(" · Баттерфляй") : ''}${d.discipline === 'TRIATHLON' ? ` · ${d.format_code === 'OLYMPIC' ? t('Олимпийская') : t('Спринт')}` : d.format_code === 'KICK_ONLY' ? t(' · Ноги') : ''}` : t("Контрольный тест"); };
  const linkedAthlete = base.athletes.find(a => a.id === accountLinks.find(l => l.club_id === clubId && l.user_id === userId)?.athlete_id);
  const identity = club?.role === 'ADMIN' ? t('Администратор') : club?.role === 'COACH' ? (profileName ? `${profileName} · ${t('Тренер')}` : t('Тренер')) : linkedAthlete ? [linkedAthlete.first_name, linkedAthlete.last_name].filter(Boolean).join(' ') : profileName || t('Спортсмен');
  const statusAction = (action: string, id: string, revision: number) => command(action, { id, expected_revision: revision });
  const visibleTab = staff ? tab : 'rating';
  const activeEntries = detail.entries.filter(sp => !sp.removed_at);
  const registeredAthletes = new Set(activeEntries.filter(sp => sp.session_id === sessionId).map(sp => detail.participants.find(p => p.id === sp.event_participant_id)?.athlete_id));
  const eventStartDate = (id: string) => historySource.sessions.filter(s => s.event_id === id && s.status === 'PUBLISHED').map(s => s.scheduled_on).sort().at(-1) ?? '';
  const eventLabel = (item: Row<'test_events'>) => `${eventStartDate(item.id) ? dateLabel(eventStartDate(item.id)) : ''}${eventStartDate(item.id) ? ' — ' : ''}${category(item.definition_id)}`;
  const activeDefinitionIds = new Set(base.definitions.filter(d => d.is_active).map(d => d.id));
  const sortedEvents = base.events.filter(e => activeDefinitionIds.has(e.definition_id)).sort((a, b) => eventStartDate(b.id).localeCompare(eventStartDate(a.id)) || a.id.localeCompare(b.id));
  const disciplineLabel = (code: string) => t(code === 'SWIMMING' ? 'Плавание' : code === 'RUNNING' ? 'Бег' : code === 'TRIATHLON' ? 'Триатлон' : code);
  const sortedDefinitions = base.definitions.filter(d => d.is_active).sort((a, b) => disciplineLabel(a.discipline).localeCompare(disciplineLabel(b.discipline), locale) || Number(a.distance_m) - Number(b.distance_m) || category(a.id).localeCompare(category(b.id), locale));
  const historicalAttempts = buildHistoryResults(historySource, base.events);
  const historyResults = historyWithPersonalBests(historicalAttempts, historySource.personalBests);
  const athleteById = new Map(base.athletes.map(a => [a.id, a]));
  const definitionsById = new Map(base.definitions.map(d => [d.id, d]));
  const groupMap = new Map<string, { key: string; date: string; discipline: string; distance: number; eventIds: string[] }>();
  for (const item of base.events) {
    const date = eventStartDate(item.id), definition = definitionsById.get(item.definition_id);
    if (!date || !definition?.is_active) continue;
    const key = `${date}|${definition.discipline}|${Number(definition.distance_m)}`;
    const group = groupMap.get(key) ?? { key, date, discipline: definition.discipline, distance: Number(definition.distance_m), eventIds: [] };
    if (!group.eventIds.includes(item.id)) group.eventIds.push(item.id);
    groupMap.set(key, group);
  }
  const ratingGroups = [...groupMap.values()].sort((a, b) => b.date.localeCompare(a.date) || a.discipline.localeCompare(b.discipline) || a.distance - b.distance);
  const selectedRatingGroup = ratingGroups.find(g => g.key === ratingSelection);
  const rankRows = (rows: HistoryResult[]) => denseRank(rows).map(row => ({ ...row, athlete: athleteById.get(row.athleteId) })).sort((a, b) => a.place - b.place || `${a.athlete?.last_name ?? ''} ${a.athlete?.first_name ?? ''}`.localeCompare(`${b.athlete?.last_name ?? ''} ${b.athlete?.first_name ?? ''}`, locale));
  const historyOptions = historyResults.map(row => ({ row, athlete: athleteById.get(row.athleteId), definition: definitionsById.get(row.definitionId) })).filter((x): x is { row: HistoryResult; athlete: NonNullable<typeof x.athlete>; definition: NonNullable<typeof x.definition> } => !!x.athlete && !!x.definition?.is_active);
  const historyAthletes = [...new Map(historyOptions.map(({ athlete }) => [athlete.id, athlete])).values()].sort((a, b) => a.last_name.localeCompare(b.last_name, locale) || a.first_name.localeCompare(b.first_name, locale));
  const compareDefinitions = (a: string, b: string) => {
    const left = definitionsById.get(a), right = definitionsById.get(b);
    if (!left || !right) return a.localeCompare(b, locale);
    const disciplineLabel = (code: string) => t(code === 'SWIMMING' ? 'Плавание' : code === 'RUNNING' ? 'Бег' : code === 'TRIATHLON' ? 'Триатлон' : code);
    return disciplineLabel(left.discipline).localeCompare(disciplineLabel(right.discipline), locale) || Number(left.distance_m) - Number(right.distance_m) || category(a).localeCompare(category(b), locale);
  };
  const selectedAthlete = base.athletes.find(a => a.id === selectedAthleteId);
  const selectedAthleteHistory = selectedAthlete ? historicalAttempts.filter(row => row.athleteId === selectedAthlete.id && definitionsById.get(row.definitionId)?.is_active).sort((a, b) => b.date.localeCompare(a.date)) : [];
  useEffect(() => {
    if (selectedAthleteId) athleteHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedAthleteId]);
  const candidateHistory = historyOptions.filter(({ athlete, definition }) =>
    (!historyDiscipline || definition.discipline === historyDiscipline) &&
    (!historyDistance || Number(definition.distance_m) === Number(historyDistance)) &&
    (!historySex || athlete.sex === historySex));
  const historyTypeOptions = [...new Set(candidateHistory.map(x => x.definition.id))].sort((a, b) => category(a).localeCompare(category(b), locale));
  const filteredHistory = candidateHistory.filter(({ definition }) => !historyType || definition.id === historyType);
  const historyDefinitionIds = [...new Set(filteredHistory.map(x => x.definition.id))].sort(compareDefinitions);
  const historicalTables = historyDefinitionIds.map(definitionId => {
    const definition = definitionsById.get(definitionId)!;
    const rankedRows = rankRows(filteredHistory.filter(x => x.definition.id === definitionId).map(x => x.row));
    const rows = historyAthleteId ? rankedRows.filter(row => row.athleteId === historyAthleteId) : rankedRows;
    return { definitionId, definition, rows };
  }).filter(table => !historyAthleteId || table.rows.length > 0);
  const eventGroupTables = selectedRatingGroup ? [...new Set(selectedRatingGroup.eventIds.map(id => base.events.find(e => e.id === id)?.definition_id).filter((id): id is string => !!id))]
    .sort(compareDefinitions).map(definitionId => {
      const definition = definitionsById.get(definitionId)!;
      const rows = rankRows(bestHistoryPerDefinition(historicalAttempts.filter(row => selectedRatingGroup.eventIds.includes(row.eventId) && row.definitionId === definitionId)));
      return { definitionId, definition, rows };
    }) : [];
  const disciplineOptions = [...new Set(base.definitions.map(d => d.discipline))].sort((a, b) => t(a === 'SWIMMING' ? 'Плавание' : a === 'RUNNING' ? 'Бег' : a === 'TRIATHLON' ? 'Триатлон' : a).localeCompare(t(b === 'SWIMMING' ? 'Плавание' : b === 'RUNNING' ? 'Бег' : b === 'TRIATHLON' ? 'Триатлон' : b), locale));
  const distanceOptions = [...new Set(base.definitions.filter(d => !historyDiscipline || d.discipline === historyDiscipline).map(d => Number(d.distance_m)))].sort((a, b) => a - b);
  const sexOptions = [...new Set(base.athletes.map(a => a.sex).filter((s): s is string => s === 'M' || s === 'F'))];
  const bySurname = (a: Row<'athletes'>, b: Row<'athletes'>) => a.last_name.localeCompare(b.last_name, locale) || a.first_name.localeCompare(b.first_name, locale);
  const activeAthletes = base.athletes.filter(a => a.sport_status === 'ACTIVE').sort(bySurname);
  const inactiveAthletes = base.athletes.filter(a => a.sport_status !== 'ACTIVE').sort(bySurname);
  const athleteToEdit = base.athletes.find(a => a.id === editAthleteId);
  if (checking) return <main className="login"><header><div className="header-toolbar"><Brand /><div className="header-actions"><AccountMenu /></div></div><h1>{t("Проверяем вход…")}</h1></header></main>;
  if (!email) return <main className="login"><header><div className="header-toolbar"><Brand /><div className="header-actions"><AccountMenu /></div></div><h1>{t("Результаты твоей команды")}</h1><p>{t("Войди в аккаунт клуба.")}</p></header><div className="body"><form onSubmit={login}><label>{t("Почта")}<input name="email" type="email" autoComplete="username" required disabled={busy} /></label><label>{t("Пароль")}<input name="password" type="password" autoComplete="current-password" required disabled={busy} /></label><button className="primary full" disabled={busy || !db}>{busy ? t("Входим…") : t("Войти")}</button></form>{error && <p className="notice error" role="alert">{t(error)}</p>}<p className="muted">{t("Доступ по приглашению клуба.")}</p></div></main>;
  return <main><header><div className="header-toolbar"><Brand /><div className="header-actions"><AccountMenu disabled={busy} onLogout={async () => { const result = await db?.auth.signOut(); if (result?.error) setError(friendlyError(result.error.message)); }} /></div></div><h1 className="portal-heading">{club ? (staff ? t("Контрольные старты и результаты") : t("Опубликованные результаты клуба")) : t("Нет доступа к клубу")}</h1><small className="account-identity">{identity}</small></header><div className="body">
    {!club ? <div className="empty">{t("У аккаунта нет активного доступа. Обратись к администратору клуба.")}</div> : <>
      {clubs.length > 1 && <label>{t("Клуб")}<select value={clubId} disabled={busy} onChange={e => setClubId(e.target.value)}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <nav className="tabs" aria-label={t("Разделы")}><button aria-pressed={visibleTab === 'rating'} onClick={() => setTab('rating')}>{t("Рейтинг")}</button>{staff && <><button aria-pressed={visibleTab === 'events'} onClick={() => setTab('events')}>{t("Старты")}</button><button aria-pressed={visibleTab === 'athletes'} onClick={() => setTab('athletes')}>{t("Спортсмены")}</button><button aria-pressed={visibleTab === 'catalog'} onClick={() => setTab('catalog')}>{t("Тесты")}</button></>}</nav>
      <div className="working" role="status" aria-live="polite">{busy ? t("Сохраняем…") : t(message)}</div>{error && <p className="notice error" role="alert">{t(error)}</p>}
      {visibleTab === 'athletes' && staff && <>
        <h2>{t("Спортсмены клуба")}</h2>
        {selectedAthlete && <section ref={athleteHistoryRef} className="card athlete-history"><div className="section-heading"><h3><RatingAthleteName firstName={selectedAthlete.first_name} lastName={selectedAthlete.last_name} /></h3><button type="button" onClick={() => setSelectedAthleteId('')}>{t("Закрыть")}</button></div><h4>{t("История стартов")}</h4>{selectedAthleteHistory.length ? <div className="table-scroll"><table className="athlete-history-table"><thead><tr><th>{t("Дата")}</th><th>{t("Тест")}</th><th>{t("Результат")}</th></tr></thead><tbody>{selectedAthleteHistory.map((row, i) => <tr key={row.eventId + row.date + i}><td>{dateLabel(row.date)}</td><td>{category(row.definitionId)}</td><td className="num">{formatTime(row.timeCs)}</td></tr>)}</tbody></table></div> : <p className="empty">{t("Опубликованных результатов пока нет.")}</p>}</section>}
        <h3>{t("Активные спортсмены")}</h3>
        <ul className="list">{activeAthletes.map(a => <li key={a.id}><button type="button" className="athlete-link" aria-pressed={selectedAthleteId === a.id} onClick={() => setSelectedAthleteId(a.id)}>{[a.last_name, a.first_name].filter(Boolean).join(' ')}</button></li>)}</ul>
        {!activeAthletes.length && <p className="empty">{t("Активных спортсменов нет.")}</p>}
        {inactiveAthletes.length > 0 && <details className="inactive-athletes-section"><summary>{t("Неактивные спортсмены")} ({inactiveAthletes.length})</summary><ul className="list inactive-athletes-list">{inactiveAthletes.map(a => <li key={a.id}><button type="button" className="athlete-link" aria-pressed={selectedAthleteId === a.id} onClick={() => setSelectedAthleteId(a.id)}>{[a.last_name, a.first_name].filter(Boolean).join(' ')}</button></li>)}</ul></details>}
        <details className="card"><summary>{t("Изменить спортсмена")}</summary>
          <label>{t("Спортсмен")}<select value={editAthleteId} onChange={e => setEditAthleteId(e.target.value)}><option value="">{t("Выбери спортсмена")}</option>{[...activeAthletes, ...inactiveAthletes].map(a => <option key={a.id} value={a.id}>{[a.last_name, a.first_name].filter(Boolean).join(' ')}</option>)}</select></label>
          {athleteToEdit && <ActionForm key={athleteToEdit.id} disabled={busy} label={t("Сохранить изменения")} onSubmit={f => command('UPDATE_ATHLETE', { id: athleteToEdit.id, expected_revision: athleteToEdit.revision, first_name: field(f, 'first'), last_name: field(f, 'last'), sex: field(f, 'sex') || null })}>
            <div className="row"><label>{t("Имя")}<input name="first" required maxLength={100} defaultValue={athleteToEdit.first_name} /></label><label>{t("Фамилия")}<input name="last" maxLength={100} defaultValue={athleteToEdit.last_name} /></label></div>
            <label>{t("Пол")}<select name="sex" defaultValue={athleteToEdit.sex === 'M' || athleteToEdit.sex === 'F' ? athleteToEdit.sex : ''}><option value="">{t("Не указан")}</option><option value="M">{t("Мужской")}</option><option value="F">{t("Женский")}</option></select></label>
            <p className="muted">{t("Фамилию можно добавить позже.")}</p>
          </ActionForm>}
        </details>
        <details className="card"><summary>{t("Добавить спортсмена")}</summary><ActionForm disabled={busy} label={t("Добавить")} onSubmit={f => command('CREATE_ATHLETE', { first_name: field(f, 'first'), last_name: field(f, 'last'), birth_date: field(f, 'birth') || null, sex: field(f, 'sex') || null })}><div className="row"><label>{t("Имя")}<input name="first" required maxLength={100} /></label><label>{t("Фамилия")}<input name="last" maxLength={100} /></label></div><div className="row"><label>{t("Дата рождения")}<input name="birth" type="date" /></label><label>{t("Пол")}<select name="sex"><option value="">{t("Не указан")}</option><option value="M">{t("Мужской")}</option><option value="F">{t("Женский")}</option></select></label></div><p className="muted">{t("Фамилию можно добавить позже.")} {t("Дата рождения доступна тренерам и самому спортсмену.")}</p></ActionForm></details>
      </>}
      {visibleTab === 'catalog' && staff && <>
        <h2>{t("Тесты")}</h2>
        <div className="cards"><section className="card">
          <h3>{t("Контрольные тесты")}</h3>
          <ul className="test-catalog">{sortedDefinitions.map(d => <li key={d.id}><span>{category(d.id)}</span><button className="danger" disabled={busy} onClick={async () => {
            if (!db || !clubId || !window.confirm(t("Удалить этот тест из каталога? Его результаты останутся в журнале."))) return;
            setBusy(true); setError('');
            try {
              const { error: archiveError } = await db.rpc('archive_test_definition', { p_club: clubId, p_definition: d.id, p_reason: 'Удаление теста из каталога по запросу администратора или тренера' });
              if (archiveError) throw new Error(archiveError.message);
              const [updatedBase, updatedHistory] = await Promise.all([fetchBase(db, clubId), fetchHistory(db, clubId)]);
              setBase(updatedBase); setHistorySource(updatedHistory); setMessage("Тест удалён из каталога.");
            } catch (err) { setError(friendlyError(err)); }
            finally { setBusy(false); }
          }}>{t("Удалить")}</button></li>)}</ul>
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
      {visibleTab === 'events' && <label>{t("Выбрать старт")}<select value={eventId} disabled={busy} onChange={e => setEventId(e.target.value)}><option value="">{t("Выбери старт")}</option>{sortedEvents.map(e => <option key={e.id} value={e.id}>{eventLabel(e)}</option>)}</select></label>}
      {visibleTab === 'rating' && <>
        <label>{t("Выбрать старт")}<select value={ratingSelection} disabled={busy || baseLoading} onChange={e => setRatingSelection(e.target.value)}>
          <option value="__ALL_HISTORY__">{t("Результаты за всю историю")}</option>
          {ratingGroups.map(group => <option key={group.key} value={group.key}>{dateLabel(group.date)} — {t(group.discipline === 'SWIMMING' ? 'Плавание' : group.discipline === 'RUNNING' ? 'Бег' : group.discipline === 'TRIATHLON' ? 'Триатлон' : group.discipline)} · {group.discipline === 'TRIATHLON' ? group.distance / 1000 : group.distance} {group.discipline === 'TRIATHLON' ? t('км') : t('м')}</option>)}
        </select></label>
        <h2>{t("Общий рейтинг")}</h2>
        {ratingSelection === '__ALL_HISTORY__' ? <>
          <section className="history-filters card"><h3>{t("Фильтры рейтинга")}</h3>
            <div className="row">
              <label>{t("Дисциплина")}<select value={historyDiscipline} onChange={e => { setHistoryDiscipline(e.target.value); setHistoryDistance(''); setHistoryType(''); }}><option value="">{t("Все дисциплины")}</option>{disciplineOptions.map(d => <option key={d} value={d}>{t(d === 'SWIMMING' ? 'Плавание' : d === 'RUNNING' ? 'Бег' : d === 'TRIATHLON' ? 'Триатлон' : d)}</option>)}</select></label>
              <label>{t(historyDiscipline === 'TRIATHLON' ? "Дистанция, км" : "Дистанция, м")}<select value={historyDistance} onChange={e => { setHistoryDistance(e.target.value); setHistoryType(''); }}><option value="">{t("Все дистанции")}</option>{distanceOptions.map(d => <option key={d} value={String(d)}>{historyDiscipline === 'TRIATHLON' ? d / 1000 : d} {historyDiscipline === 'TRIATHLON' ? t("км") : t("м")}</option>)}</select></label>
              <label>{t("Пол")}<select value={historySex} onChange={e => setHistorySex(e.target.value)}><option value="">{t("Все")}</option><option value="M">{t("Мужской")}</option><option value="F">{t("Женский")}</option></select></label>
              <label>{t("Тип")}<select value={historyType} onChange={e => setHistoryType(e.target.value)}><option value="">{t("Все типы")}</option>{historyTypeOptions.map(id => <option key={id} value={id}>{category(id)}</option>)}</select></label>
              <label>{t("Спортсмен")}<select value={historyAthleteId} onChange={e => setHistoryAthleteId(e.target.value)}><option value="">{t("Все спортсмены")}</option>{historyAthletes.map(a => <option key={a.id} value={a.id}>{[a.last_name, a.first_name].filter(Boolean).join(' ')}</option>)}</select></label>
            </div>
          </section>
          {historicalTables.length > 0 && <section className="card rating-results"><table className={`rating-table${historyAthleteId ? ' athlete-rating-table' : ''}`}><thead><tr>{historyAthleteId ? <><th>{t("Тест")}</th><th>{t("Лучший результат")}</th><th>{t("Дата")}</th></> : <><th>{t("Место")}</th><th>{t("Спортсмен")}</th><th>{t("Лучший результат")}</th><th>{t("Дата")}</th></>}</tr></thead>{historicalTables.map(table => <tbody key={table.definitionId}>{!historyAthleteId && <tr className="rating-group-row"><th scope="rowgroup" colSpan={4}>{category(table.definitionId)}</th></tr>}{table.rows.map(row => <tr key={row.athleteId} className={!historyAthleteId && row.athleteId === linkedAthlete?.id ? 'own-result' : ''}>{!historyAthleteId && <td>{row.place}</td>}{!historyAthleteId && <td><RatingAthleteName firstName={row.athlete?.first_name} lastName={row.athlete?.last_name} /></td>}{historyAthleteId && <td>{category(table.definitionId)}</td>}<td className="num">{formatTime(row.timeCs)}</td><td>{dateLabel(row.date)}</td></tr>)}</tbody>)}</table></section>}
          {!historicalTables.length && <p className="empty">{t("По этим фильтрам результатов пока нет.")}</p>}
        </> : selectedRatingGroup ? <>
          {eventGroupTables.length > 0 && <section className="card rating-results"><table className="rating-table event-rating-table"><thead><tr><th>{t("Место")}</th><th>{t("Спортсмен")}</th><th>{t("Результат")}</th></tr></thead>{eventGroupTables.map(table => <tbody key={table.definitionId}><tr className="rating-group-row"><th scope="rowgroup" colSpan={3}>{category(table.definitionId)}</th></tr>{table.rows.map(row => <tr key={row.athleteId} className={row.athleteId === linkedAthlete?.id ? 'own-result' : ''}><td>{row.place}</td><td><RatingAthleteName firstName={row.athlete?.first_name} lastName={row.athlete?.last_name} /></td><td className="num">{formatTime(row.timeCs)}</td></tr>)}</tbody>)}</table></section>}
          {!eventGroupTables.length && <p className="empty">{t("Опубликованных результатов пока нет.")}</p>}
        </> : <p className="empty">{t("Выбери старт для просмотра результатов.")}</p>}
      </>}
      {visibleTab === 'events' && staff && <><h2>{t("Контрольные старты")}</h2>{!base.events.length && <div className="empty">{t("Стартов пока нет.")}{staff && <p>{t("Сначала добавь тест в разделе «Тесты», затем создай старт.")}</p>}</div>}
      {staff && <details className="card"><summary>{t("Создать контрольный старт")}</summary><ActionForm disabled={busy || !base.definitions.length} label={t("Создать старт")} onSubmit={f => command('CREATE_EVENT', { title: field(f, 'title'), definition_id: field(f, 'definition') })}><label>{t("Название")}<input name="title" required maxLength={160} placeholder={t("Контрольный старт — октябрь")} /></label><label>{t("Тест")}<select name="definition" required><option value="">{t("Выбери тест")}</option>{sortedDefinitions.map(d => <option key={d.id} value={d.id}>{category(d.id)}</option>)}</select></label></ActionForm></details>}
      {event && <div className="event-workspace"><p className="hierarchy">{t("Старт → сессия → участники и результаты")}</p><section className="card"><h2>{eventLabel(event)}</h2><p>{category(event.definition_id)}</p><span className="pill">{labels[event.lifecycle]}</span><p className="muted">{event.lifecycle === 'OPEN' ? t("Общий рейтинг предварительный — сессии ещё могут добавляться.") : t("Старт завершён. Исправления результатов сохраняются в истории.")}</p>{staff && (event.lifecycle === 'OPEN' ? <button disabled={busy} onClick={() => void statusAction('CLOSE_EVENT', event.id, event.revision)}>{t("Закрыть старт")}</button> : <ActionForm disabled={busy} label={t("Повторно открыть старт")} onSubmit={f => command('REOPEN_EVENT', { id: event.id, expected_revision: event.revision, reason: field(f, 'reason') })}><label>{t("Причина повторного открытия")}<input name="reason" required /></label></ActionForm>)}</section>
      <h2>{t("Сессии старта")}</h2>{(() => { const available = detail.sessions.filter(s => s.status !== 'CANCELLED'); const latest = available[0]; const older = available.slice(1); return <><div className="cards">{latest && <button key={latest.id} disabled={busy} className={`card ${sessionId === latest.id ? 'selected' : ''}`} onClick={() => setSessionId(latest.id)}><strong>{latest.label}</strong><p>{dateLabel(latest.scheduled_on)}{latest.scheduled_at ? ` · ${new Intl.DateTimeFormat(locale, { timeZone: club.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(latest.scheduled_at))}` : ''}</p><span className="pill">{labels[latest.status]}</span></button>}</div>{older.length > 0 && <details className="session-history"><summary>{t("Архивные сессии")} ({older.length})</summary><div className="cards">{older.map(s => <button key={s.id} disabled={busy} className={`card ${sessionId === s.id ? 'selected' : ''}`} onClick={() => setSessionId(s.id)}><strong>{s.label}</strong><p>{dateLabel(s.scheduled_on)}{s.scheduled_at ? ` · ${new Intl.DateTimeFormat(locale, { timeZone: club.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(s.scheduled_at))}` : ''}</p><span className="pill">{labels[s.status]}</span></button>)}</div></details>}</>; })()}
      {staff && event.lifecycle === 'OPEN' && <details className="card"><summary>{t("Добавить сессию")}</summary><ActionForm disabled={busy} label={t("Создать сессию")} onSubmit={f => command('CREATE_SESSION', { event_id: event.id, label: field(f, 'label'), scheduled_on: field(f, 'date'), scheduled_at: localSessionISO(field(f, 'date'), field(f, 'time'), club.timezone), group_id: null })}><label>{t("Название")}<input name="label" required maxLength={80} placeholder={t("Плавание — утро")} /></label><div className="row"><label>{t("Дата")}<input name="date" type="date" required /></label><label>{t("Время")}<input name="time" type="time" required /></label></div><p className="muted">{t("Время клуба:")} {club.timezone}.</p></ActionForm></details>}
      {session && session.status !== 'CANCELLED' && <section className="card session-workspace"><p className="section-label">{t("Сессия")}</p><h2>{session.label}</h2><p>{labels[session.status]}</p>{activeEntries.filter(sp => sp.session_id === session.id).map(sp => { const ep = detail.participants.find(p => p.id === sp.event_participant_id); const result = detail.attempts.find(a => a.session_participant_id === sp.id && a.is_current); const replacedSwim = event.title.startsWith('Архив · Триатлон · ') && event.title.endsWith('02.05.2021'); return <section className="participant" key={sp.id}><div className="participant-heading"><h3>{athleteName(ep?.athlete_id ?? null)}</h3>{session.status === 'PUBLISHED' || event.lifecycle === 'CLOSED' ? <details className="remove-form"><summary>{t("Убрать")}</summary><ActionForm disabled={busy} label={t("Убрать из сессии")} onSubmit={f => command('REMOVE_PARTICIPANT', { id: sp.id, expected_revision: sp.revision, reason: field(f, 'reason') })}><label>{t("Причина удаления участника")}<input name="reason" required maxLength={500} /></label></ActionForm></details> : <button className="remove-participant" disabled={busy} aria-label={`${t("Убрать из сессии")}: ${athleteName(ep?.athlete_id ?? null)}`} onClick={() => void command('REMOVE_PARTICIPANT', { id: sp.id, expected_revision: sp.revision })}>{t("Убрать")}</button>}</div><ResultEditor key={`${result?.id ?? sp.id}:${result?.revision ?? sp.revision}`} result={result} segments={detail.segments.filter(seg => seg.attempt_id === result?.id)} triathlon={base.definitions.find(d => d.id === event.definition_id)?.discipline === 'TRIATHLON'} replacedSwim={replacedSwim} entryId={sp.id} published={session.status === 'PUBLISHED'} canCreate={session.status === 'DRAFT' && event.lifecycle === 'OPEN'} busy={busy} command={command} /></section>; })}
      {session.status === 'DRAFT' && event.lifecycle === 'OPEN' && <><details className="add-participant"><summary>{t("Добавить участника")}</summary><ActionForm disabled={busy || !base.athletes.some(a => !registeredAthletes.has(a.id))} label={t("Добавить")} onSubmit={f => command('REGISTER_PARTICIPANT', { session_id: session.id, athlete_id: field(f, 'athlete') })}><label>{t("Спортсмен")}<select name="athlete" required><option value="">{t("Выбери спортсмена")}</option>{base.athletes.filter(a => !registeredAthletes.has(a.id)).map(a => <option key={a.id} value={a.id}>{[a.first_name, a.last_name].filter(Boolean).join(' ')}</option>)}</select></label></ActionForm></details><div className="row session-actions"><button className="primary" disabled={busy} onClick={() => void statusAction('PUBLISH_SESSION', session.id, session.revision)}>{t("Опубликовать сессию")}</button><button className="danger" disabled={busy} onClick={() => { if (window.confirm(t("Удалить черновик сессии? Результаты сохранятся для восстановления администратором."))) void statusAction('CANCEL_SESSION', session.id, session.revision); }}>{t("Удалить черновик")}</button></div></>}
      </section>}

      </div>}
      </>}
    </>}
  </div></main>;
}

function ResultEditor({ result, segments, triathlon, replacedSwim, entryId, published, canCreate, busy, command }: { result?: Row<'attempts'>; segments: Row<'attempt_segments'>[]; triathlon: boolean; replacedSwim: boolean; entryId: string; published: boolean; canCreate: boolean; busy: boolean; command: Command }) {
  const { t } = useLanguage();
  const stageLabels: Record<string, string> = { SWIM: replacedSwim ? t('Бег 2,5 км (вместо плавания)') : t('Плавание'), T1: 'T1', BIKE: t('Велосипед'), T2: 'T2', RUN: t('Бег') };
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
