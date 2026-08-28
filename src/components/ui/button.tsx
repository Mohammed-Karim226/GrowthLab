import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "app-button-motion group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-cyan-300/55 focus-visible:ring-3 focus-visible:ring-cyan-300/20 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red-300/50 aria-invalid:ring-3 aria-invalid:ring-red-300/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "[--button-reveal:rgba(103,232,249,0.18)] liquid-glass border-cyan-200/25 bg-cyan-300/[0.16] text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_8px_24px_rgba(34,211,238,.12)] hover:border-cyan-200/45 hover:bg-cyan-300/[0.24] hover:text-white",
        outline:
          "[--button-reveal:rgba(255,255,255,0.1)] border-white/[0.16] bg-white/[0.055] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,.1)] hover:border-white/[0.3] hover:bg-white/[0.11] hover:text-white aria-expanded:border-cyan-300/40 aria-expanded:bg-cyan-300/[0.1]",
        secondary:
          "[--button-reveal:rgba(196,181,253,0.14)] border-white/[0.12] bg-white/[0.09] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,.1)] hover:border-white/[0.24] hover:bg-white/[0.15] aria-expanded:bg-white/[0.15]",
        ghost:
          "[--button-reveal:rgba(255,255,255,0.085)] border-transparent bg-transparent text-slate-300 hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-white aria-expanded:border-white/[0.16] aria-expanded:bg-white/[0.1]",
        destructive:
          "[--button-reveal:rgba(252,165,165,0.16)] border-red-300/20 bg-red-400/[0.1] text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] hover:border-red-300/40 hover:bg-red-400/[0.18] focus-visible:border-red-300/50 focus-visible:ring-red-300/20",
        link: "[--button-reveal:rgba(103,232,249,0.09)] text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
