alter table public.pool_attendance
  add column if not exists is_selected boolean not null default false;

update public.pool_attendance
set is_selected = true
where is_counted and not is_selected;

create index if not exists pool_attendance_day_idx
  on public.pool_attendance(club_id, visited_on, athlete_id);

create or replace function private.pool_attendance_command(p_club uuid, p_action text, p_payload jsonb, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_athlete uuid;
  v_attendance uuid;
  v_date date;
  v_active boolean;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_entity text;
  v_log public.audit_log;
  v_fingerprint text;
  v_timezone text;
begin
  if v_user is null or p_club is null or p_request is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Authenticated user, club, object payload and request ID required' using errcode = '22023';
  end if;

  perform 1 from public.clubs where id = p_club for update;
  if not found then raise exception 'Access denied' using errcode = '42501'; end if;

  select role into v_role from public.club_users
  where club_id = p_club and user_id = v_user and access_status = 'ACTIVE';
  if v_role is null or v_role not in ('ADMIN', 'COACH') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if p_action not in ('MARK_POOL_VISIT', 'UNMARK_POOL_VISIT', 'ADD_POOL_ATTENDANCE', 'REMOVE_POOL_ATTENDANCE', 'SET_POOL_ROSTER_ACTIVE') then
    raise exception 'Unsupported pool attendance action' using errcode = '22023';
  end if;

  v_fingerprint := md5(p_action || ':' || p_payload::text);
  select * into v_log from public.audit_log where club_id = p_club and request_id = p_request;
  if found then
    if v_log.actor_id <> v_user or v_log.action <> p_action or v_log.request_fingerprint <> v_fingerprint then
      raise exception 'Request ID already used for a different command' using errcode = '22023';
    end if;
    return v_log.after_payload->'result';
  end if;

  v_athlete := (p_payload->>'athlete_id')::uuid;
  if v_athlete is null or not exists (
    select 1 from public.athletes where club_id = p_club and id = v_athlete
  ) then
    raise exception 'Athlete not found' using errcode = '22023';
  end if;

  if p_action = 'ADD_POOL_ATTENDANCE' then
    v_date := (p_payload->>'visited_on')::date;
    if v_date is null then raise exception 'Attendance date required' using errcode = '22023'; end if;
    select timezone into v_timezone from public.clubs where id = p_club;
    if v_date > (now() at time zone v_timezone)::date then
      raise exception 'Pool attendance date cannot be in the future' using errcode = '22023';
    end if;
    select id, to_jsonb(a) into v_attendance, v_before from public.pool_attendance a
      where club_id = p_club and athlete_id = v_athlete and visited_on = v_date for update;
    if v_attendance is null then
      insert into public.pool_attendance(club_id, athlete_id, visited_on, is_counted, is_selected, created_by, updated_by)
        values (p_club, v_athlete, v_date, false, true, v_user, v_user)
        returning id into v_attendance;
    else
      update public.pool_attendance
        set is_selected = true, revision = revision + 1, updated_at = now(), updated_by = v_user
        where id = v_attendance;
    end if;
    v_entity := 'pool_attendance';
    select to_jsonb(a) into v_after from public.pool_attendance a where id = v_attendance;
  elsif p_action = 'MARK_POOL_VISIT' then
    v_date := (p_payload->>'visited_on')::date;
    if v_date is null then raise exception 'Visit date required' using errcode = '22023'; end if;
    select timezone into v_timezone from public.clubs where id = p_club;
    if v_date > (now() at time zone v_timezone)::date then
      raise exception 'Pool visit date cannot be in the future' using errcode = '22023';
    end if;

    select id, to_jsonb(a) into v_attendance, v_before
    from public.pool_attendance a
    where club_id = p_club and athlete_id = v_athlete and visited_on = v_date
    for update;

    if v_attendance is null then
      insert into public.pool_attendance(club_id, athlete_id, visited_on, is_counted, is_selected, created_by, updated_by)
        values (p_club, v_athlete, v_date, true, true, v_user, v_user)
        returning id into v_attendance;
    else
      update public.pool_attendance
        set is_counted = true, is_selected = true, revision = revision + 1, updated_at = now(), updated_by = v_user
        where id = v_attendance;
    end if;
    v_entity := 'pool_attendance';
    select to_jsonb(a) into v_after from public.pool_attendance a where id = v_attendance;
  elsif p_action = 'UNMARK_POOL_VISIT' then
    v_date := (p_payload->>'visited_on')::date;
    if v_date is null then raise exception 'Visit date required' using errcode = '22023'; end if;
    select id, to_jsonb(a) into v_attendance, v_before from public.pool_attendance a
      where club_id = p_club and athlete_id = v_athlete and visited_on = v_date for update;
    if v_attendance is null then raise exception 'Pool visit not found' using errcode = '22023'; end if;
    update public.pool_attendance
      set is_counted = false, revision = revision + 1, updated_at = now(), updated_by = v_user
      where id = v_attendance;
    v_entity := 'pool_attendance';
    select to_jsonb(a) into v_after from public.pool_attendance a where id = v_attendance;
  elsif p_action = 'REMOVE_POOL_ATTENDANCE' then
    v_date := (p_payload->>'visited_on')::date;
    if v_date is null then raise exception 'Attendance date required' using errcode = '22023'; end if;
    select id, to_jsonb(a) into v_attendance, v_before from public.pool_attendance a
      where club_id = p_club and athlete_id = v_athlete and visited_on = v_date for update;
    if v_attendance is null then raise exception 'Attendance row not found' using errcode = '22023'; end if;
    update public.pool_attendance
      set is_counted = false, is_selected = false, revision = revision + 1, updated_at = now(), updated_by = v_user
      where id = v_attendance;
    v_entity := 'pool_attendance';
    select to_jsonb(a) into v_after from public.pool_attendance a where id = v_attendance;
  else
    v_active := (p_payload->>'is_active')::boolean;
    if v_active is null then raise exception 'Roster status required' using errcode = '22023'; end if;
    select to_jsonb(r) into v_before from public.pool_attendance_roster r
      where club_id = p_club and athlete_id = v_athlete for update;
    insert into public.pool_attendance_roster(club_id, athlete_id, is_active, created_by, updated_by)
      values (p_club, v_athlete, v_active, v_user, v_user)
      on conflict (club_id, athlete_id) do update
        set is_active = excluded.is_active, updated_at = now(), updated_by = v_user;
    v_entity := 'pool_attendance_roster';
    select to_jsonb(r) into v_after from public.pool_attendance_roster r
      where club_id = p_club and athlete_id = v_athlete;
  end if;

  v_result := jsonb_build_object('id', coalesce(v_attendance, v_athlete));
  insert into public.audit_log(club_id, entity_type, entity_id, action, actor_id,
      revision_before, revision_after, visibility, before_payload, after_payload, request_id, request_fingerprint)
    values (p_club, v_entity, coalesce(v_attendance, v_athlete), p_action, v_user,
      (v_before->>'revision')::integer, (v_after->>'revision')::integer, 'SPORTS', v_before,
      jsonb_build_object('record', v_after, 'result', v_result), p_request, v_fingerprint);
  return v_result;
end;
$$;

revoke all on function private.pool_attendance_command(uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function private.pool_attendance_command(uuid, text, jsonb, uuid) to authenticated;

create or replace function public.pool_attendance_command(p_club uuid, p_action text, p_payload jsonb, p_request uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.pool_attendance_command(p_club, p_action, p_payload, p_request);
$$;
revoke all on function public.pool_attendance_command(uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.pool_attendance_command(uuid, text, jsonb, uuid) to authenticated;

