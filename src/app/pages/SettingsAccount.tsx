import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, KeyRound, Mail, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsLayout } from "./SettingsLayout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { supabase } from "../utils/supabase";

type DeletionRequest = {
  user_id: string;
  email: string | null;
  status: "pending" | "cancelled" | "completed";
  requested_at: string;
  delete_after: string;
  cancelled_at: string | null;
  completed_at: string | null;
  email_notice_status: "queued" | "sent" | "failed";
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function normalizeRpcRow<T>(value: any): T | null {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return (value ?? null) as T | null;
}

function section(title: string, body: string) {
  return `<h2>${escapeHtml(title)}</h2>${body || "<p>No entries.</p>"}`;
}

function paragraphs(items: string[]) {
  if (!items.length) return "";
  return items.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
}

export function SettingsAccount() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [deletionBusy, setDeletionBusy] = useState(false);

  const pendingDeletion = useMemo(() => deletionRequest?.status === "pending" ? deletionRequest : null, [deletionRequest]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return;
      setEmail(user.email ?? "");
      const { data, error } = await supabase
        .from("account_deletion_requests")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      setDeletionRequest((data as DeletionRequest | null) ?? null);
    } catch (error: any) {
      toast.error(error.message || "Could not load account settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveEmail = async (event: FormEvent) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) return toast.error("Enter an email address.");
    setSavingEmail(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.email === nextEmail) {
        toast.info("That email is already on your account.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      toast.success("Email change started. Check your inbox to confirm it.");
    } catch (error: any) {
      toast.error(error.message || "Could not update email");
    } finally {
      setSavingEmail(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (error: any) {
      toast.error(error.message || "Could not update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const downloadWorkDoc = async () => {
    setExporting(true);
    const warnings: string[] = [];
    const runQuery = async <T,>(label: string, query: PromiseLike<{ data: T | null; error: any }>, fallback: T): Promise<T> => {
      const result = await query;
      if (result.error) {
        warnings.push(`${label}: ${result.error.message ?? "unavailable"}`);
        return fallback;
      }
      return result.data ?? fallback;
    };

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return toast.error("Sign in to export your work.");

      const [profile, memberships, authoredBills, letters, submissions, preferences] = await Promise.all([
        runQuery("Profile", supabase.from("profiles").select("display_name,party,constituency_name,written_responses,class_id").eq("user_id", user.id).maybeSingle(), null as any),
        runQuery("Classes", supabase.from("class_memberships").select("class_id,status,classes(name,class_code)").eq("user_id", user.id), [] as any[]),
        runQuery("Bills", supabase.from("bill_display").select("id,hr_label,title,status,created_at,legislative_text,supporting_text,class_id").eq("author_user_id", user.id).order("created_at", { ascending: false }), [] as any[]),
        runQuery("Dear Colleague letters", supabase.from("dear_colleague_letters").select("id,subject,body,created_at,class_id").eq("sender_user_id", user.id).order("created_at", { ascending: false }), [] as any[]),
        runQuery("Assignment submissions", supabase.from("assignment_submissions").select("id,assignment_id,class_id,body,attachments,auto_scores,manual_score,manual_feedback,status,submitted_at,returned_at").eq("student_user_id", user.id).order("submitted_at", { ascending: false, nullsFirst: false }), [] as any[]),
        runQuery("Committee preferences", supabase.from("committee_preference_submissions").select("class_id,submitted_at").eq("user_id", user.id).order("submitted_at", { ascending: false }), [] as any[]),
      ]);

      const assignmentIds = submissions.map((submission: any) => submission.assignment_id).filter(Boolean);
      const assignmentRows = assignmentIds.length
        ? await runQuery("Assignment titles", supabase.from("class_tasks").select("id,title,due_at").in("id", assignmentIds), [] as any[])
        : [];
      const assignmentMap = new Map(assignmentRows.map((row: any) => [row.id, row]));

      const profileResponses = (profile as any)?.written_responses && typeof (profile as any).written_responses === "object"
        ? Object.entries((profile as any).written_responses).map(([key, value]) => `<h3>${escapeHtml(key)}</h3><p>${escapeHtml(value)}</p>`).join("")
        : "";

      const classBody = (memberships as any[]).map((membership) => {
        const cls = membership.classes;
        return `<p><strong>${escapeHtml(cls?.name ?? "Class")}</strong> (${escapeHtml(membership.status ?? "approved")})<br/>Code: ${escapeHtml(cls?.class_code ?? "N/A")}</p>`;
      }).join("");

      const billBody = (authoredBills as any[]).map((bill) => `
        <h3>${escapeHtml(bill.hr_label ?? "Bill")}: ${escapeHtml(bill.title)}</h3>
        <p>Status: ${escapeHtml(String(bill.status ?? "").replace(/_/g, " "))}<br/>Created: ${escapeHtml(formatDate(bill.created_at))}</p>
        <p><strong>Legislative text</strong></p>
        <p>${escapeHtml(bill.legislative_text)}</p>
        ${bill.supporting_text ? `<p><strong>Supporting text</strong></p><p>${escapeHtml(bill.supporting_text)}</p>` : ""}
      `).join("");

      const letterBody = (letters as any[]).map((letter) => `
        <h3>${escapeHtml(letter.subject || "Untitled letter")}</h3>
        <p>Sent: ${escapeHtml(formatDate(letter.created_at))}</p>
        <p>${escapeHtml(letter.body)}</p>
      `).join("");

      const submissionBody = (submissions as any[]).map((submission) => {
        const task = assignmentMap.get(submission.assignment_id);
        const attachments = Array.isArray(submission.attachments) ? submission.attachments : [];
        return `
          <h3>${escapeHtml(task?.title ?? "Assignment")}</h3>
          <p>Status: ${escapeHtml(submission.status ?? "submitted")}<br/>Submitted: ${escapeHtml(formatDate(submission.submitted_at))}<br/>Returned: ${escapeHtml(formatDate(submission.returned_at))}</p>
          <p>${escapeHtml(submission.body)}</p>
          ${submission.manual_score != null ? `<p>Score: ${escapeHtml(submission.manual_score)}</p>` : ""}
          ${submission.manual_feedback ? `<p>Feedback: ${escapeHtml(submission.manual_feedback)}</p>` : ""}
          ${attachments.length ? `<p>Attachments: ${escapeHtml(attachments.map((item: any) => item.label ?? item.id).join(", "))}</p>` : ""}
        `;
      }).join("");

      const preferenceBody = (preferences as any[]).map((preference) => `<p>Submitted: ${escapeHtml(formatDate(preference.submitted_at))}</p>`).join("");

      const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Gavel Work Export</title>
            <style>
              body { font-family: Arial, sans-serif; color: #111827; line-height: 1.45; }
              h1 { font-size: 24pt; }
              h2 { border-bottom: 1px solid #d1d5db; font-size: 16pt; margin-top: 24px; padding-bottom: 6px; }
              h3 { font-size: 12pt; margin-top: 16px; }
              p { font-size: 10.5pt; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <h1>Gavel Work Export</h1>
            <p>Exported: ${escapeHtml(formatDate(new Date().toISOString()))}</p>
            ${section("Account", paragraphs([
              `Name: ${(profile as any)?.display_name ?? "N/A"}`,
              `Email: ${user.email ?? "N/A"}`,
              `Party: ${(profile as any)?.party ?? "N/A"}`,
              `Constituency: ${(profile as any)?.constituency_name ?? "N/A"}`,
            ]))}
            ${section("Classes", classBody)}
            ${section("Profile Responses", profileResponses)}
            ${section("Bills", billBody)}
            ${section("Dear Colleague Letters", letterBody)}
            ${section("Assignment Submissions", submissionBody)}
            ${section("Committee Preference Submissions", preferenceBody)}
            ${warnings.length ? section("Export Notes", paragraphs(warnings)) : ""}
          </body>
        </html>`;

      const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `gavel-work-${new Date().toISOString().slice(0, 10)}.doc`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      toast.success("Work export downloaded.");
    } catch (error: any) {
      toast.error(error.message || "Could not export work");
    } finally {
      setExporting(false);
    }
  };

  const requestDeletion = async () => {
    if (!window.confirm("Schedule this account for deletion in three days? You can cancel from this page before the timer ends.")) return;
    setDeletionBusy(true);
    try {
      const { data, error } = await supabase.rpc("request_account_deletion");
      if (error) throw error;
      setDeletionRequest(normalizeRpcRow<DeletionRequest>(data));
      toast.success("Account deletion scheduled. A confirmation email has been queued.");
    } catch (error: any) {
      toast.error(error.message || "Could not schedule account deletion");
    } finally {
      setDeletionBusy(false);
    }
  };

  const cancelDeletion = async () => {
    setDeletionBusy(true);
    try {
      const { data, error } = await supabase.rpc("cancel_account_deletion");
      if (error) throw error;
      setDeletionRequest(normalizeRpcRow<DeletionRequest>(data));
      toast.success("Account deletion cancelled.");
    } catch (error: any) {
      toast.error(error.message || "Could not cancel deletion");
    } finally {
      setDeletionBusy(false);
    }
  };

  return (
    <SettingsLayout>
      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading account info...</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Email Address
              </CardTitle>
              <CardDescription>Update the email used for sign-in and account notices.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="account-email">Email</Label>
                  <Input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </div>
                <Button type="submit" disabled={savingEmail}>{savingEmail ? "Saving..." : "Change Email"}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-blue-600" />
                Password
              </CardTitle>
              <CardDescription>Choose a new password for this account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={savePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
                </div>
                <Button type="submit" disabled={savingPassword}>{savingPassword ? "Saving..." : "Change Password"}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-600" />
                Work Export
              </CardTitle>
              <CardDescription>Download a Word-compatible copy of your Gavel work.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" onClick={() => void downloadWorkDoc()} disabled={exporting}>
                <Download className="mr-2 h-4 w-4" />
                {exporting ? "Preparing..." : "Download Word Doc"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <Trash2 className="h-5 w-5" />
                Delete Account
              </CardTitle>
              <CardDescription>Deletion starts a three-day timer and can be cancelled here before the timer ends.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingDeletion ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">Deletion scheduled for {formatDate(pendingDeletion.delete_after)}.</p>
                  <p className="mt-1">Email notice: {pendingDeletion.email_notice_status}.</p>
                </div>
              ) : deletionRequest?.status === "cancelled" ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  Account deletion was cancelled on {formatDate(deletionRequest.cancelled_at)}.
                </div>
              ) : null}

              {pendingDeletion ? (
                <Button type="button" variant="outline" onClick={() => void cancelDeletion()} disabled={deletionBusy}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {deletionBusy ? "Cancelling..." : "Cancel Deletion"}
                </Button>
              ) : (
                <Button type="button" variant="destructive" onClick={() => void requestDeletion()} disabled={deletionBusy}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deletionBusy ? "Scheduling..." : "Delete Account"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </SettingsLayout>
  );
}

export default SettingsAccount;
