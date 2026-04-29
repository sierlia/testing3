import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { Building2, Users } from "lucide-react";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";
import { Link } from "react-router";
import { OrganizationsLayout } from "./OrganizationsLayout";

type CommitteeRow = { id: string; name: string; description: string | null; created_at: string };

export function CommitteesHome() {
  const [loading, setLoading] = useState(true);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) return;

        const { data: profile } = await supabase.from("profiles").select("class_id,role").eq("user_id", me).maybeSingle();
        const classId = (profile as any)?.class_id;
        setRole(((profile as any)?.role ?? null) as any);
        if (!classId) {
          setCommittees([]);
          return;
        }

        const { data: cls } = await supabase.from("classes").select("settings").eq("id", classId).maybeSingle();
        setSettings((cls as any)?.settings ?? {});

        const { data: rows, error } = await supabase
          .from("committees")
          .select("id,name,description,created_at")
          .order("created_at", { ascending: true });
        if (error) throw error;

        const enabled = ((cls as any)?.settings?.committees?.enabled ?? []) as string[];
        let finalRows = (rows ?? []) as any[];
        if (((profile as any)?.role === "teacher") && finalRows.length === 0 && enabled.length > 0) {
          const { data: seeded, error: sErr } = await supabase
            .from("committees")
            .insert(enabled.map((name) => ({ class_id: classId, name, description: "" })))
            .select("id,name,description,created_at");
          if (sErr) throw sErr;
          finalRows = (seeded ?? []) as any[];
          setCommittees(finalRows as any);
        } else {
          setCommittees(finalRows as any);
        }

        const ids = finalRows.map((r) => r.id);
        const { data: memRows } = await supabase
          .from("committee_members")
          .select("committee_id")
          .in("committee_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        const counts: Record<string, number> = {};
        for (const r of memRows ?? []) {
          const cid = (r as any).committee_id;
          counts[cid] = (counts[cid] ?? 0) + 1;
        }
        setMemberCounts(counts);
      } catch (e: any) {
        toast.error(e.message || "Could not load committees");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const items = useMemo(() => committees.map((c) => ({ ...c, memberCount: memberCounts[c.id] ?? 0 })), [committees, memberCounts]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrganizationsLayout active="committees">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Committees</h2>
            </div>
            {loading ? (
              <div className="text-sm text-gray-500">Loading committees…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-gray-500">No committees configured yet.</div>
            ) : (
              <div className="space-y-3">
                {items.map((c) => (
                  <div key={c.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                      {c.description ? <div className="text-sm text-gray-600 mt-1 line-clamp-2">{c.description}</div> : null}
                      <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" />
                        {c.memberCount} members
                      </div>
                    </div>
                    <Link to={`/committees/${c.id}`} className="text-sm text-blue-600 hover:underline whitespace-nowrap">
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </OrganizationsLayout>
      </main>
    </div>
  );
}
