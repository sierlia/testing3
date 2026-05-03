import { useEffect, useState } from "react";
import { FileText, PlusCircle, Users } from "lucide-react";
import { Link } from "react-router";
import { supabase } from "../utils/supabase";

type QuickOrgLink = { id: string; name: string };

export function QuickLinks({ classId }: { classId?: string }) {
  const [committees, setCommittees] = useState<QuickOrgLink[]>([]);
  const [caucuses, setCaucuses] = useState<QuickOrgLink[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role,class_id")
        .eq("user_id", uid)
        .maybeSingle();
      const targetClassId = classId ?? ((profile as any)?.class_id as string | undefined);
      if (!targetClassId) return;

      if ((profile as any)?.role === "teacher") {
        const [{ data: committeeRows }, { data: caucusRows }] = await Promise.all([
          supabase.from("committees").select("id,name").eq("class_id", targetClassId).order("name", { ascending: true }),
          supabase.from("caucuses").select("id,name").eq("class_id", targetClassId).order("name", { ascending: true }),
        ]);
        if (!cancelled) {
          setCommittees((committeeRows ?? []) as QuickOrgLink[]);
          setCaucuses((caucusRows ?? []) as QuickOrgLink[]);
        }
        return;
      }

      const [{ data: committeeMemberships }, { data: caucusMemberships }] = await Promise.all([
        supabase.from("committee_members").select("committee_id").eq("user_id", uid),
        supabase.from("caucus_members").select("caucus_id").eq("user_id", uid),
      ]);
      const committeeIds = (committeeMemberships ?? []).map((row: any) => row.committee_id).filter(Boolean);
      const caucusIds = (caucusMemberships ?? []).map((row: any) => row.caucus_id).filter(Boolean);

      const [{ data: committeeRows }, { data: caucusRows }] = await Promise.all([
        committeeIds.length
          ? supabase.from("committees").select("id,name").eq("class_id", targetClassId).in("id", committeeIds).order("name", { ascending: true })
          : Promise.resolve({ data: [] } as any),
        caucusIds.length
          ? supabase.from("caucuses").select("id,name").eq("class_id", targetClassId).in("id", caucusIds).order("name", { ascending: true })
          : Promise.resolve({ data: [] } as any),
      ]);

      if (!cancelled) {
        setCommittees((committeeRows ?? []) as QuickOrgLink[]);
        setCaucuses((caucusRows ?? []) as QuickOrgLink[]);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const section = (label: string, icon: JSX.Element, items: QuickOrgLink[], hrefFor: (id: string) => string) => (
    <div className="border-t border-gray-200 pt-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span className="text-blue-600">{icon}</span>
        {label}
      </div>
      <div className="space-y-1">
        {items.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500">None yet</div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              to={hrefFor(item.id)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              {item.name}
            </Link>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>

      <div className="space-y-4">
        <Link
          to="/bills/create"
          className="flex items-center gap-3 rounded-md border border-transparent px-4 py-3 text-gray-700 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
        >
          <div className="text-blue-600">
            <PlusCircle className="w-5 h-5" />
          </div>
          <span className="font-medium">Create Bill</span>
        </Link>
        {section("Committees", <Users className="h-4 w-4" />, committees, (id) => `/committees/${id}`)}
        {section("Caucuses", <FileText className="h-4 w-4" />, caucuses, (id) => `/caucuses/${id}`)}
      </div>
    </div>
  );
}
