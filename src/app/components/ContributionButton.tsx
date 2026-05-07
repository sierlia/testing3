import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
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
      note: note.trim(),
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
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Contribute to {recipientName}</h2>
            </div>
            <div className="space-y-3 p-5">
              <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <input type="number" min={1} value={amount} onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
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
