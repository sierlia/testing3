import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Mail } from "lucide-react";
import { supabase } from "../utils/supabase";

type LetterRow = {
  id: string;
  sender_user_id: string;
  subject: string | null;
  body: string | null;
  created_at: string;
  senderName: string;
};

export function OrganizationLettersInbox({
  organizationType,
  organizationId,
  memberIds,
}: {
  organizationType: "party" | "committee" | "caucus";
  organizationId: string;
  organizationName: string;
  memberIds: string[];
}) {
  const [loading, setLoading] = useState(true);
  const [letters, setLetters] = useState<LetterRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const storageKey = `gavel:org-letters-seen:${organizationType}:${organizationId}`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const storedSeen = new Set<string>(JSON.parse(window.localStorage.getItem(storageKey) || "[]"));
        setSeenIds(storedSeen);
        const { data: letterRows } = await supabase
          .from("dear_colleague_org_recipients")
          .select("dear_colleague_letters(id,sender_user_id,subject,body,created_at)")
          .eq("organization_type", organizationType)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(8);
        const lettersForOrg = (letterRows ?? []).map((row: any) => row.dear_colleague_letters).filter(Boolean);
        const senderIds = Array.from(new Set(lettersForOrg.map((letter: any) => letter.sender_user_id).filter(Boolean)));
        const { data: profiles } = senderIds.length
          ? await supabase.from("profiles").select("user_id,display_name").in("user_id", senderIds)
          : ({ data: [] } as any);
        const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile.display_name ?? "Member"]));
        if (!cancelled) {
          const mapped = lettersForOrg.map((letter: any) => ({ ...letter, senderName: profileMap.get(letter.sender_user_id) ?? "Member" }));
          setLetters(mapped);
          setSelectedId((current) => current ?? mapped[0]?.id ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, organizationType, memberIds.join("|"), storageKey]);

  const selected = useMemo(() => letters.find((letter) => letter.id === selectedId) ?? letters[0] ?? null, [letters, selectedId]);
  const newCount = letters.filter((letter) => !seenIds.has(letter.id)).length;

  const openLetter = (letterId: string) => {
    setSelectedId(letterId);
    setSeenIds((current) => {
      const next = new Set(current).add(letterId);
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      window.dispatchEvent(new CustomEvent("gavel:org-letters-seen", { detail: { organizationType, organizationId } }));
      return next;
    });
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Letters inbox</h2>
          {newCount > 0 ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">{newCount}</span> : null}
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading letters...</div>
      ) : letters.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-5 text-sm text-gray-500">No letters addressed to this organization yet.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {letters.map((letter) => {
            const isNew = !seenIds.has(letter.id);
            return (
            <button key={letter.id} type="button" onClick={() => openLetter(letter.id)} className={`block w-full px-3 py-3 text-left hover:bg-gray-50 ${selected?.id === letter.id ? "bg-blue-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-gray-900">{letter.subject || "Dear Colleague Letter"}</div>
                    {isNew ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">New</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">From {letter.senderName}</div>
                </div>
                <div className="shrink-0 text-xs text-gray-500">{new Date(letter.created_at).toLocaleDateString()}</div>
              </div>
            </button>
          );})}
          </div>
          {selected ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{selected.subject || "Dear Colleague Letter"}</div>
                  <div className="mt-1 text-xs text-gray-500">From {selected.senderName} on {new Date(selected.created_at).toLocaleDateString()}</div>
                </div>
                <Link to={`/letters/${selected.id}`} className="text-xs font-semibold text-blue-700 hover:text-blue-800">Open</Link>
              </div>
              <p className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-700">{selected.body}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
