import { Link } from 'react-router-dom'
import { useData, resolveTeam, slotLabel, matchLabel } from '../lib/data.jsx'
import TeamBadge from './TeamBadge.jsx'

function Side({ team, slot, away }) {
  return (
    <span className={`match-team ${away ? 'away' : ''} ${team ? '' : 'tbd'}`}>
      <TeamBadge team={team} label={slot} />
      <span className="name">{team ? team.name : slotLabel(slot)}</span>
    </span>
  )
}

export default function MatchCard({ match }) {
  const { teamById, teamBySlot } = useData()
  const home = resolveTeam(match, 'home', teamById, teamBySlot)
  const away = resolveTeam(match, 'away', teamById, teamBySlot)
  const played = match.home_score != null && match.away_score != null && match.status !== 'scheduled'

  return (
    <Link to={`/match/${match.id}`} className="match-card">
      <div className="match-meta">
        <span>{match.kickoff}</span>
        <span className="ground-badge">Ground {match.ground}</span>
        <span>{matchLabel(match)}</span>
        <span className="spacer" />
        {match.status === 'live' && <span className="status-chip live">LIVE</span>}
        {match.status === 'finished' && <span className="status-chip finished">FT</span>}
      </div>
      <div className="match-row">
        <Side team={home} slot={match.home_slot} />
        <span className="match-score">
          {played ? `${match.home_score} – ${match.away_score}` : <span className="vs">{match.kickoff}</span>}
        </span>
        <Side team={away} slot={match.away_slot} away />
      </div>
    </Link>
  )
}
