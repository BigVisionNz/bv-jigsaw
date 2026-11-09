import { bindBoardColour } from "@/lib/board-colour"
import { bindEdgeColour } from "@/lib/edge-colour"
import { bindEdgeStyle } from "@/lib/edge-style"
import { bindGridColour } from "@/lib/grid-colour"

export function bindPuzzleColours(slug: string | null) {
  bindGridColour(slug)
  bindBoardColour(slug)
  bindEdgeColour(slug)
  bindEdgeStyle(slug)
}
