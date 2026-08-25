"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

function PopoverContent({ className, children, ...props }: PopoverPrimitive.Popup.Props) {
  return <PopoverPrimitive.Portal><PopoverPrimitive.Positioner sideOffset={6} className="z-50 outline-none"><PopoverPrimitive.Popup className={cn("rounded-xl border border-white/10 bg-[#0b1020] p-3 text-slate-200 shadow-2xl outline-none", className)} {...props}>{children}</PopoverPrimitive.Popup></PopoverPrimitive.Positioner></PopoverPrimitive.Portal>;
}

export { Popover, PopoverTrigger, PopoverContent };
