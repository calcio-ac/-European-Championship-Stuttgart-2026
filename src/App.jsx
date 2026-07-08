import { useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Match from './pages/Match.jsx'
import Standings from './pages/Standings.jsx'
import Knockouts from './pages/Knockouts.jsx'
import Team from './pages/Team.jsx'
import Info from './pages/Info.jsx'
import Manager from './pages/Manager.jsx'
import Admin from './pages/Admin.jsx'
import { useData } from './lib/data.jsx'
import { CalendarIcon, TableIcon, BracketIcon, InfoIcon, UserIcon, ShieldIcon } from './components/Icons.jsx'

const NAV = [
  { to: '/', label: 'Fixtures', Icon: CalendarIcon },
  { to: '/standings', label: 'Tables', Icon: TableIcon },
  { to: '/knockouts', label: 'Bracket', Icon: BracketIcon },
  { to: '/info', label: 'Info', Icon: InfoIcon },
  { to: '/manager', label: 'Manager', Icon: UserIcon },
  { to: '/admin', label: 'Admin', Icon: ShieldIcon },
]

export default function App() {
  const { dbError } = useData()
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <NavLink to="/">
            <img src="/tournament-logo.png" alt="European Championship Stuttgart 2026" className="header-logo" />
          </NavLink>
          <NavLink to="/" className="header-title">
            European Championship
            <small>Stuttgart 2026</small>
          </NavLink>
          <nav className="header-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="page container">
        {dbError && (
          <div className="alert error">
            Could not load tournament data: {dbError}. If this is a fresh setup, run{' '}
            <code>supabase/schema.sql</code> in the Supabase SQL Editor.
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/match/:matchId" element={<Match />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/knockouts" element={<Knockouts />} />
          <Route path="/team/:teamId" element={<Team />} />
          <Route path="/info" element={<Info />} />
          <Route path="/manager" element={<Manager />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<div className="center muted mt">Page not found.</div>} />
        </Routes>

        <footer className="footer">
          <div className="footer-inner">
            <img src="/club-logo.png" alt="Stuttgart Indians FC" />
            <span>
              European Championship Stuttgart 2026 · Presented by <b>Stuttgart Indians FC</b>
            </span>
          </div>
        </footer>
      </main>

      <nav className="bottom-nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <span className="icon"><n.Icon /></span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
