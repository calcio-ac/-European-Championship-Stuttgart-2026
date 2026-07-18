import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData, FORMATIONS, matchLabel } from '../lib/data.jsx'
import Pitch, { slotPositions } from './Pitch.jsx'

/**
 * Team sheet editor shared by the manager portal and the admin dashboard.
 * `save(matchId, formation, players)` must return { error } like a supabase call.
 */
export default function SheetEditor({ team, save }) {
  const { matches } = useData()
  const [players, setPlayers] = useState([])
  const [matchId, setMatchId] = useState('')
  const [formation, setFormation] = useState('2-3-1')
  const [starters, setStarters] = useState(Array(7).fill('')) // player ids per pitch slot
  const [subs, setSubs] = useState([])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const slot = `${team.group_code}${team.seed}`
  const teamMatches = matches.filter(
    (m) => m.home_slot === slot || m.away_slot === slot ||
           m.home_team_id === team.id || m.away_team_id === team.id
  )

  useEffect(() => {
    setMatchId('')
    setStarters(Array(7).fill(''))
    setSubs([])
    setMsg(null)
    supabase.from('players').select('*').eq('team_id', team.id).order('shirt_number')
      .then(({ data }) => setPlayers((data || []).filter((p) => p.role !== 'manager')))
  }, [team.id])

  // Load an existing sheet when a match is picked
  useEffect(() => {
    if (!matchId) return
    supabase.from('lineups').select('*').eq('match_id', matchId).eq('team_id', team.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFormation(data.formation)
          const s = Array(7).fill('')
          for (const p of data.players.filter((x) => x.role === 'starter')) s[p.slot] = p.player_id
          setStarters(s)
          setSubs(data.players.filter((x) => x.role === 'sub').map((x) => x.player_id))
        } else {
          setStarters(Array(7).fill(''))
          setSubs([])
        }
        setMsg(null)
      })
  }, [matchId, team.id])

  const positions = slotPositions(formation)
  const chosen = new Set([...starters.filter(Boolean), ...subs])

  const previewPlayers = starters
    .map((pid, idx) => {
      const p = players.find((x) => x.id === pid)
      return p ? { player_id: pid, name: p.name, number: p.shirt_number, role: 'starter', slot: idx } : null
    })
    .filter(Boolean)

  const toggleSub = (pid) => {
    if (subs.includes(pid)) setSubs(subs.filter((s) => s !== pid))
    else if (subs.length < 5) setSubs([...subs, pid])
    else setMsg({ type: 'error', text: 'Maximum 5 substitutes.' })
  }

  const submit = async () => {
    if (!matchId) return setMsg({ type: 'error', text: 'Pick a match first.' })
    setBusy(true)
    setMsg(null)
    const payload = [
      ...previewPlayers,
      ...subs.map((pid) => {
        const p = players.find((x) => x.id === pid)
        return { player_id: pid, name: p?.name, number: p?.shirt_number, role: 'sub', slot: null }
      }),
    ]
    const { error } = await save(matchId, formation, payload)
    setBusy(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else setMsg({ type: 'ok', text: 'Team sheet saved! It is now visible on the match page.' })
  }

  if (players.length === 0) {
    return <div className="alert info">This team has no squad yet — add players in the Squad section first.</div>
  }

  return (
    <div className="pitch-wrap double">
      <div className="panel">
        <h2>Team Sheet — {team.name}</h2>
        <div className="form-grid">
          <div>
            <label>Match</label>
            <select className="input" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">Select match…</option>
              {teamMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.kickoff} · {matchLabel(m)} · Ground {m.ground}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Formation (GK + {formation})</label>
            <select className="input" value={formation} onChange={(e) => setFormation(e.target.value)}>
              {FORMATIONS.map((f) => (
                <option key={f} value={f}>1-{f}</option>
              ))}
            </select>
          </div>
          <div className="slot-grid">
            <label>Starting 7</label>
            {positions.map((pos, idx) => (
              <select
                key={idx}
                className="input"
                value={starters[idx] || ''}
                onChange={(e) => {
                  const next = [...starters]
                  next[idx] = e.target.value
                  setStarters(next)
                }}
              >
                <option value="">{pos.gk ? 'Goalkeeper…' : `Outfield ${idx}…`}</option>
                {players
                  .filter((p) => p.id === starters[idx] || !chosen.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.shirt_number ?? '–'} {p.name} ({p.position})
                    </option>
                  ))}
              </select>
            ))}
          </div>
          <div>
            <label>Substitutes (max 5)</label>
            <div className="subs-list">
              {players.filter((p) => !starters.includes(p.id)).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip-btn ${subs.includes(p.id) ? 'active' : ''}`}
                  onClick={() => toggleSub(p.id)}
                >
                  #{p.shirt_number ?? '–'} {p.name}
                </button>
              ))}
            </div>
          </div>
          {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
          <button className="btn" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save team sheet'}
          </button>
        </div>
      </div>
      <div>
        <div className="lineup-header">
          Live preview <span className="formation">1-{formation}</span>
        </div>
        <Pitch formation={formation} players={previewPlayers} color="home" />
      </div>
    </div>
  )
}
