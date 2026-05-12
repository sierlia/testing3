import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";

export type MemberCandidate = {
  user_id: string;
  display_name: string | null;
  party?: string | null;
  constituency_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  disabledReason?: string | null;
};

export function TeacherAddMembersPopover({
  candidates,
  onAdd,
  buttonLabel = "Add member",
}: {
  candidates: MemberCandidate[];
  onAdd: (candidate: MemberCandidate) => void | Promise<void>;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const visibleCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return candidates
      .filter((candidate) => !normalized || (candidate.display_name ?? "Member").toLowerCase().includes(normalized))
      .sort((a, b) => (a.display_name ?? "Member").localeCompare(b.display_name ?? "Member"));
  }, [candidates, query]);

  const add = async (candidate: MemberCandidate) => {
    if (candidate.disabledReason) return;
    setBusyId(candidate.user_id);
    try {
      await Promise.resolve(onAdd(candidate));
      setQuery("");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        aria-label={buttonLabel}
        title={buttonLabel}
      >
        <Plus className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members..."
              className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {visibleCandidates.length ? (
              visibleCandidates.map((candidate) => (
                <button
                  key={candidate.user_id}
                  type="button"
                  onClick={() => void add(candidate)}
                  disabled={Boolean(candidate.disabledReason) || busyId === candidate.user_id}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <div className="font-medium">{candidate.display_name ?? "Member"}</div>
                  {candidate.disabledReason ? <div className="text-xs text-gray-500">{candidate.disabledReason}</div> : null}
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-gray-500">No members found.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
