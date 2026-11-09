import type { EdgeStyle } from "@/lib/edge-style"

export const EDGE_PAD = 0.2

const MARGIN = 0.18
/** Extra reach on a shared cut so the two clipped edges overlap and hide the hairline. */
const OVERLAP = 0.015

type Size = "s" | "m" | "l"

type Seam = {
  size: Size
  /** 0: the lesser index owns the outward shape. 1: the greater index owns it. */
  out: 0 | 1
}

export type SeamMap = {
  horizontal: Seam[][]
  vertical: Seam[][]
}

const COUNT: Record<Exclude<EdgeStyle, "rectangular">, Record<Size, number>> = {
  wavy: { s: 4, m: 3, l: 2 },
  jagged: { s: 5, m: 3, l: 2 },
  beads: { s: 4, m: 3, l: 2 },
}

const AMP: Record<"wavy" | "jagged", Record<Size, number>> = {
  wavy: { s: 0.08, m: 0.13, l: 0.2 },
  jagged: { s: 0.08, m: 0.14, l: 0.2 },
}

export function seamMap(slug: string, cols: number, rows: number): SeamMap {
  const random = mulberry32(hashSeed(`${slug}:${cols}x${rows}`))
  const sizes: Size[] = ["s", "m", "l"]
  const horizontal = Array.from({ length: Math.max(0, rows - 1) }, () =>
    Array.from({ length: cols }, () => ({ size: sizes[Math.floor(random() * sizes.length)], out: (random() < 0.5 ? 0 : 1) as 0 | 1 })),
  )
  const vertical = Array.from({ length: rows }, () =>
    Array.from({ length: Math.max(0, cols - 1) }, () => ({ size: sizes[Math.floor(random() * sizes.length)], out: (random() < 0.5 ? 0 : 1) as 0 | 1 })),
  )
  return { horizontal, vertical }
}

export function pieceClipPath(style: EdgeStyle, seams: SeamMap, col: number, row: number, cols: number, rows: number, aspect: number): string | null {
  if (style === "rectangular") return null
  const shape = aspect > 0 ? aspect : 1
  const top = row === 0 ? null : seams.horizontal[row - 1][col]
  const right = col === cols - 1 ? null : seams.vertical[row][col]
  const bottom = row === rows - 1 ? null : seams.horizontal[row][col]
  const left = col === 0 ? null : seams.vertical[row][col - 1]
  const points: Array<[number, number]> = []
  append(points, samples(style, top?.size), (t) => {
    const rise = riseOf(style, top, t, shape)
    const edge = top ? (top.out === 1 ? -rise : rise) : 0
    return [t, edge - (top ? OVERLAP : 0)]
  })
  append(points, samples(style, right?.size), (t) => {
    const rise = riseOf(style, right, t, 1 / shape)
    const edge = right ? (right.out === 0 ? 1 + rise : 1 - rise) : 1
    return [edge + (right ? OVERLAP : 0), t]
  }, true)
  append(points, samples(style, bottom?.size), (t) => {
    const rise = riseOf(style, bottom, t, shape)
    const edge = bottom ? (bottom.out === 0 ? 1 + rise : 1 - rise) : 1
    return [t, edge + (bottom ? OVERLAP : 0)]
  }, true, true)
  append(points, samples(style, left?.size), (t) => {
    const rise = riseOf(style, left, t, 1 / shape)
    const edge = left ? (left.out === 1 ? -rise : rise) : 0
    return [edge - (left ? OVERLAP : 0), t]
  }, true, true)
  if (!points.length) return null
  const [first, ...rest] = points
  return `M ${coord(first[0])} ${coord(first[1])} ${rest.map((point) => `L ${coord(point[0])} ${coord(point[1])}`).join(" ")} Z`
}

export function shapedBackground(col: number, row: number, cols: number, rows: number, cellWidth?: number, cellHeight?: number) {
  const scale = 1 + 2 * EDGE_PAD
  if (cellWidth == null || cellHeight == null) {
    return {
      backgroundSize: `${(cols / scale) * 100}% ${(rows / scale) * 100}%`,
      backgroundPosition: `${((EDGE_PAD - col) / (scale - cols)) * 100}% ${((EDGE_PAD - row) / (scale - rows)) * 100}%`,
      backgroundRepeat: "no-repeat" as const,
    }
  }
  return {
    backgroundSize: `${cols * cellWidth}px ${rows * cellHeight}px`,
    backgroundPosition: `${EDGE_PAD * cellWidth - col * cellWidth}px ${EDGE_PAD * cellHeight - row * cellHeight}px`,
    backgroundRepeat: "no-repeat" as const,
  }
}

function riseOf(style: Exclude<EdgeStyle, "rectangular">, seam: Seam | null, t: number, alongOverPerp: number) {
  if (!seam) return 0
  const count = COUNT[style][seam.size]
  const amp = style === "beads" ? Math.min(EDGE_PAD, ((1 - 2 * MARGIN) / count / 2) * alongOverPerp) : AMP[style][seam.size]
  return profile(style, t, count) * amp
}

function profile(style: Exclude<EdgeStyle, "rectangular">, t: number, count: number) {
  if (t <= MARGIN || t >= 1 - MARGIN) return 0
  const u = (t - MARGIN) / (1 - 2 * MARGIN)
  if (style === "wavy") return (1 - Math.cos(u * count * Math.PI * 2)) / 2
  if (style === "jagged") {
    const local = (u * count) % 1
    return local < 0.5 ? local * 2 : (1 - local) * 2
  }
  const dx = (u * count) % 1 - 0.5
  const value = 1 - 4 * dx * dx
  return value > 0 ? Math.sqrt(value) : 0
}

function samples(style: Exclude<EdgeStyle, "rectangular">, size: Size | undefined) {
  if (style === "jagged" && size) {
    const count = COUNT.jagged[size]
    const span = 1 - 2 * MARGIN
    const stops = [0, MARGIN]
    for (let index = 0; index < count; index += 1) {
      stops.push(MARGIN + ((index + 0.5) / count) * span, MARGIN + ((index + 1) / count) * span)
    }
    stops.push(1)
    return stops
  }
  return Array.from({ length: 33 }, (_, index) => index / 32)
}

function append(points: Array<[number, number]>, stops: number[], at: (t: number) => [number, number], skipFirst = false, reverse = false) {
  const ordered = reverse ? [...stops].reverse() : stops
  ordered.forEach((t, index) => {
    if (skipFirst && index === 0) return
    points.push(at(t))
  })
}

function coord(value: number) {
  const scale = 1 + 2 * EDGE_PAD
  const next = Math.min(1, Math.max(0, (EDGE_PAD + value) / scale))
  return next.toFixed(4)
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}
