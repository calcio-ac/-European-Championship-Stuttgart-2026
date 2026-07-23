import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import MatchCard from '../components/MatchCard.jsx'

const POSITION_LABELS = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' }

export default function Team() {
  const { teamId } = useParams()
  const { teams, matches, loading } = useData()
  const [players, setPlayers] = useState([])

  const team = teams.find((t) => t.id === teamId)

  useEffect(() => {
    supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('shirt_number')
      .then(({ data }) => setPlayers(data || []))
  }, [teamId])

  if (loading) return <div className="spinner" />
  if (!team) return <div className="alert info">Team not found.</div>

  const slot = `${team.group_code}${team.seed}`
  const teamMatches = matches.filter(
    (m) =>
      m.home_slot === slot || m.away_slot === slot ||
      m.home_team_id === team.id || m.away_team_id === team.id
  )

  return (
    <>
      <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <TeamBadge team={team} label={slot} size={64} />
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{team.name}</h1>
          <div className="muted">{team.group_code ? `Group ${team.group_code}` : 'Group draw pending'}</div>
        </div>
      </div>

      <h2 className="page-title mt">Squad</h2>
      {players.length === 0 ? (
        <div className="alert info">No squad submitted yet — the team manager can add players in the Manager portal.</div>
      ) : (
        <div className="panel">
          {[
            ['Players', players.filter((p) => (p.role || 'player') === 'player')],
            ['Reserves', players.filter((p) => p.role === 'reserve')],
            ['Manager', players.filter((p) => p.role === 'manager')],
          ].map(([label, list]) => list.length > 0 && (
            <div key={label}>
              <div className="squad-heading">{label}</div>
              <table className="table">
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <td className="num pts" style={{ width: 34 }}>{p.shirt_number ?? '–'}</td>
                      <td>{p.name}</td>
                      <td className="muted">{label === 'Manager' ? '' : POSITION_LABELS[p.position] || p.position}</td>
                      <td className="muted" style={{ textAlign: 'right' }}>{p.category === 'non-keralite' ? 'Non-Keralite' : 'Keralite'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <h2 className="page-title mt">Matches</h2>
      <div className="match-list">
        {teamMatches.map((m) => <MatchCard key={m.id} match={m} />)}
      </div>
    </>
  )
}
