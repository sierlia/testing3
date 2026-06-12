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
  membershipNote?: string | null;
};

export function TeacherAddMembersPopover({
  candidates,
  onAdd,
  onInvite,
  inviteOnly = false,
  buttonLabel = "Add member",
}: {
  candidates: MemberCandidate[];
  onAdd?: (candidate: MemberCandidate) => void | Promise<void>;
  onInvite?: (candidate: MemberCandidate) => void | Promise<void>;
  inviteOnly?: boolean;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [action, setAction] = useState<"add" | "invite">(inviteOnly ? "invite" : "add");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setConfirming(false);
    setSelectedIds(new Set());
    setQuery("");
    setAction(inviteOnly ? "invite" : "add");
  }, [open]);

  const visibleCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return candidates
      .filter((candidate) => !normalized || (candidate.display_name ?? "Member").toLowerCase().includes(normalized))
      .sort((a, b) => (a.display_name ?? "Member").localeCompare(b.display_name ?? "Member"));
  }, [candidates, query]);

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedIds.has(candidate.user_id)),
    [candidates, selectedIds],
  );

  const toggleCandidate = (candidate: MemberCandidate) => {
    if (candidate.disabledReason) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(candidate.user_id)) next.delete(candidate.user_id);
      else next.add(candidate.user_id);
      return next;
    });
  };

  const saveSelected = async () => {
    const selectable = selectedCandidates.filter((candidate) => !candidate.disabledReason);
    if (!selectable.length) return;
    const handler = action === "invite" ? onInvite : onAdd;
    if (!handler) return;
    try {
      for (const candidate of selectable) {
        setBusyId(candidate.user_id);
        await Promise.resolve(handler(candidate));
      }
      setSelectedIds(new Set());
      setConfirming(false);
      setQuery("");
      setOpen(false);
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
          {!inviteOnly && onAdd && onInvite ? (
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-md border border-gray-200 bg-gray-50 p-1">
              {(["add", "invite"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setAction(mode);
                    setConfirming(false);
                  }}
                  className={`rounded px-2 py-1.5 text-xs font-semibold capitalize ${action === mode ? "bg-[#4163f2] text-white shadow-sm" : "text-gray-600 hover:bg-blue-50 hover:text-[#4163f2]"}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          ) : null}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members..."
              className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {!confirming ? (
          <>
          <div className="max-h-64 overflow-y-auto">
            {visibleCandidates.length ? (
              visibleCandidates.map((candidate) => (
                <button
                  key={candidate.user_id}
                  type="button"
                  onClick={() => toggleCandidate(candidate)}
                  disabled={Boolean(candidate.disabledReason) || busyId === candidate.user_id}
                  className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-blue-50 hover:text-[#4163f2] disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-400 ${selectedIds.has(candidate.user_id) ? "bg-blue-50 text-[#4163f2]" : "text-gray-700"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{candidate.display_name ?? "Member"}</div>
                    {selectedIds.has(candidate.user_id) && <div className="text-xs font-semibold text-[#4163f2]">Selected</div>}
                  </div>
                  {candidate.membershipNote ? <div className="text-xs text-gray-500">{candidate.membershipNote}</div> : null}
                  {candidate.disabledReason ? <div className="text-xs text-gray-500">{candidate.disabledReason}</div> : null}
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-gray-500">No members found.</div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
            <div className="text-xs text-gray-500">{selectedCandidates.length} selected</div>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={selectedCandidates.length === 0}
              className="rounded-md bg-[#4163f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3151d7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action === "invite" ? "Invite" : "Add"}
            </button>
          </div>
          </>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">{action === "invite" ? "Confirm invitations" : "Confirm add"}</div>
                <div className="text-xs text-gray-500">
                  {action === "invite" ? "These users will receive an invitation notification." : "These users will be added immediately."}
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200">
                {selectedCandidates.map((candidate) => (
                  <div key={candidate.user_id} className="border-b border-gray-100 px-3 py-2 text-sm last:border-b-0">
                    <div className="font-medium text-gray-900">{candidate.display_name ?? "Member"}</div>
                    {candidate.membershipNote ? <div className="text-xs text-gray-500">{candidate.membershipNote}</div> : null}
                    {candidate.disabledReason ? <div className="text-xs text-red-600">{candidate.disabledReason}</div> : null}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100">Back</button>
                <button type="button" onClick={() => void saveSelected()} className="rounded-md bg-[#4163f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3151d7]">
                  {action === "invite" ? "Send invites" : "Add selected"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
