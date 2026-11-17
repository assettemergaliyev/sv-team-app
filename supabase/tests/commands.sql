begin;
insert into auth.users (id,email) values ('10000000-0000-4000-8000-000000000001','sv-demo-1@example.com'),('10000000-0000-4000-8000-000000000002','sv-demo-2@example.com'),('10000000-0000-4000-8000-000000000003','sv-demo-3@example.com'),('10000000-0000-4000-8000-000000000004','sv-demo-4@example.com'),('10000000-0000-4000-8000-000000000005','sv-demo-5@example.com'),('10000000-0000-4000-8000-000000000006','sv-demo-6@example.com');
insert into public.clubs (id,name) values ('10000000-0000-4000-8000-000000000010','SV synthetic test'),('10000000-0000-4000-8000-000000000011','Other synthetic club');
insert into public.club_users (club_id,user_id,role,access_status) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','ADMIN','ACTIVE'),('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000002','COACH','ACTIVE'),('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000003','ATHLETE','ACTIVE'),('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000004','ATHLETE','BLOCKED'),('10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000006','COACH','ACTIVE');
insert into public.athletes (id,club_id,first_name,last_name) values ('10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000010','Athlete0','Demo'),('10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000010','Athlete1','Demo'),('10000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000010','Athlete2','Demo'),('10000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000010','Athlete3','Demo'),('10000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000011','Other','Club');
insert into public.athlete_private (club_id,athlete_id,birth_date) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000020','1992-04-15'),('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000021','1992-04-15'),('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000022','1992-04-15'),('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000023','1992-04-15'),('10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000024','1995-08-20');
insert into public.athlete_accounts (club_id,athlete_id,user_id) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000003'),('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000004');
insert into public.sport_groups (id,club_id,code,name) values ('10000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000010','SWIM','Swimming');
insert into public.athlete_group_memberships (club_id,athlete_id,group_id,valid_from,valid_to) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000030','2026-01-01','2026-12-31');
insert into public.test_definitions (id,club_id,discipline,distance_m,stroke_code,format_code,environment_code) values ('10000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000010','SWIMMING',50,'FREESTYLE','INDIVIDUAL','POOL'),('10000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000011','SWIMMING',50,'FREESTYLE','INDIVIDUAL','POOL');
insert into public.test_events (id,club_id,definition_id,title) values ('10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000040','Main'),('10000000-0000-4000-8000-000000000051','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000040','Draft only'),('10000000-0000-4000-8000-000000000052','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000041','Other club');
insert into public.test_sessions (id,club_id,event_id,scheduled_on,label,status,published_at,published_by) values ('10000000-0000-4000-8000-000000000060','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','2026-10-01','Morning','PUBLISHED',now(),'10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000061','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','2026-10-02','Evening','PUBLISHED',now(),'10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000062','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','2026-10-03','Draft','DRAFT',null,null),('10000000-0000-4000-8000-000000000063','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000051','2026-10-03','Other event','DRAFT',null,null),('10000000-0000-4000-8000-000000000064','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000052','2026-10-03','Other club','PUBLISHED',now(),'10000000-0000-4000-8000-000000000006');
insert into public.event_participants (id,club_id,event_id,athlete_id) values ('10000000-0000-4000-8000-000000000070','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000020'),('10000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000021'),('10000000-0000-4000-8000-000000000072','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000022'),('10000000-0000-4000-8000-000000000073','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000023'),('10000000-0000-4000-8000-000000000074','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000052','10000000-0000-4000-8000-000000000024');
insert into public.session_participants (id,club_id,event_id,session_id,event_participant_id) values ('10000000-0000-4000-8000-000000000080','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000060','10000000-0000-4000-8000-000000000070'),('10000000-0000-4000-8000-000000000081','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000061','10000000-0000-4000-8000-000000000070'),('10000000-0000-4000-8000-000000000082','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000061','10000000-0000-4000-8000-000000000071'),('10000000-0000-4000-8000-000000000083','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000061','10000000-0000-4000-8000-000000000072'),('10000000-0000-4000-8000-000000000084','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000062','10000000-0000-4000-8000-000000000071'),('10000000-0000-4000-8000-000000000085','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000062','10000000-0000-4000-8000-000000000073'),('10000000-0000-4000-8000-000000000086','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000052','10000000-0000-4000-8000-000000000064','10000000-0000-4000-8000-000000000074');
insert into public.attempts (id,club_id,session_participant_id,attempt_no,status,time_cs) values ('10000000-0000-4000-8000-000000000090','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000080',1,'FINISHED',3400),('10000000-0000-4000-8000-000000000091','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000080',2,'FINISHED',3300),('10000000-0000-4000-8000-000000000092','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000080',3,'FINISHED',3350),('10000000-0000-4000-8000-000000000093','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000081',1,'FINISHED',3250),('10000000-0000-4000-8000-000000000094','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000082',1,'FINISHED',3250),('10000000-0000-4000-8000-000000000095','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000083',1,'FINISHED',3500),('10000000-0000-4000-8000-000000000096','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000084',1,'FINISHED',3100),('10000000-0000-4000-8000-000000000097','10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000085',1,'DRAFT',null),('10000000-0000-4000-8000-000000000098','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000086',1,'FINISHED',3000);
insert into public.attempt_staff_notes (club_id,attempt_id,note,author_id) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000090','Private trainer note','10000000-0000-4000-8000-000000000002');
insert into public.audit_log (club_id,entity_type,entity_id,action,actor_id,visibility) values ('10000000-0000-4000-8000-000000000010','test_sessions','10000000-0000-4000-8000-000000000060','PUBLISH','10000000-0000-4000-8000-000000000002','SPORTS'),('10000000-0000-4000-8000-000000000010','athlete_private','10000000-0000-4000-8000-000000000020','UPDATE','10000000-0000-4000-8000-000000000001','PRIVATE');
do $$ begin begin insert into public.event_participants(club_id,event_id,athlete_id) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000020'); raise exception 'FAILED: duplicate event athlete'; exception when unique_violation then null; end; end $$;
do $$ begin begin insert into public.event_participants(club_id,event_id,athlete_id) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000024'); raise exception 'FAILED: cross club athlete'; exception when foreign_key_violation then null; end; end $$;
do $$ begin begin insert into public.session_participants(club_id,event_id,session_id,event_participant_id) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000051','10000000-0000-4000-8000-000000000063','10000000-0000-4000-8000-000000000070'); raise exception 'FAILED: cross event participation'; exception when foreign_key_violation then null; end; end $$;
do $$ begin begin insert into public.attempts(club_id,session_participant_id,attempt_no,status,time_cs) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000080',4,'FINISHED',null); raise exception 'FAILED: null finished'; exception when check_violation then null; end; end $$;
do $$ begin begin insert into public.attempts(club_id,session_participant_id,attempt_no,status,time_cs) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000080',4,'DNS',0); raise exception 'FAILED: dns zero'; exception when check_violation then null; end; end $$;
do $$ begin begin insert into public.athlete_group_memberships(club_id,athlete_id,group_id,valid_from) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000030','2026-06-01'); raise exception 'FAILED: overlap membership'; exception when exclusion_violation then null; end; end $$;

create function pg_temp.sv_assert(p_ok boolean,p_message text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'FAILED: %',p_message; end if; end $$;
with chosen as (select id,row_number() over(partition by club_id,session_participant_id order by (status='FINISHED') desc,time_cs asc nulls last,id) n from public.attempts where club_id in ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000011')) update public.attempts a set is_current=true from chosen c where a.id=c.id and c.n=1;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare
 c uuid:='10000000-0000-4000-8000-000000000010'; a uuid; g uuid; d uuid; e uuid; sessions uuid[]:='{}';
 sp uuid; at1 uuid; at2 uuid; r jsonb; r2 jsonb; req uuid; payload jsonb; i integer; v_closed timestamptz;
begin
 r:=public.sv_command(c,'CREATE_ATHLETE','{"first_name":"Demo","last_name":"Command","birth_date":"1992-04-15"}',gen_random_uuid());
 a:=(r->>'id')::uuid;
 perform pg_temp.sv_assert((select birth_date=date '1992-04-15' from public.athlete_private where athlete_id=a),'date roundtrip');
 r:=public.sv_command(c,'CREATE_GROUP','{"code":"COMMAND","name":"Command test"}',gen_random_uuid()); g:=(r->>'id')::uuid;
 r:=public.sv_command(c,'ADD_GROUP_MEMBERSHIP',jsonb_build_object('athlete_id',a,'group_id',g,'valid_from','2026-01-01'),gen_random_uuid());
 perform pg_temp.sv_assert((select count(*)=1 from public.athlete_group_memberships where athlete_id=a),'membership command');
 r:=public.sv_command(c,'UPDATE_ATHLETE',jsonb_build_object('id',a,'expected_revision',1,'birth_date','1992-04-16'),gen_random_uuid());
 perform pg_temp.sv_assert((r->>'revision')::integer=2,'athlete revision');
 begin
  perform public.sv_command(c,'UPDATE_ATHLETE',jsonb_build_object('id',a,'expected_revision',1,'first_name','Stale'),gen_random_uuid());
  raise exception 'FAILED stale athlete'; exception when serialization_failure then null; end;
 r:=public.sv_command(c,'CREATE_DEFINITION','{"discipline":"RUNNING","distance_m":1000,"stroke_code":"NONE","format_code":"INDIVIDUAL","environment_code":"TRACK"}',gen_random_uuid()); d:=(r->>'id')::uuid;
 r:=public.sv_command(c,'CREATE_EVENT',jsonb_build_object('definition_id',d,'title','Command event'),gen_random_uuid()); e:=(r->>'id')::uuid;
 for i in 1..5 loop
  r:=public.sv_command(c,'CREATE_SESSION',jsonb_build_object('event_id',e,'scheduled_on','2026-10-01','scheduled_at','2026-10-01T08:00:00+05:00','label','Session '||i,'group_id',g),gen_random_uuid());
  sessions:=array_append(sessions,(r->>'id')::uuid);
 end loop;
 perform pg_temp.sv_assert((select count(*)=5 from public.test_sessions where event_id=e),'fifth and same time sessions');
 begin
  perform public.sv_command(c,'CREATE_SESSION',jsonb_build_object('event_id',e,'scheduled_on','2026-10-02','scheduled_at','2026-10-01T08:00:00+05:00','label','Bad date'),gen_random_uuid());
  raise exception 'FAILED date mismatch'; exception when invalid_parameter_value then null; end;
 begin
  perform public.sv_command(c,'PUBLISH_SESSION',jsonb_build_object('id',sessions[1],'expected_revision',1),gen_random_uuid());
  raise exception 'FAILED empty publish'; exception when invalid_parameter_value then null; end;
 r:=public.sv_command(c,'REGISTER_PARTICIPANT',jsonb_build_object('session_id',sessions[1],'athlete_id',a),gen_random_uuid());sp:=(r->>'id')::uuid;
 r2:=public.sv_command(c,'REGISTER_PARTICIPANT',jsonb_build_object('session_id',sessions[1],'athlete_id',a),gen_random_uuid());
 perform pg_temp.sv_assert(r->>'id'=r2->>'id','duplicate participant registration');
 begin
  perform public.sv_command(c,'PUBLISH_SESSION',jsonb_build_object('id',sessions[1],'expected_revision',1),gen_random_uuid());
  raise exception 'FAILED incomplete publish'; exception when invalid_parameter_value then null; end;
 r:=public.sv_command(c,'SAVE_RESULT',jsonb_build_object('session_participant_id',sp,'time_cs',6500),gen_random_uuid());at1:=(r->>'id')::uuid;
 perform pg_temp.sv_assert((r->>'revision')::integer=1,'single result created');
 req:=gen_random_uuid(); payload:=jsonb_build_object('id',sessions[1],'expected_revision',1);
 r:=public.sv_command(c,'PUBLISH_SESSION',payload,req);r2:=public.sv_command(c,'PUBLISH_SESSION',payload,req);
 perform pg_temp.sv_assert(r=r2,'publish retry idempotent');
 perform pg_temp.sv_assert((select count(*)=1 from public.audit_log where request_id=req),'one publish audit');
 begin
  perform public.sv_command(c,'CANCEL_SESSION',payload,req);
  raise exception 'FAILED request reused'; exception when invalid_parameter_value then null; end;
 begin
  perform public.sv_command(c,'CANCEL_SESSION',jsonb_build_object('id',sessions[1],'expected_revision',2),gen_random_uuid());
  raise exception 'FAILED published delete'; exception when invalid_parameter_value then null; end;
 r:=public.sv_command(c,'REGISTER_PARTICIPANT',jsonb_build_object('session_id',sessions[2],'athlete_id',a),gen_random_uuid());sp:=(r->>'id')::uuid;
 r:=public.sv_command(c,'SAVE_RESULT',jsonb_build_object('session_participant_id',sp,'attempt_no',1,'status','FINISHED','time_cs',6300),gen_random_uuid());at2:=(r->>'id')::uuid;
 perform public.sv_command(c,'PUBLISH_SESSION',jsonb_build_object('id',sessions[2],'expected_revision',1),gen_random_uuid());
 perform pg_temp.sv_assert((select count(*)=1 from public.event_leaderboard where event_id=e),'multiple sessions single result');
 perform pg_temp.sv_assert((select best_time_cs=6300 from public.event_leaderboard where event_id=e),'best across sessions');
 begin
  perform public.sv_command(c,'CLOSE_EVENT',jsonb_build_object('id',e,'expected_revision',1),gen_random_uuid());
  raise exception 'FAILED close with drafts'; exception when invalid_parameter_value then null; end;
 for i in 3..5 loop perform public.sv_command(c,'CANCEL_SESSION',jsonb_build_object('id',sessions[i],'expected_revision',1),gen_random_uuid()); end loop;
 perform public.sv_command(c,'CLOSE_EVENT',jsonb_build_object('id',e,'expected_revision',1),gen_random_uuid());
 select closed_at into v_closed from public.test_events where id=e;
 begin
  perform public.sv_command(c,'SAVE_RESULT',jsonb_build_object('id',at2,'expected_revision',1,'status','FINISHED','time_cs',6200),gen_random_uuid());
  raise exception 'FAILED correction without reason'; exception when invalid_parameter_value then null; end;
 perform public.sv_command(c,'SAVE_RESULT',jsonb_build_object('id',at2,'expected_revision',1,'status','FINISHED','time_cs',6200,'reason','Corrected stopwatch transcription'),gen_random_uuid());
 perform pg_temp.sv_assert((select lifecycle='CLOSED' and closed_at=v_closed from public.test_events where id=e),'correction keeps event closed');
 perform pg_temp.sv_assert((select best_time_cs=6200 from public.event_leaderboard where event_id=e),'closed correction recomputes ranking');
 perform pg_temp.sv_assert((select before_payload->>'time_cs'='6300' and after_payload->'record'->>'time_cs'='6200' from public.audit_log where entity_id=at2 and before_payload is not null),'correction audit before after');
 begin
  perform public.sv_command(c,'SAVE_RESULT',jsonb_build_object('id',at2,'expected_revision',1,'status','FINISHED','time_cs',6100,'reason','Stale edit'),gen_random_uuid());
  raise exception 'FAILED revision conflict'; exception when serialization_failure then null; end;
 begin
  perform public.sv_command(c,'SAVE_RESULT',jsonb_build_object('session_participant_id',sp,'attempt_no',2,'status','FINISHED','time_cs',6100),gen_random_uuid());
  raise exception 'FAILED closed new result'; exception when serialization_failure then null; end;
 begin
  perform public.sv_command(c,'CREATE_SESSION',jsonb_build_object('event_id',e,'scheduled_on','2026-10-01','scheduled_at','2026-10-01T08:00:00+05:00','label','Closed'),gen_random_uuid());
  raise exception 'FAILED closed new session'; exception when invalid_parameter_value then null; end;
 perform public.sv_command(c,'UPDATE_EVENT_TITLE',jsonb_build_object('id',e,'expected_revision',2,'title','Corrected closed title','reason','Typo'),gen_random_uuid());
 perform pg_temp.sv_assert((select lifecycle='CLOSED' and revision=3 from public.test_events where id=e),'closed title edit');
 perform public.sv_command(c,'REOPEN_EVENT',jsonb_build_object('id',e,'expected_revision',3,'reason','Additional participants'),gen_random_uuid());
 perform pg_temp.sv_assert((select lifecycle='OPEN' and closed_at is null and closed_by is null from public.test_events where id=e),'coach reopen');
 perform public.sv_command(c,'SET_STAFF_NOTE',jsonb_build_object('attempt_id',at2,'note','Coach note'),gen_random_uuid());
 perform public.sv_command(c,'SET_STAFF_NOTE',jsonb_build_object('attempt_id',at2,'note','Coach note updated','expected_revision',1),gen_random_uuid());
 perform pg_temp.sv_assert((select revision=2 from public.attempt_staff_notes where attempt_id=at2),'note revision');
 begin
  perform public.sv_command(c,'SET_MEMBER',jsonb_build_object('user_id','10000000-0000-4000-8000-000000000005','role','ATHLETE','access_status','ACTIVE'),gen_random_uuid());
  raise exception 'FAILED coach assigns role'; exception when insufficient_privilege then null; end;
 begin
  perform public.sv_command('10000000-0000-4000-8000-000000000011','CREATE_GROUP','{"code":"HACK","name":"Denied"}',gen_random_uuid());
  raise exception 'FAILED other club write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin begin
 perform public.sv_command('10000000-0000-4000-8000-000000000010','CREATE_GROUP','{"code":"HACK","name":"Denied"}',gen_random_uuid());
 raise exception 'FAILED athlete command'; exception when insufficient_privilege then null; end;end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 begin
 perform public.sv_command('10000000-0000-4000-8000-000000000010','SET_MEMBER','{"user_id":"10000000-0000-4000-8000-000000000001","role":"COACH","access_status":"ACTIVE","expected_revision":1}',gen_random_uuid());
 raise exception 'FAILED last admin'; exception when invalid_parameter_value then null; end;
 perform public.sv_command('10000000-0000-4000-8000-000000000010','SET_MEMBER','{"user_id":"10000000-0000-4000-8000-000000000003","role":"ATHLETE","access_status":"BLOCKED","expected_revision":1}',gen_random_uuid());
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.sv_assert((select count(*)=0 from public.attempts),'admin block denies old JWT immediately');
do $$ begin begin
 perform public.sv_command('10000000-0000-4000-8000-000000000010','CREATE_GROUP','{"code":"HACK","name":"Denied"}',gen_random_uuid());
 raise exception 'FAILED blocked command'; exception when insufficient_privilege then null; end;end $$;
reset role;
set local role anon;
do $$ begin begin
 perform public.sv_command('10000000-0000-4000-8000-000000000010','CREATE_GROUP','{"code":"HACK","name":"Denied"}',gen_random_uuid());
 raise exception 'FAILED anon command'; exception when insufficient_privilege then null; end;end $$;
reset role;
rollback;
select 'Command workflow assertions passed; all synthetic rows rolled back' as test_result;
