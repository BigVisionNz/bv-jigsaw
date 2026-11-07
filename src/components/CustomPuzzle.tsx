import { useEffect, useState } from "react"

import { PuzzleBoard } from "@/components/PuzzleBoard"
import { getLibraryImage, libraryGroup } from "@/lib/library"
import type { Puzzle } from "@/lib/puzzles"

type Playable = Puzzle & { group: string }

export function CustomPuzzle() {
  const [puzzle, setPuzzle] = useState<Playable | null | undefined>(undefined)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? ""
    let url = ""
    let cancelled = false
    getLibraryImage(id)
      .then((item) => {
        if (cancelled) return
        if (!item) {
          setPuzzle(null)
          return
        }
        url = URL.createObjectURL(item.blob)
        document.title = `${item.title} · BV Jigsaw`
        setPuzzle({ slug: item.id, title: item.title, image: url, group: libraryGroup(item.source) })
      })
      .catch(() => {
        if (!cancelled) setPuzzle(null)
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  if (puzzle === undefined) return null
  if (!puzzle) {
    return (
      <div className="flex flex-1 flex-col items-start gap-3 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Picture unavailable</h1>
        <p className="text-sm text-muted-foreground">This picture is no longer on this device.</p>
        <a href="/" className="text-sm font-medium underline-offset-4 hover:underline">
          All puzzles
        </a>
      </div>
    )
  }

  return <PuzzleBoard puzzle={puzzle} />
}
