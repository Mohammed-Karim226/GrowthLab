import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-flex size-4 shrink-0">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "peer size-4 cursor-pointer appearance-none rounded-[4px] border border-input bg-transparent shadow-xs outline-none transition-colors checked:border-primary checked:bg-primary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <Check className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-primary-foreground peer-checked:block" strokeWidth={3} aria-hidden />
    </span>
  ),
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
