-- ============================================================
-- Per-match roster overrides: a player can be Player in one match and
-- Reserve in another. The squad's own role is the tournament default;
-- an override for a match applies to that match and every later match
-- until the next override. Stored in the existing lineups table
-- (players jsonb = [{"player_id":"...","role":"player"|"reserve"}]).
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- Clear any leftover team-sheet data from the old lineups concept.
delete from lineups;

create or replace function admin_save_match_roster(p_match_id text, p_team_id uuid, p_roster jsonb)
returns void language plpgsql security definer as $$
begin
  perform check_squad_editor();
  insert into lineups (match_id, team_id, formation, players, updated_at)
  values (p_match_id, p_team_id, 'roster', p_roster, now())
  on conflict (match_id, team_id)
  do update set players = excluded.players, updated_at = now();
end $$;

create or replace function admin_clear_match_roster(p_match_id text, p_team_id uuid)
returns void language plpgsql security definer as $$
begin
  perform check_squad_editor();
  delete from lineups where match_id = p_match_id and team_id = p_team_id;
end $$;

grant execute on all functions in schema public to anon, authenticated;
