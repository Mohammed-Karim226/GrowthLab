"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
function SheetContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return <DialogPrimitive.Portal><DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xl backdrop-saturate-150" /><DialogPrimitive.Popup className={cn("fixed inset-y-0 end-0 z-50 flex w-[min(100vw,30rem)] max-w-full flex-col overflow-y-auto border-s border-white/[0.14] bg-[linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,.035)_42%,rgba(8,12,32,.82))] text-slate-200 shadow-[-24px_0_80px_rgba(2,6,23,.48),inset_1px_0_0_rgba(255,255,255,.12)] backdrop-blur-3xl backdrop-saturate-150 outline-none", "[&_[data-slot=input]]:h-10 [&_[data-slot=input]]:rounded-xl [&_[data-slot=input]]:border-white/[0.13] [&_[data-slot=input]]:bg-black/15 [&_[data-slot=input]]:shadow-none [&_[data-slot=input]]:focus-visible:border-cyan-300/50 [&_[data-slot=input]]:focus-visible:ring-cyan-300/15", "[&_[data-slot=textarea]]:rounded-xl [&_[data-slot=textarea]]:border-white/[0.13] [&_[data-slot=textarea]]:bg-black/15 [&_[data-slot=textarea]]:shadow-none", className)} {...props}><DialogPrimitive.Close aria-label="Close" className="absolute end-5 top-5 z-10 flex size-8 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.07] text-slate-400 shadow-lg backdrop-blur-xl transition hover:border-white/[0.22] hover:bg-white/[0.13] hover:text-white"><X className="size-4" /></DialogPrimitive.Close>{children}</DialogPrimitive.Popup></DialogPrimitive.Portal>;
}
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("border-b border-white/[0.1] bg-white/[0.055] px-6 py-5 pe-16 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl", className)} {...props} />; }
function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) { return <DialogPrimitive.Title className={cn("font-satoshi text-xl text-white", className)} {...props} />; }
function SheetDescription({ className, ...props }: DialogPrimitive.Description.Props) { return <DialogPrimitive.Description className={cn("mt-1 text-sm leading-6 text-slate-400", className)} {...props} />; }
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("mt-auto flex flex-col-reverse gap-2 border-t border-white/[0.1] bg-white/[0.035] px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-xl sm:flex-row sm:justify-end", className)} {...props} />; }
export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter };
