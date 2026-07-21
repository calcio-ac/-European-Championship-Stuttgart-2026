import { useData, resolveTeam, slotLabel, matchLabel } from '../lib/data.jsx'
import { SponsorsMarquee } from '../components/Sponsors.jsx'

export default function MoM() {
  const { matches, teamById, teamBySlot, loading } = useData()
  if (loading) return <div className="spinner" />

  const winners = matches.filter((m) => m.motm_name)

  return (
    <>
      <h1 className="page-title">Man of the Match</h1>
      {winners.length === 0 ? (
        <div className="alert info">
          The Man of the Match album fills up as awards are given out on match day.
        </div>
      ) : (
        <div className="mom-album">
          {winners.map((m) => {
            const home = resolveTeam(m, 'home', teamById, teamBySlot)
            const away = resolveTeam(m, 'away', teamById, teamBySlot)
            const played = m.home_score != null && m.away_score != null
            return (
              <div key={m.id} className="panel mom-card">
                {m.motm_photo ? (
                  <img src={m.motm_photo} alt={m.motm_name} className="mom-award-photo" />
                ) : (
                  <span className="mom-award-photo mom-photo-fallback">{m.motm_name[0]}</span>
                )}
                <div className="mom-label">Man of the Match</div>
                <div className="mom-award-name">{m.motm_name}</div>
                <div className="muted" style={{ fontSize: 14, fontWeight: 600 }}>
                  {home ? home.name : slotLabel(m.home_slot)}
                  {played ? ` ${m.home_score} – ${m.away_score} ` : ' vs '}
                  {away ? away.name : slotLabel(m.away_slot)}
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>{matchLabel(m)} · {m.kickoff}</div>
              </div>
            )
          })}
        </div>
      )}
      <SponsorsMarquee />
    </>
  )
}
