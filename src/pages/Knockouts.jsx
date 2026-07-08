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

  const byId = (id) => matches.find((m) => m.id === id)
  // QF1+QF3 feed SF1 and QF2+QF4 feed SF2, so order them as adjacent pairs
  const pairs = [
    [byId('QF1'), byId('QF3')],
    [byId('QF2'), byId('QF4')],
  ]
  const semis = [byId('SF1'), byId('SF2')]
  const final = byId('F')

  return (
    <>
      <h1 className="page-title">Knockout Bracket</h1>
      <div className="bracket-scroll">
        <div className="bracket-tree">
          <div className="tree-col">
            <div className="bracket-col-title">Quarterfinals</div>
            <div className="tree-body">
              {pairs.map((pair, i) => (
                <div key={i} className="tree-pair link-join">
                  {pair.map((m) => m && (
                    <div key={m.id} className="tree-slot link-out">
                      <BracketMatch match={m} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="tree-col">
            <div className="bracket-col-title">Semifinals</div>
            <div className="tree-body">
              <div className="tree-pair link-join">
                {semis.map((m) => m && (
                  <div key={m.id} className="tree-slot link-in link-out">
                    <BracketMatch match={m} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="tree-col">
            <div className="bracket-col-title">Grand Final</div>
            <div className="tree-body">
              <div className="tree-slot link-in">
                {final && <BracketMatch match={final} />}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="muted mt">
        Pairings fill in automatically as group games and knockout rounds finish. Trophy ceremony at 17:45.
      </p>
    </>
  )
}
