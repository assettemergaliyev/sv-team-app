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
  return <div className="brand-lockup" role="img" aria-label="SV Team â€” Triathlonâ€“Swim, Kazakhstan">
    <span className="brand-wordmark" aria-hidden="true"><span className="brand-sv">SV</span><span className="brand-team">TEAM</span></span>
    <span className="brand-discipline" aria-hidden="true">TRIATHLONâ€“SWIM</span>
    <span className="brand-country" aria-hidden="true">KAZAKHSTAN</span>
  </div>;
}

type Command = (action: string, payload: Record<string, Json>) => Promise<boolean>;
const statusLabels: Record<string, string> = { DRAFT: 'Ğ§ĞµÑ€Ğ½Ğ¾Ğ²Ğ¸Ğº', PUBLISHED: 'ĞĞ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ¾Ğ²Ğ°Ğ½Ğ°', CANCELLED: 'Ğ£Ğ´Ğ°Ğ»ĞµĞ½Ğ°', OPEN: 'Ğ¡Ñ‚Ğ°Ñ€Ñ‚ Ğ¾Ñ‚ĞºÑ€Ñ‹Ñ‚', CLOSED: 'Ğ¡Ñ‚Ğ°Ñ€Ñ‚ Ğ·Ğ°ĞºÑ€Ñ‹Ñ‚' };
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
      requests.current.delete(key); setMessage×o8ÚÚ$z{-®éÜj×/H0ªô(´-t`t`´`´-t`0®È4,têt.ôe´/4e´/t-4-H4`´-t`t`ˆ4¦ô/´`tbô¨ôbô-Ë4`t/´-4,4/H4.´-t.te´/H4`t`´,4`4`ˆ4-´,4`t,4¨ôbô-Ëˆ‚ˆKˆ´(t/´-ô-4,4`´c4.´/´/t`´`4/´.ôc4/tbô.H4`t`´,4`4`ˆˆÂˆ™[ˆˆÜ™X]HÛÛ›Û]™[‹ˆšÚÈˆ´$t,4¦ôbô.ô,4`È4`t`´,4`4`´bô/H4-´,4`t,4`È‚ˆKˆ´(t/´-ô-4,4`´c4`t-t`t`t.4cˆˆÂˆ™[ˆˆÜ™X]HÙ\ÜÚ[Ûˆ‹ˆšÚÈˆ´(t-t`t`t.4cÈ4-´,4`t,4`È‚ˆKˆ´(t/´-ô-4,4`´c4`t`´,4`4`ˆˆÂˆ™[ˆˆÜ™X]H]™[‹ˆšÚÈˆ´(t`´,4`4`ˆ4-´,4`t,4`È‚ˆKˆ´(t/´`´bô-H4-4/´.ô.4`t-t.´`ô/t-4bÎÈ4`4,4-ô-4-t.ô.4`´-t.ô.4-4/´,t,4,´.ôcôc´`´`tcÈ4,4,´`´/´/4,4`´.4aô-t`t.´.ˆˆÂˆ™[ˆˆ’[™™YÈÙˆHÙXÛÛ™ÈÙ\\˜]ÜœÈ\™HYY]]ÛX]XØ[Kˆ‹ˆšÚÈˆ´(t-t.´`ô/t-4`´bô¨È4-´«ô-ô-4-t/H4,te´`4,têt.ôe´,ôeÈ4,têt.ô,ôe´b4`´-t`4,4,´`´/´/4,4`´`´bÈ4`´«ô`4-4-H4¦ô/´`tbô.ô,4-4bËˆ‚ˆKˆ´(t/´at`4,4/t-t/t/‹ˆˆÂˆ™[ˆˆ”Ø]™Yˆ‹ˆšÚÈˆ´(t,4¦ô`´,4.ô-4bËˆ‚ˆKˆ´(t/´at`4,4/t.4`´c4.4`t/ô`4,4,´.ô-t/t.4-HˆÂˆ™[ˆˆ”Ø]™HÛÜœ™Xİ[Ûˆ‹ˆšÚÈˆ´(´«ô-ô-t`´`ô-4eˆ4`t,4¦ô`´,4`È‚ˆKˆ´(t/´at`4,4/t.4`´c4/ô/´/ôbô`´.´`ÈˆÂˆ™[ˆˆ”Ø]™H][\‹ˆšÚÈˆ´(´,4.ô/ôbô/tbô`t`´bÈ4`t,4¦ô`´,4`È‚ˆKˆ´(t/´at`4,4/tcô-t/8 )ˆˆÂˆ™[ˆˆ”Ø]š[™ø )ˆ‹ˆšÚÈˆ´(t,4¦ô`´,4.ô`ô-4,8 )ˆ‚ˆKˆ´(t/ô/´`4`´`t/4-t/t/´,ˆ4/ô/´.´,4/t-t`‹ˆ4%4/´,t,4,´c4/ô-t`4,´/´,ô/ˆ4`ôaô,4`t`´/t.4.´,ˆˆÂˆ™[ˆˆ“›È]]\ÈY]ˆY[İ\ˆš\œİ\XÚ\[ˆ‹ˆšÚÈˆ´æ4-ôe´`4,ô-H4`t/ô/´`4`´b4bô.ô,4`4-´/´¦Ëˆ4$4.ô¤ô,4b4¦ôbÈ4¦ô,4`´bô`t`ôb4bô/tbÈ4¦ô/´`tbô¨ôbô-Ëˆ‚ˆKˆ´(t/ô/´`4`´`t/4-t/tbÈˆÂˆ™[ˆˆ]]\È‹ˆšÚÈˆ´(t/ô/´`4`´b4bô.ô,4`‚ˆKˆ´(t/ô/´`4`´`t/4-t/tbÈ4.´.ô`ô,t,ˆÂˆ™[ˆˆÛXˆ]]\È‹ˆšÚÈˆ´&´.ô`ô,H4`t/ô/´`4`´b4bô.ô,4`4bÈ‚ˆKˆ´(t`´,4`4`ˆ4-ô,4,´-t`4b4dt/Kˆ4&4`t/ô`4,4,´.ô-t/t.4cÈ4`4-t-ô`ô.ôc4`´,4`´/´,ˆ4`t/´at`4,4/tcôc´`´`tcÈ4,ˆ4.4`t`´/´`4.4.ˆˆÂˆ™[ˆˆ‘]™[ÛÜÙYˆ™\İ[ÛÜœ™Xİ[ÛœÈ\™H™XÛÜ™Y[ˆ\İÜKˆ‹ˆšÚÈˆ´(t`´,4`4`ˆ4,4cô¦ô`´,4.ô-4bËˆ4'tæt`´.4-´-H4`´«ô-ô-t`´`ô.ô-t`4eˆ4`´,4`4.4at`´,4`t,4¦ô`´,4.ô,4-4bËˆ‚ˆKˆ´(t`´,4`4`´/´,ˆ4/ô/´.´,4/t-t`‹ˆˆÂˆ™[ˆˆ“›È]™[ÈY]ˆ‹ˆšÚÈˆ´æ4-ôe´`4,ô-H4`t`´,4`4`´`´,4`4-´/´¦Ëˆ‚ˆKˆ´(t`´,4`4`´bÈˆÂˆ™[ˆˆ‘]™[È‹ˆšÚÈˆ´(t`´,4`4`´`´,4`‚ˆKˆ´(t`´,4`´`ô`HˆÂˆ™[ˆˆ”İ]\È‹ˆšÚÈˆ´'4æt`4`´-t,t-H‚ˆKˆ´(t`´.4.ôc4/ô.ô,4,´,4/t.4cÈˆÂˆ™[ˆˆ”İÚ[[Z[™Èİ›ÚÙH‹ˆšÚÈˆ´%´«ô-ô`È4`t`´.4.ôeˆ‚ˆKˆ´(´-t`t`ˆˆÂˆ™[ˆˆ•\İ‹ˆšÚÈˆ´(´-t`t`ˆ‚ˆKˆ´(´-t`t`´bÈˆÂˆ™[ˆˆ•\İÈ‹ˆšÚÈˆ´(´-t`t`´`´-t`‚ˆKˆ´(È4,4.´.´,4`ô/t`´,4/t-t`ˆ4,4.´`´.4,´/t/´,ô/ˆ4-4/´`t`´`ô/ô,ˆ4'´,t`4,4`´.4`tc4.ˆ4,4-4/4.4/t.4`t`´`4,4`´/´`4`È4.´.ô`ô,t,ˆˆÂˆ™[ˆˆ–[İ\ˆXØÛİ[\È›ÈXİ]™HXØÙ\ÜËˆÛÛXİ[İ\ˆÛXˆYZ[š\İ˜]Ü‹ˆ‹ˆšÚÈˆ´$4.´.´,4`ô/t`´bô¨ôbô-ô-4,4,t-t.ô`t-t/t-4eˆ4`4¬t¦ô`t,4`ˆ4-´/´¦Ëˆ4&´.ô`ô,H4æt.´e´/4b4e´`te´/t-H4at,4,t,4`4.ô,4`tbô¨ôbô-Ëˆ‚ˆKˆ´(ô-4,4.ô.4`´c4aô-t`4/t/´,´.4.ˆˆÂˆ™[ˆˆ‘[]H˜Y‹ˆšÚÈˆ´%´/´,t,4/tbÈ4-´/´cˆ‚ˆKˆ´(ô-4,4.ô.4`´c4aô-t`4/t/´,´.4.ˆ4`t-t`t`t.4.È4(4-t-ô`ô.ôc4`´,4`´bÈ4`t/´at`4,4/tcô`´`tcÈ4-4.ôcÈ4,´/´`t`t`´,4/t/´,´.ô-t/t.4cÈ4,4-4/4.4/t.4`t`´`4,4`´/´`4/´/ˆˆÂˆ™[ˆˆ‘[]H\È˜YÙ\ÜÚ[ÛÈ™\İ[ÈÚ[™[XZ[ˆ]˜Z[X›H›ÜˆYZ[š\İ˜]Üˆ™XÛİ™\Kˆ‹ˆšÚÈˆ´(t-t`t`t.4cÈ4-´/´,t,4`tbô/H4-´/´cˆ4.´-t`4-t.ˆ4/ô-OÈ4'tæt`´.4-´-t.ô-t`4æt.´e´/4b4eˆ4¦ô,4.ô/ôbô/t,4.´-t.ô`´e´`4-H4,4.ô`ôbÈ4«ôb4e´/H4`t,4¦ô`´,4.ô,4-4bËˆ‚ˆKˆ´)4.4/t.4b4.4`4/´,´,4.ÈˆÂˆ™[ˆˆ‘š[š\ÚY‹ˆšÚÈˆ´'4æt`4-t,ô-H4-´-t`´`´eˆ‚ˆKˆ´-ô,4.´`4bô`ˆˆÂˆ™[ˆˆ˜ÛÜÙY‹ˆšÚÈˆ´-´,4,tbô¦È‚ˆKˆ´/´`´.´`4bô`ˆˆÂˆ™[ˆˆ›Ü[ˆ‹ˆšÚÈˆ´,4b4bô¦È‚ˆKˆ´/4/´`t`K´`t`HˆÂˆ™[ˆˆ›[NœÜËš‹ˆšÚÈˆ´/4/´`t`K´`t`H‚ˆKˆ´aôaÎ´/4/´`t`K´`t`HˆÂˆ™[ˆˆš›[NœÜËš‹ˆšÚÈˆ´`t`N´/4/´`t`K´`t`H‚ˆKˆ‘‘ˆ8 %4/t-H4a4.4/t.4b4.4`4/´,´,4.ÈˆÂˆ™[ˆˆ‘‘ˆ8 %Y›İš[š\Ú‹ˆšÚÈˆ‘‘ˆ8 %4/4æt`4-t,ô-H4-´-t`´/ô-t-4eˆ‚ˆKˆ‘”È8 %4/t-H4`t`´,4`4`´/´,´,4.ÈˆÂˆ™[ˆˆ‘”È8 %Y›İİ\‹ˆšÚÈˆ‘”È8 %4`t`´,4`4`´¦ô,4b4bô¦ô/ô,4-4bÈ‚ˆKˆ‘ÔH8 %4-4.4`t.´,´,4.ô.4a4.4a´.4`4/´,´,4/HˆÂˆ™[ˆˆ‘ÔH8 %\Ü]X[YšYY‹ˆšÚÈˆ‘ÔH8 %4-´,4`4bô`t`´,4/H4b4-t`´`´-t`´e´.ô-4eˆ‚ˆKˆ´'t-t,´-t`4/t,4cÈ4/ô/´aô`´,4.4.ô.4/ô,4`4/´.ôcˆˆÂˆ™[ˆˆ’[˜ÛÜœ™Xİ[XZ[Üˆ\ÜİÛÜ™ˆ‹ˆšÚÈˆ´'ô/´b4`´,4/t-t/4-t`t-H4¦ô¬t/ô.4cô`têt-È4¦ô,4`´-Kˆ‚ˆKˆ´%ô,4/ô.4`tc4`ô-´-H4.4-ô/4-t/t-t/t,ˆ4'´,t/t/´,´.4`t`´`4,4/t.4a´`È4.4/ô/´,´`´/´`4.4.4`t/ô`4,4,´.ô-t/t.4-KˆˆÂˆ™[ˆˆ•\È™XÛÜ™Ú[™ÙYˆ™[ØY[™HHÛÜœ™Xİ[ÛˆYØZ[‹ˆ‹ˆšÚÈˆ´%´,4-ô,t,4êt-ô,ô-t`4`´e´.ô,ô-t/Kˆ4$t-t`´`´eˆ4-´,4¨ô,4`4`´bô/Ë4`´«ô-ô-t`´`ô-4eˆ4¦ô,4.t`´,4.ô,4¨ôbô-Ëˆ‚ˆKˆ´$´/t-t`t.4,´`4-t/4cÈ4.´,4-´-4/´/4`È4`ôaô,4`t`´/t.4.´`È4.4.ô.4`ô,t-t`4.4-t,ô/ˆ4.4-È4`t-t`t`t.4.4/ô-t`4-t-4/ô`ô,t.ô.4.´,4a´.4-t.KˆˆÂˆ™[ˆˆ‘[\ˆH[YH›Üˆ]™\H\XÚ\[Üˆ™[[İ™H[Hœ›ÛHHÙ\ÜÚ[Ûˆ™Y›Ü™HX›\Ú[™Ëˆ‹ˆšÚÈˆ´%´,4`4.4cô.ô,4/4,4`H4,t¬t`4bô/H4æt`4¦ô,4`´bô`t`ôb4bô/tbô¨È4`ô,4¦ôbô`´bô/H4-t/t,ôe´-ôe´¨ôe´-È4/t-t/4-t`t-H4/´/tbÈ4`t-t`t`t.4cô-4,4/H4,4.ôbô/È4`´,4`t`´,4¨ôbô-Ëˆ‚ˆKˆ´(t/t,4aô,4.ô,4-4/´,t,4,´c4`ôaô,4`t`´/t.4.´/´,ˆ4.4`4-t-ô`ô.ôc4`´,4`´bËˆˆÂˆ™[ˆˆY\XÚ\[È[™™\İ[Èš\œİˆ‹ˆšÚÈˆ´$4.ô-4bô/4-t/H4¦ô,4`´bô`t`ôb4bô.ô,4`4/4-t/H4/tæt`´.4-´-t.ô-t`4-4eˆ4¦ô/´`tbô¨ôbô-Ëˆ‚ˆKˆ´'ô-t`4-t-4-ô,4.´`4bô`´.4-t/4/´/ô`ô,t.ô.4.´`ô.H4.4.ô.4`ô-4,4.ô.4/´`t`´,4,´b4.4-t`tcÈ4aô-t`4/t/´,´.4.´.ˆˆÂˆ™[ˆˆ”X›\ÚÜˆ[]H™[XZ[š[™È˜YÈ™Y›Ü™HÛÜÚ[™Ëˆ‹ˆšÚÈˆ´%´,4,t`È4,4.ô-4bô/t-4,4¦ô,4.ô¤ô,4/H4-´/´,t,4.ô,4`4-4bÈ4-´,4`4.4cô.ô,4¨ôbô-È4/t-t/4-t`t-H4-´/´.tbô¨ôbô-Ëˆ‚ˆKˆ´(ô.´,4-´.4/ô`4.4aô.4/t`È4.4`t/ô`4,4,´.ô-t/t.4cÈ4/´/ô`ô,t.ô.4.´/´,´,4/t/t/´,ô/ˆ4`4-t-ô`ô.ôc4`´,4`´,ˆˆÂˆ™[ˆˆ”›İšYHH™X\ÛÛˆ›ÜˆÛÜœ™Xİ[™ÈHX›\ÚY™\İ[ˆ‹ˆšÚÈˆ´%´,4`4.4cô.ô,4/t¤ô,4/H4/tæt`´.4-´-t/teˆ4`´«ô-ô-t`´`È4`t-t,t-t,te´/H4.´êt`4`t-t`´e´¨ôe´-Ëˆ‚ˆKˆ´'t-t`ˆ4-4/´`t`´`ô/ô,ˆ4'ô`4/´,´-t`4c4,4.´`´.4,´/t/´`t`´c4,4.´.´,4`ô/t`´,4,ˆ4.´.ô`ô,t-KˆˆÂˆ™[ˆˆXØÙ\ÜÈ[šYYˆÚXÚÈ[İ\ˆÛXˆXØÛİ[İ]\Ëˆ‹ˆšÚÈˆ´(4¬t¦ô`t,4`ˆ4-´/´¦Ëˆ4&´.ô`ô,t`´,4¤ôbÈ4,4.´.´,4`ô/t`ˆ4/4æt`4`´-t,t-t`te´/H4`´-t.´`t-t`4e´¨ôe´-Ëˆ‚ˆKˆ´+t`´/ˆ4-4-t.t`t`´,´.4-H4-4/´`t`´`ô/ô/t/ˆ4,4-4/4.4/t.4`t`´`4,4`´/´`4`ËˆˆÂˆ™[ˆˆ•\ÈXİ[Ûˆ™\]Z\™\È[ˆYZ[š\İ˜]Ü‹ˆ‹ˆšÚÈˆ´$t¬t.È4æt`4-t.´-t`ˆ4æt.´e´/4b4e´,ô-H4¦ô/´.ô-´-t`´e´/4-4e‹ˆ‚ˆKˆ´'t-H4`ô-4,4.ô/´`tc4`t,´cô-ô,4`´c4`tcÈ4`H4`t-t`4,´-t`4/´/ˆ4'ô`4/´,´-t`4c4`t/´-t-4.4/t-t/t.4-H4.4/ô/´,´`´/´`4.ˆˆÂˆ™[ˆˆÛİ[›İ™XXÚHÙ\™\‹ˆÚXÚÈ[İ\ˆÛÛ›™Xİ[Ûˆ[™™]Kˆ‹ˆšÚÈˆ´(t-t`4,´-t`4,ô-H4¦ô/´`tbô.ô`È4/4«ô/4.´e´/H4,t/´.ô/4,4-4bËˆ4$t,4.t.ô,4/tbô`t`´bÈ4`´-t.´`t-t`4e´/Ë4¦ô,4.t`´,4.ô,4¨ôbô-Ëˆ‚ˆKˆ´(´,4.´,4cÈ4-ô,4/ô.4`tc4`ô-´-H4`t`ôbt-t`t`´,´`ô-t`‹ˆ4'´,t/t/´,´.4`t/ô.4`t/´.‹ˆˆÂˆ™[ˆˆ•\È™XÛÜ™[™XYH^\İËˆ™Yœ™\ÚH\İˆ‹ˆšÚÈˆ´'4¬t/t-4,4.H4-´,4-ô,t,4,t,4`ˆ4(´e´-ôe´/4-4eˆ4-´,4¨ô,4`4`´bô¨ôbô-Ëˆ‚ˆKˆ´'ô`4/´,´-t`4c4-4,4`´`È4.4,´`4-t/4cÈ4`t-t`t`t.4.ˆˆÂˆ™[ˆˆÚXÚÈHÙ\ÜÚ[Ûˆ]H[™[YKˆ‹ˆšÚÈˆ´(t-t`t`t.4cÈ4.´«ô/teˆ4/4-t/H4`ô,4¦ôbô`´bô/H4`´-t.´`t-t`4e´¨ôe´-Ëˆ‚ˆKˆ´(´,4.´/´,ô/ˆ4/4-t`t`´/t/´,ô/ˆ4,´`4-t/4-t/t.4/t-t`ˆ4,ˆ4aô,4`t/´,´/´/4/ô/´cô`t-H4.´.ô`ô,t,ˆˆÂˆ™[ˆˆ•\ÈØØ[[YHÙ\È›İ^\İ[ˆHÛXˆ[YH›Û™Kˆ‹ˆšÚÈˆ´&´.ô`ô,t`´bô¨È4`ô,4¦ôbô`ˆ4,t-t.ô-4-t`ôe´/t-4-H4/4¬t/t-4,4.H4-´-t`4,ôe´.ôe´.´`´eˆ4`ô,4¦ôbô`ˆ4-´/´¦Ëˆ‚ˆKˆ´'ô/´-4.´.ôc´aô-t/t.4-H4.ˆ4/ô`4.4.ô/´-´-t/t.4cˆ4-tbtdH4/t-H4/t,4`t`´`4/´-t/t/‹ˆˆÂˆ™[ˆˆ•H\XØ][ÛˆÛÛ›™Xİ[Ûˆ\È›İÛÛ™šYİ\™YY]ˆ‹ˆšÚÈˆ´¦´/´.ô-4,4/t,t,4¤ô,4¦ô/´`tbô.ô`È4æt.ôeˆ4,t,4/ô`´,4.ô/4,4¤ô,4/Kˆ‚ˆKˆ´/ˆÂˆ™[ˆˆ›H‹ˆšÚÈˆ´/‚ˆKˆˆ0­È4&´`4/´.ôcˆÂˆ™[ˆˆˆ0­Èœ™Y\İ[H‹ˆšÚÈˆˆ0­È4&´`4/´.ôc‚ˆKˆˆ0­È4$t`4,4`t`HˆÂˆ™[ˆˆˆ0­Èœ™X\İİ›ÚÙH‹ˆšÚÈˆˆ0­È4$t`4,4`t`H‚ˆKˆˆ0­È4't,4`t/ô.4/t-HˆÂˆ™[ˆˆˆ0­È˜XÚÜİ›ÚÙH‹ˆšÚÈˆˆ0­È4$4`4¦ô,4/4-t/H4-´«ô-ô`È‚ˆKˆˆ0­È4$t,4`´`´-t`4a4.ôcô.HˆÂˆ™[ˆˆˆ0­È]\™›H‹ˆšÚÈˆˆ0­È4$t,4`´`´-t`4a4.ôcô.H‚ˆKˆ´(4-t.t`´.4/t,ÈˆÈ™[ˆˆ”İ[™[™ÜÈ‹šÚÈˆ´(4-t.t`´.4/t,ÈŸKˆ´$´bô,t-t`4.4`t`´,4`4`ˆ4-4.ôcÈ4/ô`4/´`t/4/´`´`4,4`4-t-ô`ô.ôc4`´,4`´/´,‹ˆˆÈ™[ˆˆ”Ù[Xİ[ˆ]™[ÈšY]È™\İ[Ëˆ‹šÚÈˆ´'tæt`´.4-´-t.ô-t`4-4eˆ4.´êt`4`È4«ôb4e´/H4`t`´,4`4`´`´bÈ4`´,4¨ô-4,4¨ôbô-ËˆŸKˆ´'4/´.4`4-t-ô`ô.ôc4`´,4`´bÈˆÈ™[ˆˆ“^H™\İ[È‹šÚÈˆ´'4-t/te´¨È4/tæt`´.4-´-t.ô-t`4e´/ŸKˆ´(t`´,4`4`ˆ8¡¤ˆ4`t-t`t`t.4cÈ8¡¤ˆ4`ôaô,4`t`´/t.4.´.4.4`4-t-ô`ô.ôc4`´,4`´bÈˆÈ™[ˆˆ‘]™[8¡¤ˆÙ\ÜÚ[Ûˆ8¡¤ˆ\XÚ\[È[™™\İ[È‹šÚÈˆ´(t`´,4`4`ˆ8¡¤ˆ4`t-t`t`t.4cÈ8¡¤ˆ4¦ô,4`´bô`t`ôb4bô.ô,4`4/4-t/H4/tæt`´.4-´-t.ô-t`ŸKˆ´(t-t`t`t.4cÈˆÈ™[ˆˆ”Ù\ÜÚ[Ûˆ‹šÚÈˆ´(t-t`t`t.4cÈŸKˆ´(ô,t`4,4`´cˆÈ™[ˆˆ”™[[İ™H‹šÚÈˆ´$4.ôbô/È4`´,4`t`´,4`ÈŸKˆ´(ô,t`4,4`´c4.4-È4`t-t`t`t.4.ˆÈ™[ˆˆ”™[[İ™Hœ›ÛHÙ\ÜÚ[Ûˆ‹šÚÈˆ´(t-t`t`t.4cô-4,4/H4,4.ôbô/È4`´,4`t`´,4`ÈŸKˆ´'ô`4.4aô.4/t,4`ô-4,4.ô-t/t.4cÈ4`ôaô,4`t`´/t.4.´,ˆÈ™[ˆˆ”™X\ÛÛˆ›Üˆ™[[İš[™ÈH\XÚ\[‹šÚÈˆ´¦´,4`´bô`t`ôb4bô/tbÈ4,4.ôbô/È4`´,4`t`´,4`È4`t-t,t-t,teˆŸKˆ´(4-t-ô`ô.ôc4`´,4`ˆ4-tbtdH4/t-H4,´/t-t`tdt/HˆÈ™[ˆˆ“›È[YH[\™YY]‹šÚÈˆ´(ô,4¦ôbô`ˆ4æt.ôeˆ4-t/t,ôe´-ôe´.ô/4-t,ô-t/HŸKˆ´$´/t-t`t`´.4,´`4-t/4cÈˆÈ™[ˆˆ‘[\ˆ[YH‹šÚÈˆ´(ô,4¦ôbô`ˆ4-t/t,ôe´-ô`ÈŸKˆ´(t/´at`4,4/t.4`´c4`4-t-ô`ô.ôc4`´,4`ˆˆÈ™[ˆˆ”Ø]™H™\İ[‹šÚÈˆ´'tæt`´.4-´-t/teˆ4`t,4¦ô`´,4`ÈŸKˆ´(4-t-ô`ô.ôc4`´,4`ˆ4`ô-´-H4,´/t-t`tdt/Kˆ4'´,t/t/´,´.4`t`´`4,4/t.4a´`È4.4.4`t/ô/´.ôc4-ô`ô.H0ªô&4-ô/4-t/t.4`´c0®ËˆˆÈ™[ˆˆH™\İ[[™XYH^\İËˆ™[ØY[™\ÙHY]ˆ‹šÚÈˆ´'tæt`´.4-´-H4-t/t,ôe´-ôe´.ô,ô-t/Kˆ4$t-t`´`´eˆ4-´,4¨ô,4`4`´bô/Ë0ªôê4-ô,ô-t`4`´`ğ®È4`´«ô.t/4-t`te´/H4/ô,4.t-4,4.ô,4/tbô¨ôbô-ËˆŸKˆ´(ôaô,4`t`´/t.4.ˆ4`ô-´-H4`ô,t`4,4/H4.4-È4`t-t`t`t.4.ˆ4'´,t/t/´,´.4`t`´`4,4/t.4a´`ËˆˆÈ™[ˆˆ•H\XÚ\[\È›ÈÛ™Ù\ˆ[ˆ\ÈÙ\ÜÚ[Û‹ˆ™[ØYHYÙKˆ‹šÚÈˆ´¦´,4`´bô`t`ôb4bÈ4`t-t`t`t.4cô-4,4/H4,4.ôbô/È4`´,4`t`´,4.ô¤ô,4/Kˆ4$t-t`´`´eˆ4-´,4¨ô,4`4`´bô¨ôbô-ËˆŸKˆ´$´`4-t/4cÈ4-4/´.ô-´/t/ˆ4,tbô`´c4,t/´.ôc4b4-H4/t`ô.ôcËˆˆÈ™[ˆˆ•[YH]\İ™HÜ™X]\ˆ[ˆ™\›Ëˆ‹šÚÈˆ´(ô,4¦ôbô`ˆ4/têt.ô-4-t/H4«ô.ô.´-t/H4,t/´.ô`ôbÈ4.´-t`4-t.‹ˆŸKˆ´(´`4.4,4`´.ô/´/HˆÈ™[ˆˆ•šX]Ûˆ‹šÚÈˆ´(´`4.4,4`´.ô/´/HŸKˆ´.´/ˆÈ™[ˆˆšÛH‹šÚÈˆ´.´/ŸKˆ´'´.ô.4/4/ô.4.t`t.´,4cÈˆÈ™[ˆˆ“Û[\XÈ‹šÚÈˆ´'´.ô.4/4/ô.4,4-4,4.ôbô¦ÈŸKˆ´(t/ô`4.4/t`ˆˆÈ™[ˆˆ”Üš[‹šÚÈˆ´(t/ô`4.4/t`ˆŸKˆ´)4/´`4/4,4`ˆ4`´`4.4,4`´.ô/´/t,ˆÈ™[ˆˆ•šX]Ûˆ›Ü›X]‹šÚÈˆ´(´`4.4,4`´.ô/´/H4a4/´`4/4,4`´bÈŸKˆ´+t`´,4/ôbÈ4`´`4.4,4`´.ô/´/t,ˆÈ™[ˆˆ•šX]ÛˆİYÙ\È‹šÚÈˆ´(´`4.4,4`´.ô/´/H4.´-t-ô-t¨ô-4-t`4eˆŸKˆ´$´-t.ô/´`t.4/ô-t-ˆÈ™[ˆˆŞXÛ[™È‹šÚÈˆ´$´-t.ô/´`t.4/ô-t-ŸKˆ´'ô`4/´,´-t`4c4,´`4-t/4cÈ4ct`´,4/ô/´,ˆ4`ô.´,4-´.4/ô/´.ô/t/´-H4,´`4-t/4cÈ4,ˆ4a4/´`4/4,4`´-H4/4/´`t`K´`t`H4.4.ô.4aôaÎ´/4/´`t`K´`t`KˆˆÈ™[ˆˆÚXÚÈXXÚİYÙH[YKˆ[\ˆH[[YH\È[NœÜËšÜˆ›[NœÜËšˆ‹šÚÈˆ´&´-t-ô-t¨È4`ô,4¦ôbô`´bô/H4`´-t.´`t-t`4e´¨ôe´-Ëˆ4(´/´.ôbô¦È4`ô,4¦ôbô`´`´bÈ4/4/´`t`K´`t`H4/t-t/4-t`t-H4aôaÎ´/4/´`t`K´`t`H4/ôe´b4e´/4e´/t-4-H4-t/t,ôe´-ôe´¨ôe´-ËˆŸBŸNÂ™^Ü[˜İ[Ûˆ˜[œÛ]J^ˆİš[™ËØØ[NˆØØ[JHÈ™]\›ˆØØ[HOOHœHˆÈ^ˆ˜[œÛ][ÛœÖİ^OË–ÛØØ[WHÏÈ^ÈB