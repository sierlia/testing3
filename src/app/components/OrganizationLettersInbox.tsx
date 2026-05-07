import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Mail, Send } from "lucide-react";
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
  organizationName,
  memberIds,
}: {
  organizationType: "party" | "committee" | "caucus";
  organizationId: string;
  organizationName: string;
  memberIds: string[];
}) {
  const [loading, setLoading] = useState(true);
  const [letters, setLetters] = useState<LetterRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const ids = Array.from(new Set(memberIds.filter(Boolean)));
        if (!ids.length) {
          setLetters([]);
          return;
        }
        const { data: letterRows } = await supabase
          .from("dear_colleague_letters")
          .select("id,sender_user_id,subject,body,created_at")
          .in("sender_user_id", ids)
          .order("created_at", { ascending: false })
          .limit(8);
        const senderIds = Array.from(new Set((letterRows ?? []).map((letter: any) => letter.sender_user_id).filter(Boolean)));
        const { data: profiles } = senderIds.length
          ? await supabase.from("profiles").select("user_id,display_name").in("user_id", senderIds)
          : ({ data: [] } as any);
        const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.user_id, profile.display_name ?? "Member"]));
        if (!cancelled) {
          setLetters((letterRows ?? []).map((letter: any) => ({ ...letter, senderName: profileMap.get(letter.sender_user_id) ?? "Member" })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [memberIds.join("|")]);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Letters inbox</h2>
        </div>
        <Link
          to={`/dear-colleague/compose?toType=${organizationType}&to=${encodeURIComponent(organizationId)}`}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Send className="h-4 w-4" />
          Write to {organizationName}
        </Link>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading letters...</div>
      ) : letters.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-5 text-sm text-gray-500">No letters from members yet.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {letters.map((letter) => (
            <Link key={letter.id} to={`/letters/${letter.id}`} className="block py-3 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{letter.subject || "Dear Colleague Letter"}</div>
                  <div className="mt-1 text-xs text-gray-500">From {letter.senderName}</div>
                </div>
                <div className="shrink-0 text-xs text-gray-500">{new Date(letter.created_at).toLocaleDateString()}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
