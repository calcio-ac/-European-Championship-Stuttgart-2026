export default function TeamBadge({ team, label, size }) {
  const style = size ? { width: size, height: size, fontSize: size * 0.36 } : undefined
  if (team?.logo_url) {
    return <img className="badge" style={style} src={team.logo_url} alt={team.name} />
  }
  const initials = (team?.short_name || team?.name || label || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
  return (
    <span className="badge-fallback" style={style}>
      {initials}
    </span>
  )
}
