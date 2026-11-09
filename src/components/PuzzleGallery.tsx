import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type TransitionEvent } from "react"

import { PIECE_MEDAL, PieceCount } from "@/components/PieceCount"
import { ProgressCover } from "@/components/ProgressCover"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ControlTip, TooltipProvider } from "@/components/ui/tooltip"
import { completionCounts } from "@/lib/completions"
import { getFavourites, getServerFavourites, loadFavourites, subscribeFavourites } from "@/lib/favourites"
import { listLibrary, puzzleHref, resolvePlayedGames } from "@/lib/library"
import { setEdgeStyleFor } from "@/lib/edge-style"
import { PIECE_COUNTS, type PieceCount as PieceCountValue, type Puzzle, type PuzzleGroup } from "@/lib/puzzles"
import { type PlayedGame } from "@/lib/save"
import { cn } from "cn"

const PAGE_SIZE = 8
const sectionHeaderClass =
  "-mx-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 bg-linear-to-b from-neutral-300 to-white px-4 py-4 sm:-mx-6 sm:px-6 dark:from-neutral-700 dark:to-black"
export type PlayedCardGame = PlayedGame & { puzzle: Puzzle & { group: string } }

export function PuzzleGallery({ groups }: { groups: PuzzleGroup[] }) {
  const [played, setPlayed] = useState<PlayedCardGame[]>([])
  const [library, setLibrary] = useState<{ mine: Puzzle[]; received: Puzzle[] }>({ mine: [], received: [] })
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
  }, [groups])

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
  }, [])

  const favourites = favouritePuzzles(groups, library, favouriteSlugs)
  const cards = [
    collectionCard("played", "Recently Played", played.length, played[0]?.puzzle.image),
    ...(favourites.length > 0 ? [collectionCard("favourites", "Favourites", favourites.length, favourites[0]?.image)] : []),
    collectionCard("mine", "My Images", library.mine.length, library.mine[0]?.image),
    collectionCard("received", "Received Images", library.received.length, library.received[0]?.image),
    ...groups.map((group) => collectionCard(group.id, group.title, group.puzzles.length, group.puzzles[0]?.image)),
  ]

  return (
    <div className="flex w-full flex-col gap-14 px-4 py-10 sm:px-6">
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Choose a puzzle</h1>
        <p className="text-base text-muted-foreground">Choose 100, 200, 400, or 800 pieces, then solve the puzzle.</p>
      </header>
      <ul className="grid grid-cols-4 gap-4">
        {cards.map((card) => (
          <li key={card.id}>
            <CollectionCard card={card} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function collectionCard(id: string, title: string, count: number, image?: string) {
  const detail = count === 0 ? "No puzzles yet" : `${count} ${count === 1 ? "puzzle" : "puzzles"}`
  return { id, title, count, image: count > 0 ? image : undefined, detail }
}

function CollectionCard({ card }: { card: { id: string; title: string; image?: string; detail: string } }) {
  return (
    <Card className="h-full pt-0">
      <a href={`/collection/${card.id}`} aria-label={`Open ${card.title}`} className="group block">
        {card.image ? (
          <span className="relative block aspect-[4/3] overflow-hidden">
            <img src={card.image} alt="" className="size-full object-cover" />
          </span>
        ) : (
          <span className="flex aspect-[4/3] items-center justify-center bg-muted px-4 text-center text-lg font-semibold tracking-tight">
            {card.title}
          </span>
        )}
      </a>
      <CardHeader>
        <CardTitle>{card.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{card.detail}</p>
      </CardHeader>
    </Card>
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


export function PlayedCard({ game }: { game: PlayedCardGame }) {
  const href = puzzleHref(game.slug, game.pieces)
  const percent = percentComplete(game.placed, game.pieces)

  return (
    <Card className="h-full pt-0">
      <a href={href} data-astro-reload aria-label={`Continue ${game.puzzle.title}, ${percent}`} className="group relative block">
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
        <a href={href} data-astro-reload className={cn(buttonVariants(), "w-full")}>
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
      <a href={href} data-astro-reload aria-label={percent ? `Solve ${puzzle.title}, ${percent}` : `Solve ${puzzle.title}`} className="group relative block">
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
        <a href={href} data-astro-reload className={cn(buttonVariants(), "w-full")}>
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

export function SectionHeader({
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

type PageMotion = { from: number; to: number; dir: 1 | -1; shift: boolean }

function imagePageCount(count: number) {
  return count > 0 ? Math.ceil(count / PAGE_SIZE) : 0
}

export function PagedImages<T>({
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
  const [shown, setShown] = useState(current)
  const shownRef = useRef(current)
  const [motion, setMotion] = useState<PageMotion | null>(null)
  shownRef.current = shown

  useLayoutEffect(() => {
    const from = shownRef.current
    if (current === from) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(current)
      setMotion(null)
      return
    }
    setMotion({ from, to: current, dir: current > from ? 1 : -1, shift: false })
    const frame = requestAnimationFrame(() => {
      setMotion((value) => (value && value.to === current ? { ...value, shift: true } : value))
    })
    return () => cancelAnimationFrame(frame)
  }, [current])

  useEffect(() => {
    if (!motion?.shift) return
    const timer = window.setTimeout(() => {
      setShown(motion.to)
      setMotion(null)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [motion])

  function finish(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform" || !motion?.shift) return
    setShown(motion.to)
    setMotion(null)
  }

  function pageItems(index: number) {
    return items.slice(index * PAGE_SIZE, index * PAGE_SIZE + PAGE_SIZE)
  }

  const moving = motion != null
  const panels = motion ? (motion.dir === 1 ? [motion.from, motion.to] : [motion.to, motion.from]) : [shown]
  const offset = !motion ? "0%" : motion.dir === 1 ? (motion.shift ? "-50%" : "0%") : motion.shift ? "0%" : "-50%"

  return (
    <div className="flex items-center gap-3">
      {pageCount > 1 ? (
        <PageArrow direction="previous" label={label} listId={listId} disabled={moving || current === 0} onClick={() => onPage(current - 1)} />
      ) : null}
      <div id={listId} className="min-w-0 flex-1 overflow-hidden">
        <div
          className={cn("flex", motion && "w-[200%]", motion?.shift && "page-slide")}
          style={{ transform: `translateX(${offset})` }}
          onTransitionEnd={finish}
        >
          {panels.map((index) => (
            <ul key={`${motion ? "move" : "stay"}-${index}`} className={cn("grid shrink-0 grid-cols-4 gap-4", motion ? "w-1/2" : "w-full")}>
              {pageItems(index).map((item) => (
                <li key={itemKey(item)}>{renderItem(item)}</li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      {pageCount > 1 ? (
        <PageArrow direction="next" label={label} listId={listId} disabled={moving || current === pageCount - 1} onClick={() => onPage(current + 1)} />
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
