-- ============================================================
-- European Championship Stuttgart 2026 — Database Schema (v3)
-- Run this once in the Supabase SQL Editor (paste everything).
-- Safe to re-run: it drops and recreates the app tables.
--
-- Auth model:
--   * Admin  -> Supabase Authentication (email + password).
--               The FIRST signed-in user to open /admin claims the
--               admin role automatically (claim_admin).
--   * Manager-> simple per-team password stored in team_auth,
--               set by the admin. Managers pick their team from a
--               dropdown and enter the password.
--
-- Recommended: Dashboard -> Authentication -> Sign In / Providers
-- -> Email -> turn OFF "Confirm email" so the admin account works
-- immediately after sign-up on the website.
-- ============================================================

drop table if exists lineups cascade;
drop table if exists players cascade;
drop table if exists team_auth cascade;
drop table if exists matches cascade;
drop table if exists teams cascade;
drop table if exists settings cascade;
drop table if exists app_secrets cascade;
drop table if exists admin_users cascade;

-- Old function signatures from previous schema versions
drop function if exists manager_login(text, text);
drop function if exists manager_login(uuid, text);
drop function if exists check_manager(uuid, text);
drop function if exists check_manager(uuid);
drop function if exists check_admin(text);
drop function if exists check_admin();
drop function if exists manager_save_squad(uuid, text, jsonb);
drop function if exists manager_save_squad(uuid, jsonb);
drop function if exists manager_save_lineup(uuid, text, text, text, jsonb);
drop function if exists manager_save_lineup(uuid, text, text, jsonb);
drop function if exists admin_login(text);
drop function if exists admin_change_password(text, text);
drop function if exists admin_upsert_team(text, uuid, text, text, text, int, text, text);
drop function if exists admin_upsert_team(text, uuid, text, text, text, int, text);
drop function if exists admin_delete_team(text, uuid);
drop function if exists admin_update_match(text, text, int, int, text, uuid, uuid);
drop function if exists admin_save_setting(text, text, jsonb);
drop function if exists admin_advance_knockouts(text);
drop function if exists admin_shift_schedule(text, text);
drop function if exists admin_save_squad(text, uuid, jsonb);
drop function if exists admin_save_lineup(text, uuid, text, text, jsonb);
drop function if exists admin_link_manager(text, uuid, uuid, text);

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

-- group_code/seed stay null until the group draw is made.
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  group_code text check (group_code in ('A','B','C','D')),
  seed int check (seed between 1 and 4),
  logo_url text,
  created_at timestamptz default now()
);

create unique index teams_group_seat_unique
  on teams (group_code, seed)
  where group_code is not null and seed is not null;

-- Manager passwords, set by the admin; no select policy => invisible to the public API.
create table team_auth (
  team_id uuid primary key references teams(id) on delete cascade,
  password text not null
);

-- Supabase Auth users who are tournament admins; no policies => private.
create table admin_users (
  user_id uuid primary key,
  email text,
  created_at timestamptz default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  shirt_number int,
  position text default 'MF' check (position in ('GK','DF','MF','FW')),
  category text not null default 'keralite' check (category in ('keralite','non-keralite')),
  role text not null default 'player' check (role in ('player','reserve','manager')),
  created_at timestamptz default now()
);


create table matches (
  id text primary key,
  phase text not null check (phase in ('group','quarterfinal','semifinal','final')),
  round int,
  group_code text,
  ground int not null check (ground in (1,2)),
  kickoff text not null,   -- 'HH:MM'
  end_time text not null,
  home_slot text not null, -- 'A1'..'D4' | 'W-A','RU-B' | 'W-QF1' | 'W-SF1'
  away_slot text not null,
  home_team_id uuid references teams(id) on delete set null,
  away_team_id uuid references teams(id) on delete set null,
  home_score int,
  away_score int,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished')),
  motm_name text,        -- man of the match
  motm_photo text,       -- small data-URL image
  sort_order int not null
);

-- One team sheet per team per match. Players stored as a jsonb snapshot:
-- [{"player_id":"...","name":"...","number":7,"role":"starter"|"sub","slot":0..6}]
create table lineups (
  match_id text not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  formation text not null default '2-3-1',
  players jsonb not null default '[]',
  updated_at timestamptz default now(),
  primary key (match_id, team_id)
);

-- Per-match player stats entered by the admin (goals, assists, cards).
create table match_stats (
  match_id text not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_name text not null,
  goals int not null default 0,
  assists int not null default 0,
  yellows int not null default 0,
  reds int not null default 0,
  primary key (match_id, player_id)
);

create table settings (
  key text primary key,
  value jsonb not null
);

-- ------------------------------------------------------------
-- Row Level Security: public can read everything except secrets.
-- All writes happen only through the SECURITY DEFINER functions below.
-- ------------------------------------------------------------

alter table teams enable row level security;
alter table team_auth enable row level security;
alter table admin_users enable row level security;
alter table players enable row level security;
alter table match_stats enable row level security;
alter table matches enable row level security;
alter table lineups enable row level security;
alter table settings enable row level security;

create policy "public read teams"    on teams    for select using (true);
create policy "public read players"  on players  for select using (true);
create policy "public read match_stats" on match_stats for select using (true);
create policy "public read matches"  on matches  for select using (true);
create policy "public read lineups"  on lineups  for select using (true);
create policy "public read settings" on settings for select using (true);
-- team_auth and admin_users: no policies => not readable/writable via the API.

-- ------------------------------------------------------------
-- Auth helpers
-- ------------------------------------------------------------

-- Admin = logged-in Supabase Auth user listed in admin_users.
create or replace function check_admin() returns void
language plpgsql security definer as $$
begin
  if auth.uid() is null
     or not exists (select 1 from admin_users where user_id = auth.uid()) then
    raise exception 'Admin access required - sign in with the admin account';
  end if;
end $$;

-- The first signed-in user to call this becomes the admin.
-- Returns true if the caller is (now) an admin.
create or replace function claim_admin() returns boolean
language plpgsql security definer as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if exists (select 1 from admin_users where user_id = auth.uid()) then
    return true;
  end if;
  if not exists (select 1 from admin_users) then
    insert into admin_users (user_id, email) values (auth.uid(), auth.jwt()->>'email');
    return true;
  end if;
  return false;
end $$;

-- Let an existing admin promote another Supabase Auth user by email.
create or replace function admin_add_admin(p_email text) returns text
language plpgsql security definer as $$
declare v_id uuid;
begin
  perform check_admin();
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'No account with email % exists yet - they must sign up first', p_email;
  end if;
  insert into admin_users (user_id, email) values (v_id, lower(trim(p_email)))
  on conflict (user_id) do nothing;
  return p_email || ' is now an admin.';
end $$;

create or replace function check_manager(p_team_id uuid, p_password text) returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from team_auth where team_id = p_team_id and password = p_password) then
    raise exception 'Wrong team password';
  end if;
end $$;

-- Resolve a slot code like 'A1' to a team id (group-stage slots only).
create or replace function resolve_group_slot(p_slot text) returns uuid
language sql security definer as $$
  select id from teams
  where group_code = substr(p_slot, 1, 1)
    and seed = (substr(p_slot, 2, 1))::int
$$;

-- ------------------------------------------------------------
-- Shared write implementations
-- ------------------------------------------------------------

-- Full squad replace: p_players = [{"id":optional,"name":..,"shirt_number":..,"position":..}]
create or replace function save_squad_impl(p_team_id uuid, p_players jsonb)
returns void language plpgsql security definer as $$
declare item jsonb;
begin
  delete from players where team_id = p_team_id
    and id not in (select (x->>'id')::uuid from jsonb_array_elements(p_players) x where x->>'id' is not null);
  for item in select * from jsonb_array_elements(p_players) loop
    if item->>'id' is not null then
      update players set name = item->>'name',
        shirt_number = nullif(item->>'shirt_number','')::int,
        position = coalesce(nullif(item->>'position',''),'MF'),
        category = coalesce(nullif(item->>'category',''),'keralite'),
        role = coalesce(nullif(item->>'role',''),'player')
      where id = (item->>'id')::uuid and team_id = p_team_id;
    else
      insert into players (team_id, name, shirt_number, position, category, role)
      values (p_team_id, item->>'name',
              nullif(item->>'shirt_number','')::int,
              coalesce(nullif(item->>'position',''),'MF'),
              coalesce(nullif(item->>'category',''),'keralite'),
              coalesce(nullif(item->>'role',''),'player'));
    end if;
  end loop;
end $$;

create or replace function validate_lineup(p_players jsonb) returns void
language plpgsql security definer as $$
begin
  if jsonb_array_length(p_players) > 12 then
    raise exception 'Team sheet is limited to 12 players (7 starters + 5 subs)';
  end if;
  if (select count(*) from jsonb_array_elements(p_players) x where x->>'role' = 'starter') > 7 then
    raise exception 'Maximum 7 starters';
  end if;
end $$;

create or replace function save_lineup_impl(
  p_team_id uuid, p_match_id text, p_formation text, p_players jsonb)
returns void language plpgsql security definer as $$
begin
  perform validate_lineup(p_players);
  insert into lineups (match_id, team_id, formation, players, updated_at)
  values (p_match_id, p_team_id, p_formation, p_players, now())
  on conflict (match_id, team_id)
  do update set formation = excluded.formation, players = excluded.players, updated_at = now();
end $$;

-- ------------------------------------------------------------
-- Manager functions (team dropdown + password set by the admin)
-- ------------------------------------------------------------

create or replace function manager_login(p_team_id uuid, p_password text)
returns json language plpgsql security definer as $$
declare v_team teams;
begin
  perform check_manager(p_team_id, p_password);
  select * into v_team from teams where id = p_team_id;
  return json_build_object('id', v_team.id, 'name', v_team.name,
    'group_code', v_team.group_code, 'seed', v_team.seed, 'logo_url', v_team.logo_url);
end $$;

create or replace function manager_save_squad(p_team_id uuid, p_password text, p_players jsonb)
returns void language plpgsql security definer as $$
begin
  perform check_manager(p_team_id, p_password);
  perform save_squad_impl(p_team_id, p_players);
end $$;

create or replace function manager_save_lineup(
  p_team_id uuid, p_password text, p_match_id text, p_formation text, p_players jsonb)
returns void language plpgsql security definer as $$
begin
  perform check_manager(p_team_id, p_password);
  perform save_lineup_impl(p_team_id, p_match_id, p_formation, p_players);
end $$;

-- ------------------------------------------------------------
-- Admin functions (require a signed-in admin account)
-- ------------------------------------------------------------

create or replace function admin_upsert_team(
  p_id uuid, p_name text, p_short_name text,
  p_group_code text, p_seed int, p_logo_url text)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  perform check_admin();
  if p_id is null then
    insert into teams (name, short_name, group_code, seed, logo_url)
    values (trim(p_name), p_short_name, p_group_code, p_seed, p_logo_url)
    returning id into v_id;
  else
    update teams set name = trim(p_name), short_name = p_short_name,
      group_code = p_group_code, seed = p_seed, logo_url = p_logo_url
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end $$;

create or replace function admin_delete_team(p_team_id uuid)
returns void language plpgsql security definer as $$
begin
  perform check_admin();
  delete from teams where id = p_team_id;
end $$;

-- Assign a team to a group seat (or pass nulls to unassign).
create or replace function admin_assign_team(p_team_id uuid, p_group_code text, p_seed int)
returns void language plpgsql security definer as $$
begin
  perform check_admin();
  if p_group_code is null or p_seed is null then
    update teams set group_code = null, seed = null where id = p_team_id;
  else
    if exists (select 1 from teams
               where group_code = p_group_code and seed = p_seed and id <> p_team_id) then
      raise exception 'Seat % is already taken - unassign that team first', p_group_code || p_seed;
    end if;
    update teams set group_code = p_group_code, seed = p_seed where id = p_team_id;
  end if;
end $$;

-- Set (or replace) the manager password for a team.
create or replace function admin_set_team_password(p_team_id uuid, p_new_password text)
returns void language plpgsql security definer as $$
begin
  perform check_admin();
  if length(coalesce(p_new_password, '')) < 4 then
    raise exception 'Manager password must be at least 4 characters';
  end if;
  insert into team_auth (team_id, password) values (p_team_id, p_new_password)
  on conflict (team_id) do update set password = excluded.password;
end $$;

create or replace function admin_save_squad(p_team_id uuid, p_players jsonb)
returns void language plpgsql security definer as $$
begin
  perform check_admin();
  perform save_squad_impl(p_team_id, p_players);
end $$;

-- Read the current manager password of a team (admin only, to re-share).
create or replace function admin_get_team_password(p_team_id uuid)
returns text language plpgsql security definer as $$
declare v_pw text;
begin
  perform check_admin();
  select password into v_pw from team_auth where team_id = p_team_id;
  return v_pw;
end $$;

create or replace function admin_save_lineup(
  p_team_id uuid, p_match_id text, p_formation text, p_players jsonb)
returns void language plpgsql security definer as $$
begin
  perform check_admin();
  perform save_lineup_impl(p_team_id, p_match_id, p_formation, p_players);
end $$;

create or replace function admin_update_match(
  p_match_id text, p_home_score int, p_away_score int,
  p_status text, p_home_team_id uuid, p_away_team_id uuid,
  p_motm_name text default null, p_motm_photo text default null)
returns void language plpgsql security definer as $$
begin
  perform check_admin();
  update matches set
    home_score = p_home_score,
    away_score = p_away_score,
    status = coalesce(p_status, status),
    home_team_id = coalesce(p_home_team_id, home_team_id),
    away_team_id = coalesce(p_away_team_id, away_team_id),
    -- null = leave unchanged, empty string = clear
    motm_name = case when p_motm_name is null then motm_name else nullif(p_motm_name, '') end,
    motm_photo = case when p_motm_photo is null then motm_photo else nullif(p_motm_photo, '') end
  where id = p_match_id;
end $$;

create or replace function admin_save_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer as $$
begin
  perform check_admin();
  insert into settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end $$;

-- Replaces all stats rows of one match in a single call.
create or replace function admin_save_match_stats(p_match_id text, p_stats jsonb)
returns void language plpgsql security definer as $$
declare item jsonb;
begin
  perform check_admin();
  delete from match_stats where match_id = p_match_id;
  for item in select * from jsonb_array_elements(p_stats) loop
    if coalesce((item->>'goals')::int, 0) + coalesce((item->>'assists')::int, 0)
       + coalesce((item->>'yellows')::int, 0) + coalesce((item->>'reds')::int, 0) > 0 then
      insert into match_stats (match_id, player_id, team_id, player_name, goals, assists, yellows, reds)
      values (p_match_id, (item->>'player_id')::uuid, (item->>'team_id')::uuid, item->>'player_name',
              coalesce((item->>'goals')::int, 0), coalesce((item->>'assists')::int, 0),
              coalesce((item->>'yellows')::int, 0), coalesce((item->>'reds')::int, 0));
    end if;
  end loop;
end $$;

-- Man of the Match (name + optional photo), set from the details editor.
create or replace function admin_set_motm(p_match_id text, p_motm_name text, p_motm_photo text)
returns void language plpgsql security definer as $$
begin
  perform check_admin();
  update matches set
    motm_name = nullif(trim(coalesce(p_motm_name, '')), ''),
    motm_photo = nullif(coalesce(p_motm_photo, ''), '')
  where id = p_match_id;
end $$;

-- Shift the entire schedule so the first match kicks off at p_first_kickoff.
-- Every match keeps its duration and its gap to the others.
create or replace function admin_shift_schedule(p_first_kickoff text)
returns text language plpgsql security definer as $$
declare v_first int; v_new int; v_delta int; v_min int; v_max int;
begin
  perform check_admin();
  if p_first_kickoff !~ '^\d{2}:\d{2}$' then
    raise exception 'Time must be in HH:MM format';
  end if;
  select split_part(kickoff, ':', 1)::int * 60 + split_part(kickoff, ':', 2)::int
    into v_first from matches order by sort_order limit 1;
  v_new := split_part(p_first_kickoff, ':', 1)::int * 60 + split_part(p_first_kickoff, ':', 2)::int;
  v_delta := v_new - v_first;
  if v_delta = 0 then
    return 'Schedule unchanged - the first kickoff is already ' || p_first_kickoff || '.';
  end if;
  select min(split_part(kickoff, ':', 1)::int * 60 + split_part(kickoff, ':', 2)::int) + v_delta,
         max(split_part(end_time, ':', 1)::int * 60 + split_part(end_time, ':', 2)::int) + v_delta
    into v_min, v_max from matches;
  if v_min < 0 or v_max > 1439 then
    raise exception 'That shift would push matches outside 00:00-23:59';
  end if;
  update matches set
    kickoff = lpad(((split_part(kickoff, ':', 1)::int * 60 + split_part(kickoff, ':', 2)::int + v_delta) / 60)::text, 2, '0')
      || ':' ||
      lpad(((split_part(kickoff, ':', 1)::int * 60 + split_part(kickoff, ':', 2)::int + v_delta) % 60)::text, 2, '0'),
    end_time = lpad(((split_part(end_time, ':', 1)::int * 60 + split_part(end_time, ':', 2)::int + v_delta) / 60)::text, 2, '0')
      || ':' ||
      lpad(((split_part(end_time, ':', 1)::int * 60 + split_part(end_time, ':', 2)::int + v_delta) % 60)::text, 2, '0');
  return case when v_delta > 0
    then 'All matches pushed later by ' || v_delta || ' minutes. First kickoff is now ' || p_first_kickoff || '.'
    else 'All matches pulled earlier by ' || abs(v_delta) || ' minutes. First kickoff is now ' || p_first_kickoff || '.'
  end;
end $$;

-- Group standings (finished group matches only). Tiebreak: points, GD, GF, name.
create or replace function group_standings(p_group text)
returns table (team_id uuid, played int, won int, drawn int, lost int,
               gf int, ga int, gd int, points int)
language sql security definer as $$
  with resolved as (
    select resolve_group_slot(m.home_slot) as home_id,
           resolve_group_slot(m.away_slot) as away_id,
           m.home_score, m.away_score
    from matches m
    where m.phase = 'group' and m.group_code = p_group and m.status = 'finished'
      and m.home_score is not null and m.away_score is not null
  ),
  rows as (
    select home_id as tid, home_score as f, away_score as a from resolved
    union all
    select away_id, away_score, home_score from resolved
  )
  select t.id, count(r.tid)::int,
    count(*) filter (where r.f > r.a)::int,
    count(*) filter (where r.f = r.a)::int,
    count(*) filter (where r.f < r.a)::int,
    coalesce(sum(r.f),0)::int, coalesce(sum(r.a),0)::int,
    coalesce(sum(r.f) - sum(r.a),0)::int,
    coalesce(sum(case when r.f > r.a then 3 when r.f = r.a then 1 else 0 end),0)::int
  from teams t left join rows r on r.tid = t.id
  where t.group_code = p_group
  group by t.id
$$;

-- Fill knockout pairings from results. Only fills a slot when its source is decided.
create or replace function admin_advance_knockouts()
returns text language plpgsql security definer as $$
declare
  g text; v_winner uuid; v_runner uuid; v_done int; v_total int;
  m record; v_notes text := '';
begin
  perform check_admin();

  -- Group winners/runners-up -> quarterfinals
  foreach g in array array['A','B','C','D'] loop
    select count(*) filter (where status = 'finished'), count(*)
      into v_done, v_total from matches where phase = 'group' and group_code = g;
    if v_done = v_total and v_total > 0 then
      select team_id into v_winner from group_standings(g)
        order by points desc, gd desc, gf desc limit 1;
      select team_id into v_runner from group_standings(g)
        order by points desc, gd desc, gf desc limit 1 offset 1;
      update matches set home_team_id = v_winner where home_slot = 'W-' || g;
      update matches set away_team_id = v_winner where away_slot = 'W-' || g;
      update matches set home_team_id = v_runner where home_slot = 'RU-' || g;
      update matches set away_team_id = v_runner where away_slot = 'RU-' || g;
      v_notes := v_notes || 'Group ' || g || ' -> QF filled. ';
    end if;
  end loop;

  -- Knockout winners -> next round
  for m in select * from matches where phase in ('quarterfinal','semifinal')
           and status = 'finished' and home_score is not null and away_score is not null loop
    if m.home_score > m.away_score then v_winner := m.home_team_id;
    elsif m.away_score > m.home_score then v_winner := m.away_team_id;
    else v_winner := null; -- draw: admin sets shootout winner manually on the next match
    end if;
    if v_winner is not null then
      update matches set home_team_id = v_winner where home_slot = 'W-' || m.id;
      update matches set away_team_id = v_winner where away_slot = 'W-' || m.id;
      v_notes := v_notes || m.id || ' winner advanced. ';
    else
      v_notes := v_notes || m.id || ' is a draw - set the winner manually. ';
    end if;
  end loop;

  return coalesce(nullif(v_notes, ''), 'Nothing to advance yet - finish more matches first.');
end $$;

grant execute on all functions in schema public to anon, authenticated;

-- ------------------------------------------------------------
-- Seed: fixtures from the official schedule PDF
-- ------------------------------------------------------------

insert into matches (id, phase, round, group_code, ground, kickoff, end_time, home_slot, away_slot, sort_order) values
  -- Round 1
  ('M01','group',1,'A',1,'08:30','08:55','A1','A2',1),
  ('M02','group',1,'B',2,'08:30','08:55','B1','B2',2),
  ('M03','group',1,'C',1,'08:55','09:20','C1','C2',3),
  ('M04','group',1,'D',2,'08:55','09:20','D1','D2',4),
  -- Round 2
  ('M05','group',2,'A',1,'09:30','09:55','A3','A4',5),
  ('M06','group',2,'B',2,'09:30','09:55','B3','B4',6),
  ('M07','group',2,'C',1,'09:55','10:20','C3','C4',7),
  ('M08','group',2,'D',2,'09:55','10:20','D1','D3',8),
  -- Round 3
  ('M09','group',3,'A',1,'10:30','10:55','A1','A3',9),
  ('M10','group',3,'B',2,'10:30','10:55','B1','B3',10),
  ('M11','group',3,'A',1,'10:55','11:20','A2','A4',11),
  ('M12','group',3,'B',2,'10:55','11:20','B2','B4',12),
  -- Round 4
  ('M13','group',4,'C',1,'11:30','11:55','C1','C3',13),
  ('M14','group',4,'D',2,'11:30','11:55','D2','D4',14),
  ('M15','group',4,'C',1,'11:55','12:20','C2','C4',15),
  -- Round 5
  ('M16','group',5,'A',1,'12:30','12:55','A1','A4',16),
  ('M17','group',5,'A',2,'12:30','12:55','A2','A3',17),
  ('M18','group',5,'B',1,'12:55','13:20','B1','B4',18),
  ('M19','group',5,'D',2,'12:55','13:20','D3','D4',19),
  -- Round 6
  ('M20','group',6,'B',1,'13:30','13:55','B2','B3',20),
  ('M21','group',6,'C',2,'13:30','13:55','C1','C4',21),
  ('M22','group',6,'C',1,'13:55','14:21','C2','C3',22),
  ('M23','group',6,'D',2,'13:55','14:21','D1','D4',23),
  ('M24','group',6,'D',1,'14:21','14:46','D2','D3',24),
  -- Quarterfinals
  ('QF1','quarterfinal',null,null,1,'14:46','15:13','W-A','RU-B',25),
  ('QF2','quarterfinal',null,null,2,'14:46','15:13','W-B','RU-A',26),
  ('QF3','quarterfinal',null,null,1,'15:13','15:40','W-C','RU-D',27),
  ('QF4','quarterfinal',null,null,2,'15:13','15:40','W-D','RU-C',28),
  -- Semifinals
  ('SF1','semifinal',null,null,1,'16:10','16:41','W-QF1','W-QF3',29),
  ('SF2','semifinal',null,null,2,'16:10','16:41','W-QF2','W-QF4',30),
  -- Final
  ('F','final',null,null,1,'17:11','17:42','W-SF1','W-SF2',31);

-- The 16 participating teams (group seats stay empty until the draw)
insert into teams (name, short_name) values
  ('MSV Dortmund', 'MSV'),
  ('FC Westphalia Aachen', 'FWA'),
  ('Neckar Zollern FC Kerala', 'NZFC'),
  ('Frankfurter FC Kerala', 'FFC'),
  ('Sporting Mallus Regensburg', 'SMR'),
  ('Stuttgart Indians FC', 'SIFC'),
  ('Stuttgart Indians FC Deux', 'SIF2'),
  ('Phoenix FC Malta', 'PFC'),
  ('Churuli FC', 'CFC'),
  ('Minnal Bayern FC', 'MBFC'),
  ('Inter Freiburg FC', 'IFR'),
  ('Schopfheim Blitz Basel', 'SBB'),
  ('FC Ellwangen', 'FCE'),
  ('Otto FC Magdeburg A', 'OFMA'),
  ('Otto FC Magdeburg B', 'OFMB'),
  ('United Saar FC', 'USFC');

insert into settings (key, value) values
  ('tournament', '{"name":"European Championship Stuttgart 2026","date":"2026-07-25","venue":"","organizer":"Stuttgart Indians FC"}'),
  ('info_sections', '[
    {"title":"Tournament Format","body":"16 teams in 4 groups (A–D). Everyone plays 3 group matches. Top two of each group reach the quarterfinals, followed by semifinals and the grand final."},
    {"title":"Match Duration","body":"Group stage and quarterfinal matches run in 25–27 minute slots. Semifinals and the final are played with 12-minute halves."},
    {"title":"Schedule","body":"Matches run from 08:30 to about 17:45 on two grounds, with 10-minute breaks after each group round and a 30-minute rest before the semifinals and the final. Trophy ceremony at 17:45."}
  ]');
