-- Run once in the Supabase SQL Editor. Lets a signed-in admin read
-- the current manager password of a team (to re-share if forgotten).

create or replace function admin_get_team_password(p_team_id uuid)
returns text language plpgsql security definer as $$
declare v_pw text;
begin
  perform check_admin();
  select password into v_pw from team_auth where team_id = p_team_id;
  return v_pw;
end $$;

grant execute on all functions in schema public to anon, authenticated;
