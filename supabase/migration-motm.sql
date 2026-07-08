-- Run in the Supabase SQL Editor. Keeps all data.
-- 1. Sets the tournament date to 25 July 2026.
-- 2. Adds Man of the Match (name + photo) to matches.

update settings
set value = jsonb_set(value, '{date}', '"2026-07-25"')
where key = 'tournament';

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

grant execute on all functions in schema public to anon, authenticated;
