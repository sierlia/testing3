import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Calendar, Mail, PenSquare } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { supabase } from "../utils/supabase";
import { formatConstituency } from "../utils/constituency";

type Mailbox = "inbox" | "sent";

type LetterItem = {
  letter_id: string;
  mailbox: Mailbox;
  from_user_id: string;
  from_name: string;
  from_district: string | null;
  from_avatar: string | null;
  to_names: string[];
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export function DearColleagueInbox() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LetterItem[]>([]);
  const [selected, setSelected] = useState<LetterItem | null>(null);
  const [mailbox, setMailbox] = useState<Mailbox>("inbox");

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return navigate("/signin");

      const [{ data: inboxRows, error: inboxErr }, { data: sentRows, error: sentErr }] = await Promise.all([
        supabase
          .from("dear_colleague_recipients")
          .select("letter_id,read_at,dear_colleague_letters(id,sender_user_id,subject,body,created_at)")
          .eq("recipient_user_id", uid)
          .order("dear_colleague_letters(created_at)", { ascending: false } as any),
        supabase
          .from("dear_colleague_letters")
          .select("id,sender_user_id,subject,body,created_at")
          .eq("sender_user_id", uid)
          .order("created_at", { ascending: false }),
      ]);
      if (inboxErr) throw inboxErr;
      if (sentErr) throw sentErr;

      const inboxLetters = (inboxRows ?? []).map((r: any) => ({
        letter_id: r.letter_id,
        read_at: r.read_at,
        sender_user_id: r.dear_colleague_letters.sender_user_id,
        subject: r.dear_colleague_letters.subject,
        body: r.dear_colleague_letters.body,
        created_at: r.dear_colleague_letters.created_at,
      }));
      const sentLetters = (sentRows ?? []).map((l: any) => ({
        letter_id: l.id,
        read_at: null,
        sender_user_id: l.sender_user_id,
        subject: l.subject,
        body: l.body,
        created_at: l.created_at,
      }));

      const sentLetterIds = sentLetters.map((l: any) => l.letter_id);
      const { data: sentRecipients, error: recErr } = sentLetterIds.length
        ? await supabase.from("dear_colleague_recipients").select("letter_id,recipient_user_id").in("letter_id", sentLetterIds)
        : ({ data: [] } as any);
      if (recErr) throw recErr;

      const senderIds = [...inboxLetters, ...sentLetters].map((l: any) => l.sender_user_id);
      const recipientIds = (sentRecipients ?? []).map((r: any) => r.recipient_user_id);
      const profileIds = Array.from(new Set([...senderIds, ...recipientIds]));
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("user_id,display_name,constituency_name,avatar_url")
        .in("user_id", profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"]);
      if (profileErr) throw profileErr;
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      const recipientsByLetter = new Map<string, string[]>();
      for (const row of sentRecipients ?? []) {
        const letterId = (row as any).letter_id as string;
        const recipientId = (row as any).recipient_user_id as string;
        recipientsByLetter.set(letterId, [...(recipientsByLetter.get(letterId) ?? []), profileMap.get(recipientId)?.display_name ?? "Unknown"]);
      }

      const inboxMapped: LetterItem[] = inboxLetters.map((l: any) => ({
        letter_id: l.letter_id,
        mailbox: "inbox",
        from_user_id: l.sender_user_id,
        from_name: profileMap.get(l.sender_user_id)?.display_name ?? "Unknown",
        from_district: profileMap.get(l.sender_user_id)?.constituency_name ?? null,
        from_avatar: profileMap.get(l.sender_user_id)?.avatar_url ?? null,
        to_names: [],
        subject: l.subject || "(No subject)",
        body: l.body,
        created_at: l.created_at,
        read_at: l.read_at ?? null,
      }));
      const sentMapped: LetterItem[] = sentLetters.map((l: any) => ({
        letter_id: l.letter_id,
        mailbox: "sent",
        from_user_id: l.sender_user_id,
        from_name: "You",
        from_district: null,
        from_avatar: profileMap.get(l.sender_user_id)?.avatar_url ?? null,
        to_names: recipientsByLetter.get(l.letter_id) ?? [],
        subject: l.subject || "(No subject)",
        body: l.body,
        created_at: l.created_at,
        read_at: null,
      }));
      const nextItems = [...inboxMapped, ...sentMapped];
      setItems(nextItems);
      setSelected((prev) => (prev ? nextItems.find((it) => it.mailbox === prev.mailbox && it.letter_id === prev.letter_id) ?? null : nextItems.find((it) => it.mailbox === mailbox) ?? null));
    } catch (e: any) {
      toast.error(e.message || "Could not load letters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const sub = supabase
      .channel("dc_inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "dear_colleague_recipients" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "dear_colleague_letters" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const selectLetter = async (it: LetterItem) => {
    setSelected(it);
    if (it.mailbox !== "inbox" || it.read_at) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("dear_colleague_recipients")
        .update({ read_at: now })
        .eq("letter_id", it.letter_id)
        .eq("recipient_user_id", uid);
      if (error) throw error;
      setItems((prev) => prev.map((x) => (x.mailbox === "inbox" && x.letter_id === it.letter_id ? { ...x, read_at: now } : x)));
      setSelected((prev) => (prev && prev.mailbox === "inbox" && prev.letter_id === it.letter_id ? { ...prev, read_at: now } : prev));
    } catch (e: any) {
      toast.error(e.message || "Could not mark read");
    }
  };

  const unreadCount = useMemo(() => items.filter((i) => i.mailbox === "inbox" && !i.read_at).length, [items]);
  const visibleItems = useMemo(() => items.filter((i) => i.mailbox === mailbox), [items, mailbox]);
  const replySubject = selected?.subject && selected.subject !== "(No subject)" ? selected.subject : "";

  const switchMailbox = (next: Mailbox) => {
    setMailbox(next);
    setSelected(items.find((it) => it.mailbox === next) ?? null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dear Colleague Letters</h1>
            <p className="text-gray-600 mt-1">Read letters from your fellow representatives{unreadCount ? ` - ${unreadCount} unread` : ""}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dear-colleague/compose")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <PenSquare className="w-4 h-4" />
            Compose Letter
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm text-gray-600">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-2">
              <div className="flex rounded-md border border-gray-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => switchMailbox("inbox")}
                  className={`flex-1 rounded px-3 py-2 text-sm font-medium ${mailbox === "inbox" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  Inbox
                </button>
                <button
                  type="button"
                  onClick={() => switchMailbox("sent")}
                  className={`flex-1 rounded px-3 py-2 text-sm font-medium ${mailbox === "sent" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  Sent
                </button>
              </div>

              {visibleItems.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No letters yet</h3>
                  <p className="text-sm text-gray-600">{mailbox === "inbox" ? "Your inbox is empty" : "No sent letters yet"}</p>
                </div>
              ) : (
                visibleItems.map((it) => (
                  <button
                    key={`${it.mailbox}:${it.letter_id}`}
                    onClick={() => void selectLetter(it)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selected?.mailbox === it.mailbox && selected?.letter_id === it.letter_id ? "bg-blue-50 border-blue-500" : "bg-white border-gray-200 hover:border-gray-300"
                    } ${it.mailbox === "inbox" && !it.read_at ? "font-semibold" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {it.from_avatar ? (
                        <img src={it.from_avatar} alt={it.from_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <DefaultAvatar className="w-10 h-10 flex-shrink-0" iconClassName="w-5 h-5 text-gray-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-gray-900 truncate">{it.mailbox === "sent" ? `To: ${it.to_names.join(", ") || "Recipients"}` : it.from_name}</span>
                          {it.mailbox === "inbox" && !it.read_at && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
                        </div>
                        <p className="text-sm text-gray-600 truncate mb-1">{it.subject}</p>
                        <p className="text-xs text-gray-500">{formatDate(it.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="lg:col-span-2">
              {selected ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-200">
                    <Link to={`/profile/${selected.from_user_id}`}>
                      {selected.from_avatar ? (
                        <img src={selected.from_avatar} alt={selected.from_name} className="w-12 h-12 rounded-full object-cover hover:ring-2 hover:ring-blue-500 transition-all" />
                      ) : (
                        <DefaultAvatar className="w-12 h-12 hover:ring-2 hover:ring-blue-500 transition-all" iconClassName="w-6 h-6 text-gray-500" />
                      )}
                    </Link>
                    <div className="flex-1">
                      <Link to={`/profile/${selected.from_user_id}`} className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                        {selected.from_name}
                      </Link>
                      {selected.mailbox === "inbox" ? (
                        <p className="text-sm text-gray-600">{formatConstituency(selected.from_district)}</p>
                      ) : (
                        <p className="text-sm text-gray-600">To: {selected.to_names.join(", ") || "Recipients"}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(selected.created_at)}</span>
                      </div>
                    </div>
                    {selected.mailbox === "inbox" && (
                      <button
                        type="button"
                        onClick={() => navigate(`/dear-colleague/compose?to=${encodeURIComponent(selected.from_user_id)}&subject=${encodeURIComponent(replySubject)}`)}
                        className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        <PenSquare className="w-4 h-4" />
                        Reply
                      </button>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-4">{selected.subject}</h2>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-gray-700">{selected.body}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a letter to read</h3>
                  <p className="text-gray-600">Choose a letter from the list to view its contents</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
