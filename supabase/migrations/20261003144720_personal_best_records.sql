-- Store source-confirmed personal bests separately from event results.
-- The workbook's Boolean marker identifies one best result per athlete and test.

insert into public.test_definitions (
  club_id, discipline, distance_m, stroke_code, format_code, environment_code, is_active
)
select c.id, 'SWIMMING', 50, 'BACKSTROKE', 'INDIVIDUAL', 'UNSPECIFIED', true
from public.clubs c
where not exists (
  select 1 from public.test_definitions d
  where d.club_id = c.id
    and d.discipline = 'SWIMMING'
    and d.distance_m = 50
    and d.stroke_code = 'BACKSTROKE'
    and d.format_code = 'INDIVIDUAL'
    and d.environment_code = 'UNSPECIFIED'
);

create table public.personal_best_records (
  club_id uuid not null,
  athlete_id uuid not null,
  definition_id uuid not null,
  recorded_on date not null,
  time_cs bigint not null check (time_cs > 0),
  source_sheet text not null,
  source_row integer not null check (source_row > 1),
  imported_at timestamptz not null default now(),
  primary key (club_id, athlete_id, definition_id),
  foreign key (club_id, athlete_id) references public.athletes(club_id, id),
  foreign key (club_id, definition_id) references public.test_definitions(club_id, id)
);

alter table public.personal_best_records enable row level security;
revoke all on table public.personal_best_records from public, anon, authenticated;
grant select on table public.personal_best_records to authenticated;
create policy read_authorized on public.personal_best_records
  for select to authenticated
  using (private.has_role(club_id, array['ADMIN', 'COACH', 'ATHLETE']));

create index personal_best_records_definition_idx
  on public.personal_best_records(club_id, definition_id, athlete_id);
