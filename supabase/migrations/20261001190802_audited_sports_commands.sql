-- Stage 2: explicit audited commands. Private definer is not an exposed API.
alter table public.audit_log add column request_fingerprint text;
alter table public.attempt_staff_notes add column revision integer not null default 1 check(revision>0);

create function private.sv_command(p_club uuid,p_action text,p_payload jsonb,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := auth.uid(); v_role text; v_id uuid; v_event uuid; v_session uuid;
 v_before jsonb; v_after jsonb; v_result jsonb; v_entity text; v_visibility text := 'SPORTS';
 v_reason text := nullif(btrim(p_payload->>'reason'),''); v_fingerprint text;
 v_log public.audit_log; v_e public.test_events; v_s public.test_sessions;
 v_a public.attempts; v_person public.athletes; v_m public.club_users;
 v_ep uuid; v_sp uuid; v_expected integer; v_birth date;
begin
 if v_user is null or p_club is null or p_request is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then
  raise exception 'Authenticated user, club, object payload and request ID required' using errcode='22023';
 end if;
 -- Club mutex serializes mutations including changes of access. MVP trade-off:
 -- prevents role revocation and result writes from racing; revisit for high traffic.
 perform 1 from public.clubs where id=p_club for update;
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
 select role into v_role from public.club_users where club_id=p_club and user_id=v_user and access_status='ACTIVE';
 if v_role is null or v_role not in ('ADMIN','COACH') then raise exception 'Access denied' using errcode='42501'; end if;
 if p_action in ('SET_MEMBER','LINK_ATHLETE_ACCOUNT','RESTORE_SESSION') and v_role<>'ADMIN' then
  raise exception 'Admin required' using errcode='42501';
 end if;
 if p_action not in ('CREATE_ATHLETE','UPDATE_ATHLETE','CREATE_GROUP','CREATE_DEFINITION','CREATE_EVENT','CREATE_SESSION','REGISTER_PARTICIPANT','SAVE_ATTEMPT','PUBLISH_SESSION','CANCEL_SESSION','RESTORE_SESSION','CLOSE_EVENT','REOPEN_EVENT','UPDATE_EVENT_TITLE','SET_MEMBER','LINK_ATHLETE_ACCOUNT','ADD_GROUP_MEMBERSHIP','SET_STAFF_NOTE') then
  raise exception 'Unsupported action' using errcode='22023';
 end if;
 v_fingerprint := md5(p_action || ':' || p_payload::text);
 select * into v_log from public.audit_log where club_id=p_club and request_id=p_request;
 if found then
  if v_log.actor_id<>v_user or v_log.action<>p_action or v_log.request_fingerprint<>v_fingerprint then
   raise exception 'Request ID already used for a different command' using errcode='22023';
  end if;
  return v_log.after_payload->'result';
 end if;
 v_expected := (p_payload->>'expected_revision')::integer;
 if p_action='CREATE_ATHLETE' then
  insert into public.athletes(club_id,first_name,last_name,sex,sport_status,created_by,updated_by)
   values(p_club,p_payload->>'first_name',p_payload->>'last_name',p_payload->>'sex',coalesce(p_payload->>'sport_status','ACTIVE'),v_user,v_user)
   returning id into v_id;
  insert into public.athlete_private(club_id,athlete_id,birth_date) values(p_club,v_id,(p_payload->>'birth_date')::date);
  v_entity:='athletes'; v_visibility:='PRIVATE';
  select to_jsonb(a) into v_after from public.athletes a where id=v_id;
  v_after:=v_after || jsonb_build_object('birth_date',p_payload->>'birth_date');
 elsif p_action='UPDATE_ATHLETE' then
  v_id:=(p_payload->>'id')::uuid; v_entity:='athletes'; v_visibility:='PRIVATE';
  select * into v_person from public.athletes where club_id=p_club and id=v_id for update;
  if not found then raise exception 'Athlete not found' using errcode='22023'; end if;
  if v_expected is null or v_expected<>v_person.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  v_before:=to_jsonb(v_person) || jsonb_build_object('birth_date',(select birth_date from public.athlete_private where club_id=p_club and athlete_id=v_id));
  update public.athletes set first_name=coalesce(p_payload->>'first_name',first_name),last_name=coalesce(p_payload->>'last_name',last_name),
   sex=case when p_payload ? 'sex' then p_payload->>'sex' else sex end,
   sport_status=coalesce(p_payload->>'sport_status',sport_status),revision=revision+1,updated_at=now(),updated_by=v_user
   where club_id=p_club and id=v_id;
  if p_payload ? 'birth_date' then
   insert into public.athlete_private(club_id,athlete_id,birth_date) values(p_club,v_id,(p_payload->>'birth_date')::date)
    on conflict(club_id,athlete_id) do update set birth_date=excluded.birth_date;
  end if;
  select to_jsonb(a) into v_after from public.athletes a where id=v_id;
  v_after:=v_after || jsonb_build_object('birth_date',(select birth_date from public.athlete_private where club_id=p_club and athlete_id=v_id));
 elsif p_action='CREATE_GROUP' then
  insert into public.sport_groups(club_id,code,name,created_by,updated_by) values(p_club,p_payload->>'code',p_payload->>'name',v_user,v_user) returning id into v_id;
  v_entity:='sport_groups'; select to_jsonb(g) into v_after from public.sport_groups g where id=v_id;
 elsif p_action='CREATE_DEFINITION' then
  insert into public.test_definitions(club_id,discipline,distance_m,stroke_code,format_code,environment_code,created_by,updated_by)
   values(p_club,p_payload->>'discipline',(p_payload->>'distance_m')::numeric,p_payload->>'stroke_code',p_payload->>'format_code',p_payload->>'environment_code',v_user,v_user) returning id into v_id;
  v_entity:='test_definitions'; select to_jsonb(d) into v_after from public.test_definitions d where id=v_id;
 elsif p_action='CREATE_EVENT' then
  insert into public.test_events(club_id,definition_id,title,created_by,updated_by) values(p_club,(p_payload->>'definition_id')::uuid,p_payload->>'title',v_user,v_user) returning id into v_id;
  v_entity:='test_events'; select to_jsonb(e) into v_after from public.test_events e where id=v_id;
 elsif p_action='CREATE_SESSION' then
  v_event:=(p_payload->>'event_id')::uuid;
  select * into v_e from public.test_events where club_id=p_club and id=v_event for update;
  if not found or v_e.lifecycle<>'OPEN' then raise exception 'Open event required' using errcode='22023'; end if;
  if p_payload->>'scheduled_at' is null or p_payload->>'scheduled_on' is null then raise exception 'Session date and time required' using errcode='22023'; end if;
  if ((p_payload->>'scheduled_at')::timestamptz at time zone (select timezone from public.clubs where id=p_club))::date<>(p_payload->>'scheduled_on')::date then
   raise exception 'Session date does not match club-local time' using errcode='22023'; end if;
  insert into public.test_sessions(club_id,event_id,scheduled_on,scheduled_at,label,group_id,created_by,updated_by)
   values(p_club,v_event,(p_payload->>'scheduled_on')::date,(p_payload->>'scheduled_at')::timestamptz,p_payload->>'label',(p_payload->>'group_id')::uuid,v_user,v_user) returning id into v_id;
  v_entity:='test_sessions'; select to_jsonb(s) into v_after from public.test_sessions s where id=v_id;
 elsif p_action='REGISTER_PARTICIPANT' then
  v_session:=(p_payload->>'session_id')::uuid;
  select event_id into v_event from public.test_sessions where club_id=p_club and id=v_session;
  select * into v_e from public.test_events where club_id=p_club and id=v_event for update;
  select * into v_s from public.test_sessions where club_id=p_club and id=v_session for update;
  if v_e.id is null or v_e.lifecycle<>'OPEN' or v_s.status<>'DRAFT' then raise exception 'Open event and draft session required' using errcode='22023'; end if;
  insert into public.event_participants(club_id,event_id,athlete_id,created_by,updated_by)
   values(p_club,v_event,(p_payload->>'athlete_id')::uuid,v_user,v_user)
   on conflict(club_id,event_id,athlete_id) do nothing;
  select id into v_ep from public.event_participants where club_id=p_club and event_id=v_event and athlete_id=(p_payload->>'athlete_id')::uuid;
  insert into public.session_participants(club_id,event_id,session_id,event_participant_id,created_by,updated_by)
   values(p_club,v_event,v_session,v_ep,v_user,v_user) on conflict(club_id,session_id,event_participant_id) do nothing;
  select id into v_id from public.session_participants where club_id=p_club and session_id=v_session and event_participant_id=v_ep;
  v_entity:='session_participants'; select to_jsonb(sp) into v_after from public.session_participants sp where id=v_id;
 elsif p_action='SAVE_ATTEMPT' then
  v_id:=(p_payload->>'id')::uuid;
  if v_id is not null then
   select * into v_a from public.attempts where club_id=p_club and id=v_id;
   if not found then raise exception 'Attempt not found' using errcode='22023'; end if;
   v_sp:=v_a.session_participant_id;
  else v_sp:=(p_payload->>'session_participant_id')::uuid; end if;
  select session_id,event_id into v_session,v_event from public.session_participants where club_id=p_club and id=v_sp;
  select * into v_e from public.test_events where club_id=p_club and id=v_event for update;
  select * into v_s from public.test_sessions where club_id=p_club and id=v_session for update;
  if v_e.id is null or v_s.id is null or v_s.status='CANCELLED' then raise exception 'Active participation required' using errcode='22023'; end if;
  if v_id is null and (v_e.lifecycle<>'OPEN' or v_s.status<>'DRAFT') then raise exception 'New attempts require open event and draft session' using errcode='22023'; end if;
  if v_id is not null then
   select * into v_a from public.attempts where club_id=p_club and id=v_id for update;
   if v_expected is null or v_expected<>v_a.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
   if v_s.status='PUBLISHED' and v_reason is null then raise exception 'Correction reason required' using errcode='22023'; end if;
   if v_s.status='PUBLISHED' and p_payload->>'status'='DRAFT' then raise exception 'Published result cannot become draft' using errcode='22023'; end if;
   v_before:=to_jsonb(v_a);
   update public.attempts set status=p_payload->>'status',time_cs=(p_payload->>'time_cs')::bigint,
    occurred_at=case when p_payload ? 'occurred_at' then (p_payload->>'occurred_at')::timestamptz else occurred_at end,
    revision=revision+1,updated_at=now(),updated_by=v_user where club_id=p_club and id=v_id;
  else
   insert into public.attempts(club_id,session_participant_id,attempt_no,status,time_cs,occurred_at,created_by,updated_by)
    values(p_club,v_sp,(p_payload->>'attempt_no')::integer,p_payload->>'status',(p_payload->>'time_cs')::bigint,(p_payload->>'occurred_at')::timestamptz,v_user,v_user) returning id into v_id;
  end if;
  v_entity:='attempts'; select to_jsonb(a) into v_after from public.attempts a where id=v_id;
 elsif p_action in ('PUBLISH_SESSION','CANCEL_SESSION','RESTORE_SESSION') then
  v_id:=(p_payload->>'id')::uuid; v_entity:='test_sessions';
  select event_id into v_event from public.test_sessions where club_id=p_club and id=v_id;
  select * into v_e from public.test_events where club_id=p_club and id=v_event for update;
  select * into v_s from public.test_sessions where club_id=p_club and id=v_id for update;
  if v_e.id is null or v_s.id is null or v_e.lifecycle<>'OPEN' then raise exception 'Open event required' using errcode='22023'; end if;
  if v_expected is null or v_expected<>v_s.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  v_before:=to_jsonb(v_s);
  if p_action='PUBLISH_SESSION' then
   if v_s.status<>'DRAFT' then raise exception 'Draft required' using errcode='22023'; end if;
   if not exists(select 1 from public.session_participants where club_id=p_club and session_id=v_id) then raise exception 'No participants' using errcode='22023'; end if;
   if exists(select 1 from public.session_participants sp where sp.club_id=p_club and sp.session_id=v_id and
    (not exists(select 1 from public.attempts a where a.club_id=p_club and a.session_participant_id=sp.id) or
     exists(select 1 from public.attempts a where a.club_id=p_club and a.session_participant_id=sp.id and a.status='DRAFT'))) then
    raise exception 'Unfinished entries prevent publication' using errcode='22023'; end if;
   update public.test_sessions set status='PUBLISHED',published_at=now(),published_by=v_user,revision=revision+1,updated_at=now(),updated_by=v_user where id=v_id;
  elsif p_action='CANCEL_SESSION' then
   if v_s.status<>'DRAFT' then raise exception 'Only draft may be deleted' using errcode='22023'; end if;
   update public.test_sessions set status='CANCELLED',revision=revision+1,updated_at=now(),updated_by=v_user where id=v_id;
  else
   if v_s.status<>'CANCELLED' or v_reason is null then raise exception 'Cancelled session and reason required' using errcode='22023'; end if;
   update public.test_sessions set status='DRAFT',revision=revision+1,updated_at=now(),updated_by=v_user where id=v_id;
  end if;
  select to_jsonb(s) into v_after from public.test_sessions s where id=v_id;
 elsif p_action in ('CLOSE_EVENT','REOPEN_EVENT','UPDATE_EVENT_TITLE') then
  v_id:=(p_payload->>'id')::uuid; v_entity:='test_events';
  select * into v_e from public.test_events where club_id=p_club and id=v_id for update;
  if not found then raise exception 'Event not found' using errcode='22023'; end if;
  if v_expected is null or v_expected<>v_e.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  v_before:=to_jsonb(v_e);
  if p_action='CLOSE_EVENT' then
   if v_e.lifecycle<>'OPEN' or not exists(select 1 from public.test_sessions where club_id=p_club and event_id=v_id and status='PUBLISHED') or
    exists(select 1 from public.test_sessions where club_id=p_club and event_id=v_id and status='DRAFT') then raise exception 'Published sessions required; finish or cancel drafts' using errcode='22023'; end if;
   update public.test_events set lifecycle='CLOSED',closed_at=now(),closed_by=v_user,revision=revision+1,updated_at=now(),updated_by=v_user where id=v_id;
  elsif p_action='REOPEN_EVENT' then
   if v_e.lifecycle<>'CLOSED' or v_reason is null then raise exception 'Closed event and reason required' using errcode='22023'; end if;
   update public.test_events set lifecycle='OPEN',closed_at=null,closed_by=null,revision=revision+1,updated_at=now(),updated_by=v_user where id=v_id;
  else
   if v_e.lifecycle='CLOSED' and v_reason is null then raise exception 'Correction reason required' using errcode='22023'; end if;
   update public.test_events set title=p_payload->>'title',revision=revision+1,updated_at=now(),updated_by=v_user where id=v_id;
  end if;
  select to_jsonb(e) into v_after from public.test_events e where id=v_id;
 elsif p_action='SET_MEMBER' then
  v_id:=(p_payload->>'user_id')::uuid; v_entity:='club_users'; v_visibility:='PRIVATE';
  select * into v_m from public.club_users where club_id=p_club and user_id=v_id for update;
  if found then
   if v_expected is null or v_expected<>v_m.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
   if v_m.role='ADMIN' and v_m.access_status='ACTIVE' and (p_payload->>'role'<>'ADMIN' or p_payload->>'access_status'<>'ACTIVE') and
    (select count(*) from public.club_users where club_id=p_club and role='ADMIN' and access_status='ACTIVE')<=1 then
    raise exception 'Cannot remove last active admin' using errcode='22023'; end if;
   v_before:=to_jsonb(v_m);
   update public.club_users set role=p_payload->>'role',access_status=p_payload->>'access_status',revision=revision+1,updated_at=now() where club_id=p_club and user_id=v_id;
  else
   insert into public.club_users(club_id,user_id,role,access_status) values(p_club,v_id,p_payload->>'role',p_payload->>'access_status');
  end if;
  select to_jsonb(m) into v_after from public.club_users m where club_id=p_club and user_id=v_id;
 elsif p_action='LINK_ATHLETE_ACCOUNT' then
  v_id:=(p_payload->>'athlete_id')::uuid; v_entity:='athlete_accounts'; v_visibility:='PRIVATE';
  insert into public.athlete_accounts(club_id,athlete_id,user_id) values(p_club,v_id,(p_payload->>'user_id')::uuid);
  v_after:=jsonb_build_object('athlete_id',v_id,'user_id',p_payload->>'user_id');
 elsif p_action='ADD_GROUP_MEMBERSHIP' then
  insert into public.athlete_group_memberships(club_id,athlete_id,group_id,valid_from,valid_to,created_by,updated_by)
   values(p_club,(p_payload->>'athlete_id')::uuid,(p_payload->>'group_id')::uuid,(p_payload->>'valid_from')::date,(p_payload->>'valid_to')::date,v_user,v_user) returning id into v_id;
  v_entity:='athlete_group_memberships'; select to_jsonb(m) into v_after from public.athlete_group_memberships m where id=v_id;
 elsif p_action='SET_STAFF_NOTE' then
  v_id:=(p_payload->>'attempt_id')::uuid; v_entity:='attempt_staff_notes';
  select to_jsonb(n) into v_before from public.attempt_staff_notes n where club_id=p_club and attempt_id=v_id for update;
  if found and (v_expected is null or v_expected<>(v_before->>'revision')::integer) then raise exception 'Revision conflict' using errcode='40001'; end if;
  insert into public.attempt_staff_notes(club_id,attempt_id,note,author_id) values(p_club,v_id,p_payload->>'note',v_user)
   on conflict(club_id,attempt_id) do update set note=excluded.note,author_id=excluded.author_id,updated_at=now(),revision=public.attempt_staff_notes.revision+1;
  select to_jsonb(n) into v_after from public.attempt_staff_notes n where club_id=p_club and attempt_id=v_id;
 end if;
 v_result:=jsonb_build_object('id',v_id,'revision',v_after->'revision');
 insert into public.audit_log(club_id,entity_type,entity_id,action,actor_id,revision_before,revision_after,visibility,reason,before_payload,after_payload,request_id,request_fingerprint)
  values(p_club,v_entity,v_id,p_action,v_user,(v_before->>'revision')::integer,(v_after->>'revision')::integer,v_visibility,v_reason,v_before,
   jsonb_build_object('record',v_after,'result',v_result),p_request,v_fingerprint);
 return v_result;
end;
$$;
revoke all on function private.sv_command(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.sv_command(uuid,text,jsonb,uuid) to authenticated;

-- Exposed entry point is invoker; all elevated work stays in the checked private routine.
create function public.sv_command(p_club uuid,p_action text,p_payload jsonb,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.sv_command(p_club,p_action,p_payload,p_request);
$$;
revoke all on function public.sv_command(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.sv_command(uuid,text,jsonb,uuid) to authenticated;

-- Explicit deny policies document the intentionally private import staging tables.
create policy no_client_access on private.import_batches for all to authenticated using(false) with check(false);
create policy no_client_access on private.source_records for all to authenticated using(false) with check(false);
create policy no_client_access on private.source_record_attempts for all to authenticated using(false) with check(false);

-- Cover every FK, including author references. Match existing leading index columns first.
do $$ declare r record; v_cols text; begin
 for r in select c.oid,c.conrelid,c.conkey,c.conname,n.nspname,t.relname from pg_constraint c
 join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
 where c.contype='f' and n.nspname in ('public','private') and not exists(
  select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and i.indpred is null
   and array(select unnest(i.indkey::smallint[]) limit cardinality(c.conkey))=c.conkey)
 loop
  select string_agg(quote_ident(a.attname),',' order by k.ord) into v_cols
  from unnest(r.conkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=r.conrelid and a.attnum=k.attnum;
  execute format('create index %I on %I.%I (%s)',r.relname||'_'||substr(md5(r.conname),1,8)||'_fk_idx',r.nspname,r.relname,v_cols);
 end loop;
end $$;
