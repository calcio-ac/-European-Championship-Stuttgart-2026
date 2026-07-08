# European Championship Stuttgart 2026

Tournament website for the 16-team European Championship Stuttgart 2026, presented by
**Stuttgart Indians FC**. Built with React (Vite) + Supabase.

## Features

- **Fixtures** — full one-day schedule (24 group matches on 2 grounds, quarterfinals,
  semifinals, grand final) with filters for round/time, ground, group, and "your team"
- **Match pages** — live score plus both team sheets rendered on a 7-a-side pitch
- **Group standings** — auto-calculated tables (points, GD, GF), top two highlighted
- **Knockout bracket** — fills in automatically as results are entered
- **Team pages** — squad list and all of that team's matches
- **Info page** — sections editable from the admin dashboard
- **Manager portal** (`/manager`) — managers pick their team from a dropdown and enter
  the password the admin set for them; they keep a squad list and submit a team sheet
  per match (formation, 7 starters, up to 5 subs)
- **Admin dashboard** (`/admin`) — Supabase Authentication login (email + password);
  add/edit teams with logos, set manager passwords, shift the whole schedule by changing
  the first kickoff, enter live scores, submit team sheets for any team, advance knockout
  winners, edit info page + date, add more admins
- Clean light theme in the tournament colors; mobile-first with bottom navigation

## One-time database setup

1. Open your Supabase project → **SQL Editor**
2. Paste the whole contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**
3. Create the admin account in the dashboard: **Authentication → Users → Add user** —
   enter your email + password and tick **Auto Confirm User**.
4. Sign in on the site at `/admin` with that account — the first account to sign in
   there automatically becomes the tournament admin.

Re-running `schema.sql` resets the tournament data (it drops and recreates the tables),
but admin accounts live in Supabase Auth and survive; the first admin re-claims on login.

## Run locally

```bash
npm install
npm run dev
```

The Supabase URL and publishable key are read from `.env`.

## Deploy to Vercel

1. Push this folder to a GitHub repository
2. In [vercel.com](https://vercel.com) → **New Project** → import the repo (framework: Vite)
3. Add the two environment variables from `.env`:
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`
4. Deploy — `vercel.json` already handles the client-side routing.

## Match-day workflow

1. **Before:** Admin adds the 16 teams (name, logo, group + seed), sets a manager password
   per team, and shares it. Managers pick their team on the Manager page, log in, enter
   squads, and submit team sheets.
2. **During:** Admin sets matches to Live and types in scores; the public site refreshes
   every 30 seconds. After each group finishes, hit **Advance winners** in the
   Knockouts tab to fill the bracket.
3. **Draws in knockouts:** decide on penalties, then pick the winning team manually in the
   next round's match row (Scores tab).

## Security model

The browser only ever uses the public (publishable) key. All tables are read-only to the
public; every write goes through Postgres functions. Admin functions require a signed-in
Supabase Auth user listed in the private `admin_users` table; manager functions check the
per-team password in the private `team_auth` table. Neither table is exposed through the API.
