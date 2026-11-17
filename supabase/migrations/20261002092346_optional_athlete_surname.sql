-- An empty surname represents a genuinely unknown surname; names remain editable.
alter table public.athletes drop constraint athletes_last_name_check;
alter table public.athletes alter column last_name set default '';
