import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, FileText, PlusCircle, Users } from "lucide-react";
import { Link } from "react-router";
import { supabase } from "../utils/supabase";

type QuickOrgLink = { id: string; name: string };
type PermissionLink = { label: string; href: string; icon: JSX.Element; count: number };

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white">
      {count}
    </span>
  );
}

export function QuickLinks({ classId }: { classId?: string }) {
  const [committees, setCommittees] = useState<QuickOrgLink[]>([]);
  const [caucuses, setCaucuses] = useState<QuickOrgLink[]>([]);
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [permissionLinks, setPermissionLinks] = useState<PermissionLink[]>([]);

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
      setRole((profile as any)?.role === "teacher" ? "teacher" : "student");

      if ((profile as any)?.role === "teacher") {
        setPermissionLinks([]);
        const [{ data: committeeRows }, { data: caucusRows }] = await Promise.all([
          supabase.from("committees").select("id,name").eq("class_id", targetClassId).order("name", { ascending: true }),
          supabase.from("caucuses").select("id,title").eq("class_id", targetClassId).order("title", { ascending: true }),
        ]);
        if (!cancelled) {
          setCommittees((committeeRows ?? []) as QuickOrgLink[]);
          setCaucuses((caucusRows ?? []).map((row: any) => ({ id: row.id, name: row.title })) as QuickOrgLink[]);
        }
        return;
      }

      const [{ data: committeeMemberships }, { data: caucusMemberships }, { data: cls }, { data: billRows }, { data: speakerVotes }] = await Promise.all([
        supabase.from("committee_members").select("committee_id").eq("user_id", uid),
        supabase.from("caucus_members").select("caucus_id").eq("user_id", uid),
        supabase.from("classes").select("settings").eq("id", targetClassId).maybeSingle(),
        supabase.from("bill_display").select("id,status").eq("class_id", targetClassId).in("status", ["submitted", "reported"]),
        supabase.from("class_speaker_votes").select("candidate_user_id").eq("class_id", targetClassId),
      ]);
      const committeeIds = (committeeMemberships ?? []).map((row: any) => row.committee_id).filter(Boolean);
      const caucusIds = (caucusMemberships ?? []).map((row: any) => row.caucus_id).filter(Boolean);
      const settings = (cls as any)?.settings ?? {};
      const voteCounts = new Map<string, number>();
      for (const vote of speakerVotes ?? []) {
        const candidateId = (vote as any).candidate_user_id;
        if (candidateId) voteCounts.set(candidateId, (voteCounts.get(candidateId) ?? 0) + 1);
      }
      const speakerId = [...voteCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const isSpeaker = Boolean(settings?.elections?.speakerConcluded && speakerId === uid);
      const waitingReferral = ((billRows ?? []) as any[]).filter((bill) => bill.status === "submitted").length;
      const waitingCalendar = ((billRows ?? []) as any[]).filter((bill) => bill.status === "reported").length;

      const [{ data: committeeRows }, { data: caucusRows }] = await Promise.all([
        committeeIds.length
          ? supabase.from("committees").select("id,name").eq("class_id", targetClassId).in("id", committeeIds).order("name", { ascending: true })
          : Promise.resolve({ data: [] } as any),
        caucusIds.length
          ? supabase.from("caucuses").select("id,title").eq("class_id", targetClassId).in("id", caucusIds).order("title", { ascending: true })
          : Promise.resolve({ data: [] } as any),
      ]);

      if (!cancelled) {
        setCommittees((committeeRows ?? []) as QuickOrgLink[]);
        setCaucuses((caucusRows ?? []).map((row: any) => ({ id: row.id, name: row.title })) as QuickOrgLink[]);
        setPermissionLinks([
          ...(isSpeaker && settings?.permissions?.speaker?.referBills
            ? [{ label: "Sort bills into committees", href: "/teacher/bill-sorting", icon: <FileText className="h-5 w-5" />, count: waitingReferral }]
            : []),
          ...(isSpeaker && settings?.permissions?.speaker?.calendarBills
            ? [{ label: "Calendar bills", href: "/calendar?schedule=1", icon: <CalendarDays className="h-5 w-5" />, count: waitingCalendar }]
            : []),
        ]);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const section = (label: string, icon: JSX.Element, items: QuickOrgLink[], hrefFor: (id: string) => string) => (
    <div className="border-t border-gray-200 pt-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span className="text-blue-600">{icon}</span>
        {label}
      </div>
      <div className="space-y-1">
        {items.length === 0 ? (
          <div className="px-3 py-1.5 text-sm text-gray-500">None yet</div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              to={hrefFor(item.id)}
              className="flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <span className="h-5 w-5 flex-shrink-0" />
              <span>{item.name}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Quick Links</h2>

      <div className="space-y-2">
        <Link
          to="/bills/create"
          className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
        >
          <div className="text-blue-600">
            <PlusCircle className="w-5 h-5" />
          </div>
          <span className="font-medium">Create Bill</span>
        </Link>
        <Link
          to={role === "teacher" ? "/teacher/assignments" : "/assignments"}
          className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
        >
          <div className="text-blue-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <span className="font-medium">Assignments</span>
        </Link>
        {permissionLinks.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
          >
            <div className="text-blue-600">{item.icon}</div>
            <span className="min-w-0 flex-1 whitespace-normal leading-tight">{item.label}</span>
            <CountBadge count={item.count} />
          </Link>
        ))}
        {section("Committees", <FileText className="h-4 w-4" />, committees, (id) => `/committees/${id}`)}
        {section("Caucuses", <Users className="h-4 w-4" />, caucuses, (id) => `/caucuses/${id}`)}
      </div>
    </div>
  );
}
