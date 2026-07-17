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
      <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
          <table className="table">
            <thead>
              <tr><th className="num">#</th><th>Player</th><th>Position</th></tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="num pts">{p.shirt_number ?? '–'}</td>
                  <td>{p.name}</td>
                  <td className="muted">{POSITION_LABELS[p.position] || p.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="page-title mt">Matches</h2>
      <div className="match-list">
        {teamMatches.map((m) => <MatchCard key={m.id} match={m} />)}
      </div>
    </>
  )
}
