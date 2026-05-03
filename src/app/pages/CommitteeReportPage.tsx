import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { CollaborativeBillEditor } from "../components/CollaborativeBillEditor";
import { supabase } from "../utils/supabase";

export function CommitteeReportPage() {
  const { id: committeeId, billId } = useParams();
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [committeeName, setCommitteeName] = useState("Committee");
  const [bill, setBill] = useState<{ id: string; hr_label: string; title: string; status: string } | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!committeeId || !billId) return;
      setLoading(true);
      try {
        const { data: committee, error: cErr } = await supabase.from("committees").select("name,class_id").eq("id", committeeId).maybeSingle();
        if (cErr) throw cErr;
        const cid = (committee as any)?.class_id ?? null;
        setClassId(cid);
        setCommitteeName((committee as any)?.name ?? "Committee");

        const { data: billRow, error: bErr } = await supabase
          .from("bill_display")
          .select("id,hr_label,title,status")
          .eq("id", billId)
          .maybeSingle();
        if (bErr) throw bErr;
        setBill((billRow as any) ?? null);

        const { data: doc } = await supabase
          .from("committee_bill_docs")
          .select("committee_report_submitted_at")
          .eq("committee_id", committeeId)
          .eq("bill_id", billId)
          .maybeSingle();
        setSubmittedAt((doc as any)?.committee_report_submitted_at ?? null);
      } catch (e: any) {
        toast.error(e.message || "Could not load committee report");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [committeeId, billId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : !committeeId || !billId || !classId || !bill ? (
          <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-600 shadow-sm">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            Committee report not found.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-gray-600">{committeeName}</div>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">{committeeName} Report</h1>
              <div className="mt-2 text-sm text-gray-600">
                <Link to={`/bills/${bill.id}`} className="font-medium text-blue-600 hover:underline">
                  {bill.hr_label}
                </Link>{" "}
                - {bill.title}
              </div>
              <div className="mt-2 text-xs text-gray-500">{submittedAt ? `Submitted ${new Date(submittedAt).toLocaleString()}` : "Work in progress"}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <CollaborativeBillEditor
                classId={classId}
                committeeId={committeeId}
                billId={billId}
                documentId={`${billId}:report`}
                storageColumn="committee_report_ydoc_base64"
                initialHtml="<p></p>"
                editable={bill.status === "committee_vote" && !submittedAt}
                trackDeletes={false}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
