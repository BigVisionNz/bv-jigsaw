import { Check, X } from "lucide-react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from "react"

import { PieceCount } from "@/components/PieceCount"
import { buttonVariants } from "@/components/ui/button"
import { ControlTip, TooltipProvider } from "@/components/ui/tooltip"
import { completionCounts, completionStoreSnapshot, recordCompletion, subscribeCompletions } from "@/lib/completions"
import { getBoardSnap, getTraySnap, loadAutoSnap, subscribeAutoSnap } from "@/lib/auto-snap"
import { DEFAULT_EDGE_COLOUR, getEdgeColour, getEdgesShown, subscribeEdgeColour, subscribeEdgesShown } from "@/lib/edge-colour"
import { DEFAULT_BOARD_COLOUR, getBoardColour, subscribeBoardColour } from "@/lib/board-colour"
import { DEFAULT_GRID_COLOUR, getGridColour, subscribeGridColour } from "@/lib/grid-colour"
import { getHintsOn, subscribeHints } from "@/lib/hints"
import { getPictureShown, subscribePicture } from "@/lib/picture"
import { bindPuzzleColours } from "@/lib/puzzle-colours"
import { setPuzzleSolved } from "@/lib/puzzle-solved"
import { isPieceCount, PIECE_COUNTS, puzzleGrid, type PieceCount as PieceCountValue, type Puzzle } from "@/lib/puzzles"
import { loadGame, saveGame } from "@/lib/save"
import { cn } from "cn"

type PlayablePuzzle = Puzzle & { group: string }

type Piece = {
  id: number
  col: number
  row: number
}

type Bin = "tray" | "mat" | number

type Cluster = {
  id: number
  x: number
  y: number
  pieceIds: number[]
}

type Drag = {
  pieceId: number
  pieceIds: number[]
  clusterId: number | null
  x: number
  y: number
}

function ArrowLeftCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="m7 12l5-5v3h4v4h-4v3zm15 0a10 10 0 0 1-10 10A10 10 0 0 1 2 12A10 10 0 0 1 12 2a10 10 0 0 1 10 10m-2 0a8 8 0 0 0-8-8a8 8 0 0 0-8 8a8 8 0 0 0 8 8a8 8 0 0 0 8-8"
      />
    </svg>
  )
}

type Pane = "board" | "pieces" | "connect"

function FrameSizeIcon({ restore, className }: { restore: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d={
          restore
            ? "M21 15h2v2h-2zm0-4h2v2h-2zm2 8h-2v2c1 0 2-1 2-2M13 3h2v2h-2zm8 4h2v2h-2zm0-4v2h2c0-1-1-2-2-2M1 7h2v2H1zm16-4h2v2h-2zm0 16h2v2h-2zM3 3C2 3 1 4 1 5h2zm6 0h2v2H9zM5 3h2v2H5zm-4 8v8a2 2 0 0 0 2 2h12V11zm2 8l2.5-3.21l1.79 2.15l2.5-3.22L13 19z"
            : "M21 3H3C2 3 1 4 1 5v14a2 2 0 0 0 2 2h18c1 0 2-1 2-2V5c0-1-1-2-2-2M5 17l3.5-4.5l2.5 3l3.5-4.5l4.5 6z"
        }
      />
    </svg>
  )
}

function PaneSizeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  const name = active ? `Restore ${label}` : `Maximise ${label}`
  return (
    <ControlTip label={name} side="top">
      <button
        type="button"
        aria-pressed={active}
        aria-label={name}
        className="group inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={onClick}
      >
        <FrameSizeIcon restore={active} className="size-5 transition-transform duration-150 group-hover:scale-110" />
      </button>
    </ControlTip>
  )
}

const paneHeaderFade = "bg-linear-to-b from-neutral-300 to-white px-2 dark:from-neutral-700 dark:to-black"
const DRAWER_COUNT = 4
const TILE = 56
const PIECE_GAP = 8
const SNAP = 40

export function PuzzleBoard({ puzzle }: { puzzle: PlayablePuzzle }) {
  const [pieces, setPieces] = useState<PieceCountValue>(readPieceCount)
  const completionRaw = useSyncExternalStore(subscribeCompletions, completionStoreSnapshot, () => "")
  const completed = useMemo(() => {
    const stored = completionCounts(puzzle.slug)
    return Object.fromEntries(
      PIECE_COUNTS.map((count) => {
        const game = loadGame(puzzle.slug, count)
        const finished = !!game && game.placed.length === count && game.placed.every(Boolean)
        return [count, Math.max(stored[count] ?? 0, finished ? 1 : 0)]
      }),
    ) as Record<PieceCountValue, number>
  }, [completionRaw, puzzle.slug])

  useLayoutEffect(() => {
    bindPuzzleColours(puzzle.slug)
    return () => bindPuzzleColours(null)
  }, [puzzle.slug])

  return (
    <TooltipProvider>
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <ControlTip label="Back to all puzzles" side="bottom">
            <a
              href="/"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ArrowLeftCircle className="size-5" />
              All puzzles
            </a>
          </ControlTip>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{puzzle.title}</h1>
        </div>
        <PieceCount value={pieces} onChange={setPieces} completed={completed} />
      </div>
      <PuzzlePlay key={pieces} puzzle={puzzle} pieces={pieces} />
    </div>
    </TooltipProvider>
  )
}

function PuzzlePlay({ puzzle, pieces }: { puzzle: PlayablePuzzle; pieces: number }) {
  const { cols, rows } = puzzleGrid(pieces)
  const boardRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const matRef = useRef<HTMLDivElement>(null)
  const connectRef = useRef<HTMLElement>(null)
  const drawerGridRef = useRef<HTMLDivElement>(null)
  const drawerPanelRefs = useRef<Array<HTMLDivElement | null>>([])
  const drawerWellRefs = useRef<Array<HTMLDivElement | null>>([])
  const drawerTabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const draggedRef = useRef(false)
  const splitRef = useRef<HTMLDivElement>(null)
  const piecesRef = useRef<HTMLDivElement>(null)
  const looseRef = useRef<HTMLElement>(null)
  const [trayHeight, setTrayHeight] = useState<number | null>(null)
  const [piecesWidth, setPiecesWidth] = useState<number | null>(null)
  const [maximized, setMaximized] = useState<Pane | null>(null)
  const layoutBefore = useRef<{ tray: number | null; pieces: number | null } | null>(null)
  const [trayBox, setTrayBox] = useState({ width: 0, height: 0 })
  const [drawerBoxes, setDrawerBoxes] = useState(() => Array.from({ length: DRAWER_COUNT }, () => ({ width: 0, height: 0 })))
  const [selectedDrawer, setSelectedDrawer] = useState(0)
  const [saved] = useState(() => loadGame(puzzle.slug, pieces))
  const restoredClusters = uniqueClusters(withoutPieces(saved?.clusters ?? [], placedIds(saved?.placed)))
  const homeRef = useRef<Bin[]>(saved?.home ?? Array.from({ length: pieces }, () => "tray"))
  const clustersRef = useRef<Cluster[]>(restoredClusters)
  const dragRef = useRef<Drag | null>(null)
  const choosingTrayRef = useRef(false)
  const placedRef = useRef<boolean[]>(saved?.placed ?? [])
  const orderRef = useRef<number[]>(saved?.order ?? [])
  const nextCluster = useRef(saved?.nextCluster ?? 1)
  const [placed, setPlaced] = useState<boolean[]>(() => saved?.placed ?? Array(pieces).fill(false))
  const [home, setHome] = useState<Bin[]>(() => homeRef.current)
  const [clusters, setClusters] = useState<Cluster[]>(() => clustersRef.current)
  const [order, setOrder] = useState(() => saved?.order ?? shuffle(pieces))
  const [drag, setDrag] = useState<Drag | null>(null)
  const [connectBox, setConnectBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const pictureShown = useSyncExternalStore(subscribePicture, getPictureShown, () => false)
  const hintsOn = useSyncExternalStore(subscribeHints, getHintsOn, () => false)
  const edgeColour = useSyncExternalStore(subscribeEdgeColour, getEdgeColour, () => DEFAULT_EDGE_COLOUR)
  const edgesShown = useSyncExternalStore(subscribeEdgesShown, getEdgesShown, () => true)
  const gridColour = useSyncExternalStore(subscribeGridColour, getGridColour, () => DEFAULT_GRID_COLOUR)
  const boardColour = useSyncExternalStore(subscribeBoardColour, getBoardColour, () => DEFAULT_BOARD_COLOUR)
  const traySnap = useSyncExternalStore(subscribeAutoSnap, getTraySnap, () => true)
  const boardSnap = useSyncExternalStore(subscribeAutoSnap, getBoardSnap, () => false)
  const [ratio, setRatio] = useState<number | null>(null)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [imageNotice, setImageNotice] = useState(false)
  const solved = placed.every(Boolean)
  const placedCount = placed.filter(Boolean).length
  const celebrated = useRef(solved)
  const skipSave = useRef(true)
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    saveGame(puzzle.slug, pieces, {
      placed,
      home,
      clusters,
      order,
      nextCluster: nextCluster.current,
    })
  }, [placed, home, clusters, order, puzzle.slug, pieces])
  useEffect(() => {
    return () => {
      saveGame(puzzle.slug, pieces, {
        placed: placedRef.current,
        home: homeRef.current,
        clusters: clustersRef.current,
        order: orderRef.current,
        nextCluster: nextCluster.current,
      })
    }
  }, [puzzle.slug, pieces])
  useEffect(() => {
    if (!solved || celebrated.current) return
    celebrated.current = true
    if (isPieceCount(pieces)) recordCompletion(puzzle.slug, pieces)
    setCompleteOpen(true)
  }, [solved, pieces, puzzle.slug])
  useEffect(() => {
    setPuzzleSolved(solved)
    return () => setPuzzleSolved(false)
  }, [solved])
  homeRef.current = home
  clustersRef.current = clusters
  placedRef.current = placed
  orderRef.current = order

  function pieceStyle(piece: Piece, width?: number, height?: number, rim = true): CSSProperties {
    const edge = rim ? `3px solid ${edgeColour}` : undefined
    return {
      width,
      height,
      boxSizing: "border-box",
      backgroundImage: `url("${puzzle.image}")`,
      backgroundSize: `${cols * 100}% ${rows * 100}%`,
      backgroundPosition: position(piece.col, piece.row, cols, rows),
      borderTop: rim && piece.row === 0 ? edge : undefined,
      borderBottom: rim && piece.row === rows - 1 ? edge : undefined,
      borderLeft: rim && piece.col === 0 ? edge : undefined,
      borderRight: rim && piece.col === cols - 1 ? edge : undefined,
    }
  }

  function poolRim(id: number) {
    const bin = home[id]
    return bin !== "tray" && typeof bin !== "number" ? true : edgesShown
  }

  function updateDrag(next: Drag | null) {
    dragRef.current = next
    setDrag(next)
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: number) {
    event.preventDefault()
    window.getSelection()?.removeAllRanges()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some browsers reject capture when the pointer is already gone.
    }
    const pieceIds = groupedIds(id)
    const cluster = clustersRef.current.find((item) => item.pieceIds.includes(id))
    const exact =
      cluster != null &&
      pieceIds.length === cluster.pieceIds.length &&
      pieceIds.every((pieceId) => cluster.pieceIds.includes(pieceId))
    updateDrag({
      pieceId: id,
      pieceIds,
      clusterId: exact ? cluster.id : null,
      x: event.clientX,
      y: event.clientY,
    })
  }

  useEffect(() => {
    loadAutoSnap()
  }, [])

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) setRatio(image.naturalWidth / image.naturalHeight)
    }
    image.src = puzzle.image
  }, [puzzle.image])

  useEffect(() => {
    function keepTextStill(event: Event) {
      if (!dragRef.current) return
      event.preventDefault()
    }
    function move(event: PointerEvent) {
      const current = dragRef.current
      if (!current) return
      window.getSelection()?.removeAllRanges()
      updateDrag({ ...current, x: event.clientX, y: event.clientY })
    }
    function up(event: PointerEvent) {
      const current = dragRef.current
      window.getSelection()?.removeAllRanges()
      if (!current) return
      draggedRef.current = true
      const point = { x: event.clientX, y: event.clientY }
      const board = boardRef.current?.getBoundingClientRect()
      const drawer = trayAtPoint(point)
      if (drawer >= 0) {
        placeInDrawer(current.pieceIds, drawer, pieceUnderPointer(point, drawer, current.pieceIds))
        setSelectedDrawer(drawer)
      } else if (board && contains(board, point)) {
        if (getPictureShown()) setImageNotice(true)
        else placeOnBoard(current, point, board)
      } else if (contains(matRef.current?.getBoundingClientRect(), point)) dropOnMat(current, point)
      else if (contains(trayRef.current?.getBoundingClientRect(), point)) {
        placeInPool(current.pieceIds, pieceUnderPointer(point, "tray", current.pieceIds))
      }
      updateDrag(null)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    document.addEventListener("selectstart", keepTextStill)
    document.addEventListener("dragstart", keepTextStill)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      document.removeEventListener("selectstart", keepTextStill)
      document.removeEventListener("dragstart", keepTextStill)
    }
  }, [cols, rows])

  function placeOnBoard(current: Drag, point: { x: number; y: number }, board: DOMRect) {
    const cell = cellAt(point, board, cols, rows)
    if (!cell) return false
    const grabbed = pieceFromId(current.pieceId, cols)
    const target = getBoardSnap() ? { col: grabbed.col, row: grabbed.row } : cell
    if (!dropFits(current.pieceIds, current.pieceId, target.col, target.row, cols, placedRef.current)) return false
    const nextPlaced = placedRef.current.map((value, index) => (current.pieceIds.includes(index) ? true : value))
    const nextClusters = withoutPieces(clustersRef.current, current.pieceIds)
    setPlaced(nextPlaced)
    setClusters(nextClusters)
    saveGame(puzzle.slug, pieces, {
      placed: nextPlaced,
      home: homeRef.current,
      clusters: nextClusters,
      order: orderRef.current,
      nextCluster: nextCluster.current,
    })
    return true
  }

  function placeInDrawer(ids: number[], drawer: number, beforeId: number | null) {
    setHome((values) => values.map((bin, index) => (ids.includes(index) ? drawer : bin)))
    setOrder((current) => {
      const rest = current.filter((id) => !ids.includes(id))
      const index =
        beforeId != null && rest.includes(beforeId)
          ? rest.indexOf(beforeId)
          : rest.findLastIndex((id) => homeRef.current[id] === drawer && !placedRef.current[id]) + 1
      rest.splice(index < 0 ? rest.length : index, 0, ...ids)
      return rest
    })
    if (getTraySnap()) keepGroup(ids)
    else joinTrayNeighbors(ids, drawer, beforeId)
  }

  function placeInPool(ids: number[], beforeId: number | null) {
    setHome((values) => values.map((bin, index) => (ids.includes(index) ? "tray" : bin)))
    setOrder((current) => {
      const rest = current.filter((id) => !ids.includes(id))
      const index =
        beforeId != null && rest.includes(beforeId)
          ? rest.indexOf(beforeId)
          : rest.findLastIndex((id) => homeRef.current[id] === "tray" && !placedRef.current[id]) + 1
      rest.splice(index < 0 ? rest.length : index, 0, ...ids)
      return rest
    })
    joinTrayNeighbors(ids, "tray", beforeId)
  }

  function joinTrayNeighbors(ids: number[], bin: Bin, beforeId: number | null) {
    const neighbors = trayNeighbors(ids, bin, beforeId).filter((id) =>
      ids.some((moving) => sharesEdge(pieceFromId(moving, cols), pieceFromId(id, cols))),
    )
    setClusters((current) => {
      const cleared = withoutPieces(current, ids)
      if (!neighbors.length) {
        if (ids.length < 2) return cleared
        return [...cleared, { id: nextCluster.current++, x: 0, y: 0, pieceIds: [...ids] }]
      }
      const absorbed = new Set<number>(ids)
      for (const id of neighbors) {
        const cluster = cleared.find((item) => item.pieceIds.includes(id))
        const members = (cluster ? cluster.pieceIds : [id]).filter(
          (pieceId) => ids.includes(pieceId) || (homeRef.current[pieceId] === bin && !placedRef.current[pieceId]),
        )
        members.forEach((pieceId) => absorbed.add(pieceId))
      }
      return [...withoutPieces(cleared, [...absorbed]), { id: nextCluster.current++, x: 0, y: 0, pieceIds: [...absorbed] }]
    })
  }

  function trayNeighbors(ids: number[], bin: Bin, beforeId: number | null) {
    if (beforeId == null || ids.includes(beforeId)) return []
    if (homeRef.current[beforeId] !== bin || placedRef.current[beforeId]) return []
    return [beforeId]
  }

  function keepGroup(ids: number[]) {
    setClusters((current) => {
      const remaining = withoutPieces(current, ids)
      if (ids.length < 2) return remaining
      const kept = current.find((cluster) => ids.every((id) => cluster.pieceIds.includes(id)) && cluster.pieceIds.length === ids.length)
      return kept ? [...remaining, kept] : [...remaining, { id: nextCluster.current++, x: 0, y: 0, pieceIds: [...ids] }]
    })
  }

  function groupedIds(id: number) {
    const home = homeRef.current[id]
    if (home === "mat") {
      const cluster = clustersRef.current.find((item) => item.pieceIds.includes(id))
      if (!cluster) return [id]
      const together = cluster.pieceIds.every((pieceId) => homeRef.current[pieceId] === "mat" && !placedRef.current[pieceId])
      return together ? cluster.pieceIds : [id]
    }
    if (home === "tray" || typeof home === "number") {
      const ids = orderRef.current.filter((pieceId) => !placedRef.current[pieceId] && homeRef.current[pieceId] === home)
      if (typeof home === "number" && getTraySnap()) return connectGroups(ids, cols).find((group) => group.includes(id)) ?? [id]
      const cluster = clustersRef.current.find((item) => item.pieceIds.includes(id))
      const together = cluster?.pieceIds.filter((pieceId) => ids.includes(pieceId)) ?? []
      return together.length ? together : [id]
    }
    return [id]
  }

  function pieceUnderPointer(point: { x: number; y: number }, bin: Bin, moving: number[]) {
    for (const node of document.elementsFromPoint(point.x, point.y)) {
      if (!(node instanceof Element)) continue
      const host = node.closest("[data-piece-id]")
      if (!host) continue
      const id = Number(host.getAttribute("data-piece-id"))
      if (moving.includes(id) || homeRef.current[id] !== bin) continue
      return id
    }
    return null
  }

  function poolConnectTarget(current: Drag | null) {
    if (!current || !contains(trayRef.current?.getBoundingClientRect(), current)) return null
    const id = pieceUnderPointer(current, "tray", current.pieceIds)
    if (id == null) return null
    const target = pieceFromId(id, cols)
    return current.pieceIds.some((moving) => sharesEdge(pieceFromId(moving, cols), target)) ? id : null
  }

  function trayConnectTarget(current: Drag | null, drawer: number) {
    if (traySnap || !current || drawer < 0) return null
    const id = pieceUnderPointer(current, drawer, current.pieceIds)
    if (id == null) return null
    const target = pieceFromId(id, cols)
    const matches = current.pieceIds.some((moving) => sharesEdge(pieceFromId(moving, cols), target))
    return matches ? id : null
  }

  function dropOnMat(current: Drag, point: { x: number; y: number }) {
    const node = matRef.current
    if (!node) return
    const mat = node.getBoundingClientRect()
    const grabbed = pieceFromId(current.pieceId, cols)
    const box = bounds(current.pieceIds, cols)
    const cluster: Cluster = {
      id: current.clusterId ?? nextCluster.current++,
      x: Math.max(0, point.x - mat.left + node.scrollLeft - (grabbed.col - box.minCol) * TILE - TILE / 2),
      y: Math.max(0, point.y - mat.top + node.scrollTop - (grabbed.row - box.minRow) * TILE - TILE / 2),
      pieceIds: current.pieceIds,
    }
    setClusters((existing) =>
      uniqueClusters(snapCluster(cluster, withoutPieces(existing, cluster.pieceIds), cols)),
    )
    setHome((values) => values.map((bin, index) => (current.pieceIds.includes(index) ? "mat" : bin)))
  }

  function renderPiece(id: number, width: number, height: number) {
    const piece = pieceFromId(id, cols)
    return (
      <button
        key={id}
        type="button"
        data-piece-id={id}
        aria-label={`Piece ${piece.col + 1}, ${piece.row + 1}`}
        className="cursor-grab touch-none overflow-hidden rounded-md bg-muted ring-1 ring-foreground/15 active:cursor-grabbing"
        style={pieceStyle(piece, width, height, poolRim(id))}
        onPointerDown={(event) => onPointerDown(event, id)}
      />
    )
  }

  const matClusters = visibleMatClusters(clusters, home, placed)
  const matExtent = matClusters.reduce(
    (extent, cluster) => {
      const box = bounds(cluster.pieceIds, cols)
      return {
        width: Math.max(extent.width, cluster.x + (box.maxCol - box.minCol + 1) * TILE + 24),
        height: Math.max(extent.height, cluster.y + (box.maxRow - box.minRow + 1) * TILE + 24),
      }
    },
    { width: 0, height: 0 },
  )
  const trayIds = order.filter((id) => !placed[id] && home[id] === "tray")
  const poolGroups = manualTrayGroups(trayIds).map((pieceIds) => ({
    key: pieceIds.slice().sort((a, b) => a - b).join("-"),
    pieceIds,
  }))
  const cellAspect = ratio ? (ratio * rows) / cols : 1
  const poolHeight = fitPieceGrid(trayBox.width, trayBox.height, Math.max(trayIds.length, 1), PIECE_GAP, cellAspect).size
  const poolWidth = poolHeight * cellAspect
  const boardRect = boardRef.current?.getBoundingClientRect()
  const hoverDrawer = drag ? trayAtPoint(drag) : -1
  const wantsTrayChoice = drag != null && home[drag.pieceId] === "tray" && contains(connectRef.current?.getBoundingClientRect(), drag)
  if (!drag) choosingTrayRef.current = false
  else if (wantsTrayChoice) choosingTrayRef.current = true
  const choosingTray = choosingTrayRef.current
  const dragFromPieces = !drag || home[drag.pieceId] === "tray" || typeof home[drag.pieceId] === "number" || hoverDrawer >= 0
  const dragHeight = hoverDrawer >= 0 ? tileForDrawer(hoverDrawer) : dragFromPieces ? poolHeight : TILE
  const dragWidth = dragHeight * (dragFromPieces ? cellAspect : 1)
  const ghost = drag ? ghostBox(drag, cols, rows, boardRect, dragWidth, dragHeight) : null
  const hint = hintCell(hintsOn, drag, boardRect, cols, rows, placed, boardSnap)
  const landing = landingCells(drag, boardRect, cols, rows)
  const connectTarget = trayConnectTarget(drag, hoverDrawer) ?? poolConnectTarget(drag)

  useLayoutEffect(() => {
    if (connectTarget == null) {
      setConnectBox((current) => (current == null ? current : null))
      return
    }
    const id = connectTarget
    let frame = 0
    const tick = () => {
      const node = document.querySelector(`[data-piece-id="${id}"]`)
      const rect = node?.getBoundingClientRect()
      setConnectBox((current) => {
        if (!rect || rect.width === 0) return current == null ? current : null
        if (current && current.left === rect.left && current.top === rect.top && current.width === rect.width && current.height === rect.height) return current
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      })
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [connectTarget, hoverDrawer])

  function trayAtPoint(point: { x: number; y: number }) {
    const tab = drawerTabRefs.current.findIndex((node) => contains(node?.getBoundingClientRect(), point))
    if (tab >= 0) return tab
    const direct = drawerPanelRefs.current.findIndex((node) => contains(node?.getBoundingClientRect(), point))
    if (direct >= 0) return direct
    const grid = drawerGridRef.current?.getBoundingClientRect()
    if (grid && grid.height > 8 && contains(grid, point)) {
      const col = point.x < grid.left + grid.width / 2 ? 0 : 1
      const row = point.y < grid.top + grid.height / 2 ? 0 : 1
      return row * 2 + col
    }
    let best = -1
    let bestDist = 16
    drawerPanelRefs.current.forEach((node, index) => {
      const rect = node?.getBoundingClientRect()
      if (!rect || rect.height < 8) return
      const dx = point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0
      const dy = point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0
      const dist = Math.hypot(dx, dy)
      if (dist <= bestDist) {
        bestDist = dist
        best = index
      }
    })
    return best
  }

  function selectDrawer(drawer: number) {
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    setSelectedDrawer(drawer)
  }

  function tileForDrawer(drawer: number) {
    const count = order.filter((id) => !placed[id] && home[id] === drawer).length
    const box = drawerBoxes[drawer]
    if (!box || box.width <= 0 || box.height <= 0) return 48
    const fitted = fitPieceGrid(box.width, box.height, Math.max(count, 1), 4, cellAspect)
    return Math.round(Math.max(32, Math.min(72, fitted.size)))
  }

  function drawerGroups(drawer: number) {
    const ids = order.filter((id) => !placed[id] && home[id] === drawer)
    const source = traySnap ? connectGroups(ids, cols) : manualTrayGroups(ids)
    return source.map((pieceIds) => ({
      key: pieceIds.slice().sort((a, b) => a - b).join("-"),
      pieceIds,
    }))
  }

  function manualTrayGroups(ids: number[]) {
    const available = new Set(ids)
    const used = new Set<number>()
    const groups: number[][] = []
    for (const id of ids) {
      if (used.has(id)) continue
      const cluster = clusters.find((item) => item.pieceIds.includes(id))
      const pieceIds = (cluster ? cluster.pieceIds : [id]).filter((pieceId) => available.has(pieceId) && !used.has(pieceId))
      pieceIds.forEach((pieceId) => used.add(pieceId))
      if (pieceIds.length) groups.push(pieceIds)
    }
    return groups
  }

  function renderDrawerGroup(pieceIds: number[], width: number, height: number, key: string) {
    if (pieceIds.length === 1) return renderPiece(pieceIds[0], width, height)
    const box = bounds(pieceIds, cols)
    const spanW = box.maxCol - box.minCol + 1
    const spanH = box.maxRow - box.minRow + 1
    return (
      <div key={key} className="relative shrink-0" style={{ width: spanW * width, height: spanH * height }}>
        {pieceIds.map((id) => {
          const piece = pieceFromId(id, cols)
          return (
            <button
              key={id}
              type="button"
              data-piece-id={id}
              aria-label={`Piece ${piece.col + 1}, ${piece.row + 1}`}
              className="absolute cursor-grab touch-none overflow-hidden rounded-md bg-muted ring-1 ring-foreground/15 active:cursor-grabbing"
              style={{ ...pieceStyle(piece, width, height, edgesShown), left: (piece.col - box.minCol) * width, top: (piece.row - box.minRow) * height }}
              onPointerDown={(event) => onPointerDown(event, id)}
            />
          )
        })}
      </div>
    )
  }

  useEffect(() => {
    const node = trayRef.current
    if (!node) return
    const measure = () => {
      const next = contentBox(node)
      setTrayBox((current) => (current.width === next.width && current.height === next.height ? current : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const measure = () => {
      if (dragRef.current) return
      const next = Array.from({ length: DRAWER_COUNT }, (_, drawer) => {
        const node = drawerWellRefs.current[drawer]
        return node ? contentBox(node) : { width: 0, height: 0 }
      })
      setDrawerBoxes((current) =>
        next.every((box, index) => Math.abs(box.width - (current[index]?.width ?? 0)) < 2 && Math.abs(box.height - (current[index]?.height ?? 0)) < 2)
          ? current
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    drawerWellRefs.current.forEach((node) => {
      if (node) observer.observe(node)
    })
    return () => observer.disconnect()
  }, [selectedDrawer, choosingTray])

  useEffect(() => {
    const node = splitRef.current
    if (!node) return
    const observer = new ResizeObserver(() => {
      const available = node.getBoundingClientRect().height - SEPARATOR
      setTrayHeight((current) => {
        if (maximized === "board") return clampTray(MIN_TRAY, available)
        if (maximized === "pieces" || maximized === "connect") return clampTray(available - MIN_BOARD, available)
        return current == null ? null : clampTray(current, available)
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [maximized])

  useEffect(() => {
    const node = piecesRef.current
    if (!node) return
    const observer = new ResizeObserver(() => {
      const available = node.getBoundingClientRect().width - SEPARATOR
      setPiecesWidth((current) => {
        if (maximized === "pieces") return clampColumn(available - MIN_COLUMN, available)
        if (maximized === "connect") return clampColumn(MIN_COLUMN, available)
        return current == null ? null : clampColumn(current, available)
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [maximized])

  function onResizeStart(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const handle = event.currentTarget
    const container = splitRef.current
    if (!container) return
    handle.setPointerCapture(event.pointerId)
    const startY = event.clientY
    const startHeight = trayHeight ?? piecesRef.current?.getBoundingClientRect().height ?? MIN_TRAY
    const available = container.getBoundingClientRect().height - handle.getBoundingClientRect().height

    function move(ev: { clientY: number }) {
      layoutBefore.current = null
      setMaximized(null)
      setTrayHeight(clampTray(startHeight + (startY - ev.clientY), available))
    }
    function finish(ev: { pointerId: number }) {
      if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId)
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", finish)
      handle.removeEventListener("pointercancel", finish)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", finish)
    handle.addEventListener("pointercancel", finish)
  }

  function onResizeKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const container = splitRef.current
    if (!container) return
    const available = container.getBoundingClientRect().height - SEPARATOR
    const base = () => trayHeight ?? piecesRef.current?.getBoundingClientRect().height ?? MIN_TRAY
    if (event.key === "ArrowUp") {
      event.preventDefault()
      layoutBefore.current = null
      setMaximized(null)
      setTrayHeight(clampTray(base() + 24, available))
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      layoutBefore.current = null
      setMaximized(null)
      setTrayHeight(clampTray(base() - 24, available))
    }
  }

  function onSplitStart(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const handle = event.currentTarget
    const container = piecesRef.current
    if (!container) return
    handle.setPointerCapture(event.pointerId)
    const startX = event.clientX
    const available = container.getBoundingClientRect().width - handle.getBoundingClientRect().width
    const startWidth = piecesWidth ?? looseRef.current?.getBoundingClientRect().width ?? available / 2

    function move(ev: { clientX: number }) {
      layoutBefore.current = null
      setMaximized(null)
      setPiecesWidth(clampColumn(startWidth + (ev.clientX - startX), available))
    }
    function finish(ev: { pointerId: number }) {
      if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId)
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", finish)
      handle.removeEventListener("pointercancel", finish)
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", finish)
    handle.addEventListener("pointercancel", finish)
  }

  function onSplitKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const container = piecesRef.current
    if (!container) return
    const available = container.getBoundingClientRect().width - SEPARATOR
    const base = () => piecesWidth ?? looseRef.current?.getBoundingClientRect().width ?? available / 2
    if (event.key === "ArrowRight") {
      event.preventDefault()
      layoutBefore.current = null
      setMaximized(null)
      setPiecesWidth(clampColumn(base() + 24, available))
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      layoutBefore.current = null
      setMaximized(null)
      setPiecesWidth(clampColumn(base() - 24, available))
    }
  }

  function togglePane(pane: Pane) {
    const split = splitRef.current
    const row = piecesRef.current
    const vertical = split ? split.getBoundingClientRect().height - SEPARATOR : 0
    const horizontal = row ? row.getBoundingClientRect().width - SEPARATOR : 0
    if (maximized === pane) {
      const before = layoutBefore.current
      setTrayHeight(before ? before.tray : null)
      setPiecesWidth(before ? before.pieces : null)
      layoutBefore.current = null
      setMaximized(null)
      return
    }
    if (maximized == null) layoutBefore.current = { tray: trayHeight, pieces: piecesWidth }
    const short = clampTray(MIN_TRAY, vertical)
    const tall = clampTray(vertical - MIN_BOARD, vertical)
    const narrow = clampColumn(MIN_COLUMN, horizontal)
    const wide = clampColumn(horizontal - MIN_COLUMN, horizontal)
    if (pane === "board") {
      setTrayHeight(short)
      setPiecesWidth(layoutBefore.current?.pieces ?? null)
    } else if (pane === "pieces") {
      setTrayHeight(tall)
      setPiecesWidth(wide)
    } else {
      setTrayHeight(tall)
      setPiecesWidth(narrow)
    }
    setMaximized(pane)
  }

  return (
    <div className="flex min-h-0 flex-1 select-none flex-col gap-3">
      <p className="shrink-0 text-sm text-muted-foreground">
        {puzzle.group} · {pieces} pieces · {placedCount} placed
        {solved ? " · Solved" : ""}
      </p>
      <div ref={splitRef} className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-w-0 flex-col",
          trayHeight == null ? "min-h-40 flex-[2_1_0%]" : "min-h-0 flex-1",
        )}
      >
        <div className={cn("flex h-8 shrink-0 items-center justify-between gap-2", paneHeaderFade)}>
          <h2 className="text-sm font-medium">Puzzle area</h2>
          <PaneSizeButton active={maximized === "board"} label="puzzle area" onClick={() => togglePane("board")} />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: "size" }}>
        <div
          className="relative max-h-full max-w-full overflow-hidden rounded-xl ring-1 ring-foreground/10"
          style={
            ratio
              ? {
                  height: `min(100cqh, calc(100cqw / ${ratio}))`,
                  width: `min(100cqw, calc(100cqh * ${ratio}))`,
                }
              : { width: "100%", height: "100%" }
          }
        >
            <div
              ref={boardRef}
              className="grid size-full"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                backgroundColor: boardColour,
                backgroundImage: pictureShown ? `url("${puzzle.image}")` : undefined,
                backgroundSize: "100% 100%",
              }}
              aria-label={`${puzzle.title} board`}
            >
              {Array.from({ length: pieces }, (_, id) => {
                const piece = pieceFromId(id, cols)
                return (
                  <div key={id} className="border" style={{ borderColor: gridColour }}>
                    {placed[id] ? <div className="size-full" style={pieceStyle(piece)} /> : null}
                  </div>
                )
              })}
            </div>
            {landing && boardRect
              ? landing.map((cell) => (
                  <div
                    key={`${cell.col}-${cell.row}`}
                    className="pointer-events-none fixed z-[70] border-2 border-primary bg-primary/20"
                    style={{
                      left: boardRect.left + (cell.col / cols) * boardRect.width,
                      top: boardRect.top + (cell.row / rows) * boardRect.height,
                      width: boardRect.width / cols,
                      height: boardRect.height / rows,
                    }}
                  />
                ))
              : null}
            {hint && boardRect ? (
              <div
                className="pointer-events-none fixed z-[60] flex items-center justify-center"
                style={{
                  left: boardRect.left + (hint.col / cols) * boardRect.width,
                  top: boardRect.top + (hint.row / rows) * boardRect.height,
                  width: boardRect.width / cols,
                  height: boardRect.height / rows,
                }}
                aria-hidden
              >
                <span
                  className={cn(
                    "flex size-[70%] items-center justify-center rounded-full text-white shadow-md",
                    hint.correct ? "bg-green-600" : "bg-red-600",
                  )}
                >
                  {hint.correct ? <Check className="size-1/2" strokeWidth={3} /> : <X className="size-1/2" strokeWidth={3} />}
                </span>
              </div>
            ) : null}
        </div>
        </div>
      </div>
      <ControlTip label="Drag to change the height of the pieces" side="top">
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the puzzle and the pieces"
        aria-valuemin={MIN_TRAY}
        aria-valuenow={trayHeight == null ? undefined : Math.round(trayHeight)}
        tabIndex={0}
        className="relative z-10 flex h-4 shrink-0 cursor-row-resize touch-none items-center outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onPointerDown={onResizeStart}
        onKeyDown={onResizeKey}
      >
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <span className="relative mx-auto h-1.5 w-14 rounded-full bg-foreground/40" />
      </div>
      </ControlTip>
      <div
        ref={piecesRef}
        className={cn(
          "flex min-h-[120px] overflow-hidden",
          trayHeight == null ? "flex-[3_1_0%]" : "shrink-0",
        )}
        style={trayHeight == null ? undefined : { height: trayHeight }}
      >
      <section
        ref={looseRef}
        className={cn("flex min-h-0 min-w-0 flex-col gap-2", piecesWidth == null ? "flex-1" : "shrink-0")}
        style={piecesWidth == null ? undefined : { width: piecesWidth }}
        aria-label="Loose pieces"
      >
        <div className={cn("flex h-8 shrink-0 items-center justify-between gap-2", paneHeaderFade)}>
          <ControlTip label="Drag a piece onto the board, a tray, or a neighbouring piece to join them." side="top">
            <h2 className="flex h-8 w-fit shrink-0 items-center text-sm font-medium">Pieces</h2>
          </ControlTip>
          <PaneSizeButton active={maximized === "pieces"} label="pieces" onClick={() => togglePane("pieces")} />
        </div>
        <ControlTip label="Drag a piece onto the board, a tray, or a neighbouring piece to join them." side="top" disabled={drag != null}>
        <div
          ref={trayRef}
          className="flex min-h-0 flex-1 flex-wrap content-center-safe justify-center-safe gap-1 overflow-auto rounded-xl bg-card p-3 ring-1 ring-foreground/10 [scrollbar-gutter:stable] [overflow-anchor:none]"
        >
          {poolGroups.map((group) => {
            const box = bounds(group.pieceIds, cols)
            const span = (box.maxCol - box.minCol + 1) * poolWidth
            const tall = (box.maxRow - box.minRow + 1) * poolHeight
            if (group.pieceIds.every((id) => drag?.pieceIds.includes(id))) {
              return <div key={group.key} style={{ width: span, height: tall }} />
            }
            return renderDrawerGroup(group.pieceIds, poolWidth, poolHeight, group.key)
          })}
        </div>
        </ControlTip>
      </section>
      <ControlTip label="Drag to change the width of the pieces" side="top">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the pieces and connect pieces"
        aria-valuemin={MIN_COLUMN}
        aria-valuenow={piecesWidth == null ? undefined : Math.round(piecesWidth)}
        tabIndex={0}
        className="relative z-10 flex w-4 shrink-0 cursor-col-resize touch-none items-center outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onPointerDown={onSplitStart}
        onKeyDown={onSplitKey}
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <span className="relative mx-auto h-14 w-1.5 rounded-full bg-foreground/40" />
      </div>
      </ControlTip>
      <section ref={connectRef} className="flex min-h-0 min-w-0 flex-1 flex-col gap-2" aria-label="Connect pieces">
        <div className={cn("flex min-h-8 shrink-0 flex-wrap items-center gap-1", paneHeaderFade)}>
          <ControlTip label="Sort pieces in the trays below." side="top">
            <h2 className="mr-2 flex h-8 w-fit shrink-0 items-center text-sm font-medium">Connect pieces</h2>
          </ControlTip>
          {Array.from({ length: DRAWER_COUNT }, (_, drawer) => {
            const count = order.filter((id) => !placed[id] && home[id] === drawer).length
            const selected = selectedDrawer === drawer
            return (
              <ControlTip key={drawer} label={`Show Tray ${drawer + 1}`} side="top" disabled={drag != null}>
                <button
                  type="button"
                  id={`drawer-tab-${drawer}`}
                  ref={(node) => {
                    drawerTabRefs.current[drawer] = node
                  }}
                  aria-pressed={selected}
                  aria-controls={`drawer-panel-${drawer}`}
                  aria-label={`Tray ${drawer + 1}`}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    hoverDrawer === drawer && "ring-2 ring-primary",
                  )}
                  onPointerDown={() => {
                    if (!dragRef.current) draggedRef.current = false
                  }}
                  onClick={() => selectDrawer(drawer)}
                >
                  <span>Tray {drawer + 1}</span>
                  {count > 0 ? (
                    <span className={cn("min-w-4 rounded-full px-1 text-center text-[10px] leading-4 tabular-nums", selected ? "bg-primary-foreground/20" : "bg-foreground/15")}>
                      {count}
                    </span>
                  ) : null}
                </button>
              </ControlTip>
            )
          })}
          <div className="ml-auto">
            <PaneSizeButton active={maximized === "connect"} label="connect pieces" onClick={() => togglePane("connect")} />
          </div>
        </div>
        {matClusters.length > 0 ? (
          <div
            ref={matRef}
            aria-label="Joined pieces"
            className="max-h-[38%] min-h-24 shrink-0 overflow-auto rounded-xl bg-muted/50 ring-1 ring-foreground/10"
          >
            <div className="relative min-h-full w-full" style={{ minWidth: matExtent.width, height: matExtent.height || undefined }}>
              {matClusters.map((cluster) => {
                const visible = cluster.pieceIds.filter((id) => home[id] === "mat" && !drag?.pieceIds.includes(id))
                if (!visible.length) return null
                const box = bounds(visible, cols)
                return (
                  <div
                    key={cluster.id}
                    className="absolute"
                    style={{ left: cluster.x, top: cluster.y, width: (box.maxCol - box.minCol + 1) * TILE, height: (box.maxRow - box.minRow + 1) * TILE }}
                  >
                    {visible.map((id) => {
                      const piece = pieceFromId(id, cols)
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-label={`Piece ${piece.col + 1}, ${piece.row + 1}`}
                          className="absolute cursor-grab touch-none rounded-md bg-muted ring-1 ring-foreground/15 active:cursor-grabbing"
                          style={{
                            ...pieceStyle(piece, TILE, TILE),
                            left: (piece.col - box.minCol) * TILE,
                            top: (piece.row - box.minRow) * TILE,
                          }}
                          onPointerDown={(event) => onPointerDown(event, id)}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
        <div ref={drawerGridRef} className={cn("grid min-h-0 flex-1 gap-2 overflow-hidden", choosingTray ? "grid-cols-2 grid-rows-2 p-1.5" : "grid-rows-1")}>
          {Array.from({ length: DRAWER_COUNT }, (_, drawer) => {
            if (!choosingTray && drawer !== selectedDrawer) return null
            const groups = drawerGroups(drawer)
            const tileH = tileForDrawer(drawer)
            const tileW = tileH * cellAspect
            const over = hoverDrawer === drawer
            return (
              <div
                key={drawer}
                id={`drawer-panel-${drawer}`}
                role="region"
                aria-label={`Tray ${drawer + 1}`}
                ref={(node) => {
                  drawerPanelRefs.current[drawer] = node
                }}
                className={cn(
                  "flex min-h-0 min-w-0 flex-col rounded-xl ring-1",
                  choosingTray && "tray-sections-in",
                  over ? "ring-2 ring-primary" : "ring-foreground/10",
                )}
              >
                <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl", over ? "bg-primary/10" : "bg-card")}>
                <p className="flex h-8 shrink-0 items-center px-2.5 text-xs font-medium">Tray {drawer + 1}</p>
                <div
                  ref={(node) => {
                    drawerWellRefs.current[drawer] = node
                  }}
                  className="flex min-h-0 flex-1 flex-wrap content-start items-start gap-1 overflow-auto p-2 [scrollbar-gutter:stable] [overflow-anchor:none]"
                >
                  {groups.length === 0 ? (
                    <p className="m-auto px-1 text-center text-xs text-muted-foreground">Drop pieces here</p>
                  ) : (
                    groups.map((group) => {
                      const box = bounds(group.pieceIds, cols)
                      const span = (box.maxCol - box.minCol + 1) * tileW
                      const tall = (box.maxRow - box.minRow + 1) * tileH
                      return group.pieceIds.every((id) => drag?.pieceIds.includes(id)) ? (
                        <div key={group.key} style={{ width: span, height: tall }} />
                      ) : (
                        renderDrawerGroup(group.pieceIds, tileW, tileH, group.key)
                      )
                    })
                  )}
                </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
      </div>
      </div>
      {ghost ? (
        <div className="pointer-events-none fixed z-50" style={{ left: ghost.left, top: ghost.top }}>
          {ghost.pieceIds.map((id) => {
            const piece = pieceFromId(id, cols)
            const left = (piece.col - ghost.minCol) * ghost.tileW
            const top = (piece.row - ghost.minRow) * ghost.tileH
            return (
              <div
                key={id}
                className={cn("absolute overflow-hidden bg-muted shadow-lg ring-2 ring-primary", ghost.onBoard ? "rounded-sm" : "rounded-md")}
                style={{ ...pieceStyle(piece, ghost.tileW, ghost.tileH, poolRim(id)), left, top }}
              />
            )
          })}
        </div>
      ) : null}
      {connectBox ? (
        <div
          className="pointer-events-none fixed z-[70] flex items-center justify-center rounded-md bg-primary/40 ring-2 ring-primary"
          style={{ left: connectBox.left, top: connectBox.top, width: connectBox.width, height: connectBox.height }}
        >
          <span className="rounded-md bg-primary px-1.5 py-1 text-center text-[11px] font-semibold leading-none text-primary-foreground shadow-sm">
            Drop Here
          </span>
        </div>
      ) : null}
      <CompleteDialog title={puzzle.title} open={completeOpen} onClose={() => setCompleteOpen(false)} />
      <MessageDialog
        title="Show Image is on"
        lines={["Pieces cannot be placed while Show Image is on.", "Hide Image to place pieces on the board."]}
        open={imageNotice}
        onClose={() => setImageNotice(false)}
      />
    </div>
  )
}

function MessageDialog({ title, lines, open, onClose }: { title: string; lines: string[]; open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-dialog-title"
        tabIndex={-1}
        className="w-full max-w-sm rounded-xl border border-border bg-background p-6 text-foreground shadow-lg outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="message-dialog-title" className="font-heading text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-2 flex flex-col gap-1">
          {lines.map((line) => (
            <p key={line} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
        <button type="button" className={cn(buttonVariants(), "mt-5 w-full")} onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  )
}

function CompleteDialog({ title, open, onClose }: { title: string; open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="puzzle-complete-title"
        tabIndex={-1}
        className="w-full max-w-sm rounded-xl border border-border bg-background p-6 text-foreground shadow-lg outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="puzzle-complete-title" className="font-heading text-lg font-semibold">
          Puzzle Complete
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">You finished {title}.</p>
        <a href="/" className={cn(buttonVariants(), "mt-5 w-full")}>
          Back to gallery
        </a>
      </div>
    </div>
  )
}

const SEPARATOR = 16
const MIN_TRAY = 120
const MIN_BOARD = 160
const MIN_COLUMN = 180

function clampTray(height: number, available: number) {
  return Math.round(Math.min(Math.max(height, MIN_TRAY), Math.max(MIN_TRAY, available - MIN_BOARD)))
}

function clampColumn(width: number, available: number) {
  return Math.round(Math.min(Math.max(width, MIN_COLUMN), Math.max(MIN_COLUMN, available - MIN_COLUMN)))
}

function readPieceCount(): PieceCountValue {
  if (typeof window === "undefined") return 100
  const value = Number(new URLSearchParams(window.location.search).get("pieces"))
  return isPieceCount(value) ? value : 100
}

function cellAt(point: { x: number; y: number }, board: DOMRect, cols: number, rows: number) {
  const col = Math.floor(((point.x - board.left) / board.width) * cols)
  const row = Math.floor(((point.y - board.top) / board.height) * rows)
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null
  return { col, row }
}

function dropFits(pieceIds: number[], grabbedId: number, col: number, row: number, cols: number, placed: boolean[]) {
  const grabbed = pieceFromId(grabbedId, cols)
  return pieceIds.every((id) => {
    const piece = pieceFromId(id, cols)
    const targetCol = col + piece.col - grabbed.col
    const targetRow = row + piece.row - grabbed.row
    return targetCol === piece.col && targetRow === piece.row && !placed[id]
  })
}

function landingCells(drag: Drag | null, board: DOMRect | undefined, cols: number, rows: number) {
  if (!drag || !board || !contains(board, drag)) return null
  const cell = cellAt(drag, board, cols, rows)
  if (!cell) return null
  const grabbed = pieceFromId(drag.pieceId, cols)
  const cells = drag.pieceIds.flatMap((id) => {
    const piece = pieceFromId(id, cols)
    const col = cell.col + piece.col - grabbed.col
    const row = cell.row + piece.row - grabbed.row
    return col >= 0 && row >= 0 && col < cols && row < rows ? [{ col, row }] : []
  })
  return cells.length ? cells : null
}

function hintCell(
  hintsOn: boolean,
  drag: Drag | null,
  board: DOMRect | undefined,
  cols: number,
  rows: number,
  placed: boolean[],
  boardSnap: boolean,
) {
  if (!hintsOn || !drag || !board || !contains(board, drag)) return null
  const cell = cellAt(drag, board, cols, rows)
  if (!cell) return null
  const grabbed = pieceFromId(drag.pieceId, cols)
  const target = boardSnap ? { col: grabbed.col, row: grabbed.row } : cell
  const fits = dropFits(drag.pieceIds, drag.pieceId, target.col, target.row, cols, placed)
  return { ...cell, correct: fits }
}

function pieceFromId(id: number, cols: number): Piece {
  return { id, col: id % cols, row: Math.floor(id / cols) }
}

function position(col: number, row: number, cols: number, rows: number) {
  const x = cols === 1 ? 0 : (col / (cols - 1)) * 100
  const y = rows === 1 ? 0 : (row / (rows - 1)) * 100
  return `${x}% ${y}%`
}

function contains(rect: DOMRect | undefined, point: { x: number; y: number }) {
  if (!rect) return false
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

function bounds(ids: number[], cols: number) {
  const pieces = ids.map((id) => pieceFromId(id, cols))
  return {
    pieces,
    minCol: Math.min(...pieces.map((piece) => piece.col)),
    minRow: Math.min(...pieces.map((piece) => piece.row)),
    maxCol: Math.max(...pieces.map((piece) => piece.col)),
    maxRow: Math.max(...pieces.map((piece) => piece.row)),
  }
}

function sharesEdge(a: Piece, b: Piece) {
  return (a.col === b.col && Math.abs(a.row - b.row) === 1) || (a.row === b.row && Math.abs(a.col - b.col) === 1)
}

function connectGroups(ids: number[], cols: number) {
  const remaining = new Set(ids)
  const groups: number[][] = []
  for (const id of ids) {
    if (!remaining.has(id)) continue
    const pieceIds: number[] = []
    const stack = [id]
    remaining.delete(id)
    while (stack.length) {
      const current = stack.pop()!
      pieceIds.push(current)
      const piece = pieceFromId(current, cols)
      for (const other of [...remaining]) {
        if (!sharesEdge(piece, pieceFromId(other, cols))) continue
        remaining.delete(other)
        stack.push(other)
      }
    }
    groups.push(pieceIds)
  }
  return groups
}

function snapCluster(cluster: Cluster, others: Cluster[], cols: number) {
  let current = cluster
  let rest = others
  let joined = true
  while (joined) {
    joined = false
    const moving = bounds(current.pieceIds, cols)
    let best: { index: number; dist: number; x: number; y: number } | null = null
    rest.forEach((other, index) => {
      const parked = bounds(other.pieceIds, cols)
      for (const piece of moving.pieces) {
        for (const neighbour of parked.pieces) {
          if (!sharesEdge(piece, neighbour)) continue
          const expectedPieceX = other.x + (neighbour.col - parked.minCol) * TILE + (piece.col - neighbour.col) * TILE
          const expectedPieceY = other.y + (neighbour.row - parked.minRow) * TILE + (piece.row - neighbour.row) * TILE
          const x = expectedPieceX - (piece.col - moving.minCol) * TILE
          const y = expectedPieceY - (piece.row - moving.minRow) * TILE
          const dist = Math.hypot(current.x - x, current.y - y)
          if (dist <= SNAP && (!best || dist < best.dist)) best = { index, dist, x, y }
        }
      }
    })
    if (!best) break
    const other = rest[best.index]
    const parked = bounds(other.pieceIds, cols)
    const combined = bounds([...current.pieceIds, ...other.pieceIds], cols)
    current = {
      id: current.id,
      x: other.x + (combined.minCol - parked.minCol) * TILE,
      y: other.y + (combined.minRow - parked.minRow) * TILE,
      pieceIds: combined.pieces.map((piece) => piece.id),
    }
    rest = rest.filter((_, index) => index !== best.index)
    joined = true
  }
  return [current, ...rest]
}

function contentBox(node: HTMLElement) {
  const style = getComputedStyle(node)
  return {
    width: node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    height: node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
  }
}

function fitPieceGrid(width: number, height: number, count: number, gap: number, aspect = 1) {
  if (count <= 0 || width <= 0 || height <= 0) return { cols: 1, size: TILE }
  const shape = aspect > 0 ? aspect : 1
  let best = { cols: 1, size: 0 }
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols)
    const size = Math.min((width - gap * (cols - 1)) / (cols * shape), (height - gap * (rows - 1)) / rows)
    if (size > best.size) best = { cols, size }
  }
  return best
}

function ghostBox(drag: Drag, cols: number, rows: number, board: DOMRect | undefined, tileW = TILE, tileH = TILE) {
  const box = bounds(drag.pieceIds, cols)
  const grabbed = pieceFromId(drag.pieceId, cols)
  const overBoard = contains(board, drag)
  const width = overBoard && board ? board.width / cols : tileW
  const height = overBoard && board ? board.height / rows : tileH
  return {
    pieceIds: drag.pieceIds,
    minCol: box.minCol,
    minRow: box.minRow,
    tileW: width,
    tileH: height,
    onBoard: Boolean(overBoard && board),
    left: drag.x - (grabbed.col - box.minCol) * width - width / 2,
    top: drag.y - (grabbed.row - box.minRow) * height - height / 2,
  }
}

function placedIds(placed: boolean[] | undefined) {
  return placed?.flatMap((value, id) => (value ? [id] : [])) ?? []
}

function withoutPieces(clusters: Cluster[], ids: number[]) {
  return clusters.flatMap((cluster) => {
    const pieceIds = cluster.pieceIds.filter((id) => !ids.includes(id))
    return pieceIds.length ? [{ ...cluster, pieceIds }] : []
  })
}

function uniqueClusters(clusters: Cluster[]) {
  const seen = new Set<number>()
  const kept: Cluster[] = []
  for (let index = clusters.length - 1; index >= 0; index -= 1) {
    const pieceIds = clusters[index].pieceIds.filter((id) => !seen.has(id))
    pieceIds.forEach((id) => seen.add(id))
    if (pieceIds.length) kept.push({ ...clusters[index], pieceIds })
  }
  return kept.reverse()
}

function visibleMatClusters(clusters: Cluster[], home: Bin[], placed: boolean[]) {
  return uniqueClusters(clusters).flatMap((cluster) => {
    const pieceIds = cluster.pieceIds.filter((id) => home[id] === "mat" && !placed[id])
    return pieceIds.length ? [{ ...cluster, pieceIds }] : []
  })
}

function shuffle(count: number) {
  const values = Array.from({ length: count }, (_, index) => index)
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[values[index], values[swap]] = [values[swap], values[index]]
  }
  return values
}
