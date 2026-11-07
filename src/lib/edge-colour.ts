export const DEFAULT_EDGE_COLOUR = "#ffffff"

const STORAGE_KEY = "bv-jigsaw-edge-colour"
const SHOWN_KEY = "bv-jigsaw-edges-shown"

let colour = DEFAULT_EDGE_COLOUR
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

export function setEdgeColour(value: string) {
  const next = normalizeColour(value)
  if (!next || next === colour) return
  colour = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // A blocked store should not stop the colour from applying.
  }
  listeners.forEach((listener) => listener())
}

export function loadEdgeColour() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setEdgeColour(stored)
  } catch {
    // Ignore a blocked store and keep the default.
  }
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
