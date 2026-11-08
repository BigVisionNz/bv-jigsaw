export const DEFAULT_EDGE_COLOUR = "#ffffff"

const STORAGE_KEY = "bv-jigsaw-edge-colour"
const MAP_KEY = "bv-jigsaw-edge-colours"
const SHOWN_KEY = "bv-jigsaw-edges-shown"

let colour = DEFAULT_EDGE_COLOUR
let puzzle: string | null = null
let shown = true
const listeners = new Set<() => void>()
const shownListeners = new Set<() => void>()

export function subscribeEdgeColour(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getEdgeColour() {
  return colour
}

export function bindEdgeColour(slug: string | null) {
  puzzle = slug
  loadEdgeColour()
}

export function setEdgeColour(value: string) {
  const next = normalizeColour(value)
  if (!next || next === colour) return
  colour = next
  try {
    if (puzzle) writePuzzle(puzzle, next)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // A blocked store should not stop the colour from applying.
  }
  listeners.forEach((listener) => listener())
}

export function loadEdgeColour() {
  try {
    const stored = puzzle ? readPuzzle(puzzle) ?? localStorage.getItem(STORAGE_KEY) : localStorage.getItem(STORAGE_KEY)
    const next = (stored && normalizeColour(stored)) || DEFAULT_EDGE_COLOUR
    if (next === colour) return
    colour = next
    listeners.forEach((listener) => listener())
  } catch {
    // Ignore a blocked store and keep the default.
  }
}

function readPuzzle(slug: string) {
  const parsed = JSON.parse(localStorage.getItem(MAP_KEY) ?? "{}") as unknown
  if (!parsed || typeof parsed !== "object") return null
  const value = (parsed as Record<string, unknown>)[slug]
  return typeof value === "string" ? value : null
}

function writePuzzle(slug: string, value: string) {
  const parsed = JSON.parse(localStorage.getItem(MAP_KEY) ?? "{}") as unknown
  const map = parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {}
  map[slug] = value
  localStorage.setItem(MAP_KEY, JSON.stringify(map))
}

export function subscribeEdgesShown(listener: () => void) {
  shownListeners.add(listener)
  return () => shownListeners.delete(listener)
}

export function getEdgesShown() {
  return shown
}

export function setEdgesShown(value: boolean) {
  if (value === shown) return
  shown = value
  try {
    localStorage.setItem(SHOWN_KEY, value ? "1" : "0")
  } catch {
    // A blocked store should not stop the indicator from updating.
  }
  shownListeners.forEach((listener) => listener())
}

export function loadEdgesShown() {
  try {
    const stored = localStorage.getItem(SHOWN_KEY)
    if (stored === "0" || stored === "1") setEdgesShown(stored === "1")
  } catch {
    // Ignore a blocked store and keep the edges visible.
  }
}

function normalizeColour(value: string) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim())
  return match ? `#${match[1].toLowerCase()}` : null
}
