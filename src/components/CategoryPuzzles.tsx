import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"

import { PuzzleCard } from "@/components/PuzzleGallery"
import { buttonVariants } from "@/components/ui/button"
import { type PuzzleGroup } from "@/lib/puzzles"
import { listPlayedGames, type PlayedGame } from "@/lib/save"
import { cn } from "cn"

export function CategoryPuzzles({ group }: { group: PuzzleGroup }) {
  const [played, setPlayed] = useState<PlayedGame[]>([])

  useEffect(() => {
    setPlayed(listPlayedGames())
  }, [])

  return (
    <div className="flex w-full flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-col items-start gap-4">
        <a href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          <ArrowLeft />
          Back
        </a>
        <header className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">{group.title}</h1>
          {group.description ? <p className="text-base text-muted-foreground">{group.description}</p> : null}
          <p className="text-sm text-muted-foreground">
            {group.puzzles.length} {group.puzzles.length === 1 ? "puzzle" : "puzzles"}
          </p>
        </header>
      </div>
      <ul className="grid grid-cols-4 gap-4">
        {group.puzzles.map((puzzle) => (
          <li key={puzzle.slug}>
            <PuzzleCard puzzle={puzzle} played={played} />
          </li>
        ))}
      </ul>
    </div>
  )
}
