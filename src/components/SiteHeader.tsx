import { Check, Eye, EyeOff, Lightbulb, LightbulbOff, LogIn, Moon, Sun, UserPlus, X } from "lucide-react"
import { useEffect, useState, useSyncExternalStore } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ControlTip, TooltipProvider } from "@/components/ui/tooltip"
import {
  DEFAULT_EDGE_COLOUR,
  getEdgeColour,
  getEdgesShown,
  loadEdgesShown,
  setEdgeColour,
  setEdgesShown,
  subscribeEdgeColour,
  subscribeEdgesShown,
} from "@/lib/edge-colour"
import { getBoardSnap, getTraySnap, loadAutoSnap, setBoardSnap, setTraySnap, subscribeAutoSnap } from "@/lib/auto-snap"
import { DEFAULT_BOARD_COLOUR, getBoardColour, setBoardColour, subscribeBoardColour } from "@/lib/board-colour"
import { DEFAULT_GRID_COLOUR, getGridColour, setGridColour, subscribeGridColour } from "@/lib/grid-colour"
import { EDGE_STYLES, EDGE_STYLE_LABELS, getEdgeStyle, setEdgeStyle, subscribeEdgeStyle, type EdgeStyle } from "@/lib/edge-style"
import { getHintsOn, setHintsOn, subscribeHints } from "@/lib/hints"
import { getPictureShown, setPictureShown, subscribePicture } from "@/lib/picture"
import { getPuzzleSolved, subscribePuzzleSolved } from "@/lib/puzzle-solved"

const THEME_KEY = "bv-jigsaw-theme"

export function SiteHeader({ picture = false }: { picture?: boolean }) {
  return (
    <TooltipProvider>
      <header className="sticky top-0 z-40 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b bg-background px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <ControlTip label="Big Vision website">
            <a
              href="https://bigvision.co.nz"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Big Vision"
              className="shrink-0"
            >
              <img src="/big-vision-eye.svg" alt="" className="h-[42px] w-auto" />
            </a>
          </ControlTip>
          <ControlTip label="Home">
            <a href="/" className="flex shrink-0 items-center gap-3">
              <JigsawMark className="size-10" />
              <span className="text-lg font-semibold tracking-tight">BV Jigsaw</span>
            </a>
          </ControlTip>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {picture ? (
            <>
              <PictureToggle />
              <HintsToggle />
              <EdgesToggle />
              <ShapeMenu />
              <ColoursMenu />
              <AutoSnapMenu />
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2">
          <ControlTip label="Puzzles you have started">
            <a
              href="/played"
              className="inline-flex h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Last Played
            </a>
          </ControlTip>
          <ThemeButton />
          <AccountMenu />
        </div>
      </header>
    </TooltipProvider>
  )
}

function PictureToggle() {
  const shown = useSyncExternalStore(subscribePicture, getPictureShown, () => false)
  const solved = useSyncExternalStore(subscribePuzzleSolved, getPuzzleSolved, () => false)

  return (
    <ControlTip label={shown ? "Hide the finished picture" : "Show the finished picture on the board"}>
      <button
        type="button"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background"
        aria-pressed={shown}
        disabled={solved}
        onClick={() => setPictureShown(!shown)}
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        {shown ? "Hide Image" : "Show Image"}
      </button>
    </ControlTip>
  )
}

function HintsToggle() {
  const enabled = useSyncExternalStore(subscribeHints, getHintsOn, () => false)

  return (
    <ControlTip label={enabled ? "Turn the placement hint off" : "Show a tick or cross while dragging a piece"}>
      <button
        type="button"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-pressed={enabled}
        onClick={() => setHintsOn(!enabled)}
      >
        {enabled ? <Lightbulb className="size-4" /> : <LightbulbOff className="size-4" />}
        {enabled ? "Hints On" : "Hints Off"}
      </button>
    </ControlTip>
  )
}

function EdgesToggle() {
  const shown = useSyncExternalStore(subscribeEdgesShown, getEdgesShown, () => true)

  useEffect(() => {
    loadEdgesShown()
  }, [])

  return (
    <ControlTip label={shown ? "Hide the outer edge on tray pieces" : "Show the outer edge on tray pieces"}>
      <button
        type="button"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-pressed={shown}
        onClick={() => setEdgesShown(!shown)}
      >
        <SnapMark on={shown} />
        {shown ? "Edges On" : "Edges Off"}
      </button>
    </ControlTip>
  )
}

function ShapeMenu() {
  const style = useSyncExternalStore(subscribeEdgeStyle, getEdgeStyle, () => "rectangular" as EdgeStyle)

  return (
    <ControlTip label="Choose the shape of the piece edges">
      <span className="inline-flex">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            {EDGE_STYLE_LABELS[style]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-44">
            {EDGE_STYLES.map((value) => (
              <DropdownMenuItem key={value} onClick={() => setEdgeStyle(value)}>
                <Check className={value === style ? "size-4" : "size-4 opacity-0"} />
                <EdgeStyleIcon style={value} />
                {EDGE_STYLE_LABELS[value]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </ControlTip>
  )
}

function ColoursMenu() {
  const grid = useSyncExternalStore(subscribeGridColour, getGridColour, () => DEFAULT_GRID_COLOUR)
  const background = useSyncExternalStore(subscribeBoardColour, getBoardColour, () => DEFAULT_BOARD_COLOUR)
  const edge = useSyncExternalStore(subscribeEdgeColour, getEdgeColour, () => DEFAULT_EDGE_COLOUR)

  return (
    <ControlTip label="Choose the grid, background, and edge colour">
      <span className="inline-flex">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            Colours
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56" style={{ width: "14rem" }}>
            <DropdownMenuItem closeOnClick={false} className="p-0">
              <label className="flex w-full cursor-pointer items-center gap-2 px-1.5 py-1.5">
                <input
                  type="color"
                  value={grid}
                  aria-label="Grid colour"
                  className="size-6 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
                  onChange={(event) => setGridColour(event.target.value)}
                />
                Grid Colour
              </label>
            </DropdownMenuItem>
            <DropdownMenuItem closeOnClick={false} className="p-0">
              <label className="flex w-full cursor-pointer items-center gap-2 px-1.5 py-1.5">
                <input
                  type="color"
                  value={background}
                  aria-label="Background colour"
                  className="size-6 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
                  onChange={(event) => setBoardColour(event.target.value)}
                />
                Background Colour
              </label>
            </DropdownMenuItem>
            <DropdownMenuItem closeOnClick={false} className="p-0">
              <label className="flex w-full cursor-pointer items-center gap-2 px-1.5 py-1.5">
                <input
                  type="color"
                  value={edge}
                  aria-label="Edge colour"
                  className="size-6 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
                  onChange={(event) => setEdgeColour(event.target.value)}
                />
                Edge Colour
              </label>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </ControlTip>
  )
}

function AutoSnapMenu() {
  const tray = useSyncExternalStore(subscribeAutoSnap, getTraySnap, () => true)
  const puzzle = useSyncExternalStore(subscribeAutoSnap, getBoardSnap, () => false)

  useEffect(() => {
    loadAutoSnap()
  }, [])

  return (
    <ControlTip label="Automatically place pieces in a tray or on the puzzle">
      <span className="inline-flex">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            Auto Snap
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56" style={{ width: "14rem" }}>
            <DropdownMenuItem closeOnClick={false} onClick={() => setTraySnap(!tray)}>
              <SnapMark on={tray} />
              {tray ? "Tray On" : "Tray Off"}
            </DropdownMenuItem>
            <DropdownMenuItem closeOnClick={false} onClick={() => setBoardSnap(!puzzle)}>
              <SnapMark on={puzzle} />
              {puzzle ? "Puzzle Area On" : "Puzzle Area Off"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </ControlTip>
  )
}

function SnapMark({ on }: { on: boolean }) {
  return (
    <span className={`flex size-5 items-center justify-center rounded-full text-white ${on ? "bg-green-600" : "bg-red-600"}`}>
      {on ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
    </span>
  )
}

function ThemeButton() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem(THEME_KEY, next ? "dark" : "light")
    setDark(next)
  }

  const label = dark ? "Switch to light theme" : "Switch to dark theme"

  return (
    <ControlTip label={label}>
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={label}
        onClick={toggleTheme}
      >
        {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>
    </ControlTip>
  )
}

function AccountMenu() {
  return (
    <ControlTip label="Account">
      <span className="inline-flex">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="User account"
          >
            <AccountIcon className="size-6" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem>
              <UserPlus />
              Sign up
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LogIn />
              Log in
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </ControlTip>
  )
}

const EDGE_STYLE_PATHS: Record<EdgeStyle, string> = {
  rectangular: "M2 2v10h2V4h7v18h11V12h-2v8h-7V2z",
  wavy: "M16.5 21c-3 0-4.19-4.24-5.45-8.72C10.14 9.04 9 5 7.5 5C4.11 5 4 11.93 4 12H2c0-.37.06-9 5.5-9c3 0 4.21 4.25 5.47 8.74C13.83 14.8 15 19 16.5 19c3.44 0 3.53-6.93 3.53-7h2c0 .37-.06 9-5.53 9",
  jagged: "M11 22V6.83L2 16v-2.83L13 2v15.17L22 8v2.83z",
  beads: "M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 2a8 8 0 0 1 8 8a8 8 0 0 1-8 8z",
}

function EdgeStyleIcon({ style }: { style: EdgeStyle }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="currentColor" d={EDGE_STYLE_PATHS[style]} />
    </svg>
  )
}

function JigsawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5A2.5 2.5 0 0 0 10.5 1A2.5 2.5 0 0 0 8 3.5V5H4a2 2 0 0 0-2 2v3.8h1.5c1.5 0 2.7 1.2 2.7 2.7S5 16.2 3.5 16.2H2V20a2 2 0 0 0 2 2h3.8v-1.5c0-1.5 1.2-2.7 2.7-2.7s2.7 1.2 2.7 2.7V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5"
      />
    </svg>
  )
}

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4"
      />
    </svg>
  )
}
