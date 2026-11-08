import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "cn"
import type { ReactElement } from "react"

function TooltipProvider({ delay = 300, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 8,
  align = "center",
  children,
  ...props
}: TooltipPrimitive.Popup.Props & Pick<TooltipPrimitive.Positioner.Props, "align" | "side" | "sideOffset">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} className="isolate z-50">
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "relative z-50 w-fit max-w-64 origin-(--transform-origin) rounded-md bg-popover px-3 py-2 text-xs text-balance text-popover-foreground shadow-md ring-1 ring-foreground/10 data-[side=bottom]:pt-5 data-[side=left]:pr-5 data-[side=right]:pl-5 data-[side=top]:pb-5 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 rotate-45 rounded-[2px] bg-popover data-[side=bottom]:-top-2 data-[side=left]:top-1/2! data-[side=left]:-right-2 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-2 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export function ControlTip({
  label,
  side = "bottom",
  disabled = false,
  children,
}: {
  label: string
  side?: TooltipPrimitive.Positioner.Props["side"]
  disabled?: boolean
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger delay={300} closeOnClick disabled={disabled} render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

export { TooltipProvider }
