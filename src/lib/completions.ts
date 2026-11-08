import { PIECE_COUNTS, type PieceCount } from "@/lib/puzzles"

const STORAGE_KEY = "bv-jigsaw-completions"
const listeners = new Set<() => void>()

export function subscribeCompletions(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function completionStoreSnapshot() {
  if (typeof localStorage === "undefined") return ""
  return localStorage.getItem(STORAGE_KEY) ?? ""
}

export function recordCompletion(slug: string, pieces: PieceCount) {
  const counts = read()
  const id = `${slug}:${pieces}`
  counts[id] = (counts[id] ?? 0) + 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  listeners.forEach((listener) => listener())
}

export function completionCounts(slug: string): Record<PieceCount, number> {
  const counts = read()
  return Object.fromEntries(PIECE_COUNTS.map((count) => [count, counts[`${slug}:${count}`] ?? 0])) as Record<PieceCount, number>
}

function read(): Record<string, number> {
  if (typeof localStorage === "undefined") return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown
    if (!parsed || typeof parsed !== "object") return {}
    const counts: Record<string, number> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (Number.isInteger(value) && value > 0) counts[id] = value
    }
    return counts
  } catch {
    return {}
  }
}
