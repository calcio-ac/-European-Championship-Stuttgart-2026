import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData, resolveTeam, slotLabel, matchLabel } from '../lib/data.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import Pitch from '../components/Pitch.jsx'

function LineupPanel({ team, slot, lineup, color }) {
  const subs = (lineup?.players || []).filter((p) => p.role === 'sub')
  return (
    <div>
      <div className="lineup-header">
        <TeamBadge team={team} label={slot} />
        {team ? <Link to={`/team/${team.id}`}>{team.name}</Link> : slotLabel(slot)}
        {lineup && <span className="formation">1-{lineup.formation}</span>}
      </div>
      {lineup ? (
        <>
          <Pitch formation={lineup.formation} players={lineup.players} color={color} />
          {subs.length > 0 && (
            <div className="subs-list">
              {subs.map((p, i) => (
                <span key={i} className="sub-chip">
                  <b>{p.number ?? '–'}</b>
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="alert info">Team sheet not submitted yet.</div>
      )}
    </div>
  )
}

export default function Match() {
  const { matchId } = useParams()
  const { matches, teamById, teamBySlot, loading } = useData()
  const [lineups, setLineups] = useState([])

  const match = matches.find((m) => m.id === matchId)

  useEffect(() => {
    supabase
      .from('lineups')
      .select('*')
      .eq('match_id', matchId)
      .then(({ data }) => setLineups(data || []))
  }, [matchId])

  if (loading) return <div className="spinner" />
  if (!match) return <div className="alert info">Match not found.</div>

  const home = resolveTeam(match, 'home', teamById, teamBySlot)
  const away = resolveTeam(match, 'away', teamById, teamBySlot)
  const played = match.home_score != null && match.away_score != null && match.status !== 'scheduled'
  const homeLineup = home ? lineups.find((l) => l.team_id === home.id) : null
  const awayLineup = away ? lineups.find((l) => l.team_id === away.id) : null

  return (
    <>
      <div className="match-hero panel">
        <div className="meta">
          {matchLabel(match)} · Ground {match.ground} · {match.kickoff}–{match.end_time}
          {match.status === 'live' && <span className="status-chip live" style={{ marginLeft: 8 }}>LIVE</span>}
          {match.status === 'finished' && <span className="status-chip finished" style={{ marginLeft: 8 }}>FULL TIME</span>}
        </div>
        <div className="teams">
          <div className="side">
            <TeamBadge team={home} label={match.home_slot} size={58} />
            {home ? <Link to={`/team/${home.id}`}>{home.name}</Link> : slotLabel(match.home_slot)}
          </div>
          <div className="big-score">
            {played ? `${match.home_score} – ${match.away_score}` : <span className="vs">vs</span>}
          </div>
          <div className="side">
            <TeamBadge team={away} label={match.away_slot} size={58} />
            {away ? <Link to={`/team/${away.id}`}>{away.name}</Link> : slotLabel(match.away_slot)}
          </div>
        </div>
      </div>

      <h2 className="page-title mt">Lineups</h2>
      <div className="pitch-wrap double">
        <LineupPanel team={home} slot={match.home_slot} lineup={homeLineup} color="home" />
        <LineupPanel team={away} slot={match.away_slot} lineup={awayLineup} color="away" />
      </div>
    </>
  )
}
