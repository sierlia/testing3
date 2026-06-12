import { CircleHelp } from "lucide-react";
import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center self-center align-middle rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" sideOffset={8} className="max-w-sm whitespace-normal text-left leading-5">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
