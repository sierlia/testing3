import { ChevronLeft, ChevronRight } from "lucide-react";

export function CompactPager({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sizes = [10, 25, 50, 100],
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sizes?: number[];
}) {
  if (totalItems === 0) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const clampPage = (page: number) => Math.min(totalPages, Math.max(1, page || 1));

  return (
    <div className="my-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
      <div>{start}-{end} of {totalItems}</div>
      <div className="flex items-center gap-2">
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm">
          {sizes.map((size) => <option key={size} value={size}>{size} per page</option>)}
        </select>
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="flex items-center gap-1 text-gray-700">
            <input
              aria-label="Current page"
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(event) => onPageChange(clampPage(Number(event.target.value)))}
              className="w-10 rounded-md border border-gray-300 bg-white px-1 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span>of {totalPages}</span>
          </label>
          <button type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="rounded p-1.5 text-gray-700 hover:bg-gray-100 disabled:opacity-40" aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
