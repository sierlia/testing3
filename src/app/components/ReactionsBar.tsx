import { useEffect, useRef, useState } from "react";

export type ReactionEmoji = "\u{1F44D}" | "\u{1F44E}" | "\u{1F389}";

export type ReactionsSummary = {
  counts: Record<ReactionEmoji, number>;
  mine: Set<ReactionEmoji>;
  users?: Partial<Record<ReactionEmoji, string[]>>;
  userIds?: Partial<Record<ReactionEmoji, string[]>>;
  userMap?: Partial<Record<ReactionEmoji, Record<string, string>>>;
};

const EMOJIS: ReactionEmoji[] = ["\u{1F44D}", "\u{1F44E}", "\u{1F389}"];

export function emptyReactionsSummary(): ReactionsSummary {
  return { counts: { "\u{1F44D}": 0, "\u{1F44E}": 0, "\u{1F389}": 0 }, mine: new Set<ReactionEmoji>() };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function addReactionToSummary(summary: ReactionsSummary | undefined, emoji: ReactionEmoji, userId: string, userName: string, meId: string | null) {
  const cur = summary ?? emptyReactionsSummary();
  const mine = new Set(cur.mine);
  const userIds = { ...(cur.userIds ?? {}) };
  const users = { ...(cur.users ?? {}) };
  const userMap = { ...(cur.userMap ?? {}) };
  const idsForEmoji = userIds[emoji] ?? [];
  const alreadyCounted = idsForEmoji.includes(userId);
  userIds[emoji] = alreadyCounted ? idsForEmoji : [...idsForEmoji, userId];
  userMap[emoji] = { ...(userMap[emoji] ?? {}), [userId]: userName };
  users[emoji] = uniqueStrings(Object.values(userMap[emoji] ?? {}));
  if (userId === meId) mine.add(emoji);
  return {
    counts: { ...cur.counts, [emoji]: alreadyCounted ? (cur.counts[emoji] ?? 0) : (cur.counts[emoji] ?? 0) + 1 },
    mine,
    users,
    userIds,
    userMap,
  };
}

export function removeReactionFromSummary(summary: ReactionsSummary | undefined, emoji: ReactionEmoji, userId: string, meId: string | null) {
  const cur = summary ?? emptyReactionsSummary();
  const mine = new Set(cur.mine);
  const userIds = { ...(cur.userIds ?? {}) };
  const users = { ...(cur.users ?? {}) };
  const userMap = { ...(cur.userMap ?? {}) };
  const idsForEmoji = userIds[emoji] ?? [];
  const wasCounted = idsForEmoji.includes(userId);
  const shouldDecrement = wasCounted || idsForEmoji.length === 0;
  userIds[emoji] = idsForEmoji.filter((id) => id !== userId);
  if (wasCounted) {
    const nextMap = { ...(userMap[emoji] ?? {}) };
    delete nextMap[userId];
    userMap[emoji] = nextMap;
    users[emoji] = uniqueStrings(Object.values(nextMap));
  }
  if (userId === meId) mine.delete(emoji);
  return {
    counts: { ...cur.counts, [emoji]: Math.max(0, (cur.counts[emoji] ?? 0) - (shouldDecrement ? 1 : 0)) },
    mine,
    users,
    userIds,
    userMap,
  };
}

export function ReactionsBar({
  summary,
  onToggle,
  size = "sm",
  canReact = true,
}: {
  summary: ReactionsSummary | undefined;
  onToggle: (emoji: ReactionEmoji) => void | Promise<void>;
  size?: "sm" | "md";
  canReact?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingEmoji, setPendingEmoji] = useState<ReactionEmoji | null>(null);
  const pendingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const counts = summary?.counts ?? { "\u{1F44D}": 0, "\u{1F44E}": 0, "\u{1F389}": 0 };
  const mine = summary?.mine ?? new Set<ReactionEmoji>();
  const users = summary?.users ?? {};
  const baseClass = size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs";

  const shown = EMOJIS.filter((e) => (counts[e] ?? 0) > 0 || mine.has(e));

  const toggle = async (emoji: ReactionEmoji) => {
    if (!canReact) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingEmoji(emoji);
    try {
      await Promise.resolve(onToggle(emoji));
    } finally {
      pendingRef.current = false;
      setPendingEmoji(null);
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  return (
    <div className="flex items-center gap-2">
      {shown.map((emoji) => {
        const active = mine.has(emoji);
        const count = counts[emoji] ?? 0;
        const title = users[emoji]?.length ? users[emoji]?.join("\n") : "React";
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => void toggle(emoji)}
            disabled={!canReact || pendingEmoji === emoji}
            className={`${baseClass} rounded-md border transition-colors ${
              active ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 hover:bg-gray-50 text-gray-700"
            } disabled:cursor-default disabled:opacity-70`}
            title={title}
          >
            <span className="mr-1">{emoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        );
      })}
      {canReact && (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={`${baseClass} rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer select-none`}
          title="Add reaction"
        >
          +
        </button>
        {menuOpen && (
          <div className="absolute left-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg p-2 z-20 flex gap-1">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  void toggle(emoji);
                  setMenuOpen(false);
                }}
                disabled={pendingEmoji === emoji}
                className="px-2 py-1 rounded hover:bg-gray-100 text-sm disabled:opacity-60"
                title="React"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
