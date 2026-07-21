import { useData, VENUE } from '../lib/data.jsx'
import { SponsorsMarquee } from '../components/Sponsors.jsx'
import { PinIcon, PdfIcon } from '../components/Icons.jsx'

export default function Info() {
  const { settings, loading } = useData()
  if (loading) return <div className="spinner" />

  const sections = settings.info_sections || []

  return (
    <>
      <h1 className="page-title">Tournament Info</h1>
      <div className="panel">
        <h2>Venue</h2>
        <p style={{ margin: '0 0 12px', lineHeight: 1.65 }}>
          {VENUE.address}<br />{VENUE.city}
        </p>
        <a className="btn secondary small" href={VENUE.mapsUrl} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <PinIcon width={15} height={15} /> Open in Google Maps
        </a>
      </div>
      {sections.map((s, i) => (
        <div key={i} className="panel">
          <h2>{s.title}</h2>
          {s.body && <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.65 }}>{s.body}</p>}
          {s.image && (
            <a href={s.image} target="_blank" rel="noreferrer">
              <img src={s.image} alt={s.title} className="info-image" />
            </a>
          )}
          {(s.files || []).length > 0 && (
            <div className="info-files">
              {s.files.map((f, fi) => (
                <a key={fi} className="info-file" href={f.url} target="_blank" rel="noreferrer">
                  <PdfIcon width={18} height={18} /> {f.name}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
      {sections.length === 0 && (
        <div className="alert info">No info published yet. The organizer can add sections in the Admin dashboard.</div>
      )}
      <SponsorsMarquee />
    </>
  )
}
