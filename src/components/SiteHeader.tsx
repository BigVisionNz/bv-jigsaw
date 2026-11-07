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
  loadEdgeColour,
  loadEdgesShown,
  setEdgeColour,
  setEdgesShown,
  subscribeEdgeColour,
  subscribeEdgesShown,
} from "@/lib/edge-colour"
import { getBoardSnap, getTraySnap, loadAutoSnap, setBoardSnap, setTraySnap, subscribeAutoSnap } from "@/lib/auto-snap"
import { DEFAULT_GRID_COLOUR, getGridColour, loadGridColour, setGridColour, subscribeGridColour } from "@/lib/grid-colour"
import { getHintsOn, setHintsOn, subscribeHints } from "@/lib/hints"
import { getPictureShown, setPictureShown, subscribePicture } from "@/lib/picture"

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
              <EdgesMenu />
              <GridColourButton />
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

  return (
    <ControlTip label={shown ? "Hide the finished picture" : "Show the finished picture on the board"}>
      <button
        type="button"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-pressed={shown}
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

function EdgesMenu() {
  const colour = useSyncExternalStore(subscribeEdgeColour, getEdgeColour, () => DEFAULT_EDGE_COLOUR)
  const shown = useSyncExternalStore(subscribeEdgesShown, getEdgesShown, () => true)

  useEffect(() => {
    loadEdgeColour()
    loadEdgesShown()
  }, [])

  return (
    <ControlTip label="Edge colour, and whether tray pieces show their outer edge">
      <span className="inline-flex">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            Edges
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52" style={{ width: "13rem" }}>
        <DropdownMenuItem closeOnClick={false} className="p-0">
          <label className="flex w-full cursor-pointer items-center gap-2 px-1.5 py-1.5">
            <input
              type="color"
              value={colour}
              aria-label="Edge colour"
              className="size-6 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
              onChange={(event) => setEdgeColour(event.target.value)}
            />
            Edge Colour
          </label>
        </DropdownMenuItem>
        <DropdownMenuItem closeOnClick={false} onClick={() => setEdgesShown(!shown)}>
          <span
            className={`flex size-5 items-center justify-center rounded-full text-white ${shown ? "bg-green-600" : "bg-red-600"}`}
          >
            {shown ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
          </span>
          {shown ? "Edges On" : "Edges Off"}
        </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </ControlTip>
  )
}

function GridColourButton() {
  const colour = useSyncExternalStore(subscribeGridColour, getGridColour, () => DEFAULT_GRID_COLOUR)

  useEffect(() => {
    loadGridColour()
  }, [])

  return (
    <ControlTip label="Choose the colour of the board grid">
      <label
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-medium outline-none focus-within:ring-3 focus-within:ring-ring/50"
        style={{ backgroundColor: colour, color: inkFor(colour) }}
      >
        Grid Colour
        <input
          type="color"
          value={colour}
          aria-label="Grid colour"
          className="sr-only"
          onChange={(event) => setGridColour(event.target.value)}
        />
      </label>
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

function inkFor(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? "#111111" : "#ffffff"
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

function JigsawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M14 14H27A5 5 0 0 0 37 14H50V27A5 5 0 0 0 50 37V50H37A5 5 0 0 1 27 50H14V37A5 5 0 0 0 14 27Z"
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
