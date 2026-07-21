import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import { SponsorsMarquee } from '../components/Sponsors.jsx'

// Chart series colors validated for lightness, CVD separation, and contrast
const GOALS_COLOR = '#3f62c9'
const ASSISTS_COLOR = '#b8860b'

export default function Stats() {
  const { teams, teamById, loading } = useData()
  const [rows, setRows] = useState([])

  useEffect(() => {
    supabase.from('match_stats').select('*').then(({ data }) => setRows(data || []))
  }, [])

  const byPlayer = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const cur = map[r.player_id] ||
        { player_id: r.player_id, name: r.player_name, team_id: r.team_id, goals: 0, assists: 0, yellows: 0, reds: 0 }
      cur.goals += r.goals
      cur.assists += r.assists
      cur.yellows += r.yellows
      cur.reds += r.reds
      map[r.player_id] = cur
    }
    return Object.values(map)
  }, [rows])

  const byTeam = useMemo(() => {
    const map = {}
    for (const t of teams) map[t.id] = { team: t, goals: 0, assists: 0 }
    for (const r of rows) {
      if (map[r.team_id]) {
        map[r.team_id].goals += r.goals
        map[r.team_id].assists += r.assists
      }
    }
    return Object.values(map).sort((a, b) => b.goals - a.goals || b.assists - a.assists)
  }, [rows, teams])

  if (loading) return <div className="spinner" />

  return (
    <>
      <h1 className="page-title">Statistics</h1>
      <PlayerStats byPlayer={byPlayer} byTeam={byTeam} teamById={teamById} hasData={rows.length > 0} />
      <SponsorsMarquee />
    </>
  )
}

function Leaderboard({ title, rows, columns, teamById }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">Nothing here yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              {columns.map((c) => <th key={c.key} className="num">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.player_id}>
                <td>
                  <span className="team-cell">
                    <TeamBadge team={teamById[p.team_id]} size={24} />
                    {p.name}
                  </span>
                </td>
                {columns.map((c) => <td key={c.key} className="num pts">{p[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PlayerStats({ byPlayer, byTeam, teamById, hasData }) {
  if (!hasData) {
    return (
      <div className="alert info">
        Stats appear here once match details (goals, assists, cards) are entered on match day.
      </div>
    )
  }

  const scorers = [...byPlayer].filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 10)
  const assisters = [...byPlayer].filter((p) => p.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 10)
  const carded = [...byPlayer].filter((p) => p.yellows + p.reds > 0)
    .sort((a, b) => b.reds - a.reds || b.yellows - a.yellows).slice(0, 10)

  const chartTeams = byTeam.filter((t) => t.goals + t.assists > 0)
  const maxVal = Math.max(1, ...chartTeams.flatMap((t) => [t.goals, t.assists]))

  return (
    <>
      <div className="stats-grid">
        <Leaderboard title="Top Scorers" rows={scorers} teamById={teamById}
          columns={[{ key: 'goals', label: 'Goals' }]} />
        <Leaderboard title="Top Assists" rows={assisters} teamById={teamById}
          columns={[{ key: 'assists', label: 'Assists' }]} />
        <Leaderboard title="Cards" rows={carded} teamById={teamById}
          columns={[{ key: 'yellows', label: 'Yellow' }, { key: 'reds', label: 'Red' }]} />
      </div>

      {chartTeams.length > 0 && (
        <div className="panel mt">
          <h2>Goals and Assists by Team</h2>
          <div className="chart-legend">
            <span><i style={{ background: GOALS_COLOR }} /> Goals</span>
            <span><i style={{ background: ASSISTS_COLOR }} /> Assists</span>
          </div>
          <div className="chart">
            {chartTeams.map(({ team, goals, assists }) => (
              <div className="chart-row" key={team.id}>
                <div className="chart-label">
                  <TeamBadge team={team} size={22} />
                  <span>{team.short_name || team.name}</span>
                </div>
                <div className="chart-bars">
                  <div className="chart-bar" title={`${team.name}: ${goals} goals`}>
                    <div className="chart-fill" style={{ width: `${(goals / maxVal) * 100}%`, background: GOALS_COLOR }} />
                    <span className="chart-val">{goals}</span>
                  </div>
                  <div className="chart-bar" title={`${team.name}: ${assists} assists`}>
                    <div className="chart-fill" style={{ width: `${(assists / maxVal) * 100}%`, background: ASSISTS_COLOR }} />
                    <span className="chart-val">{assists}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

