// Sponsor logos live in public/sponsors/ — file names must match `file` below.
const MAIN_SPONSORS = [
  { name: 'Masalo — New Traditional Twist', file: 'masalo.png' },
  { name: 'NConsulting', file: 'nconsulting.png' },
]

const CO_SPONSORS = [
  { name: 'Indus Barrel — The Spirit of India', file: 'indus-barrel.png' },
  { name: 'MAK International — Tajmahal Store.eu', file: 'tajmahal-store.png' },
  { name: 'ADC — Allied Data Center', file: 'adc.png' },
  { name: 'Spice Route — Timeless Flavours from Kerala', file: 'spice-route.png' },
  { name: 'Financial Buddy', file: 'financial-buddy.png' },
  { name: 'Malayali', file: 'malayali.png' },
  { name: 'Foodeza', file: 'foodeza.png' },
  { name: 'Laksh Homes GmbH — Builders & Construction', file: 'laksh-homes.png' },
  { name: 'TicketVerz', file: 'ticketverz.png' },
  { name: 'Malayali Kada — Food ART Foodies GmbH', file: 'malayali-kada.png' },
]

function SponsorCard({ sponsor, large }) {
  return (
    <div className={`sponsor-card ${large ? 'large' : ''}`} title={sponsor.name}>
      <img
        src={`/sponsors/${sponsor.file}`}
        alt={sponsor.name}
        loading="lazy"
        onError={(e) => {
          // logo file not added yet: show the sponsor name instead
          e.target.style.display = 'none'
          e.target.nextSibling.style.display = 'block'
        }}
      />
      <span className="sponsor-fallback" style={{ display: 'none' }}>{sponsor.name}</span>
    </div>
  )
}

/** Continuously flowing banner with every sponsor, for secondary pages. */
export function SponsorsMarquee() {
  const items = [...MAIN_SPONSORS, ...CO_SPONSORS]
  return (
    <div className="sponsor-marquee" aria-label="Sponsors">
      <div className="sponsor-marquee-track">
        {[0, 1].map((dup) => (
          <div className="sponsor-marquee-half" key={dup} aria-hidden={dup === 1}>
            {items.map((s) => (
              <div key={s.file} className="sponsor-card marquee-item" title={s.name}>
                <img src={`/sponsors/${s.file}`} alt={s.name} loading="lazy" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Sponsors() {
  return (
    <section className="sponsors">
      <div className="sponsors-title">Sponsored by</div>
      <div className="sponsors-row main">
        {MAIN_SPONSORS.map((s) => <SponsorCard key={s.file} sponsor={s} large />)}
      </div>
      <div className="sponsors-title">Co-sponsors</div>
      <div className="sponsors-row">
        {CO_SPONSORS.map((s) => <SponsorCard key={s.file} sponsor={s} />)}
      </div>
    </section>
  )
}
