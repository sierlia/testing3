import { useEffect, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Navigation } from "../components/Navigation";
import { DraggableCommitteeCard } from "../components/DraggableCommitteeCard";
import { GripVertical, Info } from "lucide-react";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";

interface Committee {
  id: string;
  name: string;
  description: string;
  meetingTime: string;
  notes?: string;
  tags: string[];
}

export function CommitteePreferences() {
  const [rankedCommittees, setRankedCommittees] = useState<Committee[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);

  const moveCommittee = (dragIndex: number, hoverIndex: number) => {
    const draggedCommittee = rankedCommittees[dragIndex];
    const newRanking = [...rankedCommittees];
    newRanking.splice(dragIndex, 1);
    newRanking.splice(hoverIndex, 0, draggedCommittee);
    setRankedCommittees(newRanking);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        const { data: prof } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
        const cid = (prof as any)?.class_id ?? null;
        setClassId(cid);
        if (!cid) return;

        const { data: cls } = await supabase.from("classes").select("settings").eq("id", cid).maybeSingle();
        const enabledNames = ((cls as any)?.settings?.committees?.enabled ?? []) as string[];
        const { data: committees } = await supabase.from("committees").select("id,name,description,created_at").order("created_at", { ascending: true });
        const eligible = (committees ?? []).filter((c: any) => enabledNames.length === 0 || enabledNames.includes(c.name));

        const { data: existingSub } = await supabase
          .from("committee_preference_submissions")
          .select("submitted_at")
          .eq("class_id", cid)
          .eq("user_id", uid)
          .maybeSingle();
        setSubmitted(!!existingSub);

        const { data: existingPrefs } = await supabase
          .from("committee_preferences")
          .select("committee_id,rank")
          .eq("class_id", cid)
          .eq("user_id", uid);
        const rankMap = new Map((existingPrefs ?? []).map((p: any) => [p.committee_id, p.rank]));

        const sorted = eligible
          .slice()
          .sort((a: any, b: any) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999) || a.name.localeCompare(b.name));

        setRankedCommittees(
          sorted.map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description || "No description provided.",
            meetingTime: "TBD",
            tags: [],
          })),
        );
      } catch (e: any) {
        toast.error(e.message || "Could not load committees");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSubmit = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || !classId) return;

      await supabase.from("committee_preferences").delete().eq("class_id", classId).eq("user_id", uid);
      const rows = rankedCommittees.map((c, idx) => ({ class_id: classId, user_id: uid, committee_id: c.id, rank: idx + 1 }));
      const { error: insErr } = await supabase.from("committee_preferences").insert(rows);
      if (insErr) throw insErr;

      const { error: subErr } = await supabase
        .from("committee_preference_submissions")
        .upsert({ class_id: classId, user_id: uid, submitted_at: new Date().toISOString() } as any);
      if (subErr) throw subErr;

      setSubmitted(true);
      toast.success("Preferences submitted");
    } catch (e: any) {
      toast.error(e.message || "Could not submit preferences");
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Committee Preferences</h1>
            <p className="text-gray-600">
              Drag and drop to rank committees in order of preference (1st choice at top)
            </p>
          </div>

          {submitted && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 mb-1">Preferences Submitted!</h3>
                <p className="text-sm text-green-700">
                  Your committee preferences have been recorded. Your teacher will assign committees soon.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
              <GripVertical className="w-4 h-4" />
              <span>Drag to reorder your preferences</span>
            </div>

            <div className="space-y-3">
              {rankedCommittees.map((committee, index) => (
                <DraggableCommitteeCard
                  key={committee.id}
                  committee={committee}
                  index={index}
                  moveCommittee={moveCommittee}
                  rank={index + 1}
                  disabled={submitted}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {rankedCommittees.length} eligible committees
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitted || loading || rankedCommittees.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitted ? "Submitted" : "Submit Preferences"}
            </button>
          </div>
        </main>
      </div>
    </DndProvider>
  );
}
