import { findPuzzle, type Puzzle, type PuzzleGroup } from "@/lib/puzzles"
import { listPlayedGames, type PlayedGame } from "@/lib/save"

const DB_NAME = "bv-jigsaw"
const STORE = "library"

export type LibrarySource = "mine" | "received"

export type LibraryImage = {
  id: string
  title: string
  source: LibrarySource
  addedAt: number
  from?: string
  blob: Blob
}

export function puzzleHref(slug: string, pieces: number) {
  if (isLibrarySlug(slug)) return `/puzzle/custom?id=${encodeURIComponent(slug)}&pieces=${pieces}`
  return `/puzzle/${slug}?pieces=${pieces}`
}

export function isLibrarySlug(slug: string) {
  return slug.startsWith("mine-") || slug.startsWith("received-")
}

export function libraryGroup(source: LibrarySource) {
  return source === "mine" ? "My Images" : "Received Images"
}

export async function listLibrary(source: LibrarySource) {
  const db = await openDb()
  const images = await request<LibraryImage[]>(db, "readonly", (store) => store.getAll())
  db.close()
  return images.filter((image) => image.source === source).sort((a, b) => b.addedAt - a.addedAt)
}

export async function getLibraryImage(id: string) {
  const db = await openDb()
  const image = await request<LibraryImage | undefined>(db, "readonly", (store) => store.get(id))
  db.close()
  return image ?? null
}

export async function addLibraryFiles(files: File[]) {
  const images = files.filter((file) => file.type.startsWith("image/")).map((file) => ({
    id: `mine-${crypto.randomUUID()}`,
    title: imageTitle(file.name),
    source: "mine" as const,
    addedAt: Date.now(),
    blob: file,
  }))
  if (images.length === 0) return 0
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite")
    const store = transaction.objectStore(STORE)
    images.forEach((image) => store.put(image))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
  return images.length
}

export async function removeLibraryImage(id: string) {
  const db = await openDb()
  await request(db, "readwrite", (store) => store.delete(id))
  db.close()
}

export async function resolvePlayedGames(groups: PuzzleGroup[]) {
  const urls: string[] = []
  const games: Array<PlayedGame & { puzzle: Puzzle & { group: string } }> = []
  for (const game of listPlayedGames()) {
    const catalog = findPuzzle(groups, game.slug)
    if (catalog) {
      games.push({ ...game, puzzle: catalog })
      continue
    }
    const item = isLibrarySlug(game.slug) ? await getLibraryImage(game.slug) : null
    if (!item) continue
    const image = URL.createObjectURL(item.blob)
    urls.push(image)
    games.push({
      ...game,
      puzzle: { slug: item.id, title: item.title, image, group: libraryGroup(item.source) },
    })
  }
  return { games, revoke: () => urls.forEach((url) => URL.revokeObjectURL(url)) }
}

function imageTitle(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim()
  return stem || "Picture"
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function request<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const query = run(transaction.objectStore(STORE))
    query.onsuccess = () => resolve(query.result)
    query.onerror = () => reject(query.error)
  })
}
