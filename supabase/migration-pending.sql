-- ============================================================
-- Pending migration — run once in the Supabase SQL Editor.
-- Keeps all existing data. Includes everything not yet applied:
--   1. Tournament date -> 25 July 2026
--   2. Man of the Match (name + photo) on matches
--   3. Teams can exist WITHOUT a group seat (draw not done yet)
--   4. Loads the 16 participating teams
-- ============================================================

-- 1. Tournament date
update settings
set value = jsonb_set(value, '{date}', '"2026-07-25"')
where key = 'tournament';

-- 2. Man of the Match
alter table matches add column if not exists motm_name text;
alter table matches add column if not exists motm_photo text; -- small data-URL image

drop function if exists admin_update_match(text, int, int, text, uuid, uuid);

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

-- 3. Teams without a group seat until the draw is made
alter table teams alter column group_code drop not null;
alter table teams alter column seed drop not null;
alter table teams drop constraint if exists teams_group_code_seed_key;
create unique index if not exists teams_group_seat_unique
  on teams (group_code, seed)
  where group_code is not null and seed is not null;

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

-- 4. The 16 participating teams (skips any that already exist)
insert into teams (name, short_name)
select v.name, v.short_name
from (values
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
  ('United Saar FC', 'USFC')
) as v(name, short_name)
where not exists (select 1 from teams t where lower(t.name) = lower(v.name));

grant execute on all functions in schema public to anon, authenticated;
