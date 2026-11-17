alter table public.test_definitions
  add column if not exists is_active boolean not null default true;

-- These entries were duplicate or invalid catalog definitions. The associated
-- participant results were removed through the audited sports command.
update public.test_definitions
set is_active = false, revision = revision + 1, updated_at = now()
where id in (
  '9bb92afb-a7fb-5fb1-8d20-2c768e946856',
  '546fb2b6-bf29-58a8-ae78-083949f95aeb',
  'a5006dbf-6155-4c22-899c-107d99e5d75e'
);

-- The result is a backstroke test; "kick only" was an incorrect type tag.
update public.test_definitions
set format_code = 'INDIVIDUAL', revision = revision + 1, updated_at = now()
where id = '7e77a131-e2c6-55c5-87c4-f87139277540'
  and format_code = 'KICK_ONLY';

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
  if v_role not in ('ADMIN', 'COACH') then
    raise exception 'Access denied' using errcode = '42501';
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
