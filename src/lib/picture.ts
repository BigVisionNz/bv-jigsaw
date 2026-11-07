let shown = false
const listeners = new Set<() => void>()

export function subscribePicture(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPictureShown() {
  return shown
}

export function setPictureShown(value: boolean) {
  shown = value
  listeners.forEach((listener) => listener())
}
