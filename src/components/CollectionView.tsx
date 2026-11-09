import { ArrowLeft, Upload } from "lucide-react"
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"

import { PagedImages, PlayedCard, PuzzleCard, SectionHeader, type PlayedCardGame } from "@/components/PuzzleGallery"
import { buttonVariants } from "@/components/ui/button"
import { getFavourites, getServerFavourites, loadFavourites, subscribeFavourites, toggleFavourite } from "@/lib/favourites"
import { addLibraryFiles, listLibrary, removeLibraryImage, resolvePlayedGames } from "@/lib/library"
import { type Puzzle, type PuzzleGroup } from "@/lib/puzzles"
import { cn } from "cn"

const COPY: Record<string, { title: string; description: string; empty: string }> = {
  played: {
    title: "Recently Played",
    description: "Puzzles you have started, newest first.",
    empty: "No puzzles played yet.",
  },
  favourites: {
    title: "Favourites",
    description: "Puzzles you have marked with a heart.",
    empty: "No favourites yet.",
  },
  mine: {
    title: "My Images",
    description: "Pictures you uploaded.",
    empty: "Upload a picture to turn it into a puzzle.",
  },
  received: {
    title: "Received Images",
    description: "Pictures shared with you.",
    empty: "No images from friends yet.",
  },
}

export function CollectionView({ id, groups }: { id: string; groups: PuzzleGroup[] }) {
  const group = groups.find((item) => item.id === id)
  const copy = COPY[id]
  const title = group?.title ?? copy?.title ?? "Collection"
  const description = group?.description ?? copy?.description
  const [page, setPage] = useState(0)
  const [played, setPlayed] = useState<PlayedCardGame[]>([])
  const [library, setLibrary] = useState<{ mine: Puzzle[]; received: Puzzle[] }>({ mine: [], received: [] })
  const [libraryTick, setLibraryTick] = useState(0)
  const [uploadError, setUploadError] = useState("")
  const [playedReady, setPlayedReady] = useState(false)
  const needsLibrary = id === "mine" || id === "received" || id === "favourites"
  const [libraryReady, setLibraryReady] = useState(!needsLibrary)
  const favouriteSlugs = useSyncExternalStore(subscribeFavourites, getFavourites, getServerFavourites)

  useEffect(() => {
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
      setPlayedReady(true)
    })
    return () => {
      cancelled = true
      revoke()
    }
  }, [groups, libraryTick])

  useEffect(() => {
    if (!needsLibrary) return
    let cancelled = false
    const urls: string[] = []
    Promise.all([listLibrary("mine"), listLibrary("received")])
      .then(([mine, received]) => {
        if (cancelled) return
        const asPuzzle = (imageId: string, name: string, blob: Blob) => {
          const image = URL.createObjectURL(blob)
          urls.push(image)
          return { slug: imageId, title: name, image }
        }
        setLibrary({
          mine: mine.map((item) => asPuzzle(item.id, item.title, item.blob)),
          received: received.map((item) => asPuzzle(item.id, item.title, item.blob)),
        })
        setLibraryReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setLibrary({ mine: [], received: [] })
          setLibraryReady(true)
        }
      })
    return () => {
      cancelled = true
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [needsLibrary, libraryTick])

  async function onUpload(files: FileList | null) {
    const images = [...(files ?? [])].filter((file) => file.type.startsWith("image/"))
    if (images.length === 0) {
      setUploadError("Choose a picture file.")
      return
    }
    setUploadError("")
    await addLibraryFiles(images)
    setLibraryTick((value) => value + 1)
  }

  async function onRemove(imageId: string) {
    await removeLibraryImage(imageId)
    if (getFavourites().includes(imageId)) toggleFavourite(imageId)
    setLibraryTick((value) => value + 1)
  }

  const waiting = (id === "played" && !playedReady) || (needsLibrary && !libraryReady)
  const favourites = favouriteList(groups, library, favouriteSlugs)
  const puzzles = group?.puzzles ?? (id === "favourites" ? favourites : id === "mine" ? library.mine : id === "received" ? library.received : [])
  const upload =
    id === "mine" ? (
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
    ) : null

  return (
    <div className="flex w-full flex-col gap-8 px-4 py-10 sm:px-6">
      <a
        href="/"
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
          const index = (history.state as { index?: number } | null)?.index
          if (typeof index === "number" && index > 0) {
            event.preventDefault()
            history.back()
          }
        }}
      >
        <ArrowLeft />
        Back
      </a>
      {waiting ? (
        <CollectionHeading id={id} title={title} description={description} count={0} page={0} onPage={setPage} />
      ) : id === "played" ? (
        played.length === 0 ? (
          <CollectionHeading id={id} title={title} description={description} count={0} page={0} onPage={setPage} empty={copy?.empty} />
        ) : (
          <>
            <SectionHeader id={id} title={title} description={description} label={title} count={played.length} page={page} onPage={setPage} />
            <PagedImages
              label={title}
              listId={`${id}-page`}
              items={played}
              page={page}
              onPage={setPage}
              itemKey={(game) => `${game.slug}:${game.pieces}`}
              renderItem={(game) => <PlayedCard game={game} />}
            />
          </>
        )
      ) : puzzles.length === 0 ? (
        <CollectionHeading id={id} title={title} description={description} count={0} page={0} onPage={setPage} empty={copy?.empty ?? "No puzzles yet."} action={upload} error={uploadError} />
      ) : (
        <>
          <SectionHeader
            id={id}
            title={title}
            description={description}
            label={title}
            count={puzzles.length}
            page={page}
            onPage={setPage}
            action={
              upload ? (
                <span className="flex items-center gap-3">
                  {uploadError ? <span className="text-sm text-destructive">{uploadError}</span> : null}
                  {upload}
                </span>
              ) : undefined
            }
          />
          <PagedImages
            label={title}
            listId={`${id}-page`}
            items={puzzles}
            page={page}
            onPage={setPage}
            itemKey={(puzzle) => puzzle.slug}
            renderItem={(puzzle) => (
              <div className="flex flex-col gap-2">
                <PuzzleCard puzzle={puzzle} played={played} />
                {id === "mine" || id === "received" ? (
                  <button
                    type="button"
                    className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    onClick={() => void onRemove(puzzle.slug)}
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

function CollectionHeading({
  id,
  title,
  description,
  count,
  page,
  onPage,
  empty,
  action,
  error,
}: {
  id: string
  title: string
  description?: string
  count: number
  page: number
  onPage: (page: number) => void
  empty?: string
  action?: ReactNode
  error?: string
}) {
  return (
    <>
      <SectionHeader id={id} title={title} description={description} label={title} count={count} page={page} onPage={onPage} action={action} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
    </>
  )
}

function favouriteList(groups: PuzzleGroup[], library: { mine: Puzzle[]; received: Puzzle[] }, slugs: readonly string[]) {
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
