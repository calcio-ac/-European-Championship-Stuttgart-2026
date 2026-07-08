import { useData } from '../lib/data.jsx'

export default function Info() {
  const { settings, loading } = useData()
  if (loading) return <div className="spinner" />

  const sections = settings.info_sections || []
  const tournament = settings.tournament || {}

  return (
    <>
      <h1 className="page-title">Tournament Info</h1>
      {tournament.venue && (
        <div className="panel">
          <h2>Venue</h2>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{tournament.venue}</p>
        </div>
      )}
      {sections.map((s, i) => (
        <div key={i} className="panel">
          <h2>{s.title}</h2>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.65 }}>{s.body}</p>
        </div>
      ))}
      {sections.length === 0 && (
        <div className="alert info">No info published yet. The organizer can add sections in the Admin dashboard.</div>
      )}
    </>
  )
}
