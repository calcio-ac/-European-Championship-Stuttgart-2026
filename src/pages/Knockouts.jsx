import { Link } from 'react-router-dom'
import { useData, resolveTeam, slotLabel } from '../lib/data.jsx'
import TeamBadge from '../components/TeamBadge.jsx'

function BracketMatch({ match }) {
  const { teamById, teamBySlot } = useData()
  const home = resolveTeam(match, 'home', teamById, teamBySlot)
  const away = resolveTeam(match, 'away', teamById, teamBySlot)
  const played = match.home_score != null && match.away_score != null && match.status === 'finished'
  const homeWins = played && match.home_score > match.away_score
  const awayWins = played && match.away_score > match.home_score

  return (
    <Link to={`/match/${match.id}`} className="bracket-match">
      <div className="btime">
        {match.id} · {match.kickoff} · Ground {match.ground}
        {match.status === 'live' && <span className="status-chip live" style={{ marginLeft: 6 }}>LIVE</span>}
      </div>
      <div className={`brow ${homeWins ? 'winner' : ''}`}>
        <TeamBadge team={home} label={match.home_slot} size={24} />
        <span>{home ? home.name : slotLabel(match.home_slot)}</span>
        <span className="bscore">{played ? match.home_score : ''}</span>
      </div>
      <div className={`brow ${awayWins ? 'winner' : ''}`}>
        <TeamBadge team={away} label={match.away_slot} size={24} />
        <span>{away ? away.name : slotLabel(match.away_slot)}</span>
        <span className="bscore">{played ? match.away_score : ''}</span>
      </div>
    </Link>
  )
}

export default function Knockouts() {
  const { matches, loading } = useData()
  if (loading) return <div className="spinner" />

  const qfs = matches.filter((m) => m.phase === 'quarterfinal')
  const sfs = matches.filter((m) => m.phase === 'semifinal')
  const final = matches.filter((m) => m.phase === 'final')

  return (
    <>
      <h1 className="page-title">Knockout Bracket</h1>
      <div className="bracket">
        <div className="bracket-col">
          <div className="bracket-col-title">Quarterfinals</div>
          {qfs.map((m) => <BracketMatch key={m.id} match={m} />)}
        </div>
        <div className="bracket-col">
          <div className="bracket-col-title">Semifinals</div>
          {sfs.map((m) => <BracketMatch key={m.id} match={m} />)}
        </div>
        <div className="bracket-col">
          <div className="bracket-col-title">Grand Final</div>
          {final.map((m) => <BracketMatch key={m.id} match={m} />)}
        </div>
      </div>
      <p className="muted mt">
        Pairings fill in automatically as group games and knockout rounds finish. Trophy ceremony at 17:45.
      </p>
    </>
  )
}
