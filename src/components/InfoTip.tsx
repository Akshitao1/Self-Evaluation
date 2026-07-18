"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

// Small info "ⓘ" icon that reveals a tooltip on hover/tap. Wraps the shared
// Radix tooltip primitives so call sites stay terse. `Tooltip` already
// self-wraps in a provider, so no provider is needed at the call site.
export default function InfoTip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className={`w-3.5 h-3.5 text-text-light shrink-0 ${className}`} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
