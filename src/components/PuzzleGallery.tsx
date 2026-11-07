import { Upload } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { PieceCount } from "@/components/PieceCount"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { addLibraryFiles, listLibrary, puzzleHref, removeLibraryImage, resolvePlayedGames } from "@/lib/library"
import { type PieceCount as PieceCountValue, type Puzzle, type PuzzleGroup } from "@/lib/puzzles"
import { type PlayedGame } from "@/lib/save"
import { cn } from "cn"

const LEADER_COUNT = 12
const TABS = [
  { id: "default", label: "Default Images" },
  { id: "mine", label: "My Images" },
  { id: "received", label: "Received Images" },
] as const

type ImageTab = (typeof TABS)[number]["id"]
type PlayedCardGame = PlayedGame & { puzzle: Puzzle & { group: string } }

export function PuzzleGallery({ groups }: { groups: PuzzleGroup[] }) {
  const [played, setPlayed] = useState<PlayedCardGame[]>([])
  const [leaders, setLeaders] = useState<Record<string, Puzzle[]>>({})
  const [tab, setTab] = useState<ImageTab>("default")
  const [library, setLibrary] = useState<{ mine: Puzzle[]; received: Puzzle[] }>({ mine: [], received: [] })
  const [libraryTick, setLibraryTick] = useState(0)
  const [uploadError, setUploadError] = useState("")

  useEffect(() => {
    let revoke = () => {}
    let cancelled = false
    resolvePlayedGames(groups).then((result) => {
      if (cancelled) {
        result.revoke()
        return
      }
      revoke = result.revoke
      setPlayed(result.games)
    })
    setLeaders(Object.fromEntries(groups.map((group) => [group.id, sample(group.puzzles, LEADER_COUNT)])))
    return () => {
      cancelled = true
      revoke()
    }
  }, [groups, libraryTick])

  useEffect(() => {
    let cancelled = false
    const urls: string[] = []
    Promise.all([listLibrary("mine"), listLibrary("received")])
      .then(([mine, received]) => {
        if (cancelled) return
        const asPuzzle = (id: string, title: string, blob: Blob) => {
          const image = URL.createObjectURL(blob)
          urls.push(image)
          return { slug: id, title, image }
        }
        setLibrary({
          mine: mine.map((item) => asPuzzle(item.id, item.title, item.blob)),
          received: received.map((item) => asPuzzle(item.id, item.title, item.blob)),
        })
      })
      .catch(() => {
        if (!cancelled) setLibrary({ mine: [], received: [] })
      })
    return () => {
      cancelled = true
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [libraryTick])

  async function onUpload(files: FileList | null) {
    const selected = [...(files ?? [])]
    if (selected.length === 0) return
    const images = selected.filter((file) => file.type.startsWith("image/"))
    if (images.length === 0) {
      setUploadError("Choose a picture file.")
      return
    }
    setUploadError("")
    await addLibraryFiles(images)
    setLibraryTick((value) => value + 1)
  }

  async function onRemove(id: string) {
    await removeLibraryImage(id)
    setLibraryTick((value) => value + 1)
  }

  return (
    <div className="flex w-full flex-col gap-14 px-4 py-10 sm:px-6">
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Choose a puzzle</h1>
        <p className="text-base text-muted-foreground">Choose 100, 200, or 400 pieces, then solve the puzzle.</p>
      </header>
      <PlayedGrid games={played} />
      <div className="flex flex-col gap-8">
        <div role="tablist" aria-label="Image categories" className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${item.id}-tab`}
              aria-controls={`${item.id}-panel`}
              aria-selected={tab === item.id}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                tab === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === "default" ? (
          <div role="tabpanel" id="default-panel" aria-labelledby="default-tab" className="flex flex-col gap-14">
            {groups.map((group) => (
              <section key={group.id} aria-labelledby={group.id} className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex max-w-2xl flex-col gap-1">
                    <h2 id={group.id} className="text-2xl font-semibold tracking-tight">
                      {group.title}
                    </h2>
                    {group.description ? <p className="text-sm text-muted-foreground">{group.description}</p> : null}
                  </div>
                  <a href={`/category/${group.id}`} className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
                    View All
                  </a>
                </div>
                <ul className="grid grid-cols-4 gap-4">
                  {(leaders[group.id] ?? []).map((puzzle) => (
                    <li key={puzzle.slug}>
                      <PuzzleCard puzzle={puzzle} played={played} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
        {tab === "mine" ? (
          <LibraryPanel
            id="mine"
            pictures={library.mine}
            played={played}
            empty="Upload a picture to turn it into a puzzle."
            action={
              <label className={cn(buttonVariants(), "cursor-pointer")}>
                <Upload />
                Upload image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    void onUpload(event.target.files)
                    event.target.value = ""
                  }}
                />
              </label>
            }
            error={uploadError}
            onRemove={onRemove}
          />
        ) : null}
        {tab === "received" ? (
          <LibraryPanel
            id="received"
            pictures={library.received}
            played={played}
            empty="No images from friends yet."
          />
        ) : null}
      </div>
    </div>
  )
}

function LibraryPanel({
  id,
  pictures,
  played,
  empty,
  action,
  error,
  onRemove,
}: {
  id: ImageTab
  pictures: Puzzle[]
  played: PlayedCardGame[]
  empty: string
  action?: ReactNode
  error?: string
  onRemove?: (id: string) => void
}) {
  return (
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab`} className="flex flex-col gap-5">
      {action || error ? (
        <div className="flex flex-wrap items-center gap-3">
          {action}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}
      {pictures.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid grid-cols-4 gap-4">
          {pictures.map((puzzle) => (
            <li key={puzzle.slug} className="flex flex-col gap-2">
              <PuzzleCard puzzle={puzzle} played={played} />
              {onRemove ? (
                <button
                  type="button"
                  className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => onRemove(puzzle.slug)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlayedGrid({ games }: { games: PlayedCardGame[] }) {
  const shown = games.slice(0, LEADER_COUNT)

  return (
    <section aria-labelledby="played" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 id="played" className="text-2xl font-semibold tracking-tight">
            Last Played
          </h2>
          <p className="text-sm text-muted-foreground">Puzzles you have started, newest first.</p>
        </div>
        <a href="/played" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
          View All
        </a>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No puzzles played yet.</p>
      ) : (
        <ul className="grid grid-cols-4 gap-4">
          {shown.map((game) => (
            <li key={`${game.slug}:${game.pieces}`}>
              <PlayedCard game={game} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PlayedCard({ game }: { game: PlayedCardGame }) {
  const href = puzzleHref(game.slug, game.pieces)
  const percent = percentComplete(game.placed, game.pieces)

  return (
    <Card className="h-full pt-0">
      <a href={href} aria-label={`Continue ${game.puzzle.title}, ${percent}`} className="group relative block">
        <img src={game.puzzle.image} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
        <ActionOverlay label="Continue" percent={percent} />
      </a>
      <CardHeader>
        <CardTitle>{game.puzzle.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{game.placed}</span> of {game.pieces} pieces
        </p>
      </CardHeader>
      <CardFooter>
        <a href={href} className={cn(buttonVariants(), "w-full")}>
          Continue · {percent}
        </a>
      </CardFooter>
    </Card>
  )
}

export function PuzzleCard({ puzzle, played }: { puzzle: Puzzle; played: PlayedGame[] }) {
  const [pieces, setPieces] = useState<PieceCountValue>(100)
  const href = puzzleHref(puzzle.slug, pieces)
  const progress = played.find((game) => game.slug === puzzle.slug && game.pieces === pieces)
  const percent = progress ? percentComplete(progress.placed, progress.pieces) : null

  return (
    <Card className="h-full pt-0">
      <a href={href} aria-label={percent ? `Solve ${puzzle.title}, ${percent}` : `Solve ${puzzle.title}`} className="group relative block">
        <img src={puzzle.image} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
        <ActionOverlay label="Solve Puzzle" percent={percent} />
      </a>
      <CardHeader>
        <CardTitle>{puzzle.title}</CardTitle>
        <PieceCount value={pieces} onChange={setPieces} />
      </CardHeader>
      <CardFooter>
        <a href={href} className={cn(buttonVariants(), "w-full")}>
          {percent ? `Solve Puzzle · ${percent}` : "Solve Puzzle"}
        </a>
      </CardFooter>
    </Card>
  )
}

function ActionOverlay({ label, percent }: { label: string; percent: string | null }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
      <span className={cn(buttonVariants(), "pointer-events-none shadow-sm")}>
        {percent ? `${label} · ${percent}` : label}
      </span>
    </span>
  )
}

function sample<T>(values: T[], count: number) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy.slice(0, count)
}

function percentComplete(placed: number, pieces: number) {
  if (placed >= pieces) return "100% complete"
  return `${Math.max(1, Math.round((placed / pieces) * 100))}% complete`
}
