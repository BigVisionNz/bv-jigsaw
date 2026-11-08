export const DEFAULT_BOARD_COLOUR = "#454545"

const STORAGE_KEY = "bv-jigsaw-board-colour"
const MAP_KEY = "bv-jigsaw-board-colours"

let colour = DEFAULT_BOARD_COLOUR
let puzzle: string | null = null
const listeners = new Set<() => void>()

export function subscribeBoardColour(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBoardColour() {
  return colour
}

export function bindBoardColour(slug: string | null) {
  puzzle = slug
  loadBoardColour()
}

export function setBoardColour(value: string) {
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

export function loadBoardColour() {
  try {
    const stored = puzzle ? readPuzzle(puzzle) ?? localStorage.getItem(STORAGE_KEY) : localStorage.getItem(STORAGE_KEY)
    const next = (stored && normalizeColour(stored)) || DEFAULT_BOARD_COLOUR
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

function normalizeColour(value: string) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim())
  return match ? `#${match[1].toLowerCase()}` : null
}
