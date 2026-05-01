import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation } from "../components/Navigation";
import { Send, X, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { formatConstituency } from "../utils/constituency";

type RecipientType = "individual" | "caucus" | "party" | "committee";

type Recipient = {
  type: RecipientType;
  id: string; // user_id for individual, org id otherwise
  name: string;
  image?: string | null;
  district?: string | null;
};

export function CreateDearColleagueLetter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientType, setRecipientType] = useState<RecipientType>("individual");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);

  const [individuals, setIndividuals] = useState<Array<{ user_id: string; display_name: string | null; constituency_name: string | null; avatar_url: string | null }>>([]);
  const [caucuses, setCaucuses] = useState<Array<{ id: string; name: string }>>([]);
  const [parties, setParties] = useState<Array<{ id: string; name: string }>>([]);
  const [committees, setCommittees] = useState<Array<{ id: string; name: string }>>([]);
  const didPrefillReplyRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return navigate("/signin");

        const { data: pRow, error: pErr } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
        if (pErr) throw pErr;
        const classId = (pRow as any)?.class_id as string | null;
        if (!classId) {
          toast.error("Select a class first (Settings â†’ Classes)");
          return navigate("/settings/classes");
        }

        const [{ data: directory, error: dirErr }, { data: cau }, { data: par }, { data: com }] = await Promise.all([
          supabase.rpc("class_directory", { target_class: classId } as any),
          supabase.from("caucuses").select("id,title").eq("class_id", classId).order("title"),
          supabase.from("parties").select("id,name").eq("class_id", classId).order("name"),
          supabase.from("committees").select("id,name").eq("class_id", classId).order("name"),
        ]);
        if (dirErr) throw dirErr;
        const classMembers = ((directory ?? []) as any[]).filter((p) => p.user_id !== uid);
        setIndividuals(classMembers);
        setCaucuses((cau ?? []) as any);
        setParties((par ?? []) as any);
        setCommittees((com ?? []) as any);

        const replyTo = searchParams.get("to");
        if (!didPrefillReplyRef.current && replyTo) {
          didPrefillReplyRef.current = true;
          const match = classMembers.find((p) => p.user_id === replyTo);
          if (match) {
            setRecipients([
              {
                type: "individual",
                id: match.user_id,
                name: match.display_name || "Unknown",
                district: formatConstituency(match.constituency_name),
                image: match.avatar_url,
              },
            ]);
          }
          const replySubject = searchParams.get("subject") || "";
          if (replySubject) setSubject(replySubject.toLowerCase().startsWith("re:") ? replySubject : `Re: ${replySubject}`);
        }
      } catch (e: any) {
        toast.error(e.message || "Could not load recipients");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [navigate, searchParams]);

  const handleAddRecipient = (recipient: Recipient) => {
    if (!recipients.some((r) => r.id === recipient.id && r.type === recipient.type)) {
      setRecipients([...recipients, recipient]);
    }
    setSearchQuery("");
    setShowSuggestions(false);
  };

  const handleRemoveRecipient = (index: number) => setRecipients(recipients.filter((_, i) => i !== index));

  const filteredSuggestions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (recipientType === "individual") {
      const base = query
        ? individuals.filter(
            (s) =>
              (s.display_name || "").toLowerCase().includes(query) ||
              formatConstituency(s.constituency_name).toLowerCase().includes(query),
          )
        : individuals;
      return base
        .slice(0, 20)
        .map((s) => ({ id: s.user_id, name: s.display_name || "Unknown", district: formatConstituency(s.constituency_name), image: s.avatar_url }));
    }
    if (recipientType === "caucus") {
      const base = query ? caucuses.filter((s: any) => (s.name ?? s.title ?? "").toLowerCase().includes(query)) : caucuses;
      return base.slice(0, 20).map((s: any) => ({ id: s.id, name: s.name ?? s.title }));
    }
    if (recipientType === "party") {
      const base = query ? parties.filter((s) => s.name.toLowerCase().includes(query)) : parties;
      return base.slice(0, 20).map((s) => ({ id: s.id, name: s.name }));
    }
    const base = query ? committees.filter((s) => s.name.toLowerCase().includes(query)) : committees;
    return base.slice(0, 20).map((s) => ({ id: s.id, name: s.name }));
  }, [searchQuery, recipientType, individuals, caucuses, parties, committees]);

  const handleSendLetter = async () => {
    if (!subject.trim() || !message.trim() || recipients.length === 0) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return navigate("/signin");

      const { data: pRow, error: pErr } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
      if (pErr) throw pErr;
      const classId = (pRow as any)?.class_id as string | null;
      if (!classId) {
        toast.error("No active class selected");
        return;
      }

      const recipientUserIds = new Set<string>();
      for (const r of recipients) {
        if (r.type === "individual") recipientUserIds.add(r.id);
        if (r.type === "caucus") {
          const { data } = await supabase.from("caucus_members").select("user_id").eq("caucus_id", r.id);
          for (const row of data ?? []) recipientUserIds.add((row as any).user_id);
        }
        if (r.type === "party") {
          const { data: partyRow } = await supabase.from("parties").select("name").eq("id", r.id).maybeSingle();
          const { data } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("class_id", classId)
            .eq("party", (partyRow as any)?.name ?? r.name);
          for (const row of data ?? []) recipientUserIds.add((row as any).user_id);
        }
        if (r.type === "committee") {
          const { data } = await supabase.from("committee_members").select("user_id").eq("committee_id", r.id);
          for (const row of data ?? []) recipientUserIds.add((row as any).user_id);
        }
      }
      recipientUserIds.delete(uid);
      const ids = Array.from(recipientUserIds);
      if (ids.length === 0) {
        toast.error("No recipients found for that selection");
        return;
      }

      const { data: letter, error: lErr } = await supabase
        .from("dear_colleague_letters")
        .insert({ class_id: classId, sender_user_id: uid, subject: subject.trim(), body: message } as any)
        .select("id")
        .single();
      if (lErr) throw lErr;

      const rows = ids.map((rid) => ({ letter_id: (letter as any).id, recipient_user_id: rid }));
      const { error: rErr } = await supabase.from("dear_colleague_recipients").insert(rows as any);
      if (rErr) throw rErr;

      toast.success("Letter sent");
      navigate("/dear-colleague/inbox");
    } catch (e: any) {
      toast.error(e.message || "Could not send letter");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Compose Dear Colleague Letter</h1>
          <p className="text-gray-600 mt-1">Send a message to your fellow representatives</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">To:</label>

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {recipients.map((recipient, index) => (
                  <div key={`${recipient.type}:${recipient.id}`} className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full">
                    {recipient.type === "individual" && recipient.image ? (
                      <img src={recipient.image} alt={recipient.name} className="w-5 h-5 rounded-full object-cover" />
                    ) : recipient.type === "individual" ? (
                      <DefaultAvatar className="w-5 h-5" iconClassName="w-3 h-3 text-blue-700" />
                    ) : null}
                    <span className="text-sm font-medium">
                      {recipient.name}
                      {recipient.district ? ` (${recipient.district})` : ""}
                    </span>
                    <button onClick={() => handleRemoveRecipient(index)} className="hover:bg-blue-200 rounded-full p-0.5 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mb-3">
              {(["individual", "party", "committee", "caucus"] as RecipientType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setRecipientType(t)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    recipientType === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t === "individual" ? "Individuals" : t === "party" ? "Parties" : t === "committee" ? "Committees" : "Caucuses"}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                placeholder={
                  loading
                    ? "Loading..."
                    : recipientType === "individual"
                      ? "Search members..."
                      : recipientType === "party"
                        ? "Search parties..."
                        : recipientType === "committee"
                          ? "Search committees..."
                          : "Search caucuses..."
                }
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />

              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {recipientType === "individual" ? (
                    filteredSuggestions.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() =>
                          handleAddRecipient({
                            type: "individual",
                            id: s.id,
                            name: s.name,
                            district: s.district ?? null,
                            image: s.image ?? null,
                          })
                        }
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        {s.image ? (
                          <img src={s.image} alt={s.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <DefaultAvatar className="w-8 h-8" iconClassName="w-4 h-4 text-gray-500" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{s.name}</div>
                          <div className="text-sm text-gray-600">{s.district || "N/A"}</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    filteredSuggestions.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => handleAddRecipient({ type: recipientType, id: s.id, name: s.name })}
                        className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="font-medium text-gray-900">{s.name}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Support for H.R. 12"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Message:</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Dear Colleague,\n\nI am writing to..."
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void handleSendLetter()}
              disabled={!subject.trim() || !message.trim() || recipients.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Send className="w-4 h-4" />
              Send Letter
            </button>
            <button onClick={() => navigate("/dashboard")} className="px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
