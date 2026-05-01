import type * as React from "react";
import { User } from "lucide-react";
import { cn } from "./ui/utils";

export function DefaultAvatar({
  className,
  iconClassName,
  ...props
}: {
  className?: string;
  iconClassName?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-full bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden", className)} {...props}>
      <User className={cn("w-1/2 h-1/2", iconClassName)} />
    </div>
  );
}
