-- ============================================================
-- Stats migration — run once in the Supabase SQL Editor.
-- Keeps all existing data.
--   1. Players get a category (Keralite / Non-Keralite) and a
--      role (Player / Reserve / Manager).
--   2. Per-match player stats: goals, assists, yellow/red cards.
--   3. Man of the Match set by player id via dropdown.
-- ============================================================

-- 1. Player category + role
alter table players add column if not exists category text not null default 'keralite'
  check (category in ('keralite','non-keralite'));
alter table players add column if not exists role text not null default 'player'
  check (role in ('player','reserve','manager'));

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

-- 2. Per-match player stats
create table if not exists match_stats (
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

alter table match_stats enable row level security;
drop policy if exists "public read match_stats" on match_stats;
create policy "public read match_stats" on match_stats for select using (true);

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

-- 3. Man of the Match (name + optional photo), set from the details editor
create or replace function admin_set_motm(p_match_id text, p_motm_name text, p_motm_photo text)
returns void language plpgsql security definer as $$
begin
  perform check_admin();
  update matches set
    motm_name = nullif(trim(coalesce(p_motm_name, '')), ''),
    motm_photo = nullif(coalesce(p_motm_photo, ''), '')
  where id = p_match_id;
end $$;

grant execute on all functions in schema public to anon, authenticated;
