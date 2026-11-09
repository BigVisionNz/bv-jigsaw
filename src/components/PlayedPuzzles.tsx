import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"

import { ProgressCover } from "@/components/ProgressCover"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { puzzleHref, resolvePlayedGames } from "@/lib/library"
import { type Puzzle, type PuzzleGroup } from "@/lib/puzzles"
import { type PlayedGame } from "@/lib/save"
import { cn } from "cn"

type PlayedCardGame = PlayedGame & { puzzle: Puzzle & { group: string } }

export function PlayedPuzzles({ groups }: { groups: PuzzleGroup[] }) {
  const [games, setGames] = useState<PlayedCardGame[] | null>(null)

  useEffect(() => {
    let revoke = () => {}
    let cancelled = false
    resolvePlayedGames(groups).then((result) => {
      if (cancelled) {
        result.revoke()
        return
      }
      revoke = result.revoke
      setGames(result.games)
    })
    return () => {
      cancelled = true
      revoke()
    }
  }, [groups])

  const inProgress = games?.filter((game) => game.placed < game.pieces) ?? null
  const completed = games?.filter((game) => game.placed >= game.pieces) ?? null

  return (
    <div className="flex w-full flex-col gap-14 px-4 py-10 sm:px-6">
      <div className="flex flex-col items-start gap-4">
        <a href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          <ArrowLeft />
          Back to All Jigsaws
        </a>
        <header className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">Last Played</h1>
          <p className="text-base text-muted-foreground">Puzzles you have finished, and puzzles still on the board.</p>
        </header>
      </div>
      <PlayedSection
        id="in-progress"
        title="In Progress"
        empty="No puzzles in progress."
        games={inProgress}
        action="Continue"
      />
      <PlayedSection id="completed" title="Completed" empty="No completed puzzles." games={completed} action="Open" />
    </div>
  )
}

function PlayedSection({
  id,
  title,
  empty,
  games,
  action,
}: {
  id: string
  title: string
  empty: string
  games: PlayedCardGame[] | null
  action: string
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {games === null ? null : games.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((game) => (
            <li key={`${game.slug}:${game.pieces}`}>
              <PlayedCard game={game} action={action} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PlayedCard({ game, action }: { game: PlayedCardGame; action: string }) {
  const href = puzzleHref(game.slug, game.pieces)
  const done = game.placed >= game.pieces
  const percent = done ? "100% complete" : `${Math.max(1, Math.round((game.placed / game.pieces) * 100))}% complete`

  return (
    <Card className="h-full pt-0">
      <a href={href} aria-label={`${action} ${game.puzzle.title}, ${percent}`} className="group relative block">
        <ProgressCover src={game.puzzle.image} cells={game.cells} pieces={game.pieces} />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className={cn(buttonVariants(), "pointer-events-none shadow-sm")}>
            {action} · {percent}
          </span>
        </span>
      </a>
      <CardHeader>
        <CardTitle>{game.puzzle.title}</CardTitle>
        <div className="flex items-center gap-3">
          <p className="min-w-0 text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{game.placed}</span> of {game.pieces} pieces · {game.puzzle.group}
          </p>
          <Progress className="ml-auto w-24 shrink-0" value={(game.placed / game.pieces) * 100} aria-label={`${game.placed} of ${game.pieces} pieces`} />
        </div>
      </CardHeader>
      <CardFooter>
        <a href={href} className={cn(buttonVariants(), "w-full")}>
          {action} · {percent}
        </a>
      </CardFooter>
    </Card>
  )
}
