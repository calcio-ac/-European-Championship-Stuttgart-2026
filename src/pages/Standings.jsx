import { Link } from 'react-router-dom'
import { useData, GROUPS, computeStandings, slotLabel } from '../lib/data.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import { SponsorsMarquee } from '../components/Sponsors.jsx'

export default function Standings() {
  const { matches, teamBySlot, loading } = useData()

  if (loading) return <div className="spinner" />

  return (
    <>
      <h1 className="page-title">Group Standings</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Top two of each group qualify for the quarterfinals. Tiebreakers: points, goal difference, goals scored.
      </p>
      <div className="match-list" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(480px, 100%), 1fr))' }}>
        {GROUPS.map((g) => {
          const rows = computeStandings(g, matches, teamBySlot)
          return (
            <div key={g} className="panel">
              <h2>Group {g}</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th className="num">P</th>
                    <th className="num">W</th>
                    <th className="num">D</th>
                    <th className="num">L</th>
                    <th className="num">GF</th>
                    <th className="num">GA</th>
                    <th className="num">GD</th>
                    <th className="num">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.slot} className={i < 2 ? 'qualified' : ''}>
                      <td>
                        <span className="team-cell">
                          {r.team ? (
                            <Link to={`/team/${r.team.id}`} className="team-cell">
                              <TeamBadge team={r.team} label={r.slot} size={26} />
                              {r.team.name}
                            </Link>
                          ) : (
                            <>
                              <TeamBadge label={r.slot} size={26} />
                              <span className="muted">{slotLabel(r.slot)}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="num">{r.played}</td>
                      <td className="num">{r.won}</td>
                      <td className="num">{r.drawn}</td>
                      <td className="num">{r.lost}</td>
                      <td className="num">{r.gf}</td>
                      <td className="num">{r.ga}</td>
                      <td className="num">{r.gd}</td>
                      <td className="num pts">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
      <SponsorsMarquee />
    </>
  )
}
