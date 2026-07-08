import { formationRows } from '../lib/data.jsx'

/**
 * Slot positions for a 7-a-side lineup on a vertical pitch.
 * Slot 0 is always the goalkeeper; slots 1..6 fill formation rows
 * from defense to attack, left to right.
 */
export function slotPositions(formation) {
  const rows = formationRows(formation)
  const positions = [{ x: 50, y: 88, gk: true }]
  const yStart = 66
  const yEnd = 16
  const step = rows.length > 1 ? (yStart - yEnd) / (rows.length - 1) : 0
  rows.forEach((count, rowIdx) => {
    const y = rows.length === 1 ? (yStart + yEnd) / 2 : yStart - rowIdx * step
    for (let i = 0; i < count; i++) {
      const x = ((i + 1) / (count + 1)) * 100
      positions.push({ x, y, gk: false })
    }
  })
  return positions
}

export default function Pitch({ formation, players, color = 'home' }) {
  const positions = slotPositions(formation)
  const starters = (players || []).filter((p) => p.role === 'starter')

  return (
    <div className="pitch">
      <div className="halfway" />
      <div className="center-circle" />
      {starters.map((p) => {
        const pos = positions[p.slot] || positions[0]
        return (
          <div
            key={p.slot}
            className={`pitch-player ${color} ${pos.gk ? 'gk' : ''}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className="dot">{p.number ?? ''}</div>
            <div className="pname">{p.name}</div>
          </div>
        )
      })}
    </div>
  )
}
