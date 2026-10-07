alter table public.invitations
  add column email text;

create unique index invitations_pending_email_idx
  on public.invitations (club_id, lower(email))
  where email is not null and accepted_at is null and revoked_at is null;
