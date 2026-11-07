import { isPieceCount, type PieceCount } from "@/lib/puzzles"

const STORAGE_KEY = "bv-jigsaw-saves"

export type SavedBin = "tray" | "mat" | number

export type SavedCluster = {
  id: number
  x: number
  y: number
  pieceIds: number[]
}

export type SavedGame = {
  placed: boolean[]
  home: SavedBin[]
  clusters: SavedCluster[]
  order: number[]
  nextCluster: number
  savedAt?: number
}

export type PlayedGame = {
  slug: string
  pieces: PieceCount
  placed: number
  savedAt: number
}

export function loadGame(slug: string, pieces: number): SavedGame | null {
  const game = readAll()[key(slug, pieces)]
  return validGame(game, pieces) ? game : null
}

export function listPlayedGames(): PlayedGame[] {
  return Object.entries(readAll())
    .flatMap(([id, game]) => {
      const separator = id.lastIndexOf(":")
      if (separator < 1) return []
      const pieces = Number(id.slice(separator + 1))
      const slug = id.slice(0, separator)
      if (!isPieceCount(pieces) || !validGame(game, pieces)) return []
      const placed = game.placed.filter(Boolean).length
      if (placed === 0) return []
      return [{ slug, pieces, placed, savedAt: game.savedAt ?? 0 }]
    })
    .sort((a, b) => b.savedAt - a.savedAt || b.placed - a.placed)
}

export function saveGame(slug: string, pieces: number, game: SavedGame) {
  if (typeof window === "undefined" || !validGame(game, pieces)) return
  const all = readAll()
  all[key(slug, pieces)] = { ...game, savedAt: Date.now() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // A full browser store should not interrupt the placement.
  }
}

function key(slug: string, pieces: number) {
  return `${slug}:${pieces}`
}

function readAll(): Record<string, SavedGame> {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, SavedGame>) : {}
  } catch {
    return {}
  }
}

function validGame(game: unknown, pieces: number): game is SavedGame {
  if (!game || typeof game !== "object") return false
  const saved = game as SavedGame
  return (
    booleanList(saved.placed, pieces) &&
    saved.home?.length === pieces &&
    saved.home.every(validBin) &&
    permutation(saved.order, pieces) &&
    Array.isArray(saved.clusters) &&
    saved.clusters.every((cluster) => validCluster(cluster, pieces)) &&
    Number.isInteger(saved.nextCluster) &&
    saved.nextCluster >= 1
  )
}

function booleanList(value: unknown, length: number): value is boolean[] {
  return Array.isArray(value) && value.length === length && value.every((item) => typeof item === "boolean")
}

function validBin(bin: unknown): bin is SavedBin {
  return bin === "tray" || bin === "mat" || (typeof bin === "number" && Number.isInteger(bin) && bin >= 0 && bin < 4)
}

function permutation(value: unknown, length: number): value is number[] {
  if (!Array.isArray(value) || value.length !== length) return false
  const seen = new Set(value)
  return seen.size === length && value.every((id) => Number.isInteger(id) && id >= 0 && id < length)
}

function validCluster(cluster: unknown, pieces: number): cluster is SavedCluster {
  if (!cluster || typeof cluster !== "object") return false
  const saved = cluster as SavedCluster
  return (
    Number.isInteger(saved.id) &&
    Number.isFinite(saved.x) &&
    Number.isFinite(saved.y) &&
    Array.isArray(saved.pieceIds) &&
    saved.pieceIds.every((id) => Number.isInteger(id) && id >= 0 && id < pieces)
  )
}
