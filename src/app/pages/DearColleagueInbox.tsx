import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { Mail, User, Calendar } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";

type InboxItem = {
  letter_id: string;
  from_user_id: string;
  from_name: string;
  from_district: string | null;
  from_avatar: string | null;
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export function DearColleagueInbox() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [selected, setSelected] = useState<InboxItem | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return navigate("/signin");

      const { data: rows, error } = await supabase
        .from("dear_colleague_recipients")
        .select("letter_id,read_at,dear_colleague_letters(id,class_id,sender_user_id,subject,body,created_at)")
        .eq("recipient_user_id", uid)
        .order("dear_colleague_letters(created_at)", { ascending: false } as any);
      if (error) throw error;

      const letters = (rows ?? []).map((r: any) => ({
        letter_id: r.letter_id,
        read_at: r.read_at,
        sender_user_id: r.dear_colleague_letters.sender_user_id,
        subject: r.dear_colleague_letters.subject,
        body: r.dear_colleague_letters.body,
        created_at: r.dear_colleague_letters.created_at,
      }));

      const senderIds = Array.from(new Set(letters.map((l: any) => l.sender_user_id)));
      const { data: senders, error: sErr } = await supabase
        .from("profiles")
        .select("user_id,display_name,constituency_code,avatar_url")
        .in("user_id", senderIds.length ? senderIds : ["00000000-0000-0000-0000-000000000000"]);
      if (sErr) throw sErr;
      const senderMap = new Map((senders ?? []).map((s: any) => [s.user_id, s]));

      const mapped: InboxItem[] = letters.map((l: any) => ({
        letter_id: l.letter_id,
        from_user_id: l.sender_user_id,
        from_name: senderMap.get(l.sender_user_id)?.display_name ?? "Unknown",
        from_district: senderMap.get(l.sender_user_id)?.constituency_code ?? null,
        from_avatar: senderMap.get(l.sender_user_id)?.avatar_url ?? null,
        subject: l.subject || "(No subject)",
        body: l.body,
        created_at: l.created_at,
        read_at: l.read_at ?? null,
      }));
      setItems(mapped);
      if (mapped.length && !selected) setSelected(mapped[0]);
    } catch (e: any) {
      toast.error(e.message || "Could not load inbox");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // realtime updates for inbox
    const sub = supabase
      .channel("dc_inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "dear_colleague_recipients" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const selectLetter = async (it: InboxItem) => {
    setSelected(it);
    if (it.read_at) return;
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
      setItems((prev) => prev.map((x) => (x.letter_id === it.letter_id ? { ...x, read_at: now } : x)));
      setSelected((prev) => (prev && prev.letter_id === it.letter_id ? { ...prev, read_at: now } : prev));
    } catch (e: any) {
      toast.error(e.message || "Could not mark read");
    }
  };

  const unreadCount = useMemo(() => items.filter((i) => !i.read_at).length, [items]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Dear Colleague Letters</h1>
          <p className="text-gray-600 mt-1">
            Read letters from your fellow representatives{unreadCount ? ` â€¢ ${unreadCount} unread` : ""}
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm text-gray-600">Loadingâ€¦</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-2">
              {items.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No letters yet</h3>
                  <p className="text-sm text-gray-600">Your inbox is empty</p>
                </div>
              ) : (
                items.map((it) => (
                  <button
                    key={it.letter_id}
                    onClick={() => void selectLetter(it)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selected?.letter_id === it.letter_id ? "bg-blue-50 border-blue-500" : "bg-white border-gray-200 hover:border-gray-300"
                    } ${!it.read_at ? "font-semibold" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {it.from_avatar ? (
                        <img src={it.from_avatar} alt={it.from_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-gray-900 truncate">{it.from_name}</span>
                          {!it.read_at && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
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
                        <img
                          src={selected.from_avatar}
                          alt={selected.from_name}
                          className="w-12 h-12 rounded-full object-cover hover:ring-2 hover:ring-blue-500 transition-all"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition-all">
                          <User className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                    </Link>
                    <div className="flex-1">
                      <Link to={`/profile/${selected.from_user_id}`} className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                        {selected.from_name}
                      </Link>
                      <p className="text-sm text-gray-600">{selected.from_district || "N/A"}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(selected.created_at)}</span>
                      </div>
                    </div>
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

