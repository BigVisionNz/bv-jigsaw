import { ChevronLeft, ChevronRight, Upload } from "lucide-react"
import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react"

import { PIECE_MEDAL, PieceCount } from "@/components/PieceCount"
import { ProgressCover } from "@/components/ProgressCover"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ControlTip, TooltipProvider } from "@/components/ui/tooltip"
import { completionCounts } from "@/lib/completions"
import { getFavourites, getServerFavourites, loadFavourites, subscribeFavourites, toggleFavourite } from "@/lib/favourites"
import { addLibraryFiles, listLibrary, puzzleHref, removeLibraryImage, resolvePlayedGames } from "@/lib/library"
import { setEdgeStyleFor } from "@/lib/edge-style"
import { PIECE_COUNTS, type PieceCount as PieceCountValue, type Puzzle, type PuzzleGroup } from "@/lib/puzzles"
import { type PlayedGame } from "@/lib/save"
import { cn } from "cn"

const PAGE_SIZE = 8
const sectionHeaderClass =
  "-mx-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 bg-linear-to-b from-neutral-300 to-white px-4 py-4 sm:-mx-6 sm:px-6 dark:from-neutral-700 dark:to-black"
const TABS = [
  { id: "default", label: "Default Images" },
  { id: "mine", label: "My Images" },
  { id: "received", label: "Received Images" },
] as const

type ImageTab = (typeof TABS)[number]["id"]
type PlayedCardGame = PlayedGame & { puzzle: Puzzle & { group: string } }

export function PuzzleGallery({ groups }: { groups: PuzzleGroup[] }) {
  const [played, setPlayed] = useState<PlayedCardGame[]>([])
  const [tab, setTab] = useState<ImageTab>("default")
  const [library, setLibrary] = useState<{ mine: Puzzle[]; received: Puzzle[] }>({ mine: [], received: [] })
  const [libraryTick, setLibraryTick] = useState(0)
  const [uploadError, setUploadError] = useState("")
  const favouriteSlugs = useSyncExternalStore(subscribeFavourites, getFavourites, getServerFavourites)

  useLayoutEffect(() => {
    loadFavourites()
  }, [])

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
    if (getFavourites().includes(id)) toggleFavourite(id)
    setLibraryTick((value) => value + 1)
  }

  const favourites = favouritePuzzles(groups, library, favouriteSlugs)

  return (
    <div className="flex w-full flex-col gap-14 px-4 py-10 sm:px-6">
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Choose a puzzle</h1>
        <p className="text-base text-muted-foreground">Choose 100, 200, 400, or 800 pieces, then solve the puzzle.</p>
      </header>
      <PlayedGrid games={played} />
      {favourites.length > 0 ? <Favourites puzzles={favourites} played={played} /> : null}
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
              <CategorySection key={group.id} group={group} played={played} />
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
  const [page, setPage] = useState(0)
  const label = id === "mine" ? "My Images" : "Received Images"
  return (
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab`} className="flex flex-col gap-5">
      {pictures.length === 0 ? (
        <>
          {action || error ? (
            <div className="flex flex-wrap items-center gap-3">
              {action}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">{empty}</p>
        </>
      ) : (
        <>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <SectionHeader
            id={`${id}-heading`}
            title={label}
            label={label}
            count={pictures.length}
            page={page}
            onPage={setPage}
            action={action}
          />
          <PagedImages
          label={label}
          listId={`${id}-page`}
          items={pictures}
          page={page}
          onPage={setPage}
          itemKey={(puzzle) => puzzle.slug}
          renderItem={(puzzle) => (
            <div className="flex flex-col gap-2">
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
            </div>
          )}
        />
        </>
      )}
    </div>
  )
}

function CategorySection({ group, played }: { group: PuzzleGroup; played: PlayedCardGame[] }) {
  const [page, setPage] = useState(0)
  return (
    <section aria-labelledby={group.id} className="flex flex-col gap-5">
      <SectionHeader
        id={group.id}
        title={group.title}
        description={group.description}
        label={group.title}
        count={group.puzzles.length}
        page={page}
        onPage={setPage}
        action={
          <a href={`/category/${group.id}`} className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
            View All
          </a>
        }
      />
      <PagedImages
        label={group.title}
        listId={`${group.id}-page`}
        items={group.puzzles}
        page={page}
        onPage={setPage}
        itemKey={(puzzle) => puzzle.slug}
        renderItem={(puzzle) => <PuzzleCard puzzle={puzzle} played={played} />}
      />
    </section>
  )
}

function Favourites({ puzzles, played }: { puzzles: Puzzle[]; played: PlayedCardGame[] }) {
  const [page, setPage] = useState(0)
  return (
    <section aria-labelledby="favourites" className="flex flex-col gap-5">
      <SectionHeader
        id="favourites"
        title="Favourites"
        description="Puzzles you have marked with a heart."
        label="Favourites"
        count={puzzles.length}
        page={page}
        onPage={setPage}
      />
      <PagedImages
        label="Favourites"
        listId="favourites-page"
        items={puzzles}
        page={page}
        onPage={setPage}
        itemKey={(puzzle) => puzzle.slug}
        renderItem={(puzzle) => <PuzzleCard puzzle={puzzle} played={played} />}
      />
    </section>
  )
}

function favouritePuzzles(
  groups: PuzzleGroup[],
  library: { mine: Puzzle[]; received: Puzzle[] },
  slugs: readonly string[],
) {
  const bySlug = new Map<string, Puzzle>()
  for (const group of groups) {
    for (const puzzle of group.puzzles) bySlug.set(puzzle.slug, puzzle)
  }
  for (const puzzle of library.mine) bySlug.set(puzzle.slug, puzzle)
  for (const puzzle of library.received) bySlug.set(puzzle.slug, puzzle)
  return slugs.flatMap((slug) => {
    const puzzle = bySlug.get(slug)
    return puzzle ? [puzzle] : []
  })
}

function PlayedGrid({ games }: { games: PlayedCardGame[] }) {
  const [page, setPage] = useState(0)
  return (
    <section aria-labelledby="played" className="flex flex-col gap-5">
      <SectionHeader
        id="played"
        title="Recently Played"
        description="Puzzles you have started, newest first."
        label="Recently Played"
        count={games.length}
        page={page}
        onPage={setPage}
        action={
          <a href="/played" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
            View All
          </a>
        }
      />
      {games.length === 0 ? (
        <p className="text-sm text-muted-foreground">No puzzles played yet.</p>
      ) : (
        <PagedImages
          label="Recently Played"
          listId="played-page"
          items={games}
          page={page}
          onPage={setPage}
          itemKey={(game) => `${game.slug}:${game.pieces}`}
          renderItem={(game) => <PlayedCard game={game} />}
        />
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
        <ProgressCover src={game.puzzle.image} cells={game.cells} pieces={game.pieces} />
        <ActionOverlay label="Continue" percent={percent} />
      </a>
      <CardHeader>
        <PuzzleName title={game.puzzle.title} slug={game.slug} />
        <div className="flex items-center gap-3">
          <p className="min-w-0 text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{game.placed}</span> of {game.pieces} pieces
          </p>
          <Progress className="ml-auto w-24 shrink-0" value={(game.placed / game.pieces) * 100} aria-label={`${game.placed} of ${game.pieces} pieces`} />
        </div>
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
        <ProgressCover src={puzzle.image} cells={progress?.cells} pieces={pieces} />
        <ActionOverlay label="Solve Puzzle" percent={percent} />
      </a>
      <CardHeader>
        <PuzzleName title={puzzle.title} slug={puzzle.slug} />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Results</p>
          <CompletionBadges slug={puzzle.slug} played={played} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Pick a size to start</p>
          <PieceCount
            value={pieces}
            onChange={setPieces}
            href={(count) => puzzleHref(puzzle.slug, count)}
            onSelect={() => setEdgeStyleFor(puzzle.slug, "rectangular")}
          />
        </div>
      </CardHeader>
      <CardFooter>
        <a href={href} className={cn(buttonVariants(), "w-full")}>
          {percent ? `Solve Puzzle · ${percent}` : "Solve Puzzle"}
        </a>
      </CardFooter>
    </Card>
  )
}

function PuzzleName({ title, slug }: { title: string; slug: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <CardTitle className="min-w-0 flex-1">{title}</CardTitle>
      <FavouriteButton title={title} slug={slug} />
    </div>
  )
}

function FavouriteButton({ title, slug }: { title: string; slug: string }) {
  const favourites = useSyncExternalStore(subscribeFavourites, getFavourites, getServerFavourites)
  const selected = favourites.includes(slug)

  useLayoutEffect(() => {
    loadFavourites()
  }, [])

  return (
    <TooltipProvider>
      <ControlTip label={selected ? "Unmark Favourite" : "Mark as Favourite"}>
        <button
          type="button"
          aria-pressed={selected}
          aria-label={selected ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
          className="group inline-flex size-7 shrink-0 items-center justify-center rounded-full text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => toggleFavourite(slug)}
        >
          <FavouriteIcon
            filled={selected}
            className={cn("size-5 transition-transform duration-150 group-hover:scale-110", selected ? "text-red-500" : "text-white")}
          />
        </button>
      </ControlTip>
    </TooltipProvider>
  )
}

function FavouriteIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d={
          filled
            ? "M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"
            : "M12.1 18.55L12 18.65L11.89 18.55C7.14 14.24 4 11.39 4 8.5C4 6.5 5.5 5 7.5 5C9.04 5 10.54 6 11.07 7.36H12.93C13.46 6 14.96 5 16.5 5C18.5 5 20 6.5 20 8.5C20 11.39 16.86 14.24 12.1 18.55M16.5 3C14.76 3 13.09 3.81 12 5.08C10.91 3.81 9.24 3 7.5 3C4.42 3 2 5.41 2 8.5C2 12.27 5.4 15.36 10.55 20.03L12 21.35L13.45 20.03C18.6 15.36 22 12.27 22 8.5C22 5.41 19.58 3 16.5 3Z"
        }
      />
    </svg>
  )
}

function CompletionBadges({ slug, played }: { slug: string; played: PlayedGame[] }) {
  const [stored, setStored] = useState<Record<PieceCountValue, number>>({ 100: 0, 200: 0, 400: 0, 800: 0 })
  useEffect(() => {
    setStored(completionCounts(slug))
  }, [slug])

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Completions">
      {PIECE_COUNTS.map((count) => {
        const finished = played.some((game) => game.slug === slug && game.pieces === count && game.placed >= count)
        const times = Math.max(stored[count] ?? 0, finished ? 1 : 0)
        return (
          <li key={count}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-0.5 pl-2 text-xs text-muted-foreground"
              aria-label={`${count} pieces completed ${times} ${times === 1 ? "time" : "times"}`}
            >
              {count}
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
                  PIECE_MEDAL[count],
                )}
              >
                {times}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function ActionOverlay({ label, percent }: { label: string; percent: string | null }) {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
      <span className={cn(buttonVariants(), "pointer-events-none shadow-sm")}>
        {percent ? `${label} · ${percent}` : label}
      </span>
    </span>
  )
}

function SectionHeader({
  id,
  title,
  description,
  label,
  count,
  page,
  onPage,
  action,
}: {
  id: string
  title: string
  description?: string
  label: string
  count: number
  page: number
  onPage: (page: number) => void
  action?: ReactNode
}) {
  const pageCount = imagePageCount(count)
  const current = pageCount === 0 ? 0 : Math.min(page, pageCount - 1)
  return (
    <div className={sectionHeaderClass}>
      <div className="flex min-w-0 max-w-2xl flex-col gap-1 justify-self-start">
        <h2 id={id} className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <PageBadges label={label} page={current} pageCount={pageCount} onPage={onPage} />
      <div className="justify-self-end">{action}</div>
    </div>
  )
}

function PageBadges({
  label,
  page,
  pageCount,
  onPage,
}: {
  label: string
  page: number
  pageCount: number
  onPage: (page: number) => void
}) {
  if (pageCount === 0) return null
  return (
    <div className="flex max-w-md flex-wrap items-center justify-center gap-1.5" role="group" aria-label={`${label} pages`}>
      <span aria-hidden className="pr-1 text-sm font-medium">Pages</span>
      {Array.from({ length: pageCount }, (_, index) => {
        const current = index === page
        return (
          <button
            key={index}
            type="button"
            aria-current={current ? "page" : undefined}
            aria-label={`${label}, page ${index + 1}`}
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50",
              current ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground hover:bg-muted",
            )}
            onClick={() => onPage(index)}
          >
            {index + 1}
          </button>
        )
      })}
    </div>
  )
}

function imagePageCount(count: number) {
  return count > 0 ? Math.ceil(count / PAGE_SIZE) : 0
}

function PagedImages<T>({
  label,
  listId,
  items,
  page,
  onPage,
  itemKey,
  renderItem,
}: {
  label: string
  listId: string
  items: T[]
  page: number
  onPage: (page: number) => void
  itemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
}) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const visible = items.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex items-center gap-3">
      {pageCount > 1 ? (
        <PageArrow direction="previous" label={label} listId={listId} disabled={current === 0} onClick={() => onPage(current - 1)} />
      ) : null}
      <ul id={listId} className="grid min-w-0 flex-1 grid-cols-4 gap-4">
        {visible.map((item) => (
          <li key={itemKey(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <PageArrow direction="next" label={label} listId={listId} disabled={current === pageCount - 1} onClick={() => onPage(current + 1)} />
      ) : null}
    </div>
  )
}

function PageArrow({
  direction,
  label,
  listId,
  disabled,
  onClick,
}: {
  direction: "previous" | "next"
  label: string
  listId: string
  disabled: boolean
  onClick: () => void
}) {
  const name = direction === "previous" ? `Previous ${label}` : `Next ${label}`
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      aria-label={name}
      aria-controls={listId}
      disabled={disabled}
      className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "rounded-full")}
      onClick={onClick}
    >
      <Icon className="size-5 transition-transform group-hover/button:scale-110" />
    </button>
  )
}

function percentComplete(placed: number, pieces: number) {
  if (placed >= pieces) return "100% complete"
  return `${Math.max(1, Math.round((placed / pieces) * 100))}% complete`
}
