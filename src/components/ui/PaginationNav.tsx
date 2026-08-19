import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PaginationNav({ previousHref, nextHref, previousLabel, nextLabel }: {
  previousHref: string | null;
  nextHref: string | null;
  previousLabel: string;
  nextLabel: string;
}) {
  if (!previousHref && !nextHref) return null;
  return (
    <nav aria-label={`${previousLabel} / ${nextLabel}`} className="flex items-center justify-end gap-2">
      {previousHref ? <Link href={previousHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}><ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden />{previousLabel}</Link> : <Button variant="outline" size="sm" disabled><ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden />{previousLabel}</Button>}
      {nextHref ? <Link href={nextHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>{nextLabel}<ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden /></Link> : <Button variant="outline" size="sm" disabled>{nextLabel}<ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden /></Button>}
    </nav>
  );
}
