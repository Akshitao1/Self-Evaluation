"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "relative",
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex items-center justify-center h-7 relative",
        caption_label: "text-sm font-medium text-text",
        nav: "absolute inset-x-0 top-0 z-10 flex items-center justify-between",
        button_previous: cn(
          "h-7 w-7 flex items-center justify-center rounded-md border border-border bg-surface hover:bg-surface-alt text-text-muted hover:text-text transition-colors cursor-pointer",
        ),
        button_next: cn(
          "h-7 w-7 flex items-center justify-center rounded-md border border-border bg-surface hover:bg-surface-alt text-text-muted hover:text-text transition-colors cursor-pointer",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-text-muted w-9 text-[0.8rem] font-medium text-center",
        week: "flex mt-2",
        day: "p-0",
        day_button: cn(
          "h-9 w-9 text-sm rounded-md font-normal text-text transition-colors cursor-pointer",
          "hover:bg-surface-alt",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          "aria-selected:bg-primary aria-selected:text-white aria-selected:hover:bg-primary",
        ),
        selected: "[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary",
        today: "[&>button]:border [&>button]:border-primary [&>button]:text-primary",
        outside: "[&>button]:text-text-muted [&>button]:opacity-50",
        disabled: "[&>button]:text-text-muted [&>button]:opacity-30 [&>button]:cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";
