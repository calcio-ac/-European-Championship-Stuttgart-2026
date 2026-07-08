import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data.jsx'
import SheetEditor from '../components/SheetEditor.jsx'
import SquadEditor from '../components/SquadEditor.jsx'

const SESSION_KEY = 'managerSession'

export default function Manager() {
  const { loading } = useData()
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  })

  const login = (s) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
  }
  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  if (loading) return <div className="spinner" />
  if (!session) return <Login onLogin={login} />
  return <Portal session={session} onLogout={logout} />
}

function Login({ onLogin }) {
  const { teams } = useData()
  const [teamId, setTeamId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase.rpc('manager_login', {
      p_team_id: teamId, p_password: password,
    })
    setBusy(false)
    if (error) setError(error.message)
    else onLogin({ teamId: data.id, name: data.name, password })
  }

  return (
    <div className="panel" style={{ maxWidth: 440, margin: '30px auto' }}>
      <h2>Manager Login</h2>
      <p className="muted">
        Select your team and enter the password you received from the tournament organizers
        to manage your squad and submit team sheets.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <div>
          <label>Team</label>
          <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
            <option value="">Select your team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {teams.length === 0 && (
            <p className="muted" style={{ fontSize: 12.5 }}>No teams yet — the organizer adds them in the admin dashboard.</p>
          )}
        </div>
        <div>
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="alert error">{error}</div>}
        <button className="btn" disabled={busy || !teamId}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}

function Portal({ session, onLogout }) {
  const { teams } = useData()
  const [tab, setTab] = useState('squad')

  const team = teams.find((t) => t.id === session.teamId)
  if (!team) {
    return (
      <div className="panel" style={{ maxWidth: 480, margin: '30px auto' }}>
        <p className="muted">Your team no longer exists — please log in again.</p>
        <button className="btn secondary" onClick={onLogout}>Back to login</button>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{team.name} — Manager Portal</h1>
        <button className="btn secondary small" style={{ marginLeft: 'auto' }} onClick={onLogout}>Log out</button>
      </div>
      <div className="tabs mt">
        <button className={tab === 'squad' ? 'active' : ''} onClick={() => setTab('squad')}>Squad</button>
        <button className={tab === 'sheets' ? 'active' : ''} onClick={() => setTab('sheets')}>Team Sheets</button>
      </div>
      {tab === 'squad' ? (
        <SquadEditor
          team={team}
          save={(players) =>
            supabase.rpc('manager_save_squad', {
              p_team_id: team.id, p_password: session.password, p_players: players,
            })
          }
        />
      ) : (
        <SheetEditor
          team={team}
          save={(matchId, formation, players) =>
            supabase.rpc('manager_save_lineup', {
              p_team_id: team.id, p_password: session.password,
              p_match_id: matchId, p_formation: formation, p_players: players,
            })
          }
        />
      )}
    </>
  )
}
