import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Check, Download, KeyRound, Pencil, RotateCcw, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { SettingsLayout } from "./SettingsLayout";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { formatSchool, SchoolOption } from "../services/schools";
import { fullNameFromParts } from "../utils/oauthSignup";
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

type AccountProfile = {
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  schools?: unknown;
  party?: string | null;
  constituency_name?: string | null;
  written_responses?: unknown;
  class_id?: string | null;
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

function splitDisplayName(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return { firstName: "", lastName: "" };
  if (raw.includes(",")) {
    const [first, ...rest] = raw.split(",");
    return { firstName: first.trim(), lastName: rest.join(",").trim() };
  }
  const [first, ...rest] = raw.split(/\s+/);
  return { firstName: first ?? "", lastName: rest.join(" ") };
}

function parseSchools(value: unknown): SchoolOption[] {
  if (!value) return [];
  if (typeof value === "string") {
    return value
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ id: `manual:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, source: "fallback" as const }));
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((school: any) => {
      const name = String(school?.name ?? "").trim();
      if (!name) return null;
      return {
        id: String(school?.id ?? `manual:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
        name,
        city: school?.city ? String(school.city) : undefined,
        state: school?.state ? String(school.state) : undefined,
        url: school?.url ? String(school.url) : undefined,
        source: school?.source === "scorecard" ? "scorecard" : "fallback",
      } satisfies SchoolOption;
    })
    .filter(Boolean) as SchoolOption[];
}

function schoolOptionsFromText(value: string): SchoolOption[] {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      id: `manual:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      source: "fallback" as const,
    }));
}

function schoolsTextFromOptions(value: SchoolOption[]) {
  return value.map((school) => school.name).join(", ");
}

function RowShell({ title, description, children }: { title: ReactNode; description?: string; children: ReactNode }) {
  return (
    <section className="border-b border-gray-200 p-5 last:border-b-0">
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

export function SettingsAccount() {
  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [savedFirstName, setSavedFirstName] = useState("");
  const [savedLastName, setSavedLastName] = useState("");
  const [savedPreferredName, setSavedPreferredName] = useState("");
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [schoolText, setSchoolText] = useState("");
  const [savedSchoolText, setSavedSchoolText] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingSchools, setSavingSchools] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const pendingDeletion = useMemo(() => (deletionRequest?.status === "pending" ? deletionRequest : null), [deletionRequest]);
  const savedName = fullNameFromParts(savedFirstName, savedLastName) || "Member";
  const schoolsChanged = schoolText.trim() !== savedSchoolText.trim();

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return;

      const metadata = user.user_metadata ?? {};
      const metadataName = splitDisplayName(metadata.name);
      const metadataSchools = parseSchools(metadata.schools ?? metadata.school);
      const userRole = metadata.role === "teacher" ? "teacher" : "student";
      setRole(userRole);
      setEmail(user.email ?? "");
      setSavedEmail(user.email ?? "");

      const [{ data: profile, error: profileError }, { data: deletion, error: deletionError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name,first_name,last_name,schools,party,constituency_name,written_responses,class_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("account_deletion_requests").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (profileError && profileError.code !== "PGRST116") throw profileError;
      if (deletionError && deletionError.code !== "PGRST116") throw deletionError;

      const profileRow = (profile as AccountProfile | null) ?? null;
      const profileName = splitDisplayName(profileRow?.display_name);
      const nextFirst = String(profileRow?.first_name ?? metadata.first_name ?? profileName.firstName ?? metadataName.firstName ?? "").trim();
      const nextLast = String(profileRow?.last_name ?? metadata.last_name ?? profileName.lastName ?? metadataName.lastName ?? "").trim();
      const profileSchools = parseSchools(profileRow?.schools);
      const nextSchools = profileSchools.length ? profileSchools : metadataSchools;
      const nextPreferred = String(profileRow?.display_name ?? metadata.name ?? fullNameFromParts(nextFirst, nextLast) ?? "").trim();
      const nextSchoolText = schoolsTextFromOptions(nextSchools);

      setProfileExists(Boolean(profileRow));
      setFirstName(nextFirst);
      setLastName(nextLast);
      setPreferredName(nextPreferred);
      setSavedFirstName(nextFirst);
      setSavedLastName(nextLast);
      setSavedPreferredName(nextPreferred);
      setSchoolText(nextSchoolText);
      setSavedSchoolText(nextSchoolText);
      setDeletionRequest((deletion as DeletionRequest | null) ?? null);
    } catch (error: any) {
      toast.error(error.message || "Could not load account settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveProfileDetails = async (next: { firstName?: string; lastName?: string; preferredName?: string; schoolText?: string }) => {
    const nextFirstName = next.firstName ?? firstName;
    const nextLastName = next.lastName ?? lastName;
    const nextPreferredName = (next.preferredName ?? preferredName).trim();
    const nextSchoolText = (next.schoolText ?? schoolText).trim();
    const nextSchools = schoolOptionsFromText(nextSchoolText);
    const legalName = fullNameFromParts(nextFirstName, nextLastName);
    const nextName = nextPreferredName || legalName;
    if (!nextFirstName.trim() || !nextLastName.trim()) throw new Error("First and last name are required.");
    if (!nextName) throw new Error("Preferred name is required.");
    if (!nextSchools.length) throw new Error("Enter at least one school.");

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) throw new Error("Sign in to update account info.");

    const metadata = {
      ...(user.user_metadata ?? {}),
      role,
      name: nextName,
      first_name: nextFirstName.trim(),
      last_name: nextLastName.trim(),
      schools: nextSchools,
      school: nextSchoolText,
    };
    const { error: metadataError } = await supabase.auth.updateUser({ data: metadata });
    if (metadataError) throw metadataError;

    if (profileExists) {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: nextName,
          first_name: nextFirstName.trim(),
          last_name: nextLastName.trim(),
          schools: nextSchools,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);
      if (error) throw error;
    } else if (role === "student") {
      const { error } = await supabase.from("profiles").upsert({
        user_id: user.id,
        role: "student",
        display_name: nextName,
        first_name: nextFirstName.trim(),
        last_name: nextLastName.trim(),
        schools: nextSchools,
      } as any);
      if (error) throw error;
      setProfileExists(true);
    }
  };

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    setSavingName(true);
    try {
      await saveProfileDetails({ firstName: firstName.trim(), lastName: lastName.trim(), preferredName: preferredName.trim() });
      setSavedFirstName(firstName.trim());
      setSavedLastName(lastName.trim());
      setSavedPreferredName(preferredName.trim());
      setEditingName(false);
      toast.success("Name updated.");
    } catch (error: any) {
      toast.error(error.message || "Could not update name");
    } finally {
      setSavingName(false);
    }
  };

  const saveEmail = async (event: FormEvent) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) return toast.error("Enter an email address.");
    setSavingEmail(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.email === nextEmail) {
        setEditingEmail(false);
        toast.info("That email is already on your account.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      setSavedEmail(nextEmail);
      setEditingEmail(false);
      toast.success("Email change started. Check your inbox to confirm it.");
    } catch (error: any) {
      toast.error(error.message || "Could not update email");
    } finally {
      setSavingEmail(false);
    }
  };

  const saveSchools = async () => {
    setSavingSchools(true);
    try {
      await saveProfileDetails({ schoolText });
      setSavedSchoolText(schoolText.trim());
      toast.success("Schools updated.");
    } catch (error: any) {
      toast.error(error.message || "Could not update schools");
    } finally {
      setSavingSchools(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentPassword) return toast.error("Enter your current password.");
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
    setSavingPassword(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const accountEmail = auth.user?.email ?? savedEmail;
      if (!accountEmail) throw new Error("No email address is available for this account.");

      const { error: currentPasswordError } = await supabase.auth.signInWithPassword({
        email: accountEmail,
        password: currentPassword,
      });
      if (currentPasswordError) throw new Error("Current password is incorrect.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      const { error: noticeError } = await supabase.rpc("queue_account_security_email", { event_type_input: "password_changed" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordDialogOpen(false);
      if (noticeError) {
        toast.warning("Password updated, but the email notice could not be queued.");
      } else {
        toast.success("Password updated. A confirmation email has been queued.");
      }
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
        runQuery(
          "Profile",
          supabase.from("profiles").select("display_name,first_name,last_name,schools,party,constituency_name,written_responses,class_id").eq("user_id", user.id).maybeSingle(),
          null as any,
        ),
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

      const profileSchools = parseSchools((profile as any)?.schools);
      const profileResponses =
        (profile as any)?.written_responses && typeof (profile as any).written_responses === "object"
          ? Object.entries((profile as any).written_responses)
              .map(([key, value]) => `<h3>${escapeHtml(key)}</h3><p>${escapeHtml(value)}</p>`)
              .join("")
          : "";

      const classBody = (memberships as any[])
        .map((membership) => {
          const cls = membership.classes;
          return `<p><strong>${escapeHtml(cls?.name ?? "Class")}</strong> (${escapeHtml(membership.status ?? "approved")})<br/>Code: ${escapeHtml(cls?.class_code ?? "N/A")}</p>`;
        })
        .join("");

      const billBody = (authoredBills as any[])
        .map(
          (bill) => `
        <h3>${escapeHtml(bill.hr_label ?? "Bill")}: ${escapeHtml(bill.title)}</h3>
        <p>Status: ${escapeHtml(String(bill.status ?? "").replace(/_/g, " "))}<br/>Created: ${escapeHtml(formatDate(bill.created_at))}</p>
        <p><strong>Legislative text</strong></p>
        <p>${escapeHtml(bill.legislative_text)}</p>
        ${bill.supporting_text ? `<p><strong>Supporting text</strong></p><p>${escapeHtml(bill.supporting_text)}</p>` : ""}
      `,
        )
        .join("");

      const letterBody = (letters as any[])
        .map(
          (letter) => `
        <h3>${escapeHtml(letter.subject || "Untitled letter")}</h3>
        <p>Sent: ${escapeHtml(formatDate(letter.created_at))}</p>
        <p>${escapeHtml(letter.body)}</p>
      `,
        )
        .join("");

      const submissionBody = (submissions as any[])
        .map((submission) => {
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
        })
        .join("");

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
            ${section(
              "Account",
              paragraphs([
                `Name: ${(profile as any)?.display_name ?? savedName}`,
                `Email: ${user.email ?? "N/A"}`,
                `Schools: ${profileSchools.length ? profileSchools.map(formatSchool).join("; ") : "N/A"}`,
                `Party: ${(profile as any)?.party ?? "N/A"}`,
                `Constituency: ${(profile as any)?.constituency_name ?? "N/A"}`,
              ]),
            )}
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
    setDeletionBusy(true);
    try {
      const { data, error } = await supabase.rpc("request_account_deletion");
      if (error) throw error;
      setDeletionRequest(normalizeRpcRow<DeletionRequest>(data));
      setDeleteStep(0);
      setDeleteConfirmation("");
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
        <div className="w-full overflow-visible rounded-lg border border-gray-200 bg-white shadow-sm">
          <RowShell title="Name" description="Shown on your profile by default.">
            {editingName ? (
              <form onSubmit={saveName} className="grid gap-4 lg:grid-cols-[1fr_1fr_1.25fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="account-first-name">First name</Label>
                  <Input id="account-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-last-name">Last name</Label>
                  <Input id="account-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-preferred-name">Preferred name</Label>
                  <Input id="account-preferred-name" value={preferredName} onChange={(event) => setPreferredName(event.target.value)} placeholder={fullNameFromParts(firstName, lastName)} required autoComplete="off" />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" size="icon" disabled={savingName} aria-label="Save name">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Cancel name edit"
                    onClick={() => {
                      setFirstName(savedFirstName);
                      setLastName(savedLastName);
                      setPreferredName(savedPreferredName);
                      setEditingName(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="grid min-w-0 flex-1 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-500">First</div>
                    <div className="truncate font-medium text-gray-900">{savedFirstName || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-500">Last</div>
                    <div className="truncate font-medium text-gray-900">{savedLastName || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-gray-500">Preferred</div>
                    <div className="truncate font-medium text-gray-900">{savedPreferredName || savedName}</div>
                  </div>
                </div>
                <Button type="button" variant="outline" size="icon" aria-label="Edit name" onClick={() => setEditingName(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </RowShell>

          <RowShell title="Email Address" description="Used for sign-in and account notices.">
            {editingEmail ? (
              <form onSubmit={saveEmail} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="off" />
                <div className="flex gap-2">
                  <Button type="submit" size="icon" disabled={savingEmail} aria-label="Save email">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Cancel email edit"
                    onClick={() => {
                      setEmail(savedEmail);
                      setEditingEmail(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-gray-900">{savedEmail || "No email"}</p>
                <Button type="button" variant="outline" size="icon" aria-label="Edit email" onClick={() => setEditingEmail(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </RowShell>

          <RowShell title="School/Institution" description="Use commas to list more than one school.">
            <div className="space-y-3">
              <Input value={schoolText} onChange={(event) => setSchoolText(event.target.value)} placeholder="Bellevue High School" autoComplete="off" required />
              <div className="flex justify-end">
                <Button type="button" onClick={() => void saveSchools()} disabled={!schoolsChanged || savingSchools}>
                  {savingSchools ? "Saving..." : "Save School"}
                </Button>
              </div>
            </div>
          </RowShell>

          <RowShell title="Password" description="Changing your password sends a security email.">
            <div className="flex justify-end">
              <Button type="button" onClick={() => setPasswordDialogOpen(true)}>
                <KeyRound className="h-4 w-4" />
                Change Password
              </Button>
            </div>
          </RowShell>

          <RowShell title="Work Export" description="Download a Word-compatible copy of your Gavel work.">
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => void downloadWorkDoc()} disabled={exporting}>
                <Download className="h-4 w-4" />
                {exporting ? "Preparing..." : "Download Word Doc"}
              </Button>
            </div>
          </RowShell>

          <RowShell title={<span className="text-red-700">Delete Account</span>} description="Deletion starts a three-day timer and can be cancelled here before it ends.">
            <div className="space-y-4">
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

              <div className="flex flex-wrap justify-end gap-3">
                {pendingDeletion ? (
                  <Button type="button" variant="outline" onClick={() => void cancelDeletion()} disabled={deletionBusy}>
                    <RotateCcw className="h-4 w-4" />
                    {deletionBusy ? "Cancelling..." : "Cancel Deletion"}
                  </Button>
                ) : (
                  <Button type="button" variant="destructive" onClick={() => setDeleteStep(1)} disabled={deletionBusy}>
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                )}
              </div>
            </div>
          </RowShell>
        </div>
      )}

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Enter your current password before choosing a new one.</DialogDescription>
          </DialogHeader>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={savingPassword}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Saving..." : "Change Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteStep > 0}
        onOpenChange={(open) => {
          if (!open && !deletionBusy) {
            setDeleteStep(0);
            setDeleteConfirmation("");
          }
        }}
      >
        <DialogContent>
          {deleteStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <ShieldAlert className="h-5 w-5" />
                  Delete account?
                </DialogTitle>
                <DialogDescription>
                  This schedules your account for deletion in three days. You can still cancel from this page before the timer ends.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteStep(0)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" onClick={() => setDeleteStep(2)}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Confirm account deletion</DialogTitle>
                <DialogDescription>Type DELETE to schedule the three-day deletion timer.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-confirmation">Confirmation</Label>
                <Input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteStep(1)} disabled={deletionBusy}>
                  Back
                </Button>
                <Button type="button" variant="destructive" onClick={() => void requestDeletion()} disabled={deletionBusy || deleteConfirmation !== "DELETE"}>
                  {deletionBusy ? "Scheduling..." : "Schedule Deletion"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
}

export default SettingsAccount;
