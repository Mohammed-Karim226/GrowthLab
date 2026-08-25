"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Modal dialog built on Base UI, matching the existing data-slot convention.
 *
 * Base UI handles focus trapping, scroll locking and the Escape key, so the
 * admin forms get correct keyboard and screen-reader behaviour for free.
 */
function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />
}

function DialogTrigger({ className, ...props }: DialogPrimitive.Trigger.Props) {
  return (
    <DialogPrimitive.Trigger data-slot="dialog-trigger" className={className} {...props} />
  )
}

function DialogClose({ className, ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" className={className} {...props} />
}

function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className="fixed inset-0 z-50 bg-slate-950/60 opacity-100 backdrop-blur-2xl backdrop-saturate-150 transition-opacity duration-300 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "portal-glass-panel scrollbar-slim fixed start-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-3xl border border-white/[0.2] p-6 text-slate-200 shadow-[0_28px_90px_rgba(2,6,23,.55),inset_0_1px_0_rgba(255,255,255,.16)] outline-none transition-[transform,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none",
          "[&_[data-slot=dialog-header]]:-mx-6 [&_[data-slot=dialog-header]]:-mt-6 [&_[data-slot=dialog-header]]:border-b [&_[data-slot=dialog-header]]:border-white/[0.08] [&_[data-slot=dialog-header]]:bg-white/[0.02] [&_[data-slot=dialog-header]]:px-6 [&_[data-slot=dialog-header]]:py-5",
          "[&_[data-slot=dialog-footer]]:-mx-6 [&_[data-slot=dialog-footer]]:-mb-6 [&_[data-slot=dialog-footer]]:border-t [&_[data-slot=dialog-footer]]:border-white/[0.08] [&_[data-slot=dialog-footer]]:px-6 [&_[data-slot=dialog-footer]]:py-4",
          "[&_[data-slot=input]]:h-11 [&_[data-slot=input]]:rounded-2xl [&_[data-slot=input]]:border-white/[0.16] [&_[data-slot=input]]:bg-white/[0.06] [&_[data-slot=input]]:px-3 [&_[data-slot=input]]:text-slate-100 [&_[data-slot=input]]:shadow-[inset_0_1px_0_rgba(255,255,255,.1)] [&_[data-slot=input]]:focus-visible:border-cyan-300/50 [&_[data-slot=input]]:focus-visible:ring-cyan-300/15",
          "[&_[data-slot=textarea]]:rounded-2xl [&_[data-slot=textarea]]:border-white/[0.16] [&_[data-slot=textarea]]:bg-white/[0.06] [&_[data-slot=textarea]]:px-3 [&_[data-slot=textarea]]:text-slate-100 [&_[data-slot=textarea]]:shadow-[inset_0_1px_0_rgba(255,255,255,.1)] [&_[data-slot=textarea]]:focus-visible:border-cyan-300/50 [&_[data-slot=textarea]]:focus-visible:ring-cyan-300/15",
          "[&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:rounded-2xl [&_[data-slot=select-trigger]]:border-white/[0.16] [&_[data-slot=select-trigger]]:bg-white/[0.06] [&_[data-slot=select-trigger]]:shadow-[inset_0_1px_0_rgba(255,255,255,.1)]",
          "data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          "rtl:translate-x-1/2",
          className
        )}
        {...props}
      >
        <DialogPrimitive.Close
          aria-label="Close dialog"
          className="absolute end-4 top-4 z-10 flex size-9 items-center justify-center rounded-xl border border-white/[0.14] bg-white/[0.07] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-xl transition-colors hover:border-white/[0.28] hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-start pe-10", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-satoshi text-xl leading-tight text-white", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("max-w-prose text-sm leading-6 text-slate-400", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
