"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return <DayPicker className={cn("p-2", className)} classNames={{
    months: "flex flex-col gap-4",
    month: "space-y-4",
    caption: "flex items-center justify-between px-1",
    caption_label: "text-sm font-semibold text-slate-100",
    nav: "flex items-center gap-1",
    button_previous: "inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white",
    button_next: "inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white",
    month_grid: "w-full border-collapse",
    weekdays: "flex",
    weekday: "w-8 rounded-md text-center text-[10px] font-medium text-slate-500",
    week: "mt-1 flex w-full",
    day: "size-8 p-0 text-center text-sm",
    day_button: "size-8 rounded-md text-slate-300 hover:bg-[#d8be78]/15 hover:text-white",
    selected: "bg-[#d8be78]/25 text-[#f5df9b]",
    today: "border border-[#8d87f5]/50 text-white",
    outside: "text-slate-700",
    disabled: "text-slate-700 opacity-50",
    ...classNames,
  }} components={{ PreviousMonthButton: (props) => <button {...props}><ChevronLeft className="size-4 rtl:rotate-180" /></button>, NextMonthButton: (props) => <button {...props}><ChevronRight className="size-4 rtl:rotate-180" /></button> }} {...props} />;
}
