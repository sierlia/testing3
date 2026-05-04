import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { FileText, Mail, Search } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { BackButton } from "../components/BackButton";
import { supabase } from "../utils/supabase";

type RecordItem = {
  id: string;
  type: "letter" | "report";
  title: string;
  subtitle: string;
  date: string;
  href: string;
  authorId?: string | null;
};

export function RecordsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const typeFilter = searchParams.get("type") ?? "all";
  const authorFilter = searchParams.get("author") ?? "";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return navigate("/signin");
      const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
      const classId = (profile as any)?.class_id;
      if (!classId) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const [{ data: letters }, { data: reports }] = await Promise.all([
        supabase.from("dear_colleague_letters").select("id,sender_user_id,subject,body,created_at").eq("class_id", classId).order("created_at", { ascending: false }),
        supabase
          .from("committee_bill_docs")
          .select("bill_id,committee_id,committee_report_submitted_at,bills(id,hr_label,title),committees(id,name)")
          .eq("class_id", classId)
          .not("committee_report_submitted_at", "is", null)
          .order("committee_report_submitted_at", { ascending: false }),
      ]);

      const senderIds = Array.from(new Set((letters ?? []).map((letter: any) => letter.sender_user_id).filter(Boolean)));
      const { data: profiles } = senderIds.length
        ? await supabase.from("profiles").select("user_id,display_name").in("user_id", senderIds)
        : ({ data: [] } as any);
      const profileMap = new Map((profiles ?? []).map((row: any) => [row.user_id, row.display_name ?? "Member"]));

      setRecords([
        ...(letters ?? []).map((letter: any) => ({
          id: letter.id,
          type: "letter" as const,
          title: letter.subject || "Dear Colleague Letter",
          subtitle: `From ${profileMap.get(letter.sender_user_id) ?? "Member"}`,
          date: letter.created_at,
          href: `/letters/${letter.id}`,
          authorId: letter.sender_user_id,
        })),
        ...(reports ?? []).map((report: any) => ({
          id: `${report.committee_id}:${report.bill_id}`,
          type: "report" as const,
          title: `${report.committees?.name ?? "Committee"} Report`,
          subtitle: `${report.bills?.hr_label ?? "Bill"} - ${report.bills?.title ?? ""}`,
          date: report.committee_report_submitted_at,
          href: `/committee/${report.committee_id}/reports/${report.bill_id}`,
          authorId: null,
        })),
      ]);
      setLoading(false);
    };
    void load();
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records
      .filter((record) => typeFilter === "all" || record.type === typeFilter)
      .filter((record) => !authorFilter || record.authorId === authorFilter)
      .filter((record) => !q || `${record.title} ${record.subtitle}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [authorFilter, query, records, typeFilter]);

  const setType = (type: string) => {
    const next = new URLSearchParams(searchParams);
    if (type === "all") next.delete("type");
    else next.set("type", type);
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <BackButton className="mb-4" />
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Records</h1>
          <p className="mt-1 text-gray-600">Search Dear Colleague letters and committee reports.</p>
        </div>
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="inline-flex rounded-md border border-gray-200 bg-white p-1">
              {["all", "letter", "report"].map((type) => (
                <button key={type} type="button" onClick={() => setType(type)} className={`rounded px-3 py-1.5 text-sm font-semibold capitalize ${typeFilter === type || (type === "all" && typeFilter === "all") ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>
                  {type === "letter" ? "Letters" : type === "report" ? "Reports" : "All"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-sm text-gray-500">Loading records...</div>
          ) : filtered.length ? (
            <div className="divide-y divide-gray-100">
              {filtered.map((record) => {
                const Icon = record.type === "letter" ? Mail : FileText;
                return (
                  <Link key={record.id} to={record.href} className="flex items-start gap-3 p-4 hover:bg-gray-50">
                    <Icon className="mt-0.5 h-5 w-5 text-blue-600" />
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{record.title}</div>
                      <div className="mt-1 text-sm text-gray-600">{record.subtitle}</div>
                      <div className="mt-1 text-xs text-gray-500">{new Date(record.date).toLocaleString()}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-sm text-gray-500">No records found.</div>
          )}
        </div>
      </main>
    </div>
  );
}
