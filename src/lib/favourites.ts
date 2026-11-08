const STORAGE_KEY = "bv-jigsaw-favourites"
const EMPTY: string[] = []

let favourites = EMPTY
let loaded = false
const listeners = new Set<() => void>()

export function subscribeFavourites(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getFavourites() {
  return favourites
}

export function getServerFavourites() {
  return EMPTY
}

export function loadFavourites() {
  if (loaded || typeof localStorage === "undefined") return
  loaded = true
  const next = read()
  if (next.length === 0) return
  favourites = next
  listeners.forEach((listener) => listener())
}

export function toggleFavourite(slug: string) {
  favourites = favourites.includes(slug) ? favourites.filter((item) => item !== slug) : [slug, ...favourites]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favourites))
  } catch {
    // A blocked store should not stop the heart from changing.
  }
  loaded = true
  listeners.forEach((listener) => listener())
}

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
  } catch {
    return []
  }
}
