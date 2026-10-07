-- Keep the test catalog available for reading in ratings and event history,
-- but reserve catalog changes for club administrators.
create or replace function public.sv_command(
  p_club uuid,
  p_action text,
  p_payload jsonb,
  p_request uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_role text;
begin
  if p_action = 'CREATE_DEFINITION' then
    select role into v_role
    from public.club_users
    where club_id = p_club
      and user_id = auth.uid()
      and access_status = 'ACTIVE';
    if v_role is distinct from 'ADMIN' then
      raise exception 'Admin required' using errcode = '42501';
    end if;
  end if;

  return private.sv_command(p_club, p_action, p_payload, p_request);
end
$function$;

create or replace function public.archive_test_definition(
  p_club uuid,
  p_definition uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_before public.test_definitions;
begin
  if v_user is null or p_club is null or p_definition is null
      or nullif(btrim(p_reason), '') is null then
    raise exception 'Authenticated user, definition, club, and reason required'
      using errcode = '22023';
  end if;

  perform 1 from public.clubs where id = p_club for update;
  if not found then raise exception 'Access denied' using errcode = '42501'; end if;

  select role into v_role from public.club_users
    where club_id = p_club and user_id = v_user and access_status = 'ACTIVE';
  if v_role is distinct from 'ADMIN' then
    raise exception 'Admin required' using errcode = '42501';
  end if;

  select * into v_before from public.test_definitions
    where club_id = p_club and id = p_definition for update;
  if not found then raise exception 'Test not found' using errcode = '22023'; end if;
  if not v_before.is_active then
    return jsonb_build_object('id', p_definition, 'is_active', false);
  end if;

  update public.test_definitions
    set is_active = false, revision = revision + 1, updated_at = now(), updated_by = v_user
    where club_id = p_club and id = p_definition;
  insert into public.audit_log(
    club_id, entity_type, entity_id, action, actor_id, revision_before, revision_after,
    visibility, reason, before_payload, after_payload, request_id, request_fingerprint
  )
  values (
    p_club, 'test_definitions', p_definition, 'ARCHIVE_TEST_DEFINITION', v_user,
    v_before.revision, v_before.revision + 1, 'SPORTS', btrim(p_reason), to_jsonb(v_before),
    to_jsonb(v_before) || jsonb_build_object('is_active', false, 'revision', v_before.revision + 1),
    gen_random_uuid(), md5(p_definition::text || ':ARCHIVE_TEST_DEFINITION')
  );
  return jsonb_build_object('id', p_definition, 'is_active', false);
end
$function$;

revoke all on function public.archive_test_definition(uuid, uuid, text) from public, anon;
grant execute on function public.archive_test_definition(uuid, uuid, text) to authenticated;
