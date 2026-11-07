const TRAY_KEY = "bv-jigsaw-snap-tray"
const BOARD_KEY = "bv-jigsaw-snap-board"

let tray = true
let board = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function store(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0")
  } catch {
    // A blocked store should not stop the choice from applying.
  }
}

export function subscribeAutoSnap(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTraySnap() {
  return tray
}

export function getBoardSnap() {
  return board
}

export function setTraySnap(value: boolean) {
  if (value === tray) return
  tray = value
  store(TRAY_KEY, value)
  emit()
}

export function setBoardSnap(value: boolean) {
  if (value === board) return
  board = value
  store(BOARD_KEY, value)
  emit()
}

export function loadAutoSnap() {
  try {
    const storedTray = localStorage.getItem(TRAY_KEY)
    const storedBoard = localStorage.getItem(BOARD_KEY)
    if (storedTray === "0" || storedTray === "1") setTraySnap(storedTray === "1")
    if (storedBoard === "0" || storedBoard === "1") setBoardSnap(storedBoard === "1")
  } catch {
    // Ignore a blocked store and keep the defaults.
  }
}
