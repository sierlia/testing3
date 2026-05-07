import { useEffect, useState } from "react";
import { DollarSign, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";
import { getCurrentUser } from "../utils/currentUser";

type RecipientType = "member" | "party" | "committee" | "caucus";
type LobbyGroup = { id: string; name: string; class_id: string };

export function ContributionButton({ recipientType, recipientId, recipientName }: { recipientType: RecipientType; recipientId: string; recipientName: string }) {
  const [groups, setGroups] = useState<LobbyGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(50);
  const [note, setNote] = useState("");
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const uid = (await getCurrentUser())?.id;
      if (!uid) return;
      const { data: memberships } = await supabase.from("lobbyist_group_members").select("group_id,lobbyist_groups(id,name,class_id)").eq("user_id", uid);
      const next = ((memberships ?? []) as any[]).map((row) => row.lobbyist_groups).filter(Boolean);
      if (!cancelled) {
        setGroups(next);
        setGroupId(next[0]?.id ?? "");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const contribute = async () => {
    const uid = (await getCurrentUser())?.id;
    const group = groups.find((item) => item.id === groupId);
    if (!uid || !group) return;
    const { error } = await supabase.from("lobbyist_contributions").insert({
      class_id: group.class_id,
      group_id: group.id,
      from_user_id: uid,
      recipient_type: recipientType,
      recipient_id: recipientId,
      amount,
      note: note.trim().split(/\s+/).filter(Boolean).slice(0, 250).join(" "),
    } as any);
    if (error) return toast.error(error.message || "Could not contribute");
    toast.success("Contribution recorded");
    setOpen(false);
    setNote("");
  };

  if (!groups.length) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
        <DollarSign className="h-4 w-4" />
        Contribute
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Contribute to {recipientName}</h2>
                <p className="mt-1 text-sm text-gray-500">Record a campaign contribution from a lobbyist group.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Lobbyist group</span>
                <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500">
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Amount</span>
                <div className="relative">
                  <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input type="number" min={1} value={amount} onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))} className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Note</span>
                <textarea
                  value={note}
                  onChange={(event) => {
                    const words = event.target.value.trim().split(/\s+/).filter(Boolean);
                    setNote(words.length > 250 ? words.slice(0, 250).join(" ") : event.target.value);
                  }}
                  placeholder="Optional note"
                  rows={4}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="mt-1 block text-right text-xs text-gray-500">{note.trim().split(/\s+/).filter(Boolean).length}/250 words</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={() => void contribute()} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Contribute</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
