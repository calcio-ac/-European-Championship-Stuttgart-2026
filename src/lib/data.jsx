import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabase'

const DataContext = createContext(null)

export const GROUPS = ['A', 'B', 'C', 'D']

export const REFEREES = ['Oben Takor', 'Marley Michael', 'Joshua']

export const VENUE = {
  address: 'Im Obenhinaus 5, 71384 Weinstadt-Beutelsbach',
  city: 'Stuttgart',
  mapsUrl: 'https://maps.app.goo.gl/nrNgmQBxTS7htkgs5',
}

export const PHASE_LABELS = {
  group: 'Group Stage',
  quarterfinal: 'Quarterfinal',
  semifinal: 'Semifinal',
  final: 'Grand Final',
}

export function DataProvider({ children }) {
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)

  const refresh = useCallback(async () => {
    const [t, m, s] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('matches').select('*').order('sort_order'),
      supabase.from('settings').select('*'),
    ])
    if (t.error || m.error || s.error) {
      setDbError((t.error || m.error || s.error).message)
    } else {
      setDbError(null)
      setTeams(t.data)
      setMatches(m.data)
      setSettings(Object.fromEntries(s.data.map((r) => [r.key, r.value])))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000) // keep scores fresh on match day
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  const teamById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams])
  const teamBySlot = useMemo(() => {
    const map = {}
    for (const t of teams) {
      if (t.group_code && t.seed) map[`${t.group_code}${t.seed}`] = t
    }
    return map
  }, [teams])

  const value = { teams, matches, settings, loading, dbError, refresh, teamById, teamBySlot }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}

/** Human label for an unresolved slot code, e.g. 'W-A' -> 'Winner Group A'. */
export function slotLabel(slot) {
  if (/^[A-D][1-4]$/.test(slot)) return `Team ${slot}`
  if (slot.startsWith('W-')) {
    const src = slot.slice(2)
    return GROUPS.includes(src) ? `Winner Group ${src}` : `Winner ${src}`
  }
  if (slot.startsWith('RU-')) return `Runner-up Group ${slot.slice(3)}`
  return slot
}

/** Resolve one side of a match to a team object, or null if not decided yet. */
export function resolveTeam(match, side, teamById, teamBySlot) {
  const id = match[`${side}_team_id`]
  if (id && teamById[id]) return teamById[id]
  const slot = match[`${side}_slot`]
  return teamBySlot[slot] || null
}

export function matchLabel(match) {
  if (match.phase === 'group') return `Group ${match.group_code}`
  if (match.phase === 'final') return 'Grand Final'
  return `${PHASE_LABELS[match.phase]} ${match.id.slice(2) || ''}`.trim()
}

/** Group table from finished group matches. Tiebreak: points, GD, GF, name. */
export function computeStandings(group, matches, teamBySlot) {
  const rows = {}
  for (const code of ['1', '2', '3', '4']) {
    const team = teamBySlot[`${group}${code}`]
    const key = `${group}${code}`
    rows[key] = { slot: key, team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }
  }
  for (const m of matches) {
    if (m.phase !== 'group' || m.group_code !== group) continue
    if (m.status !== 'finished' || m.home_score == null || m.away_score == null) continue
    const home = rows[m.home_slot]
    const away = rows[m.away_slot]
    if (!home || !away) continue
    home.played++; away.played++
    home.gf += m.home_score; home.ga += m.away_score
    away.gf += m.away_score; away.ga += m.home_score
    if (m.home_score > m.away_score) { home.won++; away.lost++; home.points += 3 }
    else if (m.home_score < m.away_score) { away.won++; home.lost++; away.points += 3 }
    else { home.drawn++; away.drawn++; home.points++; away.points++ }
  }
  return Object.values(rows).sort((a, b) =>
    b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf ||
    (a.team?.name || a.slot).localeCompare(b.team?.name || b.slot)
  ).map((r) => ({ ...r, gd: r.gf - r.ga }))
}

/** Formations for 7-a-side: outfield rows from defense to attack (GK is implicit). */
export const FORMATIONS = ['2-3-1', '3-2-1', '2-2-2', '3-1-2', '1-3-2', '2-1-3']

export function formationRows(formation) {
  return formation.split('-').map(Number)
}
