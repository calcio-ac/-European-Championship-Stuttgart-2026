import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData, GROUPS, PHASE_LABELS, REFEREES, effectiveRoles } from '../lib/data.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import SquadEditor from '../components/SquadEditor.jsx'
import LogoCropper from '../components/LogoCropper.jsx'

/** Downscale an image file to a small square data URL we can store directly in the DB. */
function fileToDataUrl(file, size = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not read "${file.name}" — use a JPG or PNG image (HEIC photos from iPhone are not supported by browsers).`))
    }
    img.src = url
  })
}

/** Upload a file to the public "media" bucket and return its public URL. */
async function uploadToStorage(file, folder) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
  const { error } = await supabase.storage.from('media').upload(path, file, { upsert: false })
  if (error) throw error
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

export default function Admin() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState(null) // null = checking, 'admin' | 'coordinator' | 'none'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setRole(null)
      return
    }
    // First signed-in user to open /admin claims the admin role.
    supabase.rpc('claim_admin').then(async ({ data, error }) => {
      if (!error && data) return setRole('admin')
      const { data: coord } = await supabase.rpc('is_coordinator')
      setRole(coord ? 'coordinator' : 'none')
    })
  }, [session])

  if (!ready) return <div className="spinner" />
  if (!session) return <AdminLogin />
  if (role === null) return <div className="spinner" />

  if (role === 'none') {
    return (
      <div className="panel" style={{ maxWidth: 460, margin: '30px auto' }}>
        <h2>No access</h2>
        <p className="muted">
          You are signed in as <b>{session.user.email}</b>, but this account has no admin or
          coordinator access. An admin can grant it in Info &amp; Settings.
        </p>
        <button className="btn secondary" onClick={() => supabase.auth.signOut()}>Log out</button>
      </div>
    )
  }

  if (role === 'coordinator') return <CoordinatorDashboard email={session.user.email} />
  return <Dashboard email={session.user.email} />
}

function CoordinatorDashboard({ email }) {
  const [tab, setTab] = useState('scores')
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Coordinator</h1>
          <div className="muted" style={{ fontSize: 13 }}>{email}</div>
        </div>
        <button className="btn secondary small" style={{ marginLeft: 'auto' }} onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </div>
      <div className="tabs mt">
        <button className={tab === 'scores' ? 'active' : ''} onClick={() => setTab('scores')}>Scores</button>
        <button className={tab === 'squads' ? 'active' : ''} onClick={() => setTab('squads')}>Team Squads</button>
      </div>
      {tab === 'scores' ? <ScoresTab /> : <AdminSheetsTab />}
    </>
  )
}

function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="panel" style={{ maxWidth: 440, margin: '30px auto' }}>
      <h2>Admin / Coordinator Login</h2>
      <p className="muted">Sign in with your admin or coordinator account.</p>
      <form className="form-grid" onSubmit={signIn}>
        <div>
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="alert error">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Working…' : 'Sign in'}</button>
      </form>
    </div>
  )
}

function Dashboard({ email }) {
  const [tab, setTab] = useState('teams')
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Admin Dashboard</h1>
          <div className="muted" style={{ fontSize: 13 }}>{email}</div>
        </div>
        <button className="btn secondary small" style={{ marginLeft: 'auto' }} onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </div>
      <div className="tabs mt">
        {[
          ['teams', 'Teams & Managers'],
          ['schedule', 'Schedule'],
          ['scores', 'Scores'],
          ['sheets', 'Squads'],
          ['knockouts', 'Knockouts'],
          ['settings', 'Info & Settings'],
        ].map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'teams' && <TeamsTab />}
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'scores' && <ScoresTab />}
      {tab === 'sheets' && <AdminSheetsTab />}
      {tab === 'knockouts' && <KnockoutsTab />}
      {tab === 'settings' && <SettingsTab />}
    </>
  )
}

/* ---------------- Teams & Managers ---------------- */

function TeamsTab() {
  const { teams, refresh } = useData()
  const [msg, setMsg] = useState(null)
  const onSaved = (text) => { setMsg({ type: 'ok', text }); refresh() }
  const onError = (text) => setMsg({ type: 'error', text })

  const unassigned = teams.filter((t) => !t.group_code)

  return (
    <>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

      <div className="panel">
        <h2>Group Draw</h2>
        <p className="muted">
          Once the draw is made, assign each team to a seat. The fixtures, standings, and manager
          match lists fill in automatically. {unassigned.length > 0 && <b>{unassigned.length} team(s) still undrawn.</b>}
        </p>
        <div className="match-list" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(420px, 100%), 1fr))' }}>
          {GROUPS.map((g) => (
            <div key={g}>
              <h3>Group {g}</h3>
              {[1, 2, 3, 4].map((seed) => (
                <DrawSeat key={`${g}${seed}`} group={g} seed={seed}
                  team={teams.find((t) => t.group_code === g && t.seed === seed)}
                  unassigned={unassigned} onSaved={onSaved} onError={onError} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>All Teams ({teams.length})</h2>
        <p className="muted">Edit each team's name, logo, and manager password here.</p>
        {teams.map((t) => (
          <TeamRow key={t.id} team={t} onSaved={onSaved} onError={onError} />
        ))}
        <AddTeamRow onSaved={onSaved} onError={onError} />
      </div>
    </>
  )
}

function DrawSeat({ group, seed, team, unassigned, onSaved, onError }) {
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)

  const assign = async (teamId, g, s, note) => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_assign_team', {
      p_team_id: teamId, p_group_code: g, p_seed: s,
    })
    setBusy(false)
    if (error) onError(error.message)
    else { setPick(''); onSaved(note) }
  }

  return (
    <div className="list-row">
      <span className="muted" style={{ width: 30, fontWeight: 800 }}>{group}{seed}</span>
      {team ? (
        <>
          <TeamBadge team={team} label={`${group}${seed}`} size={26} />
          <span className="grow" style={{ fontWeight: 700 }}>{team.name}</span>
          <button className="btn secondary small" disabled={busy}
            onClick={() => assign(team.id, null, null, `${team.name} removed from ${group}${seed}.`)}>
            Unassign
          </button>
        </>
      ) : (
        <>
          <select className="input grow" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Empty seat — pick team…</option>
            {unassigned.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn small" disabled={busy || !pick}
            onClick={() => assign(pick, group, seed, `Team assigned to ${group}${seed}.`)}>
            Assign
          </button>
        </>
      )}
    </div>
  )
}

function TeamRow({ team, onSaved, onError }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(team.name)
  const [shortName, setShortName] = useState(team.short_name || '')
  const [logo, setLogo] = useState(team.logo_url || '')
  const [volName, setVolName] = useState(team.volunteer_name || '')
  const [volPhone, setVolPhone] = useState(team.volunteer_phone || '')
  const [busy, setBusy] = useState(false)
  const [localMsg, setLocalMsg] = useState(null)

  useEffect(() => {
    setName(team.name)
    setShortName(team.short_name || '')
    setLogo(team.logo_url || '')
    setVolName(team.volunteer_name || '')
    setVolPhone(team.volunteer_phone || '')
  }, [team])

  const [cropSrc, setCropSrc] = useState(null)

  const pickLogo = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.onerror = () => setLocalMsg({ type: 'error', text: `Could not read "${file.name}".` })
    reader.readAsDataURL(file)
  }

  // save the logo immediately once cropped - no extra Save click needed
  const uploadLogo = async (dataUrl) => {
    setCropSrc(null)
    setLogo(dataUrl)
    setLocalMsg({ type: 'info', text: 'Uploading logo…' })
    const { error } = await supabase.rpc('admin_upsert_team', {
      p_id: team.id,
      p_name: team.name,
      p_short_name: team.short_name || null,
      p_group_code: team.group_code,
      p_seed: team.seed,
      p_logo_url: dataUrl,
      p_volunteer_name: team.volunteer_name || null,
      p_volunteer_phone: team.volunteer_phone || null,
    })
    if (error) setLocalMsg({ type: 'error', text: `Logo NOT saved: ${error.message}` })
    else {
      setLocalMsg({ type: 'ok', text: 'Logo saved!' })
      onSaved(`Logo saved for ${team.name}.`)
    }
  }

  const save = async () => {
    setBusy(true)
    setLocalMsg(null)
    const { error } = await supabase.rpc('admin_upsert_team', {
      p_id: team.id,
      p_name: name,
      p_short_name: shortName || null,
      p_group_code: team.group_code,
      p_seed: team.seed,
      p_logo_url: logo || null,
      p_volunteer_name: volName || null,
      p_volunteer_phone: volPhone || null,
    })
    setBusy(false)
    if (error) {
      setLocalMsg({ type: 'error', text: error.message })
      onError(error.message)
    } else {
      setEditing(false)
      onSaved(`Saved ${name}.`)
    }
  }

  const remove = async () => {
    if (!confirm(`Delete ${team.name}? This also removes their squad and team sheets.`)) return
    const { error } = await supabase.rpc('admin_delete_team', { p_team_id: team.id })
    if (error) onError(error.message)
    else onSaved(`Deleted ${team.name}.`)
  }

  if (!editing) {
    return (
      <div className="list-row">
        <TeamBadge team={team} size={28} />
        <span className="grow" style={{ fontWeight: 700 }}>
          {team.name}
          <span className="muted" style={{ marginLeft: 8, fontSize: 12, fontWeight: 700 }}>
            {team.group_code ? `${team.group_code}${team.seed}` : 'undrawn'}
          </span>
        </span>
        <button className="btn secondary small" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn danger small" onClick={remove}>Delete</button>
      </div>
    )
  }

  return (
    <div className="list-row" style={{ alignItems: 'stretch' }}>
      <div className="form-grid" style={{ width: '100%' }}>
        <div className="form-row">
          <div className="grow">
            <label>Team name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ width: 110 }}>
            <label>Short name</label>
            <input className="input" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="FCE" />
          </div>
        </div>
        <div className="form-row">
          <div className="grow">
            <label>Team logo (JPG, JPEG, PNG or WEBP)</label>
            <input
              className="input"
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp"
              onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = '' }}
            />
          </div>
          {logo && <img src={logo} alt="logo" className="badge" style={{ width: 42, height: 42 }} />}
          {logo && !cropSrc && (
            <button className="btn secondary small" onClick={() => setCropSrc(logo)}>Adjust crop / zoom</button>
          )}
          {logo && <button className="btn secondary small" onClick={() => setLogo('')}>Remove logo</button>}
        </div>
        {cropSrc && <LogoCropper src={cropSrc} onSave={uploadLogo} onCancel={() => setCropSrc(null)} />}
        <div className="form-row">
          <div className="grow">
            <label>Volunteer name</label>
            <input className="input" value={volName} placeholder="e.g. Arun"
              onChange={(e) => setVolName(e.target.value)} />
          </div>
          <div className="grow">
            <label>Volunteer WhatsApp number (with country code)</label>
            <input className="input" value={volPhone} placeholder="e.g. +49 151 23456789"
              onChange={(e) => setVolPhone(e.target.value)} />
          </div>
        </div>
        {localMsg && <div className={`alert ${localMsg.type}`}>{localMsg.text}</div>}
        <div className="form-row">
          <button className="btn small" onClick={save} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="btn secondary small" onClick={() => setEditing(false)}>Cancel</button>
        </div>
        <ManagerPassword team={team} onSaved={onSaved} onError={onError} />
      </div>
    </div>
  )
}

function AddTeamRow({ onSaved, onError }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_upsert_team', {
      p_id: null, p_name: name, p_short_name: null,
      p_group_code: null, p_seed: null, p_logo_url: null,
    })
    setBusy(false)
    if (error) onError(error.message)
    else { setName(''); onSaved(`Added ${name}.`) }
  }

  return (
    <div className="form-row mt">
      <div className="grow">
        <input className="input" value={name} placeholder="New team name"
          onChange={(e) => setName(e.target.value)} />
      </div>
      <button className="btn secondary" onClick={add} disabled={busy || !name.trim()}>+ Add team</button>
    </div>
  )
}

/** Set the password the team's manager uses to log in to /manager. */
function ManagerPassword({ team, onSaved, onError }) {
  const [password, setPassword] = useState('')
  const [saved, setSaved] = useState(null)  // the password confirmed saved
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_set_team_password', {
      p_team_id: team.id, p_new_password: password,
    })
    setBusy(false)
    if (error) return onError(error.message)
    setSaved(password)  // keep the typed password on screen
    onSaved(`Manager password for ${team.name} saved.`)
  }

  const reveal = async () => {
    const { data, error } = await supabase.rpc('admin_get_team_password', { p_team_id: team.id })
    if (error) return onError(error.message)
    setPassword(data || '')
    setSaved(data ? null : '')
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)' }}>
        Manager password (setting a new one replaces the old)
      </label>
      <div className="form-row" style={{ marginTop: 6 }}>
        <div className="grow">
          <input className="input" value={password} placeholder="Password for this team's manager"
            onChange={(e) => { setPassword(e.target.value); setSaved(null) }} />
        </div>
        <button className="btn small" onClick={save} disabled={busy || password.length < 4}>
          {busy ? 'Saving…' : 'Set password'}
        </button>
        <button className="btn secondary small" type="button" onClick={reveal}>
          Show current
        </button>
      </div>
      {/* live readout: what you typed / what was saved */}
      {password && (
        <div className={`alert ${saved === password ? 'ok' : 'info'}`} style={{ marginTop: 8 }}>
          {saved === password ? 'Saved password: ' : 'Password entered: '}
          <b style={{ fontFamily: 'monospace', fontSize: 16 }}>{password}</b>
          {saved === password && ` — share this with ${team.name}'s manager.`}
        </div>
      )}
      {saved === '' && <div className="alert info" style={{ marginTop: 8 }}>No password set for this team yet.</div>}
    </div>
  )
}

/* ---------------- Schedule ---------------- */

function ScheduleTab() {
  const { matches, refresh } = useData()
  const [newTime, setNewTime] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const first = matches[0]
  const last = matches[matches.length - 1]

  const shift = async () => {
    setBusy(true)
    setNote('')
    const { data, error } = await supabase.rpc('admin_shift_schedule', { p_first_kickoff: newTime })
    setBusy(false)
    setNote(error ? `Error: ${error.message}` : data)
    refresh()
  }

  return (
    <div className="panel">
      <h2>Shift the Schedule</h2>
      <p className="muted">
        Change the kickoff time of the first match and every other match moves with it —
        all durations, gaps, and breaks stay exactly the same. Current schedule:
        first kickoff <b>{first?.kickoff}</b>, final ends <b>{last?.end_time}</b>.
      </p>
      <div className="form-row">
        <div>
          <label>New first kickoff</label>
          <input className="input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
        </div>
        <button className="btn" onClick={shift} disabled={busy || !newTime}>
          {busy ? 'Shifting…' : 'Shift all matches'}
        </button>
      </div>
      {note && <div className="alert info mt">{note}</div>}
    </div>
  )
}

/* ---------------- Scores ---------------- */

function ScoresTab() {
  const { matches, refresh } = useData()
  const [msg, setMsg] = useState(null)

  const phases = ['group', 'quarterfinal', 'semifinal', 'final']
  return (
    <>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
      {phases.map((phase) => (
        <div key={phase} className="panel">
          <h2>{PHASE_LABELS[phase]}{phase === 'quarterfinal' || phase === 'semifinal' ? 's' : ''}</h2>
          {matches.filter((m) => m.phase === phase).map((m) => (
            <ScoreRow key={m.id} match={m}
              onSaved={(text) => { setMsg({ type: 'ok', text }); refresh() }}
              onError={(text) => setMsg({ type: 'error', text })} />
          ))}
        </div>
      ))}
    </>
  )
}

function ScoreRow({ match, onSaved, onError }) {
  const { teamById, teamBySlot, teams } = useData()
  const [homeScore, setHomeScore] = useState(match.home_score ?? '')
  const [awayScore, setAwayScore] = useState(match.away_score ?? '')
  const [status, setStatus] = useState(match.status)
  const [homeTeamId, setHomeTeamId] = useState(match.home_team_id || '')
  const [awayTeamId, setAwayTeamId] = useState(match.away_team_id || '')
  const [showDetails, setShowDetails] = useState(false)
  const [referee, setReferee] = useState(match.referee || '')
  const [busy, setBusy] = useState(false)

  const isKnockout = match.phase !== 'group'
  const homeTeam = teamById[match.home_team_id] || teamBySlot[match.home_slot]
  const awayTeam = teamById[match.away_team_id] || teamBySlot[match.away_slot]
  const homeName = homeTeam?.name || match.home_slot
  const awayName = awayTeam?.name || match.away_slot

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_update_match', {
      p_match_id: match.id,
      p_home_score: homeScore === '' ? null : Number(homeScore),
      p_away_score: awayScore === '' ? null : Number(awayScore),
      p_status: status,
      p_home_team_id: isKnockout && homeTeamId ? homeTeamId : null,
      p_away_team_id: isKnockout && awayTeamId ? awayTeamId : null,
    })
    setBusy(false)
    if (error) onError(error.message)
    else onSaved(`${match.id} updated.`)
  }

  return (
    <div className="list-row">
      <span className="muted" style={{ width: 88, fontSize: 12.5, fontWeight: 700 }}>
        {match.id} · {match.kickoff}<br />G{match.ground}
      </span>
      {isKnockout ? (
        <select className="input grow" value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)}>
          <option value="">{match.home_slot} (auto)</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      ) : (
        <span className="grow" style={{ fontWeight: 700 }}>{homeName}</span>
      )}
      <input className="input" style={{ width: 58 }} type="number" min="0" placeholder="–"
        value={homeScore} onChange={(e) => setHomeScore(e.target.value)} />
      <span className="muted">:</span>
      <input className="input" style={{ width: 58 }} type="number" min="0" placeholder="–"
        value={awayScore} onChange={(e) => setAwayScore(e.target.value)} />
      {isKnockout ? (
        <select className="input grow" value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}>
          <option value="">{match.away_slot} (auto)</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      ) : (
        <span className="grow" style={{ fontWeight: 700, textAlign: 'right' }}>{awayName}</span>
      )}
      <select className="input" style={{ width: 118 }} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="scheduled">Scheduled</option>
        <option value="live">Live</option>
        <option value="finished">Finished</option>
      </select>
      <button className="btn small" onClick={save} disabled={busy}>{busy ? '…' : 'Save'}</button>
      <button className="btn secondary small" onClick={() => setShowDetails(!showDetails)}>
        {showDetails ? 'Hide details' : 'Details'}
      </button>
      <div className="ref-row">
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>Referee</span>
        {isKnockout ? (
          <select className="input" style={{ maxWidth: 200 }} value={referee}
            onChange={async (e) => {
              setReferee(e.target.value)
              const { error } = await supabase.rpc('admin_set_referee', { p_match_id: match.id, p_referee: e.target.value })
              if (error) onError(error.message); else onSaved(`${match.id} referee set.`)
            }}>
            <option value="">Select referee…</option>
            {REFEREES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : (
          <span style={{ fontWeight: 700 }}>{match.referee || '–'}</span>
        )}
      </div>
      {showDetails && (
        <MatchDetails match={match} homeTeam={homeTeam} awayTeam={awayTeam}
          onSaved={onSaved} onError={onError} />
      )}
    </div>
  )
}

/** Per-player goals/assists/cards plus Man of the Match, for one match. */
function MatchDetails({ match, homeTeam, awayTeam, onSaved, onError }) {
  const [players, setPlayers] = useState([])
  const [stats, setStats] = useState({})
  const [motmId, setMotmId] = useState('')
  const [motmPhoto, setMotmPhoto] = useState(match.motm_photo || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const teamIds = [homeTeam?.id, awayTeam?.id].filter(Boolean)

  useEffect(() => {
    if (teamIds.length === 0) return
    Promise.all([
      supabase.from('players').select('*').in('team_id', teamIds).order('shirt_number'),
      supabase.from('match_stats').select('*').eq('match_id', match.id),
    ]).then(([p, s]) => {
      const squad = (p.data || []).filter((x) => x.role !== 'manager')
      setPlayers(squad)
      const st = {}
      for (const row of s.data || []) {
        st[row.player_id] = { goals: row.goals, assists: row.assists, yellows: row.yellows, reds: row.reds }
      }
      setStats(st)
      const motm = squad.find((x) => x.name === match.motm_name)
      setMotmId(motm ? motm.id : '')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, homeTeam?.id, awayTeam?.id])

  if (teamIds.length < 2) {
    return <div className="alert info" style={{ flexBasis: '100%' }}>Assign both teams to this match first (make the draw / advance winners).</div>
  }
  if (players.length === 0) {
    return <div className="alert info" style={{ flexBasis: '100%' }}>No squads submitted yet for these teams.</div>
  }

  const getStat = (pid) => stats[pid] || { goals: 0, assists: 0, yellows: 0, reds: 0 }
  const setStat = (pid, field, val) =>
    setStats({ ...stats, [pid]: { ...getStat(pid), [field]: val === '' ? 0 : Math.max(0, Number(val)) } })

  const save = async () => {
    setBusy(true)
    setMsg(null)
    const payload = players
      .map((p) => ({ player_id: p.id, team_id: p.team_id, player_name: p.name, ...getStat(p.id) }))
      .filter((r) => r.goals + r.assists + r.yellows + r.reds > 0)
    const motmPlayer = players.find((p) => p.id === motmId)
    const r1 = await supabase.rpc('admin_save_match_stats', { p_match_id: match.id, p_stats: payload })
    const r2 = await supabase.rpc('admin_set_motm', {
      p_match_id: match.id,
      p_motm_name: motmPlayer?.name || '',
      p_motm_photo: motmPlayer ? motmPhoto : '',
    })
    setBusy(false)
    const error = r1.error || r2.error
    if (error) {
      setMsg({ type: 'error', text: error.message })
      onError(error.message)
    } else {
      setMsg({ type: 'ok', text: 'Match details saved.' })
      onSaved(`${match.id} details saved.`)
    }
  }

  const teamOf = (p) => (p.team_id === homeTeam.id ? homeTeam : awayTeam)

  return (
    <div style={{ flexBasis: '100%', borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Player</th><th>Team</th>
            <th className="num">Goals</th><th className="num">Assists</th>
            <th className="num">Yellow</th><th className="num">Red</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const s = getStat(p.id)
            return (
              <tr key={p.id}>
                <td>#{p.shirt_number ?? '–'} {p.name}</td>
                <td className="muted">{teamOf(p).short_name || teamOf(p).name}</td>
                {['goals', 'assists', 'yellows', 'reds'].map((f) => (
                  <td key={f} className="num">
                    <input className="input" style={{ width: 54, padding: '6px 8px' }} type="number" min="0"
                      value={s[f] || ''} placeholder="0"
                      onChange={(e) => setStat(p.id, f, e.target.value)} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="form-row mt">
        <div className="grow">
          <label>Man of the Match</label>
          <select className="input" value={motmId} onChange={(e) => setMotmId(e.target.value)}>
            <option value="">None selected</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({teamOf(p).short_name || teamOf(p).name})
              </option>
            ))}
          </select>
        </div>
        <div className="grow">
          <label>Photo (optional)</label>
          <input className="input" type="file" accept="image/*,.jpg,.jpeg,.png,.webp"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                setMotmPhoto(await fileToDataUrl(f, 200))
              } catch (err) {
                setMsg({ type: 'error', text: err.message })
              }
            }} />
        </div>
        {motmPhoto && <img src={motmPhoto} alt="Man of the match" className="badge" style={{ width: 40, height: 40 }} />}
        <button className="btn small" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button>
      </div>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

      <h3 style={{ marginBottom: 4 }}>Player / Reserve for this match</h3>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
        Overrides only affect this match onward (later matches keep this list until you change it again).
      </p>
      <div className="pitch-wrap double">
        <MatchRoster match={match} team={homeTeam} onSaved={onSaved} onError={onError} />
        <MatchRoster match={match} team={awayTeam} onSaved={onSaved} onError={onError} />
      </div>
    </div>
  )
}

/** Per-match player/reserve override for one team (carries forward to later matches). */
function MatchRoster({ match, team, onSaved, onError }) {
  const { matches } = useData()
  const [roster, setRoster] = useState([]) // effective, editable
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!team) return
    Promise.all([
      supabase.from('players').select('*').eq('team_id', team.id).order('shirt_number'),
      supabase.from('lineups').select('match_id, team_id, players').eq('team_id', team.id),
    ]).then(([p, o]) => {
      setRoster(effectiveRoles(p.data || [], o.data || [], matches, match.id).filter((x) => x.role !== 'manager'))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id, match.id])

  if (!team) return null

  const toggle = (id) =>
    setRoster(roster.map((p) => (p.id === id ? { ...p, role: p.role === 'reserve' ? 'player' : 'reserve' } : p)))

  const saveRoster = async () => {
    setBusy(true)
    const payload = roster.map((p) => ({ player_id: p.id, role: p.role }))
    const { error } = await supabase.rpc('admin_save_match_roster', {
      p_match_id: match.id, p_team_id: team.id, p_roster: payload,
    })
    setBusy(false)
    if (error) onError(error.message)
    else onSaved(`${team.short_name || team.name} roster set from ${match.id} onward.`)
  }

  const revert = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_clear_match_roster', { p_match_id: match.id, p_team_id: team.id })
    setBusy(false)
    if (error) onError(error.message)
    else onSaved(`${team.short_name || team.name} override for ${match.id} removed.`)
  }

  return (
    <div className="panel">
      <div className="lineup-header">
        <TeamBadge team={team} size={24} /> {team.name}
      </div>
      {roster.map((p) => (
        <div key={p.id} className="list-row" style={{ padding: '5px 0' }}>
          <span className="num pts" style={{ width: 28 }}>{p.shirt_number ?? '–'}</span>
          <span className="grow">{p.name}</span>
          <button
            className={`chip-btn ${p.role === 'reserve' ? 'active' : ''}`}
            onClick={() => toggle(p.id)}
          >
            {p.role === 'reserve' ? 'Reserve' : 'Player'}
          </button>
        </div>
      ))}
      <div className="form-row mt">
        <button className="btn small" onClick={saveRoster} disabled={busy}>{busy ? 'Saving…' : 'Save roster'}</button>
        <button className="btn secondary small" onClick={revert} disabled={busy}>Revert to previous</button>
      </div>
    </div>
  )
}

/* ---------------- Team sheets (admin) ---------------- */

function AdminSheetsTab() {
  const { teams } = useData()
  const [teamId, setTeamId] = useState('')
  const team = teams.find((t) => t.id === teamId)

  return (
    <>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h2>Edit a Team's Squad</h2>
        <p className="muted">
          Add or correct any team's squad — including promoting a reserve to player or
          transferring a player to another team — on behalf of a manager. Changes show up
          on the team and match pages immediately.
        </p>
        <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ maxWidth: 340 }}>
          <option value="">Select team…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.group_code ? `${t.group_code}${t.seed} · ` : ''}{t.name}
            </option>
          ))}
        </select>
      </div>
      {team && (
        <SquadEditor
          team={team}
          save={(players) =>
            supabase.rpc('admin_save_squad', { p_team_id: team.id, p_players: players })
          }
        />
      )}
    </>
  )
}

/* ---------------- Knockouts ---------------- */

function KnockoutsTab() {
  const { refresh } = useData()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const advance = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_advance_knockouts')
    setBusy(false)
    setNote(error ? `Error: ${error.message}` : data)
    refresh()
  }

  return (
    <div className="panel">
      <h2>Advance Winners</h2>
      <p className="muted">
        Once all matches of a group are marked <b>Finished</b>, this fills the quarterfinal pairings from the
        group tables (points → goal difference → goals scored). Finished quarterfinals and semifinals push
        their winners into the next round automatically. If a knockout match ends in a draw, decide it on
        penalties and set the winning team manually in the <b>Scores</b> tab.
      </p>
      <button className="btn" onClick={advance} disabled={busy}>
        {busy ? 'Working…' : 'Advance winners now'}
      </button>
      {note && <div className="alert info mt">{note}</div>}
    </div>
  )
}

/* ---------------- Settings ---------------- */

function SettingsTab() {
  const { settings, refresh } = useData()
  const [tournament, setTournament] = useState(settings.tournament || {})
  const [sections, setSections] = useState(settings.info_sections || [])
  const [newPassword, setNewPassword] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newCoordEmail, setNewCoordEmail] = useState('')
  const [coordinators, setCoordinators] = useState([])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const loadCoordinators = () =>
    supabase.rpc('admin_list_coordinators').then(({ data }) => setCoordinators(data || []))

  useEffect(() => {
    setTournament(settings.tournament || {})
    setSections(settings.info_sections || [])
    loadCoordinators()
  }, [settings])

  const saveAll = async () => {
    setBusy(true)
    setMsg(null)
    const r1 = await supabase.rpc('admin_save_setting', { p_key: 'tournament', p_value: tournament })
    const r2 = await supabase.rpc('admin_save_setting', { p_key: 'info_sections', p_value: sections })
    setBusy(false)
    const error = r1.error || r2.error
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'ok', text: 'Settings saved.' }); refresh() }
  }

  const changePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setMsg({ type: 'ok', text: 'Admin password changed.' })
      setNewPassword('')
    }
  }

  const addAdmin = async () => {
    const { data, error } = await supabase.rpc('admin_add_admin', { p_email: newAdminEmail })
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setMsg({ type: 'ok', text: data })
      setNewAdminEmail('')
    }
  }

  const addCoordinator = async () => {
    const { data, error } = await supabase.rpc('admin_add_coordinator', { p_email: newCoordEmail })
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'ok', text: data }); setNewCoordEmail(''); loadCoordinators() }
  }

  const removeCoordinator = async (email) => {
    const { data, error } = await supabase.rpc('admin_remove_coordinator', { p_email: email })
    if (error) setMsg({ type: 'error', text: error.message })
    else { setMsg({ type: 'ok', text: data }); loadCoordinators() }
  }

  return (
    <>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
      <div className="panel">
        <h2>Tournament</h2>
        <div className="form-row">
          <div className="grow">
            <label>Date</label>
            <input className="input" type="date" value={tournament.date || ''}
              onChange={(e) => setTournament({ ...tournament, date: e.target.value || null })} />
          </div>
          <div className="grow">
            <label>Venue / address</label>
            <input className="input" value={tournament.venue || ''} placeholder="Ground name, street, city"
              onChange={(e) => setTournament({ ...tournament, venue: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Info Page Sections</h2>
        <p className="muted">Each section can have text, one image, and any number of PDF attachments. Remember to press <b>Save all settings</b> when done.</p>
        {sections.map((s, i) => {
          const patch = (changes) => setSections(sections.map((x, j) => (j === i ? { ...x, ...changes } : x)))
          return (
            <div key={i} className="form-grid" style={{ borderBottom: '1px solid var(--border)', padding: '14px 0' }}>
              <div className="form-row">
                <input className="input grow" value={s.title} placeholder="Section title"
                  onChange={(e) => patch({ title: e.target.value })} />
                <button className="btn danger small" onClick={() => setSections(sections.filter((_, j) => j !== i))}>Remove</button>
              </div>
              <textarea className="input" value={s.body} placeholder="Section text (optional)"
                onChange={(e) => patch({ body: e.target.value })} />

              <div className="form-row">
                <div className="grow">
                  <label>Image (optional)</label>
                  <input className="input" type="file" accept="image/*,.jpg,.jpeg,.png,.webp"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setMsg({ type: 'info', text: 'Uploading image…' })
                      try { patch({ image: await uploadToStorage(f, 'info') }); setMsg({ type: 'ok', text: 'Image uploaded — press Save all settings.' }) }
                      catch (err) { setMsg({ type: 'error', text: err.message }) }
                      e.target.value = ''
                    }} />
                </div>
                {s.image && <img src={s.image} alt="" className="badge" style={{ width: 46, height: 46, borderRadius: 8 }} />}
                {s.image && <button className="btn secondary small" onClick={() => patch({ image: null })}>Remove image</button>}
              </div>

              <div>
                <label>PDF attachments (optional)</label>
                {(s.files || []).map((f, fi) => (
                  <div key={fi} className="list-row">
                    <span className="grow">{f.name}</span>
                    <button className="btn danger small"
                      onClick={() => patch({ files: s.files.filter((_, k) => k !== fi) })}>Remove</button>
                  </div>
                ))}
                <input className="input mt" type="file" accept="application/pdf,.pdf"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setMsg({ type: 'info', text: 'Uploading PDF…' })
                    try {
                      const url = await uploadToStorage(f, 'info')
                      patch({ files: [...(s.files || []), { name: f.name, url }] })
                      setMsg({ type: 'ok', text: 'PDF uploaded — press Save all settings.' })
                    } catch (err) { setMsg({ type: 'error', text: err.message }) }
                    e.target.value = ''
                  }} />
              </div>
            </div>
          )
        })}
        <div className="form-row mt">
          <button className="btn secondary" onClick={() => setSections([...sections, { title: '', body: '' }])}>+ Add section</button>
          <button className="btn" onClick={saveAll} disabled={busy}>{busy ? 'Saving…' : 'Save all settings'}</button>
        </div>
      </div>

      <div className="panel">
        <h2>Admin Account</h2>
        <div className="form-row">
          <div className="grow">
            <label>New password</label>
            <input className="input" type="password" value={newPassword} placeholder="New admin password (min 6 chars)"
              onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <button className="btn danger" onClick={changePassword} disabled={newPassword.length < 6}>
            Change password
          </button>
        </div>
        <div className="form-row mt">
          <div className="grow">
            <label>Add another admin (they must sign up first)</label>
            <input className="input" type="email" value={newAdminEmail} placeholder="colleague@email.com"
              onChange={(e) => setNewAdminEmail(e.target.value)} />
          </div>
          <button className="btn secondary" onClick={addAdmin} disabled={!newAdminEmail.includes('@')}>
            Grant admin access
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Coordinators</h2>
        <p className="muted">
          Coordinators can log in and <b>only edit team squads</b> — nothing else. First create their
          account in Supabase → Authentication → Users (Add user, Auto Confirm), then add the email here.
        </p>
        {coordinators.length > 0 && coordinators.map((email) => (
          <div key={email} className="list-row">
            <span className="grow" style={{ fontWeight: 700 }}>{email}</span>
            <button className="btn danger small" onClick={() => removeCoordinator(email)}>Remove</button>
          </div>
        ))}
        <div className="form-row mt">
          <div className="grow">
            <label>Coordinator email (account must exist in Supabase Auth)</label>
            <input className="input" type="email" value={newCoordEmail} placeholder="coordinator@email.com"
              onChange={(e) => setNewCoordEmail(e.target.value)} />
          </div>
          <button className="btn secondary" onClick={addCoordinator} disabled={!newCoordEmail.includes('@')}>
            Add coordinator
          </button>
        </div>
      </div>
    </>
  )
}
