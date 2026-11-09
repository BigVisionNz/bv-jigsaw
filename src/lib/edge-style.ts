export const EDGE_STYLES = ["rectangular", "wavy", "jagged", "beads"] as const

export type EdgeStyle = (typeof EDGE_STYLES)[number]

export const EDGE_STYLE_LABELS: Record<EdgeStyle, string> = {
  rectangular: "Rectangular",
  wavy: "Wavy",
  jagged: "Jagged",
  beads: "Beads",
}

const STORAGE_KEY = "bv-jigsaw-edge-style"
const MAP_KEY = "bv-jigsaw-edge-styles"

let style: EdgeStyle = "rectangular"
let puzzle: string | null = null
const listeners = new Set<() => void>()

export function subscribeEdgeStyle(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getEdgeStyle() {
  return style
}

export function bindEdgeStyle(slug: string | null) {
  puzzle = slug
  loadEdgeStyle()
}

export function setEdgeStyle(value: EdgeStyle) {
  if (puzzle) setEdgeStyleFor(puzzle, value)
  else storeStyle(null, value)
}

export function setEdgeStyleFor(slug: string, value: EdgeStyle) {
  storeStyle(slug, value)
}

function storeStyle(slug: string | null, value: EdgeStyle) {
  try {
    if (slug) writePuzzle(slug, value)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // A blocked store should not stop the shape from applying.
  }
  if (slug && puzzle !== slug) return
  if (value === style) return
  style = value
  listeners.forEach((listener) => listener())
}

export function loadEdgeStyle() {
  try {
    const stored = puzzle ? readPuzzle(puzzle) ?? localStorage.getItem(STORAGE_KEY) : localStorage.getItem(STORAGE_KEY)
    const next = (stored && normalizeStyle(stored)) || "rectangular"
    if (next === style) return
    style = next
    listeners.forEach((listener) => listener())
  } catch {
    // Ignore a blocked store and keep the straight cut.
  }
}

function readPuzzle(slug: string) {
  const parsed = JSON.parse(localStorage.getItem(MAP_KEY) ?? "{}") as unknown
  if (!parsed || typeof parsed !== "object") return null
  const value = (parsed as Record<string, unknown>)[slug]
  return typeof value === "string" ? value : null
}

function writePuzzle(slug: string, value: EdgeStyle) {
  const parsed = JSON.parse(localStorage.getItem(MAP_KEY) ?? "{}") as unknown
  const map = parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {}
  map[slug] = value
  localStorage.setItem(MAP_KEY, JSON.stringify(map))
}

function normalizeStyle(value: string): EdgeStyle | null {
  return (EDGE_STYLES as readonly string[]).includes(value) ? (value as EdgeStyle) : null
}
