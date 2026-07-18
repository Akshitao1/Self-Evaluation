import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const joveoButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-[#303F9F] text-white shadow-xs hover:bg-[#29358f]",
        secondary: "bg-[#e6e8ff] text-[#303F9F] hover:bg-[#d5d7f0]",
        tertiary: "bg-white text-[#303F9F] border border-[#e2e8f0] hover:bg-[#f5f5ff]",
        text: "bg-transparent text-[#303F9F] hover:bg-[#f5f5ff]",
        // Include default to make it easier to switch between button systems
        default: "bg-[#303F9F] text-white shadow-xs hover:bg-[#29358f]",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-[#303F9F] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function JoveoButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof joveoButtonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(joveoButtonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { JoveoButton, joveoButtonVariants }
