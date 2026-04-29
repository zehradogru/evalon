'use client'

import { useEffect, useRef } from 'react'

// ─── Land region bounding boxes [minLat, maxLat, minLon, maxLon] ─────────────
const LAND: [number, number, number, number][] = [
  [24, 70, -125, -52],   // North America (main)
  [55, 71, -170, -130],  // Alaska
  [60, 83, -54, -17],    // Greenland
  [8, 24, -100, -77],    // Central America
  [18, 23, -85, -74],    // Cuba
  [18, 20, -74, -68],    // Hispaniola
  [-56, 12, -82, -34],   // South America
  [35, 71, -9, 40],      // Europe
  [50, 59, -8, 2],       // UK / Ireland
  [63, 67, -24, -13],    // Iceland
  [74, 81, 10, 30],      // Svalbard
  [-34, 37, -17, 52],    // Africa
  [-26, -12, 43, 51],    // Madagascar
  [12, 31, 34, 60],      // Arabian Peninsula
  [8, 35, 60, 89],       // Indian Subcontinent
  [5, 10, 79, 82],       // Sri Lanka
  [10, 77, 40, 142],     // Asia (main + Siberia + China)
  [5, 30, 95, 115],      // Southeast Asia mainland
  [-6, 5, 95, 108],      // Sumatra
  [-4, 7, 108, 119],     // Borneo
  [-5, 2, 119, 127],     // Sulawesi
  [-9, -6, 105, 116],    // Java
  [-10, 0, 130, 150],    // New Guinea
  [5, 20, 117, 127],     // Philippines
  [31, 45, 130, 146],    // Japan
  [22, 25, 120, 122],    // Taiwan
  [-44, -10, 113, 154],  // Australia
  [-47, -34, 166, 178],  // New Zealand
  [50, 62, 156, 170],    // Kamchatka
]

// ─── Ocean exclusions within land regions ────────────────────────────────────
const OCEAN: [number, number, number, number][] = [
  [51, 64, -95, -79],    // Hudson Bay
  [18, 30, -97, -83],    // Gulf of Mexico
  [33, 42, 0, 30],       // Mediterranean interior
  [37, 47, 49, 54],      // Caspian Sea
  [7, 22, 80, 97],       // Bay of Bengal
  [0, 22, 107, 121],     // South China Sea
  [35, 52, 128, 142],    // Sea of Japan
]

function isLand(lat: number, lon: number): boolean {
  if (!LAND.some(([a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d)) return false
  if (OCEAN.some(([a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d)) return false
  return true
}

// Seeded PRNG for deterministic dot generation (no SSR mismatch)
function sRand(s: number) {
  const x = Math.sin(s + 1) * 10000
  return x - Math.floor(x)
}

// Pre-compute land dots at module level (computed once, reused everywhere)
const DOTS: [number, number][] = (() => {
  const result: [number, number][] = []
  for (let i = 0; i < 22000; i++) {
    const lat = sRand(i * 2) * 180 - 90
    const lon = sRand(i * 2 + 1) * 360 - 180
    if (isLand(lat, lon)) result.push([lat, lon])
  }
  return result
})()

// Major trading hubs [lat, lon]
const CITIES: [number, number][] = [
  [40.7, -74.0],    // New York
  [51.5, -0.1],     // London
  [48.8, 2.3],      // Paris
  [35.7, 139.7],    // Tokyo
  [1.3, 103.8],     // Singapore
  [19.1, 72.9],     // Mumbai
  [-33.9, 151.2],   // Sydney
  [31.2, 121.5],    // Shanghai
  [25.2, 55.3],     // Dubai
  [-23.5, -46.6],   // Sao Paulo
  [55.8, 37.6],     // Moscow
  [41.0, 29.0],     // Istanbul
]

// Arc connections between trading hubs
const ARCS: [number, number][] = [
  [0, 1],  // New York ↔ London
  [1, 3],  // London ↔ Tokyo
  [3, 4],  // Tokyo ↔ Singapore
  [4, 8],  // Singapore ↔ Dubai
  [0, 9],  // New York ↔ Sao Paulo
  [1, 11], // London ↔ Istanbul
  [6, 4],  // Sydney ↔ Singapore
  [10, 11],// Moscow ↔ Istanbul
  [2, 5],  // Paris ↔ Mumbai
  [7, 3],  // Shanghai ↔ Tokyo
]

interface GlobeCanvasProps {
  size?: number
  className?: string
}

export function GlobeCanvas({ size = 480, className = '' }: GlobeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotRef = useRef(0)
  const rafRef = useRef<number>(0)
  // Each arc has its own progress offset so they're staggered
  const arcRef = useRef(ARCS.map((_, i) => (i * 0.11) % 1))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctxRaw = canvas.getContext('2d')
    if (!ctxRaw) return
    const ctx: CanvasRenderingContext2D = ctxRaw

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const S = size
    canvas.width = S * dpr
    canvas.height = S * dpr
    ctx.scale(dpr, dpr)

    const cx = S / 2
    const cy = S / 2
    const R = S * 0.41

    // 3D sphere projection: lat/lon → (x, y, z)
    function toXYZ(lat: number, lon: number): [number, number, number] {
      const φ = (lat * Math.PI) / 180
      const λ = ((lon + rotRef.current) * Math.PI) / 180
      return [
        Math.cos(φ) * Math.sin(λ),
        -Math.sin(φ),
        Math.cos(φ) * Math.cos(λ),
      ]
    }

    function project(x: number, y: number): [number, number] {
      return [cx + x * R, cy + y * R]
    }

    // Linear interpolation between lat/lon for arc drawing
    function arcPoints(
      lat1: number, lon1: number,
      lat2: number, lon2: number,
      segments: number
    ): Array<[number, number, number]> {
      const pts: Array<[number, number, number]> = []
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        // Slight altitude boost for arc effect (raise midpoint)
        const arc = Math.sin(t * Math.PI) * 0.15
        const lat = lat1 + (lat2 - lat1) * t
        const lon = lon1 + (lon2 - lon1) * t
        const [x, y, z] = toXYZ(lat, lon)
        // Apply arc lift perpendicular to sphere surface
        const scale = 1 + arc
        pts.push([x * scale, y * scale, z * scale])
      }
      return pts
    }

    let lastTime = 0

    function draw(time: number) {
      const delta = Math.min((time - lastTime) / 16.67, 3)
      lastTime = time

      ctx.clearRect(0, 0, S, S)

      // ── Atmosphere outer glow ──
      const atm = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.2)
      atm.addColorStop(0, 'rgba(40, 98, 255, 0.18)')
      atm.addColorStop(0.5, 'rgba(124, 58, 237, 0.08)')
      atm.addColorStop(1, 'rgba(40, 98, 255, 0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = atm
      ctx.fill()

      // ── Globe dark surface ──
      const surf = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, 0, cx, cy, R)
      surf.addColorStop(0, 'rgba(10, 15, 45, 0.92)')
      surf.addColorStop(0.7, 'rgba(5, 8, 28, 0.95)')
      surf.addColorStop(1, 'rgba(2, 4, 18, 0.98)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = surf
      ctx.fill()

      // ── Latitude grid lines (subtle) ──
      ctx.save()
      ctx.globalAlpha = 0.06
      for (let lat = -60; lat <= 60; lat += 30) {
        const φ = (lat * Math.PI) / 180
        const ry = Math.cos(φ) * R
        const yOff = -Math.sin(φ) * R
        ctx.beginPath()
        ctx.ellipse(cx, cy + yOff, ry, ry * 0.08, 0, 0, Math.PI * 2)
        ctx.strokeStyle = '#2862ff'
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
      ctx.restore()

      const rot = rotRef.current

      // ── Land dots ──
      for (const [lat, lon] of DOTS) {
        const [x, y, z] = toXYZ(lat, lon)
        if (z < 0) continue
        const [sx, sy] = project(x, y)
        const alpha = Math.pow(z, 0.4) * 0.85
        const dotR = 0.9 + z * 0.9
        ctx.beginPath()
        ctx.arc(sx, sy, dotR, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(41, 98, 255, ${alpha})`
        ctx.fill()
      }

      // ── Arc connections (comet-style) ──
      for (let i = 0; i < ARCS.length; i++) {
        const [ci, cj] = ARCS[i]
        const p = arcRef.current[i]
        const [lat1, lon1] = CITIES[ci]
        const [lat2, lon2] = CITIES[cj]

        const SEG = 64
        const tailLen = 0.28
        const tail = p - tailLen
        const head = p

        const pts = arcPoints(lat1, lon1, lat2, lon2, SEG)

        // Faint full-arc background line
        ctx.beginPath()
        let lineStarted = false
        for (let s = 0; s <= SEG; s++) {
          const [x, y, z] = pts[s]
          if (z < 0) { lineStarted = false; continue }
          const [sx, sy] = project(x, y)
          if (!lineStarted) { ctx.moveTo(sx, sy); lineStarted = true }
          else ctx.lineTo(sx, sy)
        }
        ctx.strokeStyle = 'rgba(41, 98, 255, 0.1)'
        ctx.lineWidth = 0.8
        ctx.stroke()

        // Bright comet segment
        ctx.beginPath()
        let started = false
        for (let s = 0; s <= SEG; s++) {
          const t = s / SEG
          if (t < Math.max(0, tail) || t > Math.min(1, head)) continue
          const [x, y, z] = pts[s]
          if (z < 0) { started = false; continue }
          const [sx, sy] = project(x, y)
          if (!started) { ctx.moveTo(sx, sy); started = true }
          else ctx.lineTo(sx, sy)
        }

        // Gradient comet: bright head, fading tail
        const [headX, headY] = (() => {
          const headIdx = Math.min(SEG, Math.floor(head * SEG))
          const [x, y] = pts[headIdx]
          return project(x, y)
        })()
        const [tailX, tailY] = (() => {
          const tailIdx = Math.max(0, Math.floor(Math.max(0, tail) * SEG))
          const [x, y] = pts[tailIdx]
          return project(x, y)
        })()
        const cometGrad = ctx.createLinearGradient(tailX, tailY, headX, headY)
        cometGrad.addColorStop(0, 'rgba(41, 98, 255, 0)')
        cometGrad.addColorStop(0.6, 'rgba(100, 160, 255, 0.5)')
        cometGrad.addColorStop(1, 'rgba(180, 220, 255, 0.9)')
        ctx.strokeStyle = cometGrad
        ctx.lineWidth = 1.5
        ctx.stroke()

        arcRef.current[i] = (p + 0.003 * delta) % 1.3
      }

      // ── City dots ──
      for (const [lat, lon] of CITIES) {
        const [x, y, z] = toXYZ(lat, lon)
        if (z < 0) continue
        const [sx, sy] = project(x, y)
        const alpha = Math.min(1, z * 2.5)

        // Outer glow
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9)
        glow.addColorStop(0, `rgba(80, 150, 255, ${alpha * 0.5})`)
        glow.addColorStop(0.5, `rgba(41, 98, 255, ${alpha * 0.2})`)
        glow.addColorStop(1, 'rgba(41, 98, 255, 0)')
        ctx.beginPath()
        ctx.arc(sx, sy, 9, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Center dot
        ctx.beginPath()
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fill()

        // Inner ring
        ctx.beginPath()
        ctx.arc(sx, sy, 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(100, 160, 255, ${alpha * 0.6})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      // ── Globe border ring ──
      const ring = ctx.createLinearGradient(cx - R, cy, cx + R, cy)
      ring.addColorStop(0, 'rgba(41, 98, 255, 0.9)')
      ring.addColorStop(0.3, 'rgba(124, 58, 237, 0.6)')
      ring.addColorStop(0.7, 'rgba(124, 58, 237, 0.6)')
      ring.addColorStop(1, 'rgba(41, 98, 255, 0.9)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = ring
      ctx.lineWidth = 1.2
      ctx.stroke()

      // ── Highlight shine (top-left) ──
      const shine = ctx.createRadialGradient(
        cx - R * 0.35, cy - R * 0.35, 0,
        cx - R * 0.35, cy - R * 0.35, R * 0.55
      )
      shine.addColorStop(0, 'rgba(255, 255, 255, 0.04)')
      shine.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = shine
      ctx.fill()

      rotRef.current += 0.04 * delta

      void rot // suppress unused warning
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={className}
    />
  )
}
