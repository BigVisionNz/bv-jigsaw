import { buttonVariants } from "@/components/ui/button"
import { PIECE_COUNTS, type PieceCount } from "@/lib/puzzles"
import { cn } from "cn"

const MEDAL: Record<PieceCount, string> = {
  100: "bg-[#c47848] text-[#2a140c]",
  200: "bg-[#7a4e2d] text-[#f6e7d4]",
  400: "bg-[#d5d8de] text-[#1a1d22]",
  800: "bg-[#e0b033] text-[#3a2806]",
}

export function PieceCount({
  value,
  onChange,
  completed,
}: {
  value: PieceCount
  onChange: (count: PieceCount) => void
  completed?: Record<PieceCount, number>
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Piece count">
      {PIECE_COUNTS.map((count) => {
        const times = completed?.[count]
        const label = times == null ? `${count}` : `${count} pieces, completed ${times} ${times === 1 ? "time" : "times"}`
        return (
          <button
            key={count}
            type="button"
            aria-pressed={value === count}
            aria-label={completed ? label : undefined}
            className={cn(buttonVariants({ variant: value === count ? "default" : "outline", size: "sm" }), "gap-1.5")}
            onClick={() => onChange(count)}
          >
            {count}
            {times == null ? null : (
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
                  MEDAL[count],
                )}
              >
                {times}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
