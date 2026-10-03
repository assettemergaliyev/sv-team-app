-- The user clarified that the 2.5 km run on 2021-05-02 replaced the cancelled swim.
-- Keep the measured replacement time under SWIM (the missing triathlon stage),
-- and keep the 5 km time under RUN. The original source rows remain preserved.
do $$
declare
  v_batch uuid;
  v_club uuid;
  v_count integer;
begin
  select id, club_id into v_batch, v_club
  from private.import_batches
  where source_fingerprint='776160305db964e6f10fb8becddc2fe67f4a473ac17cbe14c458cbb8d10e8299'
    and mapping_version='historical-results-v1';
  if v_batch is null then raise exception 'Historical triathlon import batch is missing'; end if;

  create temporary table may2_run_map on commit drop as
  select run_row.id source_record_id,
         attempt_link.attempt_id,
         case run_row.raw_payload#>>'{sources,0,cells,H}'
           when '2,5 км' then 'SWIM'
           when '5 км' then 'RUN'
         end segment_code,
         (run_row.raw_payload->>'time_cs')::bigint time_cs
  from private.source_records run_row
  join private.source_records total_row
    on total_row.club_id=run_row.club_id
   and total_row.batch_id=run_row.batch_id
   and total_row.raw_payload->>'date'=run_row.raw_payload->>'date'
   and total_row.raw_payload->>'athlete_source_id'=run_row.raw_payload->>'athlete_source_id'
   and total_row.raw_payload#>>'{sources,0,cells,G}' in ('Sprint','Olympic')
  join private.source_record_attempts attempt_link
    on attempt_link.club_id=total_row.club_id and attempt_link.source_record_id=total_row.id
  where run_row.batch_id=v_batch
    and run_row.raw_payload->>'date'='2021-05-02'
    and run_row.raw_payload#>>'{sources,0,cells,G}'='Бег'
    and run_row.raw_payload#>>'{sources,0,cells,H}' in ('2,5 км','5 км');

  select count(*) into v_count from may2_run_map;
  if v_count<>20 or (select count(distinct source_record_id) from may2_run_map)<>20
     or exists(select 1 from may2_run_map where segment_code is null or time_cs<=0)
     or exists(select 1 from may2_run_map group by attempt_id,segment_code having count(*)<>1)
     or exists(select 1 from may2_run_map m join public.attempt_segments s
        on s.club_id=v_club and s.attempt_id=m.attempt_id and s.segment_code=m.segment_code) then
    raise exception 'Expected 20 unique May 2 replacement/run stage rows with no existing segment';
  end if;

  insert into public.attempt_segments(club_id,attempt_id,segment_code,time_cs)
  select v_club,attempt_id,segment_code,time_cs from may2_run_map;

  insert into private.source_record_attempts(club_id,source_record_id,attempt_id)
  select v_club,source_record_id,attempt_id from may2_run_map;

  update private.source_records r set processing_status='PROCESSED', error=null
  from may2_run_map m where r.id=m.source_record_id and r.club_id=v_club;

  update private.import_batches b set
    status=case when not exists(select 1 from private.source_records r where r.batch_id=v_batch and r.processing_status='PENDING') then 'COMPLETED' else 'PENDING' end,
    counts=jsonb_build_object(
      'pending',(select count(*) from private.source_records r where r.batch_id=v_batch and r.processing_status='PENDING'),
      'processed',(select count(*) from private.source_records r where r.batch_id=v_batch and r.processing_status='PROCESSED'))
  where b.id=v_batch;
end $$;
