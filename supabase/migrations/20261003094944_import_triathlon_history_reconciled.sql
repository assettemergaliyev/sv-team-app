-- Import triathlon totals and identifiable split times from the staged 2021–2022 source.
-- The 20 duplicate 2.5 km/5 km run rows on 2021-05-02 remain staged for review.
do $$
declare
 v_batch uuid;
 v_club uuid;
 v_admin uuid;
begin
 select id,club_id into v_batch,v_club from private.import_batches
 where source_fingerprint='776160305db964e6f10fb8becddc2fe67f4a473ac17cbe14c458cbb8d10e8299' and status='PENDING' and (counts->>'pending')::integer>0;
 if v_batch is null then raise exception 'Historical source batch is missing'; end if;
 if exists(select 1 from public.test_events where club_id=v_club and title like 'Архив · Триатлон · %') then
  raise exception 'Triathlon archive was already imported';
 end if;
 select user_id into v_admin from public.club_users where club_id=v_club and role='ADMIN' and access_status='ACTIVE' order by created_at limit 1;

 create temporary table tri_source on commit drop as
 select r.id source_record_id, r.raw_payload->>'date' event_date,
        r.raw_payload->>'athlete_source_id' source_athlete_id,
        r.raw_payload#>>'{sources,0,cells,K}' course,
        r.raw_payload#>>'{sources,0,cells,G}' discipline,
        r.raw_payload#>>'{sources,0,cells,H}' source_distance,
        (r.raw_payload->>'distance_m')::numeric distance_m,
        (r.raw_payload->>'time_cs')::bigint time_cs,
        (roster.raw_payload->>'athlete_id')::uuid athlete_id
 from private.source_records r
 join private.source_records roster on roster.club_id=r.club_id and roster.source_sheet='ID'
   and roster.raw_payload->>'source_id'=r.raw_payload->>'athlete_source_id'
 where r.batch_id=v_batch and r.processing_status='PENDING';

 insert into public.test_definitions(club_id,discipline,distance_m,stroke_code,format_code,environment_code,created_by,updated_by)
 select distinct v_club,'TRIATHLON',distance_m,'NONE',upper(course),'UNSPECIFIED',v_admin,v_admin
 from tri_source where discipline in ('Sprint','Olympic')
 on conflict(club_id,discipline,distance_m,stroke_code,format_code,environment_code) do nothing;

 insert into public.test_events(club_id,definition_id,title,lifecycle,created_by,updated_by)
 select v_club,d.id,'Архив · Триатлон · '||s.course||' · '||to_char(s.event_date::date,'DD.MM.YYYY'),'OPEN',v_admin,v_admin
 from (select distinct event_date,course,distance_m from tri_source where discipline in ('Sprint','Olympic')) s
 join public.test_definitions d on d.club_id=v_club and d.discipline='TRIATHLON' and d.distance_m=s.distance_m and d.format_code=upper(s.course)
 where not exists(select 1 from public.test_events e where e.club_id=v_club and e.title='Архив · Триатлон · '||s.course||' · '||to_char(s.event_date::date,'DD.MM.YYYY'));

 insert into public.test_sessions(club_id,event_id,scheduled_on,label,status,published_at,published_by,created_by,updated_by)
 select v_club,e.id,s.event_date::date,'Архив', 'PUBLISHED', now(),v_admin,v_admin,v_admin
 from (select distinct event_date,course,distance_m from tri_source where discipline in ('Sprint','Olympic')) s
 join public.test_events e on e.club_id=v_club and e.title='Архив · Триатлон · '||s.course||' · '||to_char(s.event_date::date,'DD.MM.YYYY')
 where not exists(select 1 from public.test_sessions x where x.club_id=v_club and x.event_id=e.id and x.label='Архив');

 create temporary table tri_totals on commit drop as
 select src.source_record_id,src.event_date,src.source_athlete_id,src.course,src.distance_m,src.time_cs,src.athlete_id,
        e.id event_id,s.id session_id
 from tri_source src
 join public.test_events e on e.club_id=v_club and e.title='Архив · Триатлон · '||src.course||' · '||to_char(src.event_date::date,'DD.MM.YYYY')
 join public.test_sessions s on s.club_id=v_club and s.event_id=e.id and s.label='Архив'
 where src.discipline in ('Sprint','Olympic');

 insert into public.event_participants(club_id,event_id,athlete_id,created_by,updated_by)
 select distinct v_club,event_id,athlete_id,v_admin,v_admin from tri_totals
 on conflict(club_id,event_id,athlete_id) do nothing;
 insert into public.session_participants(club_id,event_id,session_id,event_participant_id,created_by,updated_by)
 select distinct v_club,t.event_id,t.session_id,ep.id,v_admin,v_admin
 from tri_totals t join public.event_participants ep on ep.club_id=v_club and ep.event_id=t.event_id and ep.athlete_id=t.athlete_id
 on conflict(club_id,session_id,event_participant_id) do nothing;

 create temporary table tri_attempt_map on commit drop as
 select t.source_record_id,t.event_date,t.source_athlete_id,t.course,t.event_id,t.session_id,sp.id session_participant_id,
        gen_random_uuid() attempt_id,t.time_cs
 from tri_totals t join public.event_participants ep on ep.club_id=v_club and ep.event_id=t.event_id and ep.athlete_id=t.athlete_id
 join public.session_participants sp on sp.club_id=v_club and sp.event_id=t.event_id and sp.session_id=t.session_id and sp.event_participant_id=ep.id;

 insert into public.attempts(id,club_id,session_participant_id,attempt_no,status,time_cs,created_by,updated_by,is_current)
 select attempt_id,v_club,session_participant_id,1,'FINISHED',time_cs,v_admin,v_admin,true from tri_attempt_map;

 insert into public.attempt_segments(club_id,attempt_id,segment_code,time_cs)
 select v_club,m.attempt_id,case src.discipline when 'Плавание' then 'SWIM' when 'Вело' then 'BIKE' when 'Т1' then 'T1' when 'Т2' then 'T2' when 'Бег' then 'RUN' end,src.time_cs
 from tri_source src join tri_attempt_map m on m.event_date=src.event_date and m.source_athlete_id=src.source_athlete_id and m.course=src.course
 where src.discipline in ('Плавание','Вело','Т1','Т2','Бег')
   and not (src.event_date='2021-05-02' and src.discipline='Бег');

 insert into private.source_record_attempts(club_id,source_record_id,attempt_id)
 select v_club,m.source_record_id,m.attempt_id from tri_attempt_map m
 union all
 select v_club,src.source_record_id,m.attempt_id from tri_source src join tri_attempt_map m on m.event_date=src.event_date and m.source_athlete_id=src.source_athlete_id and m.course=src.course
 where src.discipline in ('Плавание','Вело','Т1','Т2','Бег')
   and not (src.event_date='2021-05-02' and src.discipline='Бег');

 update private.source_records r set processing_status='PROCESSED',error=null
 where r.batch_id=v_batch and exists(select 1 from tri_attempt_map m where m.source_record_id=r.id);
 update private.source_records r set processing_status='PROCESSED',error=null
 where r.batch_id=v_batch and r.processing_status='PENDING'
   and r.raw_payload->>'date' <> '2021-05-02'
   and r.raw_payload#>>'{sources,0,cells,G}' in ('Плавание','Вело','Т1','Т2','Бег');
 update private.source_records r set processing_status='PROCESSED',error=null
 where r.batch_id=v_batch and r.processing_status='PENDING' and r.raw_payload->>'date'='2021-05-02'
   and r.raw_payload#>>'{sources,0,cells,G}' in ('Вело','Т1','Т2');
 update private.source_records r set error='Two different running distances (2.5 km and 5 km) are listed for the same sprint; stage mapping needs confirmation.'
 where r.batch_id=v_batch and r.processing_status='PENDING' and r.raw_payload->>'date'='2021-05-02'
   and r.raw_payload#>>'{sources,0,cells,G}'='Бег';

 update public.test_events e set lifecycle='CLOSED',closed_at=now(),closed_by=v_admin,revision=revision+1,updated_at=now(),updated_by=v_admin
 where e.club_id=v_club and e.title like 'Архив · Триатлон · %';
 update private.import_batches b set status='PENDING',counts=jsonb_build_object('pending',(
   select count(*) from private.source_records r where r.batch_id=v_batch and r.processing_status='PENDING'),
   'processed',(select count(*) from private.source_records r where r.batch_id=v_batch and r.processing_status='PROCESSED'))
 where b.id=v_batch;
end $$;
