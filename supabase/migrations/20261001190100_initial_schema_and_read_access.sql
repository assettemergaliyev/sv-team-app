-- Approved model 2026-10-01. Stage 1: structure, read RLS, fail-closed writes.
-- Auth users are managed by Supabase. No real data or secrets.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create extension if not exists btree_gist with schema extensions;

create table public.clubs (
id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name))>0),
timezone text not null default 'Asia/Almaty', created_at timestamptz not null default now()
);

create table public.club_users (
club_id uuid not null references public.clubs(id), user_id uuid not null references auth.users(id),
role text not null check(role in ('ADMIN','COACH','ATHLETE')),
access_status text not null default 'ACTIVE' check(access_status in ('ACTIVE','BLOCKED')),
created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
revision integer not null default 1 check(revision>0), primary key(club_id,user_id)
);

create table public.athletes (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
first_name text not null check(length(btrim(first_name))>0), last_name text not null check(length(btrim(last_name))>0), sex text check(sex in ('M','F','UNKNOWN')), sport_status text not null default 'ACTIVE' check(sport_status in ('ACTIVE','INACTIVE'))
);

create table public.athlete_private (
club_id uuid not null, athlete_id uuid not null, birth_date date,
primary key(club_id,athlete_id), foreign key(club_id,athlete_id) references public.athletes(club_id,id)
);

create table public.athlete_accounts (
club_id uuid not null, athlete_id uuid not null, user_id uuid not null,
primary key(club_id,athlete_id), unique(club_id,user_id),
foreign key(club_id,athlete_id) references public.athletes(club_id,id),
foreign key(club_id,user_id) references public.club_users(club_id,user_id)
);

create table public.sport_groups (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
code text not null check(length(btrim(code))>0), name text not null check(length(btrim(name))>0), unique(club_id,code)
);

create table public.athlete_group_memberships (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
athlete_id uuid not null, group_id uuid not null, valid_from date not null, valid_to date,
check(valid_to is null or valid_to>=valid_from),
foreign key(club_id,athlete_id) references public.athletes(club_id,id),
foreign key(club_id,group_id) references public.sport_groups(club_id,id),
exclude using gist (club_id with =, athlete_id with =, group_id with =, daterange(valid_from,valid_to,'[]') with &&)
);

create table public.test_definitions (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
discipline text not null check(length(btrim(discipline))>0), distance_m numeric(12,3) not null check(distance_m>0),
stroke_code text not null check(length(btrim(stroke_code))>0), format_code text not null check(length(btrim(format_code))>0), environment_code text not null check(length(btrim(environment_code))>0),
unique(club_id,discipline,distance_m,stroke_code,format_code,environment_code)
);

create table public.test_events (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
definition_id uuid not null, title text not null check(length(btrim(title))>0),
lifecycle text not null default 'OPEN' check(lifecycle in ('OPEN','CLOSED')), closed_at timestamptz, closed_by uuid references auth.users(id),
check((lifecycle='CLOSED' and closed_at is not null and closed_by is not null) or (lifecycle='OPEN' and closed_at is null and closed_by is null)),
foreign key(club_id,definition_id) references public.test_definitions(club_id,id)
);

create table public.test_sessions (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
event_id uuid not null, scheduled_on date not null, scheduled_at timestamptz,
label text not null, group_id uuid, status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','CANCELLED')),
published_at timestamptz, published_by uuid references auth.users(id),
check((status='PUBLISHED' and published_at is not null and published_by is not null) or (status<>'PUBLISHED' and published_at is null and published_by is null)),
foreign key(club_id,event_id) references public.test_events(club_id,id),
foreign key(club_id,group_id) references public.sport_groups(club_id,id), unique(club_id,event_id,id)
);

create table public.event_participants (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
event_id uuid not null, athlete_id uuid not null,
foreign key(club_id,event_id) references public.test_events(club_id,id), foreign key(club_id,athlete_id) references public.athletes(club_id,id),
unique(club_id,event_id,athlete_id), unique(club_id,event_id,id)
);

create table public.session_participants (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
event_id uuid not null, session_id uuid not null, event_participant_id uuid not null,
foreign key(club_id,event_id,session_id) references public.test_sessions(club_id,event_id,id),
foreign key(club_id,event_id,event_participant_id) references public.event_participants(club_id,event_id,id),
unique(club_id,session_id,event_participant_id)
);

create table public.attempts (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
session_participant_id uuid not null, attempt_no integer not null check(attempt_no>0),
status text not null default 'DRAFT' check(status in ('FINISHED','DNS','DNF','DSQ','DRAFT')), time_cs bigint, occurred_at timestamptz,
check((status='FINISHED' and time_cs is not null and time_cs>0) or (status in ('DNS','DNF','DSQ','DRAFT') and time_cs is null)),
foreign key(club_id,session_participant_id) references public.session_participants(club_id,id), unique(club_id,session_participant_id,attempt_no)
);

create table public.attempt_segments (
club_id uuid not null, attempt_id uuid not null, segment_code text not null check(segment_code in ('SWIM','T1','BIKE','T2','RUN')), time_cs bigint not null check(time_cs>=0),
primary key(club_id,attempt_id,segment_code), foreign key(club_id,attempt_id) references public.attempts(club_id,id)
);

create table public.attempt_staff_notes (
club_id uuid not null, attempt_id uuid not null, note text not null, author_id uuid not null references auth.users(id),
updated_at timestamptz not null default now(), primary key(club_id,attempt_id), foreign key(club_id,attempt_id) references public.attempts(club_id,id)
);

create table public.user_preferences (
user_id uuid primary key references auth.users(id), language text not null default 'RU' check(language in ('RU','KK','EN'))
);

create table public.invitations (
id uuid primary key default gen_random_uuid(),
club_id uuid not null references public.clubs(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
revision integer not null default 1 check (revision>0),
created_by uuid references auth.users(id),
updated_by uuid references auth.users(id),
unique(club_id,id),
intended_role text not null check(intended_role in ('ADMIN','COACH','ATHLETE')), athlete_id uuid, auth_invitation_reference text,
expires_at timestamptz not null, accepted_at timestamptz, revoked_at timestamptz,
foreign key(club_id,athlete_id) references public.athletes(club_id,id), check(accepted_at is null or revoked_at is null)
);

create table public.audit_log (
id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
entity_type text not null, entity_id uuid not null, action text not null, actor_id uuid not null references auth.users(id),
occurred_at timestamptz not null default now(), revision_before integer, revision_after integer,
visibility text not null default 'SPORTS' check(visibility in ('SPORTS','PRIVATE')),
reason text, before_payload jsonb, after_payload jsonb, request_id uuid,
unique(club_id,request_id)
);

create table private.import_batches (
id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id),
source_fingerprint text not null, mapping_version text not null,
status text not null check(status in ('PENDING','PROCESSING','COMPLETED','FAILED')), counts jsonb not null default '{}',
created_at timestamptz not null default now(), unique(club_id,id), unique(club_id,source_fingerprint,mapping_version)
);

create table private.source_records (
id uuid primary key default gen_random_uuid(), club_id uuid not null, batch_id uuid not null,
source_sheet text, source_row integer check(source_row>0), source_key text not null, raw_payload jsonb not null,
processing_status text not null check(processing_status in ('PENDING','PROCESSED','FAILED')), error text,
foreign key(club_id,batch_id) references private.import_batches(club_id,id), unique(club_id,id), unique(club_id,batch_id,source_key)
);

create table private.source_record_attempts (
club_id uuid not null, source_record_id uuid not null, attempt_id uuid not null,
primary key(club_id,source_record_id,attempt_id), foreign key(club_id,source_record_id) references private.source_records(club_id,id),
foreign key(club_id,attempt_id) references public.attempts(club_id,id)
);


-- Narrow lookup of the caller's current membership; avoids recursive club_users RLS.
create function private.has_role(p_club uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.club_users m
 where m.club_id=p_club and m.user_id=auth.uid() and m.access_status='ACTIVE' and m.role=any(p_roles));
$$;
create function private.owns_athlete(p_club uuid,p_athlete uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.has_role(p_club,array['ADMIN','COACH','ATHLETE']) and exists(
 select 1 from public.athlete_accounts a where a.club_id=p_club and a.athlete_id=p_athlete and a.user_id=auth.uid());
$$;
create function private.participant_is_published(p_club uuid,p_participant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.has_role(p_club,array['ADMIN','COACH','ATHLETE']) and exists(
 select 1 from public.session_participants sp join public.test_sessions s on s.club_id=sp.club_id and s.id=sp.session_id
 where sp.club_id=p_club and sp.event_participant_id=p_participant and s.status='PUBLISHED');
$$;
revoke all on function private.has_role(uuid,text[]), private.owns_athlete(uuid,uuid), private.participant_is_published(uuid,uuid) from public,anon;
grant execute on function private.has_role(uuid,text[]), private.owns_athlete(uuid,uuid), private.participant_is_published(uuid,uuid) to authenticated;

alter table public.clubs enable row level security;
revoke all on table public.clubs from public,anon,authenticated;
grant select on table public.clubs to authenticated;
create policy read_authorized on public.clubs for select to authenticated using (private.has_role(id,array['ADMIN','COACH','ATHLETE']));

alter table public.club_users enable row level security;
revoke all on table public.club_users from public,anon,authenticated;
grant select on table public.club_users to authenticated;
create policy read_authorized on public.club_users for select to authenticated using (user_id=(select auth.uid()) or private.has_role(club_id,array['ADMIN','COACH']));

alter table public.athletes enable row level security;
revoke all on table public.athletes from public,anon,authenticated;
grant select on table public.athletes to authenticated;
create policy read_authorized on public.athletes for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH','ATHLETE']));

alter table public.athlete_private enable row level security;
revoke all on table public.athlete_private from public,anon,authenticated;
grant select on table public.athlete_private to authenticated;
create policy read_authorized on public.athlete_private for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH']) or private.owns_athlete(club_id,athlete_id));

alter table public.athlete_accounts enable row level security;
revoke all on table public.athlete_accounts from public,anon,authenticated;
grant select on table public.athlete_accounts to authenticated;
create policy read_authorized on public.athlete_accounts for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH']) or (user_id=(select auth.uid()) and private.has_role(club_id,array['ADMIN','COACH','ATHLETE'])));

alter table public.sport_groups enable row level security;
revoke all on table public.sport_groups from public,anon,authenticated;
grant select on table public.sport_groups to authenticated;
create policy read_authorized on public.sport_groups for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH','ATHLETE']));

alter table public.athlete_group_memberships enable row level security;
revoke all on table public.athlete_group_memberships from public,anon,authenticated;
grant select on table public.athlete_group_memberships to authenticated;
create policy read_authorized on public.athlete_group_memberships for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH','ATHLETE']));

alter table public.test_definitions enable row level security;
revoke all on table public.test_definitions from public,anon,authenticated;
grant select on table public.test_definitions to authenticated;
create policy read_authorized on public.test_definitions for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH','ATHLETE']));

alter table public.test_events enable row level security;
revoke all on table public.test_events from public,anon,authenticated;
grant select on table public.test_events to authenticated;
create policy read_authorized on public.test_events for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH']) or (private.has_role(club_id,array['ADMIN','COACH','ATHLETE']) and exists(select 1 from public.test_sessions s where s.club_id=test_events.club_id and s.event_id=test_events.id and s.status='PUBLISHED')));

alter table public.test_sessions enable row level security;
revoke all on table public.test_sessions from public,anon,authenticated;
grant select on table public.test_sessions to authenticated;
create policy read_authorized on public.test_sessions for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH']) or (private.has_role(club_id,array['ADMIN','COACH','ATHLETE']) and status='PUBLISHED'));

alter table public.event_participants enable row level security;
revoke all on table public.event_participants from public,anon,authenticated;
grant select on table public.event_participants to authenticated;
create policy read_authorized on public.event_participants for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH']) or private.participant_is_published(club_id,id));

alter table public.session_participants enable row level security;
revoke all on table public.session_participants from public,anon,authenticated;
grant select on table public.session_participants to authenticated;
create policy read_authorized on public.session_participants for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH']) or (private.has_role(club_id,array['ADMIN','COACH','ATHLETE']) and exists(select 1 from public.test_sessions s where s.club_id=session_participants.club_id and s.id=session_participants.session_id and s.status='PUBLISHED')));

alter table public.attempts enable row level security;
revoke all on table public.attempts from public,anon,authenticated;
grant select on table public.attempts to authenticated;
create policy read_authorized on public.attempts for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH']) or (private.has_role(club_id,array['ADMIN','COACH','ATHLETE']) and exists(select 1 from public.session_participants sp where sp.club_id=attempts.club_id and sp.id=attempts.session_participant_id)));

alter table public.attempt_segments enable row level security;
revoke all on table public.attempt_segments from public,anon,authenticated;
grant select on table public.attempt_segments to authenticated;
create policy read_authorized on public.attempt_segments for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH']) or (private.has_role(club_id,array['ADMIN','COACH','ATHLETE']) and exists(select 1 from public.attempts a where a.club_id=attempt_segments.club_id and a.id=attempt_segments.attempt_id)));

alter table public.attempt_staff_notes enable row level security;
revoke all on table public.attempt_staff_notes from public,anon,authenticated;
grant select on table public.attempt_staff_notes to authenticated;
create policy read_authorized on public.attempt_staff_notes for select to authenticated using (private.has_role(club_id,array['ADMIN','COACH']));

alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from public,anon,authenticated;
grant select on table public.user_preferences to authenticated;
create policy read_authorized on public.user_preferences for select to authenticated using (user_id=(select auth.uid()));

alter table public.invitations enable row level security;
revoke all on table public.invitations from public,anon,authenticated;
grant select on table public.invitations to authenticated;
create policy read_authorized on public.invitations for select to authenticated using (private.has_role(club_id,array['ADMIN']) or (private.has_role(club_id,array['ADMIN','COACH']) and intended_role='ATHLETE'));

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from public,anon,authenticated;
grant select on table public.audit_log to authenticated;
create policy read_authorized on public.audit_log for select to authenticated using (private.has_role(club_id,array['ADMIN']) or (private.has_role(club_id,array['ADMIN','COACH']) and visibility='SPORTS'));

alter table private.import_batches enable row level security;
revoke all on table private.import_batches from public,anon,authenticated;
-- No client grant: import uses a dedicated authorized server operation in stage 2.

alter table private.source_records enable row level security;
revoke all on table private.source_records from public,anon,authenticated;
-- No client grant: import uses a dedicated authorized server operation in stage 2.

alter table private.source_record_attempts enable row level security;
revoke all on table private.source_record_attempts from public,anon,authenticated;
-- No client grant: import uses a dedicated authorized server operation in stage 2.


grant insert,update on public.user_preferences to authenticated;
create policy insert_own on public.user_preferences for insert to authenticated with check(user_id=(select auth.uid()));
create policy update_own on public.user_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Revisions change only through later audited commands. No generic sports write grants.
create view public.event_leaderboard with (security_invoker=true) as
with best as (
 select ep.club_id,ep.event_id,ep.athlete_id,min(a.time_cs) as best_time_cs
 from public.event_participants ep join public.session_participants sp
 on sp.club_id=ep.club_id and sp.event_participant_id=ep.id and sp.event_id=ep.event_id
 join public.test_sessions s on s.club_id=sp.club_id and s.id=sp.session_id and s.event_id=sp.event_id
 join public.attempts a on a.club_id=sp.club_id and a.session_participant_id=sp.id
 where s.status='PUBLISHED' and a.status='FINISHED'
 group by ep.club_id,ep.event_id,ep.athlete_id
)
select *,dense_rank() over(partition by club_id,event_id order by best_time_cs) as place from best;
revoke all on public.event_leaderboard from public,anon,authenticated;
grant select on public.event_leaderboard to authenticated;

create index club_users_lookup_idx on public.club_users(user_id,club_id);

create index athlete_accounts_lookup_idx on public.athlete_accounts(user_id,club_id);

create index athlete_group_memberships_lookup_idx on public.athlete_group_memberships(club_id,group_id);

create index test_events_lookup_idx on public.test_events(club_id,definition_id);

create index test_sessions_lookup_idx on public.test_sessions(club_id,event_id,status,scheduled_at);

create index event_participants_lookup_idx on public.event_participants(club_id,athlete_id,event_id);

create index session_participants_lookup_idx on public.session_participants(club_id,event_id,event_participant_id);

create index attempts_lookup_idx on public.attempts(club_id,session_participant_id,status,time_cs);

create index invitations_lookup_idx on public.invitations(club_id,athlete_id);

create index audit_log_lookup_idx on public.audit_log(club_id,occurred_at);

create index source_record_attempts_attempt_idx on private.source_record_attempts(club_id,attempt_id);
