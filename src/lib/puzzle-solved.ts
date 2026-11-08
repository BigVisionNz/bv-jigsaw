let solved = false
const listeners = new Set<() => void>()

export function subscribePuzzleSolved(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPuzzleSolved() {
  return solved
}

export function setPuzzleSolved(value: boolean) {
  if (solved === value) return
  solved = value
  listeners.forEach((listener) => listener())
}
