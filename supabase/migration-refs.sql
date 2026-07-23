-- ============================================================
-- Referees + swap of two group matches.
-- Run once in the Supabase SQL Editor. Keeps data.
-- Referees (from the Officials Assignment sheet): Oben Takor, Marley Michael, Joshua.
-- Group-stage refs follow the time slot; knockout refs are chosen in the score portal.
-- ============================================================

alter table matches add column if not exists referee text;

-- 1. Swap Neckar Zollern vs Sporting Mallus (was 09:00) with Inter Freiburg vs MSV (13:30)
update matches set home_slot='B2', away_slot='B3', group_code='B' where id='M03'; -- 09:00 now Inter vs MSV
update matches set home_slot='D4', away_slot='D2', group_code='D' where id='M21'; -- 13:30 now Neckar vs Sporting

-- 2. Assign group-stage referees by time slot (Ground 1 / Ground 2 per the sheet)
update matches set referee='Oben Takor'    where id in ('M01','M04','M07','M10','M13','M16','M19','M23');
update matches set referee='Marley Michael' where id in ('M02','M05','M08','M11','M14','M17','M20','M22');
update matches set referee='Joshua'         where id in ('M03','M06','M09','M12','M15','M18','M21','M24');

-- 3. Set the referee of a match (admin or coordinator, e.g. for knockout matches)
create or replace function admin_set_referee(p_match_id text, p_referee text)
returns void language plpgsql security definer as $$
begin
  perform check_squad_editor();
  update matches set referee = nullif(trim(coalesce(p_referee, '')), '') where id = p_match_id;
end $$;

grant execute on all functions in schema public to anon, authenticated;
