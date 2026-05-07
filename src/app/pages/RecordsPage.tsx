import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Eye, FileText, Mail, Search, SlidersHorizontal, Vote } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { InfoTooltip } from "../components/InfoTooltip";
import { supabase } from "../utils/supabase";
import { getCurrentUser } from "../utils/currentUser";

type VoteChoice = "yea" | "nay" | "present" | "not_voted";
type RecordType = "letter" | "report" | "vote";
type VoteList = Record<VoteChoice, Array<{ userId: string; name: string }>>;

type RecordItem = {
  id: string;
  type: RecordType;
  title: string;
  subtitle: string;
  date: string;
  href: string;
  authorId?: string | null;
  voteUserIds?: string[];
  votes?: VoteList;
};

const emptyVotes = (): VoteList => ({ yea: [], nay: [], present: [], not_voted: [] });

export function RecordsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") ?? "newest");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const typeFilter = (searchParams.get("type") ?? "all") as RecordType | "all";
  const userFilter = searchParams.get("user") ?? searchParams.get("author") ?? "";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const user = await getCurrentUser();
      const uid = user?.id;
      if (!uid) return navigate("/signin");
      const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
      const classId = (profile as any)?.class_id;
      if (!classId) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const [{ data: letters }, { data: reports }, { data: committeeDocs }, { data: committeeVotes }, { data: committeeMembers }, { data: floorSessions }, { data: floorVotes }, directory] = await Promise.all([
        supabase.from("dear_colleague_letters").select("id,sender_user_id,subject,body,created_at").eq("class_id", classId).order("created_at", { ascending: false }),
        supabase
          .from("committee_bill_docs")
          .select("bill_id,committee_id,committee_report_submitted_at,bills(id,hr_label,title),committees(id,name)")
          .eq("class_id", classId)
          .not("committee_report_submitted_at", "is", null)
          .order("committee_report_submitted_at", { ascending: false }),
        supabase
          .from("committee_bill_docs")
          .select("bill_id,committee_id,committee_vote_finalized_at,bills(id,hr_label,title),committees(id,name)")
          .eq("class_id", classId)
          .not("committee_vote_finalized_at", "is", null)
          .order("committee_vote_finalized_at", { ascending: false }),
        supabase.from("bill_committee_votes").select("bill_id,committee_id,user_id,vote").eq("class_id", classId),
        supabase.from("committee_members").select("committee_id,user_id"),
        supabase.from("bill_floor_sessions").select("id,bill_id,results_posted_at,closed_at,posted_result,bills(id,hr_label,title)").eq("class_id", classId).not("results_posted_at", "is", null),
        supabase.from("bill_floor_votes").select("session_id,bill_id,user_id,vote").eq("class_id", classId),
        supabase.rpc("class_directory", { target_class: classId } as any),
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
      for (const row of (committeeMembers ?? []) as any[]) {
        const current = committeeMemberMap.get(row.committee_id) ?? [];
        current.push(row.user_id);
        committeeMemberMap.set(row.committee_id, current);
      }

      const committeeVoteRecords = (committeeDocs ?? []).map((doc: any) => {
        const rows = (committeeVotes ?? []).filter((voteRow: any) => voteRow.bill_id === doc.bill_id && voteRow.committee_id === doc.committee_id);
        const memberIds = committeeMemberMap.get(doc.committee_id) ?? [...new Set(rows.map((row: any) => row.user_id))];
        const votes = voteListsFor(rows, memberIds);
        return {
          id: `committee-vote:${doc.committee_id}:${doc.bill_id}`,
          type: "vote" as const,
          title: `${doc.committees?.name ?? "Committee"} Vote`,
          subtitle: `${doc.bills?.hr_label ?? "Bill"} - ${doc.bills?.title ?? ""}`,
          date: doc.committee_vote_finalized_at,
          href: `/bills/${doc.bill_id}`,
          voteUserIds: rows.map((row: any) => row.user_id),
          votes,
        };
      });

      const floorVoteRecords = (floorSessions ?? []).map((session: any) => {
        const rows = (floorVotes ?? []).filter((voteRow: any) => voteRow.session_id === session.id);
        const votes = voteListsFor(rows, people.map((person) => person.user_id));
        return {
          id: `floor-vote:${session.id}`,
          type: "vote" as const,
          title: "Floor Vote",
          subtitle: `${session.bills?.hr_label ?? "Bill"} - ${session.bills?.title ?? ""}`,
          date: session.results_posted_at ?? session.closed_at,
          href: `/bills/${session.bill_id}`,
          voteUserIds: rows.map((row: any) => row.user_id),
          votes,
        };
      });

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
        ...committeeVoteRecords,
        ...floorVoteRecords,
      ]);
      setLoading(false);
    };
    void load();
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records
      .filter((record) => typeFilter === "all" || record.type === typeFilter)
      .filter((record) => !userFilter || record.authorId === userFilter || record.voteUserIds?.includes(userFilter))
      .filter((record) => !q || `${record.title} ${record.subtitle}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortBy === "oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "type") return a.type.localeCompare(b.type) || new Date(b.date).getTime() - new Date(a.date).getTime();
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [query, records, sortBy, typeFilter, userFilter]);

  const updateParam = (key: string, value: string, defaultValue = "") => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  const selectedRecord = filtered.find((record) => record.id === previewId) ?? filtered[0] ?? null;

  const voteLists = selectedRecord?.votes;
  const recordIcon = (type: RecordType) => type === "letter" ? Mail : type === "report" ? FileText : Vote;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900">Records</h1>
            <InfoTooltip label="What are records?">
              <p>The real Congressional Record is the official published account of congressional proceedings, debate, statements, and related materials. It gives the public a searchable history of what happened in Congress.</p>
              <p className="mt-2">In this simulation, Records collects letters, reports, and finalized vote records.</p>
            </InfoTooltip>
          </div>
        </div>
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records..." className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <SlidersHorizontal className="h-4 w-4 text-gray-400" />
                <select value={typeFilter} onChange={(event) => updateParam("type", event.target.value, "all")} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">All types</option>
                  <option value="letter">Letters</option>
                  <option value="report">Reports</option>
                  <option value="vote">Votes</option>
                </select>
              </label>
              <label className="ml-auto flex items-center gap-2 text-sm font-medium text-gray-700">
                Sort
                <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); updateParam("sort", event.target.value, "newest"); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="title">Title</option>
                  <option value="type">Type</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {loading ? (
              <div className="p-8 text-sm text-gray-500">Loading records...</div>
            ) : filtered.length ? (
              <div className="divide-y divide-gray-100">
                {filtered.map((record) => {
                  const Icon = recordIcon(record.type);
                  return (
                    <button key={record.id} type="button" onClick={() => setPreviewId(record.id)} className={`flex w-full items-start gap-3 p-4 text-left hover:bg-gray-50 ${selectedRecord?.id === record.id ? "bg-blue-50" : ""}`}>
                      <Icon className="mt-0.5 h-5 w-5 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900">{record.title}</div>
                        <div className="mt-1 text-sm text-gray-600">{record.subtitle}</div>
                        <div className="mt-1 text-xs text-gray-500">{new Date(record.date).toLocaleString()}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-sm text-gray-500">No records found.</div>
            )}
          </div>
          <aside className="self-start rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            {selectedRecord ? (
              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{selectedRecord.type}</div>
                    <h2 className="mt-1 text-lg font-semibold text-gray-900">{selectedRecord.title}</h2>
                    <div className="mt-1 text-sm text-gray-600">{selectedRecord.subtitle}</div>
                  </div>
                  <Link to={selectedRecord.href} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Eye className="h-4 w-4" />
                    Open
                  </Link>
                </div>
                {voteLists ? (
                  <div className="grid grid-cols-2 gap-3">
                    {(["yea", "nay", "present", "not_voted"] as VoteChoice[]).map((choice) => (
                      <div key={choice} className="rounded-md border border-gray-200">
                        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-gray-600">{choice.replace("_", " ")} ({voteLists[choice].length})</div>
                        <div className="max-h-36 overflow-y-auto p-2">
                          {voteLists[choice].length ? voteLists[choice].map((person) => <div key={person.userId} className="truncate rounded px-2 py-1 text-sm text-gray-700">{person.name}</div>) : <div className="px-2 py-1 text-sm text-gray-400">None</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Select Open to view the full record.</p>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Select a record to preview it.</div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
