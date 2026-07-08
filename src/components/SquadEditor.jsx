import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const POSITIONS = ['GK', 'DF', 'MF', 'FW']

/**
 * Squad list editor shared by the manager portal and the admin dashboard.
 * `save(players)` must return { error } like a supabase call.
 */
export default function SquadEditor({ team, save }) {
  const [players, setPlayers] = useState([])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    supabase.from('players').select('*').eq('team_id', team.id).order('shirt_number')
      .then(({ data }) => setPlayers(data || []))
  useEffect(() => { load(); setMsg(null) }, [team.id])

  const update = (i, field, value) =>
    setPlayers(players.map((p, j) => (j === i ? { ...p, [field]: value } : p)))

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    const payload = players
      .filter((p) => p.name?.trim())
      .map((p) => ({ id: p.id || null, name: p.name.trim(), shirt_number: p.shirt_number ?? '', position: p.position }))
    const { error } = await save(payload)
    setBusy(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'ok', text: 'Squad saved!' }); load() }
  }

  return (
    <div className="panel">
      <h2>Squad List — {team.name}</h2>
      <p className="muted">Add all players here first — team sheets are picked from this list.</p>
      {players.map((p, i) => (
        <div key={p.id || `new-${i}`} className="list-row">
          <input className="input" style={{ width: 64 }} type="number" min="1" max="99" placeholder="#"
            value={p.shirt_number ?? ''} onChange={(e) => update(i, 'shirt_number', e.target.value)} />
          <input className="input grow" placeholder="Player name"
            value={p.name} onChange={(e) => update(i, 'name', e.target.value)} />
          <select className="input" style={{ width: 90 }} value={p.position}
            onChange={(e) => update(i, 'position', e.target.value)}>
            {POSITIONS.map((pos) => <option key={pos}>{pos}</option>)}
          </select>
          <button className="btn danger small" onClick={() => setPlayers(players.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <div className="form-row mt">
        <button className="btn secondary" onClick={() => setPlayers([...players, { name: '', shirt_number: '', position: 'MF' }])}>
          + Add player
        </button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save squad'}</button>
      </div>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
    </div>
  )
}
