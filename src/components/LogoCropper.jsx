import { useEffect, useRef, useState } from 'react'

const V = 240 // viewport size in px

/**
 * Square crop/zoom editor: drag the image to position it, slider to zoom.
 * Calls onSave with a 256x256 PNG data URL.
 */
export default function LogoCropper({ src, onSave, onCancel }) {
  const imgRef = useRef(null)
  const drag = useRef(null)
  const [dim, setDim] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setDim({ w: img.width, h: img.height })
      const s = V / Math.min(img.width, img.height)
      setOffset({ x: (V - img.width * s) / 2, y: (V - img.height * s) / 2 })
      setZoom(1)
      setError('')
    }
    img.onerror = () => setError('Could not read this image — use a JPG or PNG file.')
    img.src = src
  }, [src])

  if (error) {
    return (
      <div className="alert error">
        {error} <button className="btn secondary small" onClick={onCancel}>Close</button>
      </div>
    )
  }
  if (!dim) return <div className="alert info">Loading image…</div>

  const s0 = V / Math.min(dim.w, dim.h)
  const s = s0 * zoom

  const clamp = (o, sc) => ({
    x: Math.min(0, Math.max(V - dim.w * sc, o.x)),
    y: Math.min(0, Math.max(V - dim.h * sc, o.y)),
  })

  const onPointerDown = (e) => {
    e.preventDefault()
    drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    setOffset(clamp({
      x: drag.current.ox + (e.clientX - drag.current.sx),
      y: drag.current.oy + (e.clientY - drag.current.sy),
    }, s))
  }
  const onPointerUp = () => { drag.current = null }

  const changeZoom = (z) => {
    // keep the viewport center fixed while zooming
    const cx = (V / 2 - offset.x) / s
    const cy = (V / 2 - offset.y) / s
    const ns = s0 * z
    setZoom(z)
    setOffset(clamp({ x: V / 2 - cx * ns, y: V / 2 - cy * ns }, ns))
  }

  const save = () => {
    const OUT = 256
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUT, OUT)
    ctx.drawImage(imgRef.current, -offset.x / s, -offset.y / s, V / s, V / s, 0, 0, OUT, OUT)
    onSave(canvas.toDataURL('image/png'))
  }

  return (
    <div className="cropper">
      <div
        className="cropper-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            width: dim.w,
            height: dim.h,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${s})`,
            transformOrigin: '0 0',
          }}
        />
        <div className="cropper-ring" />
      </div>
      <div className="cropper-controls">
        <label>Zoom</label>
        <input
          type="range" min="1" max="4" step="0.01" value={zoom}
          onChange={(e) => changeZoom(Number(e.target.value))}
        />
        <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 10px' }}>
          Drag the image to position it inside the square.
        </p>
        <div className="form-row">
          <button className="btn small" onClick={save}>Use this crop</button>
          <button className="btn secondary small" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
