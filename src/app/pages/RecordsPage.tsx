import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ExternalLink, Eye, FileText, Mail, Newspaper, Plus, Search, Vote } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { InfoTooltip } from "../components/InfoTooltip";
import { CompactPager } from "../components/CompactPager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { supabase } from "../utils/supabase";
import { getCurrentUser } from "../utils/currentUser";
import { useAuth } from "../utils/AuthContext";

type VoteChoice = "yea" | "nay" | "present" | "not_voted";
type BaseRecordType = "letter" | "report" | "vote" | "newsletter";
type RowMode = "preview" | "open";
type SortKey = "newest" | "oldest" | "title" | "type";
type VoteList = Record<VoteChoice, Array<{ userId: string; name: string }>>;

type RecordItem = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  date: string;
  href: string;
  body?: string;
  authorId?: string | null;
  voteUserIds?: string[];
  votes?: VoteList;
  metadata?: any;
  generated?: boolean;
};

function FilterSelect({ value, onChange, children, className = "w-40" }: { value: string; onChange: (value: string) => void; children: ReactNode; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[140]">{children}</SelectContent>
    </Select>
  );
}

const emptyVotes = (): VoteList => ({ yea: [], nay: [], present: [], not_voted: [] });
const builtInTypes: BaseRecordType[] = ["letter", "report", "vote", "newsletter"];

function typeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function recordIcon(type: string) {
  if (type === "letter") return Mail;
  if (type === "vote") return Vote;
  if (type === "newsletter") return Newspaper;
  return FileText;
}

function statusRank(status: string) {
  const ranks: Record<string, number> = { draft: 0, submitted: 1, in_committee: 2, committee_vote: 3, reported: 4, calendared: 5, floor: 6, passed: 7, failed: 7 };
  return ranks[status] ?? 0;
}

function RecordPreviewPanel({ record }: { record: RecordItem }) {
  const Icon = recordIcon(record.type);
  const voteLists = record.votes;
  const newsletter = record.metadata?.newsletter;
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="bg-blue-600 p-4 text-white">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Icon className="h-4 w-4" />
            {typeLabel(record.type)}
          </span>
          <Link to={record.href}>
            <button className="rounded p-1 transition-colors hover:bg-blue-700">
              <ExternalLink className="h-4 w-4" />
            </button>
          </Link>
        </div>
        <h3 className="font-semibold">{record.title}</h3>
      </div>
      <div className="space-y-4 p-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <div className="font-medium text-gray-900">{record.subtitle}</div>
          <div className="mt-1 text-xs text-gray-500">{new Date(record.date).toLocaleString()}</div>
        </div>
        {voteLists ? (
          <div className="grid grid-cols-2 gap-3">
            {(["yea", "nay", "present", "not_voted"] as VoteChoice[]).map((choice) => (
              <div key={choice} className="rounded-md border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-gray-600">{choice.replace("_", " ")} ({voteLists[choice].length})</div>
                <div className="max-h-40 overflow-y-auto p-2">
                  {voteLists[choice].length ? voteLists[choice].map((person) => <div key={person.userId} className="truncate rounded px-2 py-1 text-sm text-gray-700">{person.name}</div>) : <div className="px-2 py-1 text-sm text-gray-400">None</div>}
                </div>
              </div>
            ))}
          </div>
        ) : newsletter ? (
          <div className="space-y-4 text-sm">
            <NewsletterSection title="Top Cosponsor Gains" rows={newsletter.cosponsorLeaders} />
            <NewsletterSection title="Fastest-Moving Bills" rows={newsletter.fastestMoving} />
            <NewsletterSection title="Passed Out of Committee" rows={newsletter.reportedBills} />
          </div>
        ) : (
          <div className="max-h-[520px] overflow-hidden whitespace-pre-line text-sm leading-6 text-gray-700">{record.body || "Select Open to view the full record."}</div>
        )}
        <Link to={record.href} className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
          <ExternalLink className="h-4 w-4" />
          View Full Record
        </Link>
      </div>
    </div>
  );
}

function NewsletterSection({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div>
      <h4 className="mb-2 font-semibold text-gray-900">{title}</h4>
      {rows?.length ? (
        <ol className="space-y-1">
          {rows.map((row, index) => (
            <li key={`${title}-${index}`} className="rounded bg-gray-50 px-3 py-2 text-gray-700">
              {index + 1}. {row.label} <span className="text-gray-500">{row.detail}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded bg-gray-50 px-3 py-2 text-gray-500">None</div>
      )}
    </div>
  );
}

export function RecordsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isTeacher = (user?.user_metadata as any)?.role === "teacher";
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordTypes, setRecordTypes] = useState<string[]>(["record"]);
  const [classId, setClassId] = useState<string | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sortBy, setSortBy] = useState<SortKey>((searchParams.get("sort") as SortKey) ?? "newest");
  const [rowMode, setRowMode] = useState<RowMode>("preview");
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") ?? "all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editorOpen, setEditorOpen] = useState(false);
  const [recordDraft, setRecordDraft] = useState({ title: "", type: "record", body: "" });
  const userFilter = searchParams.get("user") ?? searchParams.get("author") ?? "";

  const loadRecords = async () => {
    setLoading(true);
    const currentUser = await getCurrentUser();
    const uid = currentUser?.id;
    if (!uid) return navigate("/signin");
    const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
    const activeClassId = (profile as any)?.class_id;
    setClassId(activeClassId ?? null);
    if (!activeClassId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const { data: cls } = await supabase.from("classes").select("settings").eq("id", activeClassId).maybeSingle();
    const customTypes = (((cls as any)?.settings?.records?.types ?? ["record"]) as string[]).filter(Boolean);
    setRecordTypes(customTypes.length ? customTypes : ["record"]);

    const [{ data: customRecords }, { data: letters }, { data: reports }, { data: committeeDocs }, { data: committeeVotes }, { data: committeeMembers }, { data: floorSessions }, { data: floorVotes }, directory] = await Promise.all([
      supabase.from("custom_records").select("id,type,title,body,created_by,generated,metadata,created_at,updated_at").eq("class_id", activeClassId).order("created_at", { ascending: false }),
      supabase.from("dear_colleague_letters").select("id,sender_user_id,subject,body,created_at").eq("class_id", activeClassId).order("created_at", { ascending: false }),
      supabase
        .from("committee_bill_docs")
        .select("bill_id,committee_id,committee_report_submitted_at,bills(id,hr_label,title),committees(id,name)")
        .eq("class_id", activeClassId)
        .not("committee_report_submitted_at", "is", null)
        .order("committee_report_submitted_at", { ascending: false }),
      supabase
        .from("committee_bill_docs")
        .select("bill_id,committee_id,committee_vote_finalized_at,bills(id,hr_label,title),committees(id,name)")
        .eq("class_id", activeClassId)
        .not("committee_vote_finalized_at", "is", null)
        .order("committee_vote_finalized_at", { ascending: false }),
      supabase.from("bill_committee_votes").select("bill_id,committee_id,user_id,vote").eq("class_id", activeClassId),
      supabase.from("committee_members").select("committee_id,user_id"),
      supabase.from("bill_floor_sessions").select("id,bill_id,results_posted_at,closed_at,posted_result,bills(id,hr_label,title)").eq("class_id", activeClassId).not("results_posted_at", "is", null),
      supabase.from("bill_floor_votes").select("session_id,bill_id,user_id,vote").eq("class_id", activeClassId),
      supabase.rpc("class_directory", { target_class: activeClassId } as any),
    ]);

    const people = ((directory.data ?? []) as any[]).filter((person) => person.role !== "teacher");
    const peopleById = new Map(people.map((person) => [person.user_id, person.display_name ?? "Member"]));
    const senderIds = Array.from(new Set((letters ?? []).map((letter: any) => letter.sender_user_id).filter(Boolean)));
    const { data: profiles } = senderIds.length
      ? await supabase.from("profiles").select("user_id,display_name").in("user_id", senderIds)
      : ({ data: [] } as any);
    const profileMap = new Map((profiles ?? []).map((row: any) => [row.user_id, row.display_name ?? "Member"]));

    const voteListsFor = (rows: any[], memberIds: string[]) => {
      const lists = emptyVotes();
      const voted = new Set<string>();
      for (const row of rows) {
        const choice = row.vote as VoteChoice;
        voted.add(row.user_id);
        lists[choice].push({ userId: row.user_id, name: peopleById.get(row.user_id) ?? "Member" });
      }
      for (const memberId of memberIds) {
        if (!voted.has(memberId)) lists.not_voted.push({ userId: memberId, name: peopleById.get(memberId) ?? "Member" });
      }
      for (const choice of Object.keys(lists) as VoteChoice[]) lists[choice].sort((a, b) => a.name.localeCompare(b.name));
      return lists;
    };

    const committeeMemberMap = new Map<string, string[]>();
    for (const row of (committeeMembers ?? []) as any[]) committeeMemberMap.set(row.committee_id, [...(committeeMemberMap.get(row.committee_id) ?? []), row.user_id]);

    const nextRecords: RecordItem[] = [
      ...((customRecords ?? []) as any[]).map((record) => ({
        id: `custom:${record.id}`,
        type: record.type,
        title: record.title,
        subtitle: record.generated ? "Generated record" : "Teacher-created record",
        date: record.created_at,
        href: `/records?record=${record.id}`,
        body: record.body,
        authorId: record.created_by,
        metadata: record.metadata,
        generated: record.generated,
      })),
      ...(letters ?? []).map((letter: any) => ({
        id: `letter:${letter.id}`,
        type: "letter",
        title: letter.subject || "Dear Colleague Letter",
        subtitle: `From ${profileMap.get(letter.sender_user_id) ?? "Member"}`,
        date: letter.created_at,
        href: `/letters/${letter.id}`,
        body: letter.body,
        authorId: letter.sender_user_id,
      })),
      ...(reports ?? []).map((report: any) => ({
        id: `report:${report.committee_id}:${report.bill_id}`,
        type: "report",
        title: `${report.committees?.name ?? "Committee"} Report`,
        subtitle: `${report.bills?.hr_label ?? "Bill"} - ${report.bills?.title ?? ""}`,
        date: report.committee_report_submitted_at,
        href: `/committee/${report.committee_id}/reports/${report.bill_id}`,
        authorId: null,
      })),
      ...(committeeDocs ?? []).map((doc: any) => {
        const rows = (committeeVotes ?? []).filter((voteRow: any) => voteRow.bill_id === doc.bill_id && voteRow.committee_id === doc.committee_id);
        const memberIds = committeeMemberMap.get(doc.committee_id) ?? [...new Set(rows.map((row: any) => row.user_id))];
        return {
          id: `committee-vote:${doc.committee_id}:${doc.bill_id}`,
          type: "vote",
          title: `${doc.committees?.name ?? "Committee"} Vote`,
          subtitle: `${doc.bills?.hr_label ?? "Bill"} - ${doc.bills?.title ?? ""}`,
          date: doc.committee_vote_finalized_at,
          href: `/bills/${doc.bill_id}`,
          voteUserIds: rows.map((row: any) => row.user_id),
          votes: voteListsFor(rows, memberIds),
        };
      }),
      ...(floorSessions ?? []).map((session: any) => {
        const rows = (floorVotes ?? []).filter((voteRow: any) => voteRow.session_id === session.id);
        return {
          id: `floor-vote:${session.id}`,
          type: "vote",
          title: "Floor Vote",
          subtitle: `${session.bills?.hr_label ?? "Bill"} - ${session.bills?.title ?? ""}`,
          date: session.results_posted_at ?? session.closed_at,
          href: `/bills/${session.bill_id}`,
          voteUserIds: rows.map((row: any) => row.user_id),
          votes: voteListsFor(rows, people.map((person) => person.user_id)),
        };
      }),
    ];
    setRecords(nextRecords);
    const requestedRecordId = searchParams.get("record");
    setSelectedRecord((prev) => nextRecords.find((record) => record.id === `custom:${requestedRecordId}`) ?? prev ?? nextRecords[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, sortBy, typeFilter, pageSize]);

  const availableTypes = useMemo(() => Array.from(new Set([...builtInTypes, ...recordTypes, ...records.map((record) => record.type)])), [recordTypes, records]);
  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records
      .filter((record) => typeFilter === "all" || record.type === typeFilter)
      .filter((record) => !userFilter || record.authorId === userFilter || record.voteUserIds?.includes(userFilter))
      .filter((record) => !q || `${record.title} ${record.subtitle} ${record.body ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortBy === "oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "type") return typeLabel(a.type).localeCompare(typeLabel(b.type)) || new Date(b.date).getTime() - new Date(a.date).getTime();
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [query, records, sortBy, typeFilter, userFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const resultLabel = loading ? "Loading records..." : `${filteredRecords.length} records found`;

  const updateParam = (key: string, value: string, defaultValue = "") => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  const setType = (value: string) => {
    setTypeFilter(value);
    updateParam("type", value, "all");
  };

  const resetFilters = () => {
    setQuery("");
    setType("all");
    setSortBy("newest");
    updateParam("sort", "newest", "newest");
  };

  const handleRecordClick = (record: RecordItem) => {
    if (rowMode === "open") {
      navigate(record.href);
      if (record.href.startsWith("/records")) setSelectedRecord(record);
      return;
    }
    setSelectedRecord(record);
  };

  const createRecord = async () => {
    if (!classId || !recordDraft.title.trim()) return;
    const currentUser = await getCurrentUser();
    const { error } = await supabase.from("custom_records").insert({
      class_id: classId,
      title: recordDraft.title.trim(),
      type: recordDraft.type,
      body: recordDraft.body.trim(),
      created_by: currentUser?.id ?? null,
    } as any);
    if (error) throw error;
    setEditorOpen(false);
    setRecordDraft({ title: "", type: recordTypes[0] ?? "record", body: "" });
    await loadRecords();
  };

  const generateNewsletter = async () => {
    if (!classId) return;
    const currentUser = await getCurrentUser();
    const { data: last } = await supabase
      .from("custom_records")
      .select("created_at")
      .eq("class_id", classId)
      .eq("type", "newsletter")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const since = (last as any)?.created_at ?? "1970-01-01T00:00:00.000Z";
    const [{ data: cosponsors }, { data: bills }, { data: reports }, { data: votes }] = await Promise.all([
      supabase.from("bill_cosponsors").select("bill_id,created_at,bills(id,hr_label,title)").eq("class_id", classId).gt("created_at", since),
      supabase.from("bill_display").select("id,hr_label,title,status,created_at").eq("class_id", classId).gte("created_at", since),
      supabase
        .from("committee_bill_docs")
        .select("bill_id,committee_id,committee_report_submitted_at,bills(id,hr_label,title),committees(id,name)")
        .eq("class_id", classId)
        .gt("committee_report_submitted_at", since),
      supabase.from("bill_committee_votes").select("bill_id,committee_id,vote").eq("class_id", classId),
    ]);
    const cosponsorCounts = new Map<string, any>();
    for (const row of (cosponsors ?? []) as any[]) {
      const current = cosponsorCounts.get(row.bill_id) ?? { bill: row.bills, count: 0 };
      current.count += 1;
      cosponsorCounts.set(row.bill_id, current);
    }
    const cosponsorLeaders = [...cosponsorCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((row) => ({ label: `${row.bill?.hr_label ?? "Bill"} - ${row.bill?.title ?? ""}`, detail: `+${row.count} cosponsor${row.count === 1 ? "" : "s"}` }));
    const fastestMoving = ((bills ?? []) as any[])
      .sort((a, b) => statusRank(b.status) - statusRank(a.status))
      .slice(0, 10)
      .map((bill) => ({ label: `${bill.hr_label ?? "Bill"} - ${bill.title ?? ""}`, detail: `${statusRank(bill.status)} stage point${statusRank(bill.status) === 1 ? "" : "s"}` }));
    const reportedBills = ((reports ?? []) as any[]).map((report) => {
      const rows = ((votes ?? []) as any[]).filter((vote) => vote.bill_id === report.bill_id && vote.committee_id === report.committee_id);
      const counts = { yea: rows.filter((row) => row.vote === "yea").length, nay: rows.filter((row) => row.vote === "nay").length, present: rows.filter((row) => row.vote === "present").length };
      return {
        label: `${report.bills?.hr_label ?? "Bill"} - ${report.bills?.title ?? ""}`,
        detail: `${report.committees?.name ?? "Committee"}; ${counts.yea} yea, ${counts.nay} nay, ${counts.present} present`,
      };
    });
    const metadata = { newsletter: { since, cosponsorLeaders, fastestMoving, reportedBills } };
    const body = [
      "Top cosponsor gains",
      ...cosponsorLeaders.map((row, index) => `${index + 1}. ${row.label} ${row.detail}`),
      "",
      "Fastest-moving bills",
      ...fastestMoving.map((row, index) => `${index + 1}. ${row.label} ${row.detail}`),
      "",
      "Passed out of committee",
      ...reportedBills.map((row) => `${row.label} ${row.detail}`),
    ].join("\n");
    const { error } = await supabase.from("custom_records").insert({
      class_id: classId,
      type: "newsletter",
      title: `Newsletter - ${new Date().toLocaleDateString()}`,
      body,
      metadata,
      generated: true,
      created_by: currentUser?.id ?? null,
    } as any);
    if (error) throw error;
    await loadRecords();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">Records</h1>
              <InfoTooltip label="What are records?">
                <p>The real Congressional Record is the official published account of congressional proceedings, debate, statements, and related materials. It gives the public a searchable history of what happened in Congress.</p>
                <p className="mt-2">In this simulation, Records collects letters, reports, finalized vote records, newsletters, and teacher-created records.</p>
              </InfoTooltip>
            </div>
            <p className="text-gray-600">{resultLabel}</p>
          </div>
          {isTeacher && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void generateNewsletter()} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
                <Newspaper className="h-4 w-4" />
                Generate newsletter
              </button>
              <button type="button" onClick={() => setEditorOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700" aria-label="Add record">
                <Plus className="h-4 w-4" />
                Add record
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search title, type, author, or text..." value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-md border border-gray-300 py-3 pl-10 pr-3 text-base outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect value={typeFilter} onChange={setType}>
                  <SelectItem value="all">All types</SelectItem>
                  {availableTypes.map((type) => <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>)}
                </FilterSelect>
                <FilterSelect value={sortBy} onChange={(value) => { setSortBy(value as SortKey); updateParam("sort", value, "newest"); }}>
                  <SelectItem value="newest">Sort: Newest</SelectItem>
                  <SelectItem value="oldest">Sort: Oldest</SelectItem>
                  <SelectItem value="title">Sort: Title</SelectItem>
                  <SelectItem value="type">Sort: Type</SelectItem>
                </FilterSelect>
                <button onClick={resetFilters} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700">Reset</button>
              </div>
              <div className="flex rounded-md border border-gray-300 bg-white p-1 shadow-sm">
                <button type="button" onClick={() => setRowMode("preview")} className={`flex items-center justify-center gap-1 rounded px-3 py-1.5 text-sm font-medium ${rowMode === "preview" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
                <button type="button" onClick={() => setRowMode("open")} className={`flex items-center justify-center gap-1 rounded px-3 py-1.5 text-sm font-medium ${rowMode === "open" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>
                  <ExternalLink className="h-4 w-4" />
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-6 ${rowMode === "preview" ? "lg:grid-cols-3" : ""}`}>
          <div className={rowMode === "preview" ? "lg:col-span-2" : ""}>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {loading ? (
                <div className="py-12 text-center text-gray-500">Loading records...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No records found matching your criteria</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {pageRecords.map((record) => {
                    const Icon = recordIcon(record.type);
                    return (
                      <div
                        key={record.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleRecordClick(record)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") handleRecordClick(record);
                        }}
                        className={`block w-full p-4 text-left transition-colors hover:bg-gray-50 ${selectedRecord?.id === record.id && rowMode === "preview" ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                <Icon className="h-3.5 w-3.5" />
                                {typeLabel(record.type)}
                              </span>
                              {record.generated && <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">Generated</span>}
                            </div>
                            <h2 className="mb-2 text-base font-semibold text-gray-900">{record.title}</h2>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                              <span>{record.subtitle}</span>
                              <span className="text-gray-300">|</span>
                              <span>{new Date(record.date).toLocaleDateString()}</span>
                            </div>
                            {record.body && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{record.body}</p>}
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2 text-gray-400">
                            {rowMode === "preview" ? <FileText className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {!loading && filteredRecords.length > 0 && <CompactPager currentPage={currentPage} totalPages={totalPages} totalItems={filteredRecords.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
          </div>

          {rowMode === "preview" && (
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                {selectedRecord ? <RecordPreviewPanel record={selectedRecord} /> : <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm"><p className="text-gray-500">Select a record to preview</p></div>}
              </div>
            </div>
          )}
        </div>
      </main>

      {editorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Add record</h2>
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-md px-2 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100">Close</button>
            </div>
            <div className="space-y-4 p-5">
              <input value={recordDraft.title} onChange={(event) => setRecordDraft({ ...recordDraft, title: event.target.value })} placeholder="Record title" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <Select value={recordDraft.type} onValueChange={(type) => setRecordDraft({ ...recordDraft, type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[140]">
                  {recordTypes.map((type) => <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>)}
                </SelectContent>
              </Select>
              <textarea value={recordDraft.body} onChange={(event) => setRecordDraft({ ...recordDraft, body: event.target.value })} rows={10} placeholder="Record text" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={() => void createRecord()} disabled={!recordDraft.title.trim()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
