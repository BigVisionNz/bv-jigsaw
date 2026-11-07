export const DEFAULT_GRID_COLOUR = "#737373"

const STORAGE_KEY = "bv-jigsaw-grid-colour"

let colour = DEFAULT_GRID_COLOUR
const listeners = new Set<() => void>()

export function subscribeGridColour(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getGridColour() {
  return colour
}

export function setGridColour(value: string) {
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

export function loadGridColour() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setGridColour(stored)
  } catch {
    // Ignore a blocked store and keep the default.
  }
}

function normalizeColour(value: string) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim())
  return match ? `#${match[1].toLowerCase()}` : null
}
