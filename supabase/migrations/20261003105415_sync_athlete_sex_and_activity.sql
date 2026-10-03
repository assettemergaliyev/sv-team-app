-- Historical sex values were synchronized from the private workbook into the existing athletes.sex field.
-- No roster names, identifiers, or per-athlete sex mapping are stored in the public repository.
-- Mark athletes inactive when they have no active participation in a published start during 2025–2026.
do $$
declare
  v_actor uuid;
  v_row record;
  v_before jsonb;
  v_after public.athletes%rowtype;
begin
  select cu.user_id into v_actor
  from public.club_users cu
  join public.clubs c on c.id=cu.club_id
  where c.name='SV Team' and cu.role='ADMIN' and cu.access_status='ACTIVE'
  order by cu.created_at
  limit 1;
  if v_actor is null then raise exception 'Active SV Team administrator is required for the data migration'; end if;

  for v_row in
    select a.* from public.athletes a join public.clubs c on c.id=a.club_id and c.name='SV Team'
    where a.sport_status='ACTIVE'
      and not exists (
        select 1 from public.event_participants ep
        join public.session_participants sp on sp.event_participant_id=ep.id and sp.removed_at is null
        join public.test_sessions s on s.id=sp.session_id and s.status='PUBLISHED'
        where ep.athlete_id=a.id and s.scheduled_on between date '2025-01-01' and least(date '2026-12-31',current_date)
      )
  loop
    v_before:=to_jsonb(v_row);
    update public.athletes set sport_status='INACTIVE',revision=revision+1,updated_at=now(),updated_by=v_actor where id=v_row.id returning * into v_after;
    insert into public.audit_log(club_id,entity_type,entity_id,action,actor_id,revision_before,revision_after,visibility,reason,before_payload,after_payload,request_id)
    values(v_after.club_id,'athletes',v_after.id,'UPDATE_ATHLETE',v_actor,v_row.revision,v_after.revision,'PRIVATE','No published participation in 2025–2026',v_before,jsonb_build_object('record',to_jsonb(v_after),'participation_window',format('2025-01-01 through %s',least(date '2026-12-31',current_date))),gen_random_uuid());
  end loop;
end $$;
