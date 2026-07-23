import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData, resolveTeam, slotLabel, matchLabel, effectiveRoles } from '../lib/data.jsx'
import TeamBadge from '../components/TeamBadge.jsx'

const POSITION_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 }

const byPosition = (a, b) =>
  (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9) ||
  (a.shirt_number ?? 99) - (b.shirt_number ?? 99)

function PlayerRows({ list }) {
  return list.map((p) => (
    <tr key={p.id}>
      <td className="num pts" style={{ width: 34 }}>{p.shirt_number ?? '–'}</td>
      <td>{p.name}</td>
      <td className="muted" style={{ width: 40, textAlign: 'right' }}>{p.position}</td>
    </tr>
  ))
}

function SquadPanel({ team, slot, players }) {
  const all = players || []
  const mains = all.filter((p) => p.role === 'player').sort(byPosition)
  const reserves = all.filter((p) => p.role === 'reserve').sort(byPosition)
  const managers = all.filter((p) => p.role === 'manager')

  return (
    <div className="panel">
      <div className="lineup-header">
        <TeamBadge team={team} label={slot} />
        {team ? <Link to={`/team/${team.id}`}>{team.name}</Link> : slotLabel(slot)}
      </div>
      {all.length === 0 ? (
        <div className="alert info">Squad not submitted yet.</div>
      ) : (
        <>
          <div className="squad-heading">Players</div>
          {mains.length > 0
            ? <table className="table"><tbody><PlayerRows list={mains} /></tbody></table>
            : <p className="muted" style={{ margin: '4px 0' }}>None listed.</p>}

          {reserves.length > 0 && (
            <>
              <div className="squad-heading">Reserves</div>
              <table className="table"><tbody><PlayerRows list={reserves} /></tbody></table>
            </>
          )}
          {managers.length > 0 && (
            <>
              <div className="squad-heading">Manager</div>
              <div className="subs-list">
                {managers.map((m) => <span key={m.id} className="sub-chip">{m.name}</span>)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function Match() {
  const { matchId } = useParams()
  const { matches, teamById, teamBySlot, loading } = useData()
  const [stats, setStats] = useState([])
  const [squads, setSquads] = useState({})
  const [overrides, setOverrides] = useState([])

  const match = matches.find((m) => m.id === matchId)

  useEffect(() => {
    supabase
      .from('match_stats')
      .select('*')
      .eq('match_id', matchId)
      .then(({ data }) => setStats(data || []))
  }, [matchId])

  const home0 = match ? resolveTeam(match, 'home', teamById, teamBySlot) : null
  const away0 = match ? resolveTeam(match, 'away', teamById, teamBySlot) : null

  useEffect(() => {
    const ids = [home0?.id, away0?.id].filter(Boolean)
    if (ids.length === 0) return
    supabase.from('players').select('*').in('team_id', ids)
      .then(({ data }) => {
        const byTeam = {}
        for (const p of data || []) (byTeam[p.team_id] ||= []).push(p)
        setSquads(byTeam)
      })
    supabase.from('lineups').select('match_id, team_id, players').in('team_id', ids)
      .then(({ data }) => setOverrides(data || []))
  }, [home0?.id, away0?.id])

  const rosterFor = (team) =>
    team
      ? effectiveRoles(squads[team.id], overrides.filter((o) => o.team_id === team.id), matches, matchId)
      : []

  if (loading) return <div className="spinner" />
  if (!match) return <div className="alert info">Match not found.</div>

  const home = home0
  const away = away0
  const played = match.home_score != null && match.away_score != null && match.status !== 'scheduled'

  const scorers = stats.filter((s) => s.goals > 0)
  const homeScorers = home ? scorers.filter((s) => s.team_id === home.id) : []
  const awayScorers = away ? scorers.filter((s) => s.team_id === away.id) : []
  const scorerLabel = (s) => `${s.player_name}${s.goals > 1 ? ` (${s.goals})` : ''}`

  return (
    <>
      <div className="match-hero panel">
        <div className="meta">
          {matchLabel(match)} · Ground {match.ground} · {match.kickoff}–{match.end_time}
          {match.referee && <> · Ref: {match.referee}</>}
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
        {(homeScorers.length > 0 || awayScorers.length > 0) && (
          <div className="scorers">
            <div className="scorers-side">
              {homeScorers.map((s) => <div key={s.player_id}>{scorerLabel(s)}</div>)}
            </div>
            <div className="scorers-mid muted">Goals</div>
            <div className="scorers-side right">
              {awayScorers.map((s) => <div key={s.player_id}>{scorerLabel(s)}</div>)}
            </div>
          </div>
        )}
      </div>

      {match.motm_name && (
        <div className="panel motm-card">
          {match.motm_photo ? (
            <img src={match.motm_photo} alt={match.motm_name} className="motm-photo" />
          ) : (
            <span className="motm-photo motm-photo-fallback">{match.motm_name[0]}</span>
          )}
          <div>
            <div className="motm-label">Man of the Match</div>
            <div className="motm-name">{match.motm_name}</div>
          </div>
        </div>
      )}

      <h2 className="page-title mt">Squads</h2>
      <div className="pitch-wrap double">
        <SquadPanel team={home} slot={match.home_slot} players={rosterFor(home)} />
        <SquadPanel team={away} slot={match.away_slot} players={rosterFor(away)} />
      </div>
    </>
  )
}
