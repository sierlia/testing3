import { ArrowUpDown } from "lucide-react";

type SortDirectionButtonProps = {
  direction: "asc" | "desc";
  onClick: () => void;
  className?: string;
};

export function SortDirectionButton({ direction, onClick, className = "" }: SortDirectionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "asc" ? "Sort ascending" : "Sort descending"}
      title={direction === "asc" ? "Ascending" : "Descending"}
      className={`rounded-md border border-gray-300 bg-white p-1.5 transition-colors hover:bg-gray-50 ${className}`}
    >
      <ArrowUpDown className="h-4 w-4 text-gray-600" />
    </button>
  );
}
