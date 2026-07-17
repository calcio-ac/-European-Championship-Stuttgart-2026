import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useData, GROUPS, PHASE_LABELS } from '../lib/data.jsx'
import TeamBadge from '../components/TeamBadge.jsx'
import SheetEditor from '../components/SheetEditor.jsx'
import SquadEditor from '../components/SquadEditor.jsx'

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

export default function Admin() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(null) // null = checking

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
      setIsAdmin(null)
      return
    }
    // First signed-in user to open /admin claims the admin role.
    supabase.rpc('claim_admin').then(({ data, error }) => setIsAdmin(!error && !!data))
  }, [session])

  if (!ready) return <div className="spinner" />
  if (!session) return <AdminLogin />
  if (isAdmin === null) return <div className="spinner" />

  if (!isAdmin) {
    return (
      <div className="panel" style={{ maxWidth: 460, margin: '30px auto' }}>
        <h2>Not an admin</h2>
        <p className="muted">
          You are signed in as <b>{session.user.email}</b>, but this account has no admin access.
          An existing admin can grant it in Info &amp; Settings.
        </p>
        <button className="btn secondary" onClick={() => supabase.auth.signOut()}>Log out</button>
      </div>
    )
  }

  return <Dashboard email={session.user.email} />
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
      <h2>Admin Login</h2>
      <p className="muted">Sign in with the tournament admin account.</p>
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
          ['sheets', 'Team Sheets'],
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
  const [busy, setBusy] = useState(false)
  const [localMsg, setLocalMsg] = useState(null)

  useEffect(() => {
    setName(team.name)
    setShortName(team.short_name || '')
    setLogo(team.logo_url || '')
  }, [team])

  const pickLogo = async (file) => {
    if (!file) return
    setLocalMsg({ type: 'info', text: 'Reading image…' })
    let dataUrl
    try {
      dataUrl = await fileToDataUrl(file)
    } catch (err) {
      return setLocalMsg({ type: 'error', text: err.message })
    }
    setLogo(dataUrl)
    // save the logo immediately - no extra Save click needed
    setLocalMsg({ type: 'info', text: 'Uploading logo…' })
    const { error } = await supabase.rpc('admin_upsert_team', {
      p_id: team.id,
      p_name: team.name,
      p_short_name: team.short_name || null,
      p_group_code: team.group_code,
      p_seed: team.seed,
      p_logo_url: dataUrl,
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
            <label>Team logo (JPG or PNG)</label>
            <input
              className="input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              onChange={(e) => pickLogo(e.target.files?.[0])}
            />
          </div>
          {logo && <img src={logo} alt="logo" className="badge" style={{ width: 42, height: 42 }} />}
          {logo && <button className="btn secondary small" onClick={() => setLogo('')}>Remove logo</button>}
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
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_set_team_password', {
      p_team_id: team.id, p_new_password: password,
    })
    setBusy(false)
    if (error) return onError(error.message)
    setPassword('')
    onSaved(`Manager password set for ${team.name}. Share it with the manager — they log in by picking "${team.name}" on the Manager page.`)
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)' }}>
        Manager password (setting a new one replaces the old)
      </label>
      <div className="form-row" style={{ marginTop: 6 }}>
        <div className="grow">
          <input className="input" value={password} placeholder="Password for this team's manager"
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn small" onClick={save} disabled={busy || password.length < 4}>
          {busy ? 'Saving…' : 'Set password'}
        </button>
      </div>
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
  const [motmName, setMotmName] = useState(match.motm_name || '')
  const [motmPhoto, setMotmPhoto] = useState(match.motm_photo || '')
  const [busy, setBusy] = useState(false)

  const isKnockout = match.phase !== 'group'
  const homeName = teamById[match.home_team_id]?.name || teamBySlot[match.home_slot]?.name || match.home_slot
  const awayName = teamById[match.away_team_id]?.name || teamBySlot[match.away_slot]?.name || match.away_slot

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_update_match', {
      p_match_id: match.id,
      p_home_score: homeScore === '' ? null : Number(homeScore),
      p_away_score: awayScore === '' ? null : Number(awayScore),
      p_status: status,
      p_home_team_id: isKnockout && homeTeamId ? homeTeamId : null,
      p_away_team_id: isKnockout && awayTeamId ? awayTeamId : null,
      p_motm_name: motmName.trim(),
      p_motm_photo: motmPhoto,
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
      <div className="motm-row">
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 700, width: 88 }}>Man of the match</span>
        <input className="input grow" placeholder="Player name (empty to clear)"
          value={motmName} onChange={(e) => setMotmName(e.target.value)} />
        <input className="input grow" type="file" accept="image/png,image/jpeg,image/webp,image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              setMotmPhoto(await fileToDataUrl(f, 200))
            } catch (err) {
              onError(err.message)
            }
          }} />
        {motmPhoto && (
          <>
            <img src={motmPhoto} alt="Man of the match" className="badge" style={{ width: 40, height: 40 }} />
            <button className="btn secondary small" onClick={() => setMotmPhoto('')}>Remove photo</button>
          </>
        )}
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
        <h2>Submit a Team Sheet</h2>
        <p className="muted">
          Fill in or correct a squad and team sheet on behalf of any team — for example when a
          manager has no access on match day. The sheet appears on the match page exactly as if
          the manager submitted it.
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
        <>
          <SquadEditor
            team={team}
            save={(players) =>
              supabase.rpc('admin_save_squad', { p_team_id: team.id, p_players: players })
            }
          />
          <div className="mt" />
          <SheetEditor
            team={team}
            save={(matchId, formation, players) =>
              supabase.rpc('admin_save_lineup', {
                p_team_id: team.id, p_match_id: matchId, p_formation: formation, p_players: players,
              })
            }
          />
        </>
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
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setTournament(settings.tournament || {})
    setSections(settings.info_sections || [])
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
        {sections.map((s, i) => (
          <div key={i} className="form-grid" style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
            <div className="form-row">
              <input className="input grow" value={s.title} placeholder="Section title"
                onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <button className="btn danger small" onClick={() => setSections(sections.filter((_, j) => j !== i))}>Remove</button>
            </div>
            <textarea className="input" value={s.body} placeholder="Section text"
              onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
          </div>
        ))}
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
    </>
  )
}
