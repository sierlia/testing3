import { useMemo } from "react";

export type ReactionEmoji = "\u{1F44D}" | "\u{1F44E}" | "\u{1F389}";

export type ReactionsSummary = {
  counts: Record<ReactionEmoji, number>;
  mine: Set<ReactionEmoji>;
};

const EMOJIS: ReactionEmoji[] = ["\u{1F44D}", "\u{1F44E}", "\u{1F389}"];

export function ReactionsBar({
  summary,
  onToggle,
  size = "sm",
}: {
  summary: ReactionsSummary | undefined;
  onToggle: (emoji: ReactionEmoji) => void;
  size?: "sm" | "md";
}) {
  const counts = summary?.counts ?? { "\u{1F44D}": 0, "\u{1F44E}": 0, "\u{1F389}": 0 };
  const mine = summary?.mine ?? new Set<ReactionEmoji>();
  const baseClass = size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs";

  const total = useMemo(() => EMOJIS.reduce((acc, e) => acc + (counts[e] ?? 0), 0), [counts]);
  if (total === 0) {
    return (
      <div className="flex items-center gap-2">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            className={`${baseClass} rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700`}
            title="React"
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {EMOJIS.map((emoji) => {
        const active = mine.has(emoji);
        const count = counts[emoji] ?? 0;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            className={`${baseClass} rounded-md border transition-colors ${
              active ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 hover:bg-gray-50 text-gray-700"
            }`}
            title="React"
          >
            <span className="mr-1">{emoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
