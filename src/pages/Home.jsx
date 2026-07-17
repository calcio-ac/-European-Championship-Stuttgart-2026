import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData, GROUPS, PHASE_LABELS } from '../lib/data.jsx'
import MatchCard from '../components/MatchCard.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import Sponsors from '../components/Sponsors.jsx'

function sectionTitle(match) {
  if (match.phase === 'group') return 'Group Stage'
  return PHASE_LABELS[match.phase] + (match.phase === 'quarterfinal' || match.phase === 'semifinal' ? 's' : '')
}

export default function Home() {
  const { matches, teams, settings, loading } = useData()
  const [ground, setGround] = useState('all')
  const [group, setGroup] = useState('all')
  const [teamId, setTeamId] = useState(() => localStorage.getItem('myTeam') || 'all')

  const tournament = settings.tournament || {}

  const pickTeam = (id) => {
    setTeamId(id)
    if (id === 'all') localStorage.removeItem('myTeam')
    else localStorage.setItem('myTeam', id)
  }

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (ground !== 'all' && String(m.ground) !== ground) return false
      if (group !== 'all' && m.group_code !== group) return false
      if (teamId !== 'all') {
        const team = teams.find((t) => t.id === teamId)
        if (!team) return true
        const slot = `${team.group_code}${team.seed}`
        const involved =
          m.home_slot === slot || m.away_slot === slot ||
          m.home_team_id === teamId || m.away_team_id === teamId
        if (!involved) return false
      }
      return true
    })
  }, [matches, teams, ground, group, teamId])

  // Group into titled sections that follow the schedule order
  const sections = useMemo(() => {
    const out = []
    for (const m of filtered) {
      const title = sectionTitle(m)
      if (!out.length || out[out.length - 1].title !== title) out.push({ title, items: [] })
      out[out.length - 1].items.push(m)
    }
    return out
  }, [filtered])

  const dateLabel = tournament.date
    ? new Date(tournament.date + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'Date to be announced'

  return (
    <>
      <section className="hero">
        <img src="/tournament-logo.png" alt="European Championship Stuttgart 2026" />
        <div>
          <span className="date-chip">
            {tournament.venue || 'Stuttgart'} · {dateLabel}
          </span>
        </div>
        <div className="presented">
          <img src="/club-logo.png" alt="Stuttgart Indians FC" />
          Presented by Stuttgart Indians FC
        </div>
      </section>

      <div className="filters">
        <select className="filter-select" value={ground} onChange={(e) => setGround(e.target.value)}>
          <option value="all">Both grounds</option>
          <option value="1">Ground 1</option>
          <option value="2">Ground 2</option>
        </select>
        <select className="filter-select" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="all">All groups</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>Group {g}</option>
          ))}
        </select>
        <select className="filter-select" value={teamId} onChange={(e) => pickTeam(e.target.value)}>
          <option value="all">Select your team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {loading && <div className="spinner" />}
      {!loading && sections.length === 0 && (
        <div className="alert info">No matches found for these filters.</div>
      )}
      {sections.map((s) => (
        <div key={s.title}>
          <div className="round-title">{s.title}</div>
          <div className="match-list">
            {s.items.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>
      ))}

      {teams.length > 0 && (
        <>
          <div className="round-title">Participating Teams</div>
          <div className="teams-grid">
            {teams.map((t) => (
              <Link key={t.id} to={`/team/${t.id}`} className="team-tile">
                <TeamBadge team={t} size={46} />
                <span>{t.name}</span>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                  {t.group_code ? `Group ${t.group_code}` : 'Draw pending'}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <Sponsors />
    </>
  )
}
