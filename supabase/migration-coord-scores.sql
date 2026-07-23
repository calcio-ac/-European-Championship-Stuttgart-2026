-- ============================================================
-- Let coordinators upload scores (and match stats / Man of the Match),
-- in addition to editing squads. Run once in the Supabase SQL Editor.
-- ============================================================

-- Match result: score, status, knockout team fill-in
create or replace function admin_update_match(
  p_match_id text, p_home_score int, p_away_score int,
  p_status text, p_home_team_id uuid, p_away_team_id uuid,
  p_motm_name text default null, p_motm_photo text default null)
returns void language plpgsql security definer as $$
begin
  perform check_squad_editor();  -- admin OR coordinator
  update matches set
    home_score = p_home_score,
    away_score = p_away_score,
    status = coalesce(p_status, status),
    home_team_id = coalesce(p_home_team_id, home_team_id),
    away_team_id = coalesce(p_away_team_id, away_team_id),
    motm_name = case when p_motm_name is null then motm_name else nullif(p_motm_name, '') end,
    motm_photo = case when p_motm_photo is null then motm_photo else nullif(p_motm_photo, '') end
  where id = p_match_id;
end $$;

-- Per-player goals / assists / cards
create or replace function admin_save_match_stats(p_match_id text, p_stats jsonb)
returns void language plpgsql security definer as $$
declare item jsonb;
begin
  perform check_squad_editor();
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

-- Man of the Match
create or replace function admin_set_motm(p_match_id text, p_motm_name text, p_motm_photo text)
returns void language plpgsql security definer as $$
begin
  perform check_squad_editor();
  update matches set
    motm_name = nullif(trim(coalesce(p_motm_name, '')), ''),
    motm_photo = nullif(coalesce(p_motm_photo, ''), '')
  where id = p_match_id;
end $$;

grant execute on all functions in schema public to anon, authenticated;
