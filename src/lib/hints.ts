let enabled = false
const listeners = new Set<() => void>()

export function subscribeHints(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getHintsOn() {
  return enabled
}

export function setHintsOn(value: boolean) {
  enabled = value
  listeners.forEach((listener) => listener())
}
