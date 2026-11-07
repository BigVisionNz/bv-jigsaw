import { existsSync, readdirSync } from "node:fs"
import { extname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { allPuzzles, findPuzzle, type PuzzleGroup } from "@/lib/puzzles"

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"])

const DESCRIPTIONS: Record<string, string> = {
  animals: "Wildlife portraits from the woods.",
  botanical: "Leaves, flowers, and quiet greenhouses.",
  "family-and-friends": "Days out with the people you know.",
  skyline: "Cities seen from the water and the street.",
}

const puzzlesDir = fileURLToPath(new URL("../../public/puzzles/", import.meta.url))

export function loadPuzzleGroups(): PuzzleGroup[] {
  if (!existsSync(puzzlesDir)) return []
  return readdirSync(puzzlesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => groupFrom(entry.name))
    .filter((group) => group.puzzles.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title))
}

export function loadPuzzles() {
  return allPuzzles(loadPuzzleGroups())
}

export function loadPuzzle(slug: string | undefined) {
  return findPuzzle(loadPuzzleGroups(), slug)
}

function groupFrom(id: string): PuzzleGroup {
  const used = new Set<string>()
  const puzzles = readdirSync(join(puzzlesDir, id), { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
    .map((entry) => {
      const stem = entry.name.slice(0, entry.name.length - extname(entry.name).length)
      return {
        slug: uniqueSlug(id, stem, used),
        title: puzzleTitle(stem),
        image: `/puzzles/${encodeURIComponent(id)}/${encodeURIComponent(entry.name)}`,
      }
    })

  return {
    id,
    title: groupTitle(id),
    description: DESCRIPTIONS[id],
    puzzles,
  }
}

function groupTitle(id: string) {
  return id
    .split("-")
    .filter(Boolean)
    .map((word, index, words) => {
      if (word === "and" && index > 0 && index < words.length - 1) return "&"
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(" ")
}

function puzzleTitle(stem: string) {
  const title = stem.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim()
  if (!title) return "Puzzle"
  if (title !== title.toLowerCase()) return title
  return title.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

function uniqueSlug(folder: string, stem: string, used: Set<string>) {
  const base = `${slugify(folder)}--${slugify(stem)}`
  let slug = base
  let suffix = 2
  while (used.has(slug)) {
    slug = `${base}-${suffix}`
    suffix += 1
  }
  used.add(slug)
  return slug
}

function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "puzzle"
}
