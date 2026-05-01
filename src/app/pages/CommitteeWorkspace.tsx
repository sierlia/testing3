import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { CheckCircle2, FileText, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { supabase } from "../utils/supabase";
import { CollaborativeBillEditor } from "../components/CollaborativeBillEditor";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { YjsSupabaseProvider } from "../utils/yjsSupabaseProvider";

type BillRow = {
  id: string;
  hr_label: string;
  title: string;
  legislative_text: string;
  author_user_id: string;
};

export function CommitteeWorkspace() {
  const { id } = useParams();
  const committeeId = id!;

  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [committeeName, setCommitteeName] = useState<string>("Committee");

  const [bills, setBills] = useState<Array<{ id: string; number: string; title: string; sponsor: string; legislativeHtml: string }>>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [textView, setTextView] = useState<"edited" | "original">("edited");
  const [reportDraft, setReportDraft] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [activeEditors, setActiveEditors] = useState<
    Array<{ id: string; name: string; color: string; avatar_url: string | null }>
  >([]);
  const presenceRef = useRef<{ provider: YjsSupabaseProvider; doc: Y.Doc; awareness: Awareness } | null>(null);
  const presenceEmitSeqRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
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

        const { data: refs, error: rErr } = await supabase.from("bill_referrals").select("bill_id").eq("committee_id", committeeId);
        if (rErr) throw rErr;
        const billIds = (refs ?? []).map((r: any) => r.bill_id);
        if (!billIds.length) {
          setBills([]);
          setSelectedBillId(null);
          return;
        }

        const { data: billRows, error: bErr } = await supabase
          .from("bill_display")
          .select("id,hr_label,title,legislative_text,author_user_id")
          .in("id", billIds)
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
          number: b.hr_label,
          title: b.title,
          sponsor: sponsorMap.get(b.author_user_id) ?? "Member",
          legislativeHtml: b.legislative_text,
        }));
        setBills(mapped);
        setSelectedBillId(mapped[0]?.id ?? null);
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
    if (!selectedBillId || !classId) {
      setReportDraft("");
      return;
    }

    let cancelled = false;
    const loadReport = async () => {
      setReportLoading(true);
      setReportSaved(false);
      try {
        const { data, error } = await supabase
          .from("committee_bill_docs")
          .select("committee_report")
          .eq("committee_id", committeeId)
          .eq("bill_id", selectedBillId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setReportDraft((data as any)?.committee_report ?? "");
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || "Could not load committee report");
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [classId, committeeId, selectedBillId]);

  const saveReport = async () => {
    if (!selected || !classId) return;
    setReportSaving(true);
    setReportSaved(false);
    try {
      const { error } = await supabase.from("committee_bill_docs").upsert(
        {
          bill_id: selected.id,
          committee_id: committeeId,
          class_id: classId,
          committee_report: reportDraft,
        } as any,
        { onConflict: "bill_id,committee_id" },
      );
      if (error) throw error;
      setReportSaved(true);
      toast.success("Committee report saved");
    } catch (e: any) {
      toast.error(e.message || "Could not save committee report");
    } finally {
      setReportSaving(false);
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

        // Get display name + stable per-committee color for awareness metadata.
        const { data: p } = await supabase.from("profiles").select("display_name").eq("user_id", uid).maybeSingle();
        const name = (p as any)?.display_name ?? auth.user?.user_metadata?.name ?? "Member";
        const normalizedName = String(name || "").trim() || "Member";
        let color = "#2563eb";
        try {
          const { data: row } = await supabase
            .from("committee_member_colors")
            .select("color")
            .eq("committee_id", committeeId)
            .eq("user_id", uid)
            .maybeSingle();
          if ((row as any)?.color) color = (row as any).color as string;
        } catch {}
        if (!color || color === "#2563eb") {
          try {
            const { data: assigned } = await supabase.rpc("ensure_committee_member_color", { target_committee: committeeId } as any);
            if (typeof assigned === "string" && assigned) color = assigned;
          } catch {
            // ignore
          }
        }

        // Tear down any previous presence connection for a different bill.
        presenceRef.current?.provider.destroy();
        presenceRef.current?.doc.destroy();
        presenceRef.current = null;

        const doc = new Y.Doc();
        const awareness = new Awareness(doc);
        const provider = new YjsSupabaseProvider(
          { doc, awareness, key: { classId, committeeId, billId: selectedBillId }, user: { id: uid, name: normalizedName, color } },
          undefined,
        );
        presenceRef.current = { provider, doc, awareness };

        const emit = async () => {
          const seq = ++presenceEmitSeqRef.current;
          const states = awareness.getStates();
          const map = new Map<string, { id: string; name: string; color: string }>();
          for (const [, st] of states.entries()) {
            const u = (st as any)?.user as { id?: string; name?: string; color?: string } | undefined;
            if (!u?.id) continue;
            map.set(u.id, { id: u.id, name: u.name ?? "Member", color: u.color ?? "#2563eb" });
          }
          const users = Array.from(map.values());
          if (!users.length) {
            if (!cancelled && seq === presenceEmitSeqRef.current) setActiveEditors([]);
            return;
          }

          // First paint quickly from awareness; then enrich with avatar urls.
          if (!cancelled && seq === presenceEmitSeqRef.current) {
            setActiveEditors(
              users
                .map((u) => ({ id: u.id, name: u.name ?? "Member", color: u.color, avatar_url: null }))
                .sort((a, b) => a.name.localeCompare(b.name)),
            );
          }

          const ids = users.map((u) => u.id);
          const { data } = await supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", ids);
          const pMap = new Map((data ?? []).map((row: any) => [row.user_id, row]));
          if (cancelled || seq !== presenceEmitSeqRef.current) return;
          setActiveEditors(
            users
              .map((u) => ({
                id: u.id,
                name: (pMap.get(u.id) as any)?.display_name ?? u.name ?? "Member",
                color: u.color,
                avatar_url: (pMap.get(u.id) as any)?.avatar_url ?? null,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        };

        await emit();
        const onChange = () => void emit();
        awareness.on("change", onChange);
        // Ensure we remove listener when we tear down this presence doc.
        (presenceRef.current as any).__onChange = onChange;
      } catch (e: any) {
        if (!cancelled) setActiveEditors([]);
      }
    };

    void setupPresence();
    return () => {
      cancelled = true;
      presenceEmitSeqRef.current++;
      const cur: any = presenceRef.current;
      if (cur?.awareness && cur?.__onChange) {
        try {
          cur.awareness.off("change", cur.__onChange);
        } catch {}
      }
      presenceRef.current?.provider.destroy();
      presenceRef.current?.doc.destroy();
      presenceRef.current = null;
    };
  }, [classId, committeeId, selectedBillId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{committeeName} Workspace</h1>
          <p className="text-gray-600">Live, collaborative bill text editing</p>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : bills.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center text-gray-600">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            No bills have been referred to this committee yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="text-sm font-semibold text-gray-900">Referred Bills</div>
                <div className="text-xs text-gray-500">{bills.length} total</div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {bills.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBillId(b.id)}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${
                      selectedBillId === b.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="font-mono text-sm font-semibold text-gray-900">{b.number}</div>
                    <div className="text-sm text-gray-700 line-clamp-2">{b.title}</div>
                    <div className="text-xs text-gray-500 mt-1">Sponsor: {b.sponsor}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {selected && classId ? (
                <>
                  <div className="p-5 border-b border-gray-200">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="font-mono text-sm font-semibold text-gray-900">{selected.number}</div>
                        <div className="text-xl font-bold text-gray-900 mt-1">{selected.title}</div>
                        <div className="text-sm text-gray-600 mt-1">Sponsor: {selected.sponsor}</div>
                      </div>
                      <div className="flex items-center gap-3">
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
                                  <div className="w-8 h-8 rounded-full bg-gray-100 border-2" style={{ borderColor: u.color }} />
                                )}
                              </Link>
                            ))}
                          </div>
                        )}

                        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setTextView("edited")}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                              textView === "edited" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <Pencil className="w-4 h-4" />
                            Edited Text
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextView("original")}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                              textView === "original" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            Original Text
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 space-y-6">
                    <div>
                      {textView === "edited" ? (
                        <CollaborativeBillEditor
                          classId={classId}
                          committeeId={committeeId}
                          billId={selected.id}
                          initialHtml={selected.legislativeHtml}
                          editable
                        />
                      ) : (
                        <div className="prose max-w-none min-h-[420px] p-4 rounded-md border border-gray-200 bg-gray-50">
                          <div dangerouslySetInnerHTML={{ __html: selected.legislativeHtml || "<p></p>" }} />
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-3">
                        {textView === "edited"
                          ? "Changes sync live to other committee members and are persisted in Supabase."
                          : "Original bill text is read-only."}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-5">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Committee Report</h3>
                          <p className="text-sm text-gray-600">Draft the committee's recommendation, findings, or notes for this bill.</p>
                        </div>
                        {reportSaved && (
                          <div className="inline-flex items-center gap-1.5 text-sm text-green-700">
                            <CheckCircle2 className="w-4 h-4" />
                            Saved
                          </div>
                        )}
                      </div>
                      <textarea
                        value={reportDraft}
                        onChange={(e) => {
                          setReportDraft(e.target.value);
                          setReportSaved(false);
                        }}
                        disabled={reportLoading}
                        rows={7}
                        placeholder="Write the committee report..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y disabled:bg-gray-50 disabled:text-gray-500"
                      />
                      <div className="flex justify-end mt-3">
                        <button
                          type="button"
                          onClick={() => void saveReport()}
                          disabled={reportSaving || reportLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
                        >
                          <Save className="w-4 h-4" />
                          {reportSaving ? "Saving" : "Save Report"}
                        </button>
                      </div>
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
