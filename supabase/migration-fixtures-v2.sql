-- ============================================================
-- Fixtures update (new PDF) + team volunteer + deadline setting.
-- Run once in the Supabase SQL Editor. Keeps teams; re-seeds matches.
-- Because it re-seeds matches, any entered scores/lineups/stats are
-- cleared — run this BEFORE match day.
-- ============================================================

-- 1. Team volunteer contact
alter table teams add column if not exists volunteer_name text;
alter table teams add column if not exists volunteer_phone text;

-- update admin_upsert_team to carry volunteer fields
-- (drop the old 6-arg version so there is no overload ambiguity)
drop function if exists admin_upsert_team(uuid, text, text, text, int, text);
create or replace function admin_upsert_team(
  p_id uuid, p_name text, p_short_name text,
  p_group_code text, p_seed int, p_logo_url text,
  p_volunteer_name text default null, p_volunteer_phone text default null)
returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  perform check_admin();
  if p_id is null then
    insert into teams (name, short_name, group_code, seed, logo_url, volunteer_name, volunteer_phone)
    values (trim(p_name), p_short_name, p_group_code, p_seed, p_logo_url,
            nullif(trim(coalesce(p_volunteer_name,'')),''), nullif(trim(coalesce(p_volunteer_phone,'')),''))
    returning id into v_id;
  else
    update teams set name = trim(p_name), short_name = p_short_name,
      group_code = p_group_code, seed = p_seed, logo_url = p_logo_url,
      volunteer_name = nullif(trim(coalesce(p_volunteer_name,'')),''),
      volunteer_phone = nullif(trim(coalesce(p_volunteer_phone,'')),'')
    where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end $$;

-- 2. Assign the 16 teams to seats matching the PDF groups
update teams set group_code = null, seed = null;
update teams set group_code='A', seed=1 where lower(name)=lower('Stuttgart Indians FC');
update teams set group_code='A', seed=2 where lower(name)=lower('Schopfheim Blitz Basel');
update teams set group_code='A', seed=3 where lower(name)=lower('Churuli FC');
update teams set group_code='A', seed=4 where lower(name)=lower('Phoenix FC Malta');
update teams set group_code='B', seed=1 where lower(name)=lower('Minnal Bayern FC');
update teams set group_code='B', seed=2 where lower(name)=lower('Inter Freiburg FC');
update teams set group_code='B', seed=3 where lower(name)=lower('MSV Dortmund');
update teams set group_code='B', seed=4 where lower(name)=lower('FC Ellwangen');
update teams set group_code='C', seed=1 where lower(name)=lower('Frankfurter FC Kerala');
update teams set group_code='C', seed=2 where lower(name)=lower('FC Westphalia Aachen');
update teams set group_code='C', seed=3 where lower(name)=lower('Otto FC Magdeburg B');
update teams set group_code='C', seed=4 where lower(name)=lower('United Saar FC');
update teams set group_code='D', seed=1 where lower(name)=lower('Otto FC Magdeburg A');
update teams set group_code='D', seed=2 where lower(name)=lower('Sporting Mallus Regensburg');
update teams set group_code='D', seed=3 where lower(name)=lower('Stuttgart Indians FC Deux');
update teams set group_code='D', seed=4 where lower(name)=lower('Neckar Zollern FC Kerala');

-- 3. Re-seed all matches from the new schedule
delete from matches;

insert into matches (id, phase, round, group_code, ground, kickoff, end_time, home_slot, away_slot, sort_order) values
  ('M01','group',null,'C',1,'08:30','09:00','C1','C2',1),
  ('M02','group',null,'C',2,'08:30','09:00','C3','C4',2),
  ('M03','group',null,'D',1,'09:00','09:30','D1','D2',3),
  ('M04','group',null,'D',2,'09:00','09:30','D3','D4',4),
  ('M05','group',null,'C',1,'09:30','10:00','C1','C3',5),
  ('M06','group',null,'C',2,'09:30','10:00','C2','C4',6),
  ('M07','group',null,'D',1,'10:00','10:30','D1','D3',7),
  ('M08','group',null,'D',2,'10:00','10:30','D2','D4',8),
  ('M09','group',null,'A',1,'10:30','11:00','A1','A2',9),
  ('M10','group',null,'B',2,'10:30','11:00','B1','B2',10),
  ('M11','group',null,'A',1,'11:00','11:30','A3','A4',11),
  ('M12','group',null,'B',2,'11:00','11:30','B3','B4',12),
  ('M13','group',null,'C',1,'11:30','12:00','C1','C4',13),
  ('M14','group',null,'C',2,'11:30','12:00','C2','C3',14),
  ('M15','group',null,'A',1,'12:00','12:30','A1','A4',15),
  ('M16','group',null,'B',2,'12:00','12:30','B1','B3',16),
  ('M17','group',null,'D',1,'12:30','13:00','D1','D4',17),
  ('M18','group',null,'D',2,'12:30','13:00','D2','D3',18),
  ('M19','group',null,'A',1,'13:00','13:30','A3','A2',19),
  ('M20','group',null,'B',2,'13:00','13:30','B1','B4',20),
  ('M21','group',null,'B',1,'13:30','14:00','B2','B3',21),
  ('M22','group',null,'A',1,'14:00','14:30','A4','A2',22),
  ('M23','group',null,'B',1,'14:30','15:00','B2','B4',23),
  ('M24','group',null,'A',2,'14:30','15:00','A1','A3',24),
  ('QF1','quarterfinal',null,null,1,'15:00','15:30','W-B','RU-D',25),
  ('QF2','quarterfinal',null,null,2,'15:00','15:30','W-D','RU-B',26),
  ('QF3','quarterfinal',null,null,1,'15:30','16:00','W-A','RU-C',27),
  ('QF4','quarterfinal',null,null,2,'15:30','16:00','W-C','RU-A',28),
  ('SF1','semifinal',null,null,1,'16:20','16:50','W-QF1','W-QF3',29),
  ('SF2','semifinal',null,null,2,'16:20','16:50','W-QF2','W-QF4',30),
  ('F','final',null,null,1,'17:10','17:40','W-SF1','W-SF2',31);

-- 4. Team-sheet submission deadline shown to managers
insert into settings (key, value) values
  ('lineup_deadline', '"2026-07-24T23:59:00"')
on conflict (key) do update set value = excluded.value;
