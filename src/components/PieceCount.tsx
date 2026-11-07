import { buttonVariants } from "@/components/ui/button"
import { PIECE_COUNTS, type PieceCount } from "@/lib/puzzles"
import { cn } from "cn"

export function PieceCount({
  value,
  onChange,
}: {
  value: PieceCount
  onChange: (count: PieceCount) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Piece count">
      {PIECE_COUNTS.map((count) => (
        <button
          key={count}
          type="button"
          aria-pressed={value === count}
          className={cn(buttonVariants({ variant: value === count ? "default" : "outline", size: "sm" }))}
          onClick={() => onChange(count)}
        >
          {count}
        </button>
      ))}
    </div>
  )
}
