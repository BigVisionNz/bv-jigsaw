import type { TraySlot } from "@/lib/save"

type Cell = { col: number; row: number }

function pieceCell(id: number, cols: number) {
  return { col: id % cols, row: Math.floor(id / cols) }
}

function bounds(ids: number[], cols: number) {
  const pieces = ids.map((id) => pieceCell(id, cols))
  return {
    pieces,
    minCol: Math.min(...pieces.map((piece) => piece.col)),
    minRow: Math.min(...pieces.map((piece) => piece.row)),
    maxCol: Math.max(...pieces.map((piece) => piece.col)),
    maxRow: Math.max(...pieces.map((piece) => piece.row)),
  }
}

function sharesEdge(a: { col: number; row: number }, b: { col: number; row: number }) {
  return (a.col === b.col && Math.abs(a.row - b.row) === 1) || (a.row === b.row && Math.abs(a.col - b.col) === 1)
}

function samePieces(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

export function trayGroups(ids: number[], clusters: { pieceIds: number[] }[]) {
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

export function packTraySlots(groups: number[][], columns: number, cols: number): TraySlot[] {
  const width = Math.max(1, columns)
  let col = 0
  let row = 0
  let rowHeight = 0
  const slots: TraySlot[] = []
  for (const pieceIds of groups) {
    if (!pieceIds.length) continue
    const box = bounds(pieceIds, cols)
    const spanW = box.maxCol - box.minCol + 1
    const spanH = box.maxRow - box.minRow + 1
    if (col > 0 && col + spanW > width) {
      col = 0
      row += rowHeight
      rowHeight = 0
    }
    slots.push({ pieceIds: [...pieceIds], col, row })
    col += spanW
    rowHeight = Math.max(rowHeight, spanH)
  }
  return slots
}

export function releaseSlots(slots: TraySlot[], removed: number[], cols: number): TraySlot[] {
  const gone = new Set(removed)
  return slots.flatMap((slot) => {
    const pieceIds = slot.pieceIds.filter((id) => !gone.has(id))
    if (!pieceIds.length) return []
    if (pieceIds.length === slot.pieceIds.length) return [{ pieceIds: [...slot.pieceIds], col: slot.col, row: slot.row }]
    const old = bounds(slot.pieceIds, cols)
    const next = bounds(pieceIds, cols)
    return [
      {
        pieceIds,
        col: slot.col + (next.minCol - old.minCol),
        row: slot.row + (next.minRow - old.minRow),
      },
    ]
  })
}

function cellsOf(slot: TraySlot, cols: number) {
  const box = bounds(slot.pieceIds, cols)
  return slot.pieceIds.map((id) => {
    const piece = pieceCell(id, cols)
    return { col: slot.col + (piece.col - box.minCol), row: slot.row + (piece.row - box.minRow) }
  })
}

function occupied(slots: TraySlot[], cols: number) {
  const cells = new Set<string>()
  for (const slot of slots) {
    for (const cell of cellsOf(slot, cols)) cells.add(`${cell.col},${cell.row}`)
  }
  return cells
}

function overlaps(slot: TraySlot, others: TraySlot[], cols: number) {
  const taken = occupied(others, cols)
  return cellsOf(slot, cols).some((cell) => cell.col < 0 || cell.row < 0 || taken.has(`${cell.col},${cell.row}`))
}

function alignedAnchor(movingIds: number[], other: TraySlot, cols: number): Cell | null {
  const moving = bounds(movingIds, cols)
  const parked = bounds(other.pieceIds, cols)
  let result: Cell | null = null
  for (const piece of moving.pieces) {
    for (const neighbour of parked.pieces) {
      if (!sharesEdge(piece, neighbour)) continue
      const nCol = other.col + (neighbour.col - parked.minCol)
      const nRow = other.row + (neighbour.row - parked.minRow)
      const anchor = {
        col: nCol + (piece.col - neighbour.col) - (piece.col - moving.minCol),
        row: nRow + (piece.row - neighbour.row) - (piece.row - moving.minRow),
      }
      if (result && (result.col !== anchor.col || result.row !== anchor.row)) return null
      result = anchor
    }
  }
  return result
}

function combineSlots(moving: TraySlot, other: TraySlot, cols: number): TraySlot {
  const parked = bounds(other.pieceIds, cols)
  const combined = bounds([...moving.pieceIds, ...other.pieceIds], cols)
  return {
    pieceIds: combined.pieces.map((piece) => piece.col + piece.row * cols),
    col: other.col + (combined.minCol - parked.minCol),
    row: other.row + (combined.minRow - parked.minRow),
  }
}

function nearestFree(slot: TraySlot, others: TraySlot[], cols: number): Cell {
  const taken = occupied(others, cols)
  const box = bounds(slot.pieceIds, cols)
  const footprint = slot.pieceIds.map((id) => {
    const piece = pieceCell(id, cols)
    return [piece.col - box.minCol, piece.row - box.minRow] as const
  })
  const fits = (col: number, row: number) =>
    footprint.every(([dc, dr]) => {
      const cellCol = col + dc
      const cellRow = row + dr
      return cellCol >= 0 && cellRow >= 0 && !taken.has(`${cellCol},${cellRow}`)
    })
  if (fits(slot.col, slot.row)) return { col: slot.col, row: slot.row }
  for (let radius = 1; radius <= 64; radius += 1) {
    for (let dc = -radius; dc <= radius; dc += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
        const col = slot.col + dc
        const row = slot.row + dr
        if (col < 0 || row < 0) continue
        if (fits(col, row)) return { col, row }
      }
    }
  }
  return { col: Math.max(0, slot.col), row: Math.max(0, slot.row) }
}

export function placeTrayGroup(ids: number[], desired: Cell, existing: TraySlot[], cols: number): TraySlot[] {
  const others = releaseSlots(existing, ids, cols)
  let moving: TraySlot = { pieceIds: [...ids], col: Math.max(0, desired.col), row: Math.max(0, desired.row) }

  let best: { dist: number; anchor: Cell } | null = null
  for (let index = 0; index < others.length; index += 1) {
    const other = others[index]
    const aligned = alignedAnchor(moving.pieceIds, other, cols)
    if (!aligned || aligned.col < 0 || aligned.row < 0) continue
    const dist = Math.max(Math.abs(aligned.col - moving.col), Math.abs(aligned.row - moving.row))
    if (dist > 1 || (best && dist >= best.dist)) continue
    const rest = others.filter((_, otherIndex) => otherIndex !== index)
    if (overlaps(combineSlots({ ...moving, col: aligned.col, row: aligned.row }, other, cols), rest, cols)) continue
    best = { dist, anchor: aligned }
  }
  if (best) moving = { ...moving, col: best.anchor.col, row: best.anchor.row }

  let guard = 0
  while (guard < others.length + 1) {
    guard += 1
    const index = others.findIndex((other) => {
      const aligned = alignedAnchor(moving.pieceIds, other, cols)
      if (!aligned || aligned.col !== moving.col || aligned.row !== moving.row) return false
      const rest = others.filter((slot) => slot !== other)
      return !overlaps(combineSlots(moving, other, cols), rest, cols)
    })
    if (index < 0) break
    const [other] = others.splice(index, 1)
    moving = combineSlots(moving, other, cols)
  }

  if (overlaps(moving, others, cols)) {
    const free = nearestFree(moving, others, cols)
    moving = { ...moving, col: free.col, row: free.row }
  }
  return [...others, moving]
}

export function resolveTraySlots(groups: number[][], stored: TraySlot[] | null, columns: number, cols: number): TraySlot[] {
  if (!stored) return packTraySlots(groups, columns, cols)
  const resolved: TraySlot[] = []
  const missing: number[][] = []
  for (const pieceIds of groups) {
    const slot = stored.find((item) => samePieces(item.pieceIds, pieceIds))
    if (slot) resolved.push({ pieceIds: [...pieceIds], col: slot.col, row: slot.row })
    else missing.push(pieceIds)
  }
  for (const slot of packTraySlots(missing, columns, cols)) {
    const free = nearestFree(slot, resolved, cols)
    resolved.push({ ...slot, col: free.col, row: free.row })
  }
  return resolved
}
