begin;
insert into auth.users(id,email) values ('20000000-0000-4000-8000-000000000001','triathlon-segments@example.test');
insert into public.clubs(id,name,timezone) values ('20000000-0000-4000-8000-000000000010','Triathlon synthetic','Asia/Almaty');
insert into public.club_users(club_id,user_id,role,access_status) values ('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','ADMIN','ACTIVE');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare
 c uuid:='20000000-0000-4000-8000-000000000010';
 athlete uuid; definition uuid; event_id uuid; session_id uuid; participant uuid; v_attempt_id uuid; result jsonb;
 stages jsonb:=jsonb_build_array(
  jsonb_build_object('segment_code','SWIM','time_cs',7500),
  jsonb_build_object('segment_code','T1','time_cs',8200),
  jsonb_build_object('segment_code','BIKE','time_cs',215000),
  jsonb_build_object('segment_code','T2','time_cs',5000),
  jsonb_build_object('segment_code','RUN','time_cs',149000));
begin
 result:=public.sv_command(c,'CREATE_ATHLETE','{"first_name":"Stage","last_name":"Test"}',gen_random_uuid()); athlete:=(result->>'id')::uuid;
 result:=public.sv_command(c,'CREATE_DEFINITION','{"discipline":"TRIATHLON","distance_m":27500,"stroke_code":"NONE","format_code":"SPRINT","environment_code":"UNSPECIFIED"}',gen_random_uuid()); definition:=(result->>'id')::uuid;
 result:=public.sv_command(c,'CREATE_EVENT',jsonb_build_object('definition_id',definition,'title','Triathlon segment test'),gen_random_uuid()); event_id:=(result->>'id')::uuid;
 result:=public.sv_command(c,'CREATE_SESSION',jsonb_build_object('event_id',event_id,'scheduled_on','2026-10-02','scheduled_at','2026-10-02T08:00:00+05:00','label','Synthetic'),gen_random_uuid()); session_id:=(result->>'id')::uuid;
 result:=public.sv_command(c,'REGISTER_PARTICIPANT',jsonb_build_object('session_id',session_id,'athlete_id',athlete),gen_random_uuid()); participant:=(result->>'id')::uuid;
 result:=public.sv_command(c,'SAVE_RESULT',jsonb_build_object('session_participant_id',participant,'time_cs',439500,'segments',stages),gen_random_uuid()); v_attempt_id:=(result->>'id')::uuid;
 if (select count(*) from public.attempt_segments where attempt_id=v_attempt_id)<>5 then raise exception 'FAILED: all five split times should be stored'; end if;
 if (select jsonb_array_length(after_payload->'record'->'segments') from public.audit_log where entity_id=v_attempt_id order by occurred_at desc limit 1)<>5 then raise exception 'FAILED: audit stores split times'; end if;
 stages:=jsonb_set(stages,'{0,time_cs}','7600'::jsonb);
 perform public.sv_command(c,'SAVE_RESULT',jsonb_build_object('id',v_attempt_id,'expected_revision',1,'time_cs',440000,'segments',stages),gen_random_uuid());
 if (select time_cs from public.attempt_segments where attempt_id=v_attempt_id and segment_code='SWIM')<>7600 then raise exception 'FAILED: split correction'; end if;
 begin
  perform public.sv_command(c,'SAVE_RESULT',jsonb_build_object('id',v_attempt_id,'expected_revision',2,'time_cs',441000,'segments',jsonb_build_array(jsonb_build_object('segment_code','SWIM','time_cs',1),jsonb_build_object('segment_code','SWIM','time_cs',2)), 'reason','Synthetic test'),gen_random_uuid());
  raise exception 'FAILED: duplicate split should fail'; exception when invalid_parameter_value then null; end;
 if (select time_cs from public.attempt_segments where attempt_id=v_attempt_id and segment_code='SWIM')<>7600 then raise exception 'FAILED: failed update must roll back atomically'; end if;
end $$;
rollback;
