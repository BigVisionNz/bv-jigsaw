import { useEffect, useRef, useState } from "react"

import { puzzleGrid } from "@/lib/puzzles"
import { cn } from "cn"

type Crop = { x: number; y: number; w: number; h: number }

export function ProgressCover({ src, cells, pieces }: { src: string; cells?: boolean[]; pieces: number }) {
  const frame = useRef<HTMLSpanElement>(null)
  const [crop, setCrop] = useState<Crop | null>(null)
  const { cols, rows } = puzzleGrid(pieces)
  const mask = cells?.length === pieces ? cells : null
  const anyPlaced = mask?.some(Boolean) ?? false

  useEffect(() => {
    const node = frame.current
    const image = node?.querySelector("img")
    if (!node || !(image instanceof HTMLImageElement)) return
    const update = () => {
      if (!image.naturalWidth || !image.naturalHeight) return
      const box = node.getBoundingClientRect()
      if (box.width <= 0 || box.height <= 0) return
      setCrop(coverCrop(image.naturalWidth / image.naturalHeight, box.width / box.height))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    image.addEventListener("load", update)
    return () => {
      observer.disconnect()
      image.removeEventListener("load", update)
    }
  }, [src])

  return (
    <span ref={frame} className="relative block aspect-[4/3] overflow-hidden">
      <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        {crop && anyPlaced && mask ? (
          mask.map((placed, id) => (
            <span
              key={id}
              className={cn("absolute", placed ? "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]" : "bg-black/55")}
              style={cellBox(id, cols, rows, crop)}
            />
          ))
        ) : anyPlaced ? null : (
          <span className="absolute inset-0 bg-black/55" />
        )}
      </span>
    </span>
  )
}

function coverCrop(imageAspect: number, frameAspect: number): Crop {
  if (imageAspect > frameAspect) {
    const w = frameAspect / imageAspect
    return { x: (1 - w) / 2, y: 0, w, h: 1 }
  }
  const h = imageAspect / frameAspect
  return { x: 0, y: (1 - h) / 2, w: 1, h }
}

function cellBox(id: number, cols: number, rows: number, crop: Crop) {
  const col = id % cols
  const row = Math.floor(id / cols)
  return {
    left: `${((col / cols - crop.x) / crop.w) * 100}%`,
    top: `${((row / rows - crop.y) / crop.h) * 100}%`,
    width: `${(1 / cols / crop.w) * 100}%`,
    height: `${(1 / rows / crop.h) * 100}%`,
  }
}
