import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/data.jsx'
import SquadEditor from '../components/SquadEditor.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import { WhatsAppIcon } from '../components/Icons.jsx'

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
  const { teams, settings } = useData()

  const deadline = settings.lineup_deadline
    ? new Date(settings.lineup_deadline).toLocaleString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null
  const pastDeadline = settings.lineup_deadline && new Date() > new Date(settings.lineup_deadline)

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
      {deadline && (
        <div className={`alert ${pastDeadline ? 'error' : 'info'} mt`}>
          {pastDeadline
            ? `The team-list submission deadline (${deadline}) has passed. Please contact the organizers for any changes.`
            : `Submit your full squad by ${deadline}. After that, contact the organizers to promote a reserve or transfer a player.`}
        </div>
      )}
      <div className="mt">
        <SquadEditor
          team={team}
          save={(players) =>
            supabase.rpc('manager_save_squad', {
              p_team_id: team.id, p_password: session.password, p_players: players,
            })
          }
        />
      </div>
      <VolunteersPanel />
    </>
  )
}

/** Team volunteer contacts — visible only inside the manager portal, not on the public site. */
function VolunteersPanel() {
  const { teams } = useData()
  const withVol = teams.filter((t) => t.volunteer_name || t.volunteer_phone)
  if (withVol.length === 0) return null
  return (
    <div className="panel mt">
      <h2>Team Volunteers</h2>
      <p className="muted">Contact any team's volunteer directly. These details are only visible to logged-in managers.</p>
      {withVol.map((t) => (
        <div key={t.id} className="list-row">
          <TeamBadge team={t} size={26} />
          <span className="grow" style={{ fontWeight: 700 }}>
            {t.name}
            {t.volunteer_name && <span className="muted" style={{ fontWeight: 600 }}> · {t.volunteer_name}</span>}
          </span>
          {t.volunteer_phone && (
            <a className="btn whatsapp-btn small"
              href={`https://wa.me/${t.volunteer_phone.replace(/[^\d]/g, '')}`}
              target="_blank" rel="noreferrer">
              <WhatsAppIcon width={16} height={16} /> WhatsApp
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
