import { useMemo, useState } from "react";

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

export function CollapsibleText({
  text,
  limit = 500,
  className = "",
}: {
  text: string;
  limit?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = useMemo(() => wordCount(text) >= limit, [limit, text]);
  const displayed = !shouldCollapse || expanded ? text : truncateWords(text, limit);

  return (
    <div className={className}>
      <div className={`relative whitespace-pre-line ${shouldCollapse && !expanded ? "max-h-72 overflow-hidden" : ""}`}>
        {displayed}
        {shouldCollapse && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-white/0" />
        )}
      </div>
      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
