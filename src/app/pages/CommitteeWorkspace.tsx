import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, ChevronRight, FileText, Pencil, Send, Sparkles, Vote } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { CollaborativeBillEditor } from "../components/CollaborativeBillEditor";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { CommitteeTabs, markCommitteeSeenIds, readCommitteeSeenIds, updateCommitteeTabCounts } from "../components/CommitteeTabs";
import { postCommitteeProgress, proposeBillForCommitteeVote } from "../services/bills";

type BillRow = {
  id: string;
  bill_number: number | null;
  title: string;
  legislative_text: string;
  author_user_id: string;
  status: string;
};

const workspaceCache = new Map<
  string,
  {
    classId: string | null;
    committeeName: string;
    myCommitteeRole: string | null;
    bills: Array<{ id: string; number: string; title: string; sponsor: string; legislativeHtml: string; status: string }>;
    selectedBillId: string | null;
  }
>();

export function CommitteeWorkspace() {
  const { id } = useParams();
  const committeeId = id!;

  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [myCommitteeRole, setMyCommitteeRole] = useState<string | null>(null);
  const [committeeName, setCommitteeName] = useState<string>("Committee");

  const [bills, setBills] = useState<Array<{ id: string; number: string; title: string; sponsor: string; legislativeHtml: string; status: string }>>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [seenBillIds, setSeenBillIds] = useState<Set<string>>(() => new Set());
  const [textView, setTextView] = useState<"edited" | "clean" | "original">("edited");
  const [billListOpen, setBillListOpen] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [postingProgress, setPostingProgress] = useState(false);
  const [activeEditors, setActiveEditors] = useState<
    Array<{ id: string; name: string; color: string; avatar_url: string | null }>
  >([]);
  const presenceChannelRef = useRef<any>(null);

  useEffect(() => {
    const load = async () => {
      const cached = workspaceCache.get(committeeId);
      if (cached) {
        setClassId(cached.classId);
        setCommitteeName(cached.committeeName);
        setMyCommitteeRole(cached.myCommitteeRole);
        setBills(cached.bills);
        setSelectedBillId((prev) => prev ?? cached.selectedBillId);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

        // Derive the class from the committee so deep-links/reloads still have a working my_class_id().
        const { data: committee, error: cErr } = await supabase.from("committees").select("name,class_id").eq("id", committeeId).maybeSingle();
        if (cErr) throw cErr;
        const cid = (committee as any)?.class_id ?? null;
        setCommitteeName((committee as any)?.name ?? "Committee");
        setClassId(cid);
        if (cid) {
          const desiredRole = (auth.user?.user_metadata as any)?.role === "teacher" ? "teacher" : "student";
          await supabase.from("profiles").upsert({ user_id: uid, class_id: cid, role: desiredRole, display_name: auth.user?.user_metadata?.name ?? null } as any);
        }
        if (!cid) return;

        const { data: myMembership } = await supabase
          .from("committee_members")
          .select("role")
          .eq("committee_id", committeeId)
          .eq("user_id", uid)
          .maybeSingle();
        setMyCommitteeRole((myMembership as any)?.role ?? null);

        const { data: refs, error: rErr } = await supabase.from("bill_referrals").select("bill_id").eq("committee_id", committeeId);
        if (rErr) throw rErr;
        const billIds = (refs ?? []).map((r: any) => r.bill_id);
        if (!billIds.length) {
          setBills([]);
          setSelectedBillId(null);
          return;
        }

        const { data: billRows, error: bErr } = await supabase
          .from("bills")
          .select("id,bill_number,title,legislative_text,author_user_id,status")
          .in("id", billIds)
          .eq("status", "in_committee")
          .order("bill_number", { ascending: true });
        if (bErr) throw bErr;

        const sponsorIds = Array.from(new Set((billRows ?? []).map((b: any) => b.author_user_id)));
        const { data: sponsors } = await supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", sponsorIds.length ? sponsorIds : ["00000000-0000-0000-0000-000000000000"]);
        const sponsorMap = new Map((sponsors ?? []).map((s: any) => [s.user_id, s.display_name]));

        const mapped = (billRows as any[]).map((b: BillRow) => ({
          id: b.id,
          number: `H.R. ${b.bill_number ?? ""}`.trim(),
          title: b.title,
          sponsor: sponsorMap.get(b.author_user_id) ?? "Member",
          legislativeHtml: b.legislative_text,
          status: b.status,
        }));
        setBills(mapped);
        const nextSelectedBillId = selectedBillId && mapped.some((bill) => bill.id === selectedBillId) ? selectedBillId : mapped[0]?.id ?? null;
        setSelectedBillId(nextSelectedBillId);
        workspaceCache.set(committeeId, {
          classId: cid,
          committeeName: (committee as any)?.name ?? "Committee",
          myCommitteeRole: (myMembership as any)?.role ?? null,
          bills: mapped,
          selectedBillId: nextSelectedBillId,
        });
      } catch (e: any) {
        toast.error(e.message || "Could not load committee workspace");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [committeeId]);

  const selected = bills.find((b) => b.id === selectedBillId) ?? null;

  useEffect(() => {
    setSeenBillIds(new Set(readCommitteeSeenIds(committeeId, "review")));
  }, [committeeId]);

  useEffect(() => {
    if (!selectedBillId) return;
    markCommitteeSeenIds(committeeId, "review", [selectedBillId]);
    setSeenBillIds(new Set(readCommitteeSeenIds(committeeId, "review")));
  }, [committeeId, selectedBillId]);

  const selectBill = (billId: string) => {
    setSelectedBillId(billId);
    const cached = workspaceCache.get(committeeId);
    if (cached) workspaceCache.set(committeeId, { ...cached, selectedBillId: billId });
    markCommitteeSeenIds(committeeId, "review", [billId]);
    setSeenBillIds(new Set(readCommitteeSeenIds(committeeId, "review")));
  };

  const proposeSelectedBillForVote = async () => {
    if (!selected) return;
    setProposing(true);
    try {
      await proposeBillForCommitteeVote(selected.id);
      setBills((prev) => {
        const next = prev.filter((bill) => bill.id !== selected.id);
        setSelectedBillId(next[0]?.id ?? null);
        const cached = workspaceCache.get(committeeId);
        if (cached) workspaceCache.set(committeeId, { ...cached, bills: next, selectedBillId: next[0]?.id ?? null });
        updateCommitteeTabCounts(committeeId, (current) => {
          const reviewIds = current.ids.review.filter((id) => id !== selected.id);
          const voteIds = Array.from(new Set([...current.ids.vote, selected.id]));
          return {
            counts: { ...current.counts, review: reviewIds.length, vote: voteIds.length },
            ids: { ...current.ids, review: reviewIds, vote: voteIds },
          };
        });
        return next;
      });
      toast.success("Bill proposed for committee vote");
    } catch (e: any) {
      toast.error(e.message || "Could not propose bill for vote");
    } finally {
      setProposing(false);
    }
  };

  const postSelectedBillProgress = async () => {
    if (!selected) return;
    setPostingProgress(true);
    try {
      await postCommitteeProgress(selected.id, committeeId);
      toast.success("Progress posted");
    } catch (e: any) {
      toast.error(e.message || "Could not post progress");
    } finally {
      setPostingProgress(false);
    }
  };

  useEffect(() => {
    if (!classId || !selectedBillId) {
      setActiveEditors([]);
      return;
    }

    let cancelled = false;
    const setupPresence = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

        const { data: profile } = await supabase.from("profiles").select("display_name,avatar_url").eq("user_id", uid).maybeSingle();
        const normalizedName = String((profile as any)?.display_name ?? auth.user?.user_metadata?.name ?? "").trim() || "Member";

        let color = "#2563eb";
        const { data: existingColor } = await supabase
          .from("committee_member_colors")
          .select("color")
          .eq("committee_id", committeeId)
          .eq("user_id", uid)
          .maybeSingle();
        if ((existingColor as any)?.color) {
          color = (existingColor as any).color;
        } else {
          const { data: assigned } = await supabase.rpc("ensure_committee_member_color", { target_committee: committeeId } as any);
          if (typeof assigned === "string" && assigned) color = assigned;
        }

        const self = {
          id: uid,
          name: normalizedName,
          color,
          avatar_url: (profile as any)?.avatar_url ?? null,
          online_at: new Date().toISOString(),
        };
        if (cancelled) return;
        if (!cancelled) setActiveEditors([self]);

        const channel = supabase.channel(`bill-presence:${committeeId}:${selectedBillId}`, {
          config: { presence: { key: uid } },
        });

        const syncPresence = () => {
          const state = channel.presenceState() as Record<string, Array<any>>;
          const editors = Object.values(state)
            .flat()
            .map((payload: any) => ({
              id: payload.id as string,
              name: String(payload.name || "").trim() || "Member",
              color: (payload.color as string) || "#2563eb",
              avatar_url: (payload.avatar_url as string | null | undefined) ?? null,
              online_at: payload.online_at as string | undefined,
            }))
            .filter((payload) => payload.id);

          const byUser = new Map<string, (typeof editors)[number]>();
          for (const editor of editors) byUser.set(editor.id, editor);
          const list = Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name));
          if (!cancelled) setActiveEditors(list.length ? list : [self]);
        };

        channel
          .on("presence", { event: "sync" }, syncPresence)
          .on("presence", { event: "join" }, syncPresence)
          .on("presence", { event: "leave" }, syncPresence)
          .subscribe(async (status) => {
            if (status !== "SUBSCRIBED" || cancelled) return;
            await channel.track(self);
            syncPresence();
          });

        presenceChannelRef.current = channel;
      } catch {
        if (!cancelled) setActiveEditors([]);
      }
    };

    void setupPresence();
    return () => {
      cancelled = true;
      const channel = presenceChannelRef.current;
      presenceChannelRef.current = null;
      if (channel) {
        void channel.untrack();
        void supabase.removeChannel(channel);
      }
    };
  }, [classId, committeeId, selectedBillId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{committeeName}</h1>
        </div>
        <div className="mb-6">
          <CommitteeTabs committeeId={committeeId} active="review" />
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : bills.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center text-gray-600">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            No bills have been referred to this committee yet.
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-6 ${billListOpen ? "lg:grid-cols-3" : "lg:grid-cols-[auto_1fr]"}`}>
            {billListOpen ? (
            <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-900">Referred Bills</div>
                  <button type="button" onClick={() => setBillListOpen(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs text-gray-500">{bills.length} total</div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {bills.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => selectBill(b.id)}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${
                      selectedBillId === b.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!seenBillIds.has(b.id) && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" aria-label="New bill" />}
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm font-semibold text-gray-900">{b.number}</div>
                        <div className="text-sm text-gray-700 line-clamp-2">{b.title}</div>
                    <div className="text-xs text-gray-500 mt-1">Sponsor: {b.sponsor}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            ) : (
              <button
                type="button"
                onClick={() => setBillListOpen(true)}
                className="h-fit rounded-lg border border-gray-200 bg-white p-3 text-gray-600 shadow-sm hover:bg-gray-50"
                aria-label="Open referred bills"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}

            <div className={`${billListOpen ? "lg:col-span-2" : ""} bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden`}>
              {selected && classId ? (
                <>
                  <div className="p-5 border-b border-gray-200">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="font-mono text-sm font-semibold text-gray-900">{selected.number}</div>
                        <div className="text-xl font-bold text-gray-900 mt-1">{selected.title}</div>
                        <div className="text-sm text-gray-600 mt-1">Sponsor: {selected.sponsor}</div>
                      </div>
                      <div className="sticky top-0 z-20 flex flex-col items-end gap-2 rounded-md bg-white/95 p-1 backdrop-blur">
                        {activeEditors.length > 0 && (
                          <div className="flex items-center gap-1.5 justify-end">
                            {activeEditors.map((u) => (
                              <Link
                                key={u.id}
                                to={`/profile/${u.id}`}
                                className="presence-avatar"
                                data-tooltip={u.name}
                                style={{ ["--presence-color" as any]: u.color }}
                              >
                                {u.avatar_url ? (
                                  <img
                                    src={u.avatar_url}
                                    className="w-8 h-8 rounded-full object-cover border-2"
                                    style={{ borderColor: u.color }}
                                  />
                                ) : (
                                  <DefaultAvatar className="w-8 h-8 border-2" style={{ borderColor: u.color }} />
                                )}
                              </Link>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap justify-end gap-2">
                          <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                            <button
                              type="button"
                              onClick={() => setTextView("edited")}
                              className={`inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium transition-colors ${
                                textView === "edited" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edited
                            </button>
                            <button
                              type="button"
                              onClick={() => setTextView("clean")}
                              className={`inline-flex items-center gap-1.5 border-l border-gray-300 px-2 py-1.5 text-xs font-medium transition-colors ${
                                textView === "clean" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Clean
                            </button>
                            <button
                              type="button"
                              onClick={() => setTextView("original")}
                              className={`inline-flex items-center gap-1.5 border-l border-gray-300 px-2 py-1.5 text-xs font-medium transition-colors ${
                                textView === "original" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Original
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => void postSelectedBillProgress()}
                            disabled={postingProgress}
                            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                            {postingProgress ? "Posting" : "Post progress"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void proposeSelectedBillForVote()}
                            disabled={proposing || selected.status !== "in_committee"}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Vote className="w-4 h-4" />
                            {selected.status === "committee_vote" ? "Proposed" : proposing ? "Proposing" : "Propose Vote"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 space-y-6">
                    <div>
                      <div className={textView === "original" ? "hidden" : ""}>
                        <CollaborativeBillEditor
                          classId={classId}
                          committeeId={committeeId}
                          billId={selected.id}
                          initialHtml={selected.legislativeHtml}
                          editable={textView === "edited"}
                          displayMode={textView === "clean" ? "clean" : "tracked"}
                        />
                      </div>
                      {textView === "original" && (
                        <div className="prose max-w-none min-h-[420px] p-4 rounded-md border border-gray-200 bg-gray-50">
                          <div dangerouslySetInnerHTML={{ __html: selected.legislativeHtml || "<p></p>" }} />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-sm text-gray-600">Select a bill.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
