-- ============================================================
-- Coordinator accounts: limited logins that can ONLY edit team
-- squads in the admin dashboard (no scores, schedule, teams, etc.)
-- Run once in the Supabase SQL Editor.
-- ============================================================

create table if not exists coordinators (
  user_id uuid primary key,
  email text,
  created_at timestamptz default now()
);
alter table coordinators enable row level security;
-- no policies => private, only reachable through the functions below

create or replace function is_coordinator() returns boolean
language sql security definer stable as $$
  select exists (select 1 from coordinators where user_id = auth.uid());
$$;
grant execute on function is_coordinator() to anon, authenticated;

-- A squad editor is either a full admin or a coordinator.
create or replace function check_squad_editor() returns void
language plpgsql security definer as $$
begin
  if auth.uid() is null
     or not (exists (select 1 from admin_users where user_id = auth.uid())
             or exists (select 1 from coordinators where user_id = auth.uid())) then
    raise exception 'Access required - sign in with an admin or coordinator account';
  end if;
end $$;

-- Allow coordinators (and admins) to save any team's squad.
create or replace function admin_save_squad(p_team_id uuid, p_players jsonb)
returns void language plpgsql security definer as $$
begin
  perform check_squad_editor();
  perform save_squad_impl(p_team_id, p_players);
end $$;

-- Admin manages coordinators (the account must be created in Supabase Auth first).
create or replace function admin_add_coordinator(p_email text) returns text
language plpgsql security definer as $$
declare v_id uuid;
begin
  perform check_admin();
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'No account with email % exists yet - create it in Authentication -> Users first', p_email;
  end if;
  insert into coordinators (user_id, email) values (v_id, lower(trim(p_email)))
  on conflict (user_id) do update set email = excluded.email;
  return p_email || ' is now a coordinator.';
end $$;

create or replace function admin_remove_coordinator(p_email text) returns text
language plpgsql security definer as $$
begin
  perform check_admin();
  delete from coordinators where lower(email) = lower(trim(p_email));
  return p_email || ' removed from coordinators.';
end $$;

create or replace function admin_list_coordinators() returns setof text
language sql security definer as $$
  select email from coordinators order by email;
$$;

grant execute on all functions in schema public to anon, authenticated;
