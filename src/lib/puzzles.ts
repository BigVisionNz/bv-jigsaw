export const PIECE_COUNTS = [100, 200, 400, 800] as const

export type PieceCount = (typeof PIECE_COUNTS)[number]

export function isPieceCount(value: number): value is PieceCount {
  return (PIECE_COUNTS as readonly number[]).includes(value)
}

export type Puzzle = {
  slug: string
  title: string
  image: string
}

export type PuzzleGroup = {
  id: string
  title: string
  description?: string
  puzzles: Puzzle[]
}

export function allPuzzles(groups: PuzzleGroup[]) {
  return groups.flatMap((group) =>
    group.puzzles.map((puzzle) => ({ ...puzzle, group: group.title })),
  )
}

export function findPuzzle(groups: PuzzleGroup[], slug: string | undefined) {
  return allPuzzles(groups).find((puzzle) => puzzle.slug === slug)
}

export function puzzleGrid(pieces: number) {
  let cols = pieces
  let rows = 1
  let score = pieces
  for (let nextRows = 1; nextRows * nextRows <= pieces; nextRows += 1) {
    if (pieces % nextRows !== 0) continue
    const nextCols = pieces / nextRows
    const nextScore = Math.abs(nextCols - nextRows)
    if (nextScore < score) {
      cols = nextCols
      rows = nextRows
      score = nextScore
    }
  }
  return { cols, rows }
}
