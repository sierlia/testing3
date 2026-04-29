import { useEffect, useMemo, useState } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../utils/AuthContext";
import { supabase } from "../utils/supabase";
import { SettingsLayout } from "./SettingsLayout";

type ToggleKey =
  | "party.new_announcement"
  | "party.replies"
  | "party.reactions"
  | "party.vote_open"
  | "committee.new_announcement"
  | "committee.replies"
  | "committee.reactions"
  | "committee.bill_referred"
  | "caucus.new_member_joined"
  | "caucus.new_announcement"
  | "caucus.replies"
  | "caucus.reactions";

type Prefs = Record<ToggleKey, boolean>;

const defaultPrefs: Prefs = {
  "party.new_announcement": true,
  "party.replies": true,
  "party.reactions": true,
  "party.vote_open": true,
  "committee.new_announcement": true,
  "committee.replies": true,
  "committee.reactions": true,
  "committee.bill_referred": true,
  "caucus.new_member_joined": false,
  "caucus.new_announcement": true,
  "caucus.replies": true,
  "caucus.reactions": true,
};

function mergePrefs(raw: any): Prefs {
  if (!raw || typeof raw !== "object") return { ...defaultPrefs };
  const out: any = { ...defaultPrefs };
  for (const key of Object.keys(defaultPrefs) as ToggleKey[]) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  return out as Prefs;
}

export function SettingsNotifications() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>({ ...defaultPrefs });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isCaucusLeader, setIsCaucusLeader] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const [{ data: pRow, error: pErr }, { data: leaderRows, error: lErr }] = await Promise.all([
          supabase.from("profiles").select("notification_prefs").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("caucus_members")
            .select("caucus_id")
            .eq("user_id", user.id)
            .in("role", ["chair", "co_chair"]),
        ]);
        if (pErr) throw pErr;
        if (lErr) throw lErr;
        setPrefs(mergePrefs((pRow as any)?.notification_prefs));
        setIsCaucusLeader((leaderRows ?? []).length > 0);
      } catch (e: any) {
        toast.error(e.message || "Could not load notification settings");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const sections = useMemo(
    () => [
      {
        title: "Party",
        items: [
          { key: "party.new_announcement" as const, label: "New announcements", description: "When your party posts an announcement" },
          { key: "party.replies" as const, label: "Replies", description: "When someone replies to a party announcement thread" },
          { key: "party.reactions" as const, label: "Reactions", description: "When someone reacts to a party announcement or comment" },
          { key: "party.vote_open" as const, label: "Vote open", description: "When a party vote opens" },
        ],
      },
      {
        title: "Committee",
        items: [
          { key: "committee.new_announcement" as const, label: "New announcements", description: "When your committee posts an announcement" },
          { key: "committee.replies" as const, label: "Replies", description: "When someone comments or replies in your committee" },
          { key: "committee.reactions" as const, label: "Reactions", description: "When someone reacts to a committee announcement or comment" },
          { key: "committee.bill_referred" as const, label: "Bill referred", description: "When a bill is referred to your committee" },
        ],
      },
      {
        title: "Caucus",
        items: [
          {
            key: "caucus.new_member_joined" as const,
            label: "New member joined",
            description: "Only applies if you are the chair or co-chair of a caucus",
            requiresLeader: true,
          },
          { key: "caucus.new_announcement" as const, label: "New announcements", description: "When one of your caucuses posts an announcement" },
          { key: "caucus.replies" as const, label: "Replies", description: "When someone comments or replies in your caucuses" },
          { key: "caucus.reactions" as const, label: "Reactions", description: "When someone reacts to a caucus announcement or comment" },
        ],
      },
    ],
    [],
  );

  const toggle = (key: ToggleKey) => setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    if (!user?.id) return;
    setSaveStatus("saving");
    try {
      const { error } = await supabase.from("profiles").update({ notification_prefs: prefs }).eq("user_id", user.id);
      if (error) throw error;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (e: any) {
      setSaveStatus("idle");
      toast.error(e.message || "Could not save preferences");
    }
  };

  return (
    <SettingsLayout>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-600">Choose what you want to be notified about</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sections.map((section) => (
              <div key={section.title} className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">{section.title}</h3>
                <div className="space-y-4">
                  {section.items.map((item) => {
                    const disabled = (item as any).requiresLeader ? !isCaucusLeader : false;
                    return (
                      <div key={item.key} className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{item.label}</div>
                          <div className="text-sm text-gray-600">{item.description}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(item.key)}
                          disabled={disabled}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            prefs[item.key] ? "bg-blue-600" : "bg-gray-200"
                          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              prefs[item.key] ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={save}
            disabled={saveStatus === "saving" || loading}
            className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium transition-all ${
              saveStatus === "saved" ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saveStatus === "saving" && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
            {saveStatus === "saved" && <Check className="w-4 h-4" />}
            {saveStatus === "idle" && "Save Preferences"}
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved!"}
          </button>
        </div>
      </div>
    </SettingsLayout>
  );
}

