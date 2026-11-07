import { Check, X } from "lucide-react"
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from "react"

import { PieceCount } from "@/components/PieceCount"
import { ControlTip, TooltipProvider } from "@/components/ui/tooltip"
import { getBoardSnap, getTraySnap, loadAutoSnap, subscribeAutoSnap } from "@/lib/auto-snap"
import { DEFAULT_EDGE_COLOUR, getEdgeColour, getEdgesShown, subscribeEdgeColour, subscribeEdgesShown } from "@/lib/edge-colour"
import { DEFAULT_GRID_COLOUR, getGridColour, subscribeGridColour } from "@/lib/grid-colour"
import { getHintsOn, subscribeHints } from "@/lib/hints"
import { getPictureShown, subscribePicture } from "@/lib/picture"
import { isPieceCount, puzzleGrid, type PieceCount as PieceCountValue, type Puzzle } from "@/lib/puzzles"
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

const DRAWER_COUNT = 4
const TILE = 56
const PIECE_GAP = 8
const SNAP = 40

export function PuzzleBoard({ puzzle }: { puzzle: PlayablePuzzle }) {
  const [pieces, setPieces] = useState<PieceCountValue>(readPieceCount)

  return (
    <TooltipProvider>
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <ControlTip label="Back to all puzzles" side="bottom">
            <a href="/" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">
              All puzzles
            </a>
          </ControlTip>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{puzzle.title}</h1>
        </div>
        <PieceCount value={pieces} onChange={setPieces} />
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
  const [trayBox, setTrayBox] = useState({ width: 0, height: 0 })
  const [drawerBoxes, setDrawerBoxes] = useState(() => Array.from({ length: DRAWER_COUNT }, () => ({ width: 0, height: 0 })))
  const [selectedDrawer, setSelectedDrawer] = useState(0)
  const [saved] = useState(() => loadGame(puzzle.slug, pieces))
  const restoredClusters = uniqueClusters(withoutPieces(saved?.clusters ?? [], placedIds(saved?.placed)))
  const homeRef = useRef<Bin[]>(saved?.home ?? Array.from({ length: pieces }, () => "tray"))
  const clustersRef = useRef<Cluster[]>(restoredClusters)
  const dragRef = useRef<Drag | null>(null)
  const placedRef = useRef<boolean[]>(saved?.placed ?? [])
  const orderRef = useRef<number[]>(saved?.order ?? [])
  const nextCluster = useRef(saved?.nextCluster ?? 1)
  const [placed, setPlaced] = useState<boolean[]>(() => saved?.placed ?? Array(pieces).fill(false))
  const [home, setHome] = useState<Bin[]>(() => homeRef.current)
  const [clusters, setClusters] = useState<Cluster[]>(() => clustersRef.current)
  const [order, setOrder] = useState(() => saved?.order ?? shuffle(pieces))
  const [drag, setDrag] = useState<Drag | null>(null)
  const pictureShown = useSyncExternalStore(subscribePicture, getPictureShown, () => false)
  const hintsOn = useSyncExternalStore(subscribeHints, getHintsOn, () => false)
  const edgeColour = useSyncExternalStore(subscribeEdgeColour, getEdgeColour, () => DEFAULT_EDGE_COLOUR)
  const edgesShown = useSyncExternalStore(subscribeEdgesShown, getEdgesShown, () => true)
  const gridColour = useSyncExternalStore(subscribeGridColour, getGridColour, () => DEFAULT_GRID_COLOUR)
  const traySnap = useSyncExternalStore(subscribeAutoSnap, getTraySnap, () => true)
  const boardSnap = useSyncExternalStore(subscribeAutoSnap, getBoardSnap, () => false)
  const [ratio, setRatio] = useState<number | null>(null)
  const solved = placed.every(Boolean)
  const placedCount = placed.filter(Boolean).length
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
        if (!placeOnBoard(current, point, board)) restoreAfterMiss(current)
      } else if (contains(matRef.current?.getBoundingClientRect(), point)) dropOnMat(current, point)
      else if (contains(trayRef.current?.getBoundingClientRect(), point)) moveToTray(current.pieceIds)
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
    if (!getBoardSnap() && !touchesPlaced(current.pieceIds, cols, placedRef.current)) return false
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

  function joinTrayNeighbors(ids: number[], drawer: number, beforeId: number | null) {
    const neighbors = trayNeighbors(ids, drawer, beforeId).filter((id) =>
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
          (pieceId) => ids.includes(pieceId) || (homeRef.current[pieceId] === drawer && !placedRef.current[pieceId]),
        )
        members.forEach((pieceId) => absorbed.add(pieceId))
      }
      return [...withoutPieces(cleared, [...absorbed]), { id: nextCluster.current++, x: 0, y: 0, pieceIds: [...absorbed] }]
    })
  }

  function trayNeighbors(ids: number[], drawer: number, beforeId: number | null) {
    if (beforeId == null || ids.includes(beforeId)) return []
    if (homeRef.current[beforeId] !== drawer || placedRef.current[beforeId]) return []
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

  function restoreAfterMiss(current: Drag) {
    const origin = homeRef.current[current.pieceId]
    if (origin === "tray" && !getHintsOn()) moveToTray(current.pieceIds)
  }

  function groupedIds(id: number) {
    const home = homeRef.current[id]
    if (home === "mat") {
      const cluster = clustersRef.current.find((item) => item.pieceIds.includes(id))
      if (!cluster) return [id]
      const together = cluster.pieceIds.every((pieceId) => homeRef.current[pieceId] === "mat" && !placedRef.current[pieceId])
      return together ? cluster.pieceIds : [id]
    }
    if (typeof home === "number") {
      const ids = orderRef.current.filter((pieceId) => !placedRef.current[pieceId] && homeRef.current[pieceId] === home)
      if (getTraySnap()) return connectGroups(ids, cols).find((group) => group.includes(id)) ?? [id]
      const cluster = clustersRef.current.find((item) => item.pieceIds.includes(id))
      const together = cluster?.pieceIds.filter((pieceId) => ids.includes(pieceId)) ?? []
      return together.length ? together : [id]
    }
    return [id]
  }

  function pieceUnderPointer(point: { x: number; y: number }, drawer: number, moving: number[]) {
    for (const node of document.elementsFromPoint(point.x, point.y)) {
      if (!(node instanceof Element)) continue
      const host = node.closest("[data-piece-id]")
      if (!host) continue
      const id = Number(host.getAttribute("data-piece-id"))
      if (moving.includes(id) || homeRef.current[id] !== drawer) continue
      return id
    }
    return null
  }

  function moveToTray(ids: number[]) {
    setHome((values) => values.map((bin, index) => (ids.includes(index) ? "tray" : bin)))
    detach(ids)
  }

  function detach(ids: number[]) {
    setClusters((current) => withoutPieces(current, ids))
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

  function renderPiece(id: number, size = TILE) {
    const piece = pieceFromId(id, cols)
    return (
      <button
        key={id}
        type="button"
        data-piece-id={id}
        aria-label={`Piece ${piece.col + 1}, ${piece.row + 1}`}
        className="cursor-grab touch-none rounded-md bg-muted ring-1 ring-foreground/15 active:cursor-grabbing"
        style={pieceStyle(piece, size, size, poolRim(id))}
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
  const trayLayout = fitPieceGrid(trayBox.width, trayBox.height, trayIds.length, PIECE_GAP)
  const boardRect = boardRef.current?.getBoundingClientRect()
  const hoverDrawer = drag ? trayAtPoint(drag) : -1
  const choosingTray = drag != null && home[drag.pieceId] === "tray" && contains(connectRef.current?.getBoundingClientRect(), drag)
  const dragTile = hoverDrawer >= 0 ? tileForDrawer(hoverDrawer) : !drag || home[drag.pieceId] === "tray" || typeof home[drag.pieceId] === "number" ? trayLayout.size : TILE
  const ghost = drag ? ghostBox(drag, cols, rows, boardRect, dragTile) : null
  const hint = hintCell(hintsOn, drag, boardRect, cols, rows, placed, boardSnap)

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
    const fitted = fitPieceGrid(box.width, box.height, Math.max(count, 1), 4)
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

  function renderDrawerGroup(pieceIds: number[], tile: number, key: string) {
    if (pieceIds.length === 1) return renderPiece(pieceIds[0], tile)
    const box = bounds(pieceIds, cols)
    const spanW = box.maxCol - box.minCol + 1
    const spanH = box.maxRow - box.minRow + 1
    return (
      <div key={key} className="relative shrink-0 overflow-hidden rounded-md ring-1 ring-foreground/15" style={{ width: spanW * tile, height: spanH * tile }}>
        {pieceIds.map((id) => {
          const piece = pieceFromId(id, cols)
          return (
            <button
              key={id}
              type="button"
              data-piece-id={id}
              aria-label={`Piece ${piece.col + 1}, ${piece.row + 1}`}
              className="absolute cursor-grab touch-none bg-muted active:cursor-grabbing"
              style={{
                ...pieceStyle(piece, tile, tile, edgesShown),
                left: (piece.col - box.minCol) * tile,
                top: (piece.row - box.minRow) * tile,
              }}
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
      const next = Array.from({ length: DRAWER_COUNT }, (_, drawer) => {
        const node = drawerWellRefs.current[drawer]
        return node ? contentBox(node) : { width: 0, height: 0 }
      })
      setDrawerBoxes((current) =>
        next.every((box, index) => box.width === current[index]?.width && box.height === current[index]?.height) ? current : next,
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
      setTrayHeight((current) => (current == null ? null : clampTray(current, available)))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = piecesRef.current
    if (!node) return
    const observer = new ResizeObserver(() => {
      const available = node.getBoundingClientRect().width - SEPARATOR
      setPiecesWidth((current) => (current == null ? null : clampColumn(current, available)))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

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
      setTrayHeight(clampTray(base() + 24, available))
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
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
      setPiecesWidth(clampColumn(base() + 24, available))
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      setPiecesWidth(clampColumn(base() - 24, available))
    }
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
          "flex min-w-0 items-center justify-center",
          trayHeight == null ? "min-h-40 flex-[2_1_0%]" : "min-h-0 flex-1",
        )}
        style={{ containerType: "size" }}
      >
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
              className="grid size-full bg-muted"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
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
        <ControlTip label="Loose pieces. Drag one onto the board or a tray." side="top">
          <h2 className="flex h-8 w-fit shrink-0 items-center text-sm font-medium">Pieces</h2>
        </ControlTip>
        <ControlTip label="Loose pieces. Drag one onto the board or a tray." side="top" disabled={drag != null}>
        <div
          ref={trayRef}
          className="grid min-h-0 flex-1 place-content-center overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10"
          style={{ gridTemplateColumns: `repeat(${trayLayout.cols}, ${trayLayout.size}px)`, gap: PIECE_GAP }}
        >
          {trayIds.map((id) =>
            drag?.pieceIds.includes(id) ? (
              <div key={id} style={{ width: trayLayout.size, height: trayLayout.size }} />
            ) : (
              renderPiece(id, trayLayout.size)
            ),
          )}
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
        <div className="flex min-h-8 shrink-0 flex-wrap items-center gap-1">
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
        <div ref={drawerGridRef} className={cn("grid min-h-0 flex-1 gap-2 overflow-hidden", choosingTray ? "grid-cols-2 grid-rows-2" : "grid-rows-1")}>
          {Array.from({ length: DRAWER_COUNT }, (_, drawer) => {
            if (!choosingTray && drawer !== selectedDrawer) return null
            const groups = drawerGroups(drawer)
            const tile = tileForDrawer(drawer)
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
                  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-card ring-1",
                  choosingTray && "tray-sections-in",
                  over ? "bg-primary/10 ring-2 ring-primary" : "ring-foreground/10",
                )}
              >
                <p className="flex h-8 shrink-0 items-center px-2.5 text-xs font-medium">Tray {drawer + 1}</p>
                <div
                  ref={(node) => {
                    drawerWellRefs.current[drawer] = node
                  }}
                  className="flex min-h-0 flex-1 flex-wrap content-start items-start gap-1 overflow-auto p-2"
                >
                  {groups.length === 0 ? (
                    <p className="m-auto px-1 text-center text-xs text-muted-foreground">Drop pieces here</p>
                  ) : (
                    groups.map((group) => {
                      const box = bounds(group.pieceIds, cols)
                      const width = (box.maxCol - box.minCol + 1) * tile
                      const height = (box.maxRow - box.minRow + 1) * tile
                      return group.pieceIds.every((id) => drag?.pieceIds.includes(id)) ? (
                        <div key={group.key} style={{ width, height }} />
                      ) : (
                        renderDrawerGroup(group.pieceIds, tile, group.key)
                      )
                    })
                  )}
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
            return (
              <div
                key={id}
                className="absolute rounded-sm shadow-lg ring-2 ring-primary"
                style={{
                  ...pieceStyle(piece, ghost.tileW, ghost.tileH, poolRim(id)),
                  left: (piece.col - ghost.minCol) * ghost.tileW,
                  top: (piece.row - ghost.minRow) * ghost.tileH,
                }}
              />
            )
          })}
        </div>
      ) : null}
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
  const correct = fits && (boardSnap || touchesPlaced(drag.pieceIds, cols, placed))
  return { ...cell, correct }
}

function touchesPlaced(pieceIds: number[], cols: number, placed: boolean[]) {
  if (!placed.some(Boolean)) return true
  return pieceIds.some((id) => {
    const piece = pieceFromId(id, cols)
    return placed.some((value, other) => value && !pieceIds.includes(other) && sharesEdge(piece, pieceFromId(other, cols)))
  })
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

function fitPieceGrid(width: number, height: number, count: number, gap: number) {
  if (count <= 0 || width <= 0 || height <= 0) return { cols: 1, size: TILE }
  let best = { cols: 1, size: 0 }
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols)
    const size = Math.min((width - gap * (cols - 1)) / cols, (height - gap * (rows - 1)) / rows)
    if (size > best.size) best = { cols, size }
  }
  return best
}

function ghostBox(drag: Drag, cols: number, rows: number, board: DOMRect | undefined, tile = TILE) {
  const box = bounds(drag.pieceIds, cols)
  const grabbed = pieceFromId(drag.pieceId, cols)
  const overBoard = contains(board, drag)
  const tileW = overBoard && board ? board.width / cols : tile
  const tileH = overBoard && board ? board.height / rows : tile
  return {
    pieceIds: drag.pieceIds,
    minCol: box.minCol,
    minRow: box.minRow,
    tileW,
    tileH,
    left: drag.x - (grabbed.col - box.minCol) * tileW - tileW / 2,
    top: drag.y - (grabbed.row - box.minRow) * tileH - tileH / 2,
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
