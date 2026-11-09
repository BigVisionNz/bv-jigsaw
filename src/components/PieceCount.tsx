import { buttonVariants } from "@/components/ui/button"
import { PIECE_COUNTS, type PieceCount } from "@/lib/puzzles"
import { cn } from "cn"

export const PIECE_MEDAL: Record<PieceCount, string> = {
  100: "bg-[#c47848] text-[#2a140c]",
  200: "bg-[#7a4e2d] text-[#f6e7d4]",
  400: "bg-[#d5d8de] text-[#1a1d22]",
  800: "bg-[#e0b033] text-[#3a2806]",
}

export function PieceCount({
  value,
  onChange,
  completed,
  href,
  onSelect,
}: {
  value: PieceCount
  onChange: (count: PieceCount) => void
  completed?: Record<PieceCount, number>
  href?: (count: PieceCount) => string
  onSelect?: (count: PieceCount) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Piece count">
      {PIECE_COUNTS.map((count) => {
        const times = completed?.[count]
        const label = times == null ? `${count} pieces` : `${count} pieces, completed ${times} ${times === 1 ? "time" : "times"}`
        const className = cn(buttonVariants({ variant: value === count ? "default" : "outline", size: "sm" }), "gap-1.5")
        const start = () => {
          onSelect?.(count)
          if (!href) onChange(count)
        }
        const badge = times == null ? null : (
          <span
            className={cn(
              "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
              PIECE_MEDAL[count],
            )}
          >
            {times}
          </span>
        )
        if (href) {
          return (
            <a key={count} href={href(count)} data-astro-reload aria-label={label} className={className} onClick={start}>
              {count}
              {badge}
            </a>
          )
        }
        return (
          <button key={count} type="button" aria-pressed={value === count} aria-label={label} className={className} onClick={start}>
            {count}
            {badge}
          </button>
        )
      })}
    </div>
  )
}
