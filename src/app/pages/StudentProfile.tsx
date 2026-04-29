import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import {
  Award,
  Bold,
  ChevronDown,
  ChevronUp,
  FileText,
  Flag,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Mail,
  MapPin,
  Pencil,
  Save,
  User,
  X,
} from "lucide-react";
import { Navigation } from "../components/Navigation";
import { ConstituencyPicker, getConstituencyById } from "../components/ConstituencyPicker";
import {
  getPartyIdByName,
  getPartyNameById,
  NewParty,
  PartySelection,
} from "../components/PartySelection";
import { supabase } from "../utils/supabase";

type EditingSection = "personal_statement" | "constituency_description" | "key_issues" | null;

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  party: string | null;
  constituency_name: string | null;
  constituency_population: number | null;
  constituency_cook_pvi: string | null;
  constituency_url: string | null;
  written_responses: Record<string, any> | null;
  personal_statement?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  role?: string | null;
  class_id?: string | null;
};

export function StudentProfile() {
  const { id } = useParams();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [billsAuthored, setBillsAuthored] = useState<any[]>([]);
  const [billsCosponsored, setBillsCosponsored] = useState<any[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);

  const [showFullStatement, setShowFullStatement] = useState(false);
  const [showFullConstituency, setShowFullConstituency] = useState(false);

  const [showPartyModal, setShowPartyModal] = useState(false);
  const [partyDraftId, setPartyDraftId] = useState<string | null>(null);
  const [newPartyDraft, setNewPartyDraft] = useState<NewParty | undefined>(undefined);

  const [showConstituencyModal, setShowConstituencyModal] = useState(false);
  const [constituencyDraftId, setConstituencyDraftId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const currentUserId = auth.user?.id ?? null;
      setAuthUserId(currentUserId);

      const uid = id === "me" || !id ? currentUserId : id;
      if (!uid) return;

      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
      const pr: ProfileRow =
        (p as any) ?? {
          user_id: uid,
          display_name: "",
          party: null,
          constituency_name: null,
          constituency_population: null,
          constituency_cook_pvi: null,
          constituency_url: null,
          avatar_url: null,
          personal_statement: "",
          written_responses: {},
        };

      setProfile(pr);
      setUpdatedAt(pr.updated_at || pr.created_at || new Date().toISOString());

      const { data: ba } = await supabase
        .from("bill_display")
        .select("id,hr_label,title,status")
        .eq("author_user_id", uid)
        .order("bill_number");
      setBillsAuthored(ba ?? []);

      const { data: bc } = await supabase
        .from("bill_cosponsors")
        .select("bill_id,bills!inner(id,title,bill_number,status)")
        .eq("user_id", uid);
      setBillsCosponsored(
        (bc ?? []).map((r: any) => ({
          id: r.bills.id,
          hr_label: `H.R. ${r.bills.bill_number}`,
          title: r.bills.title,
          status: r.bills.status,
        })),
      );

      const existingPartyId = (pr.written_responses as any)?.party_id ?? getPartyIdByName(pr.party);
      setPartyDraftId(existingPartyId ?? null);
      setNewPartyDraft((pr.written_responses as any)?.new_party ?? undefined);
      setConstituencyDraftId((pr.written_responses as any)?.constituency_id ?? null);
    })();
  }, [id]);

  const isMe = authUserId !== null && profile?.user_id === authUserId;

  const saveProfile = async (patch: Partial<ProfileRow>, syncName = false) => {
    if (!profile) return;
    const payload = {
      user_id: profile.user_id,
      role: profile.role ?? "student",
      class_id: profile.class_id ?? null,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload as any);
    if (error) {
      toast.error(error.message || "Could not save profile");
      return;
    }

    if (syncName && patch.display_name) {
      await supabase.auth.updateUser({ data: { name: patch.display_name } });
    }

    setProfile({ ...profile, ...(patch as any) });
    setUpdatedAt(new Date().toISOString());
  };

  const mergeWrittenResponses = (patch: Record<string, any>) => {
    if (!profile) return;
    const next = { ...(profile.written_responses || {}), ...patch };
    setProfile({ ...profile, written_responses: next });
    void saveProfile({ written_responses: next } as any);
  };

  const insertMarkdown = (prefix: string, suffix = "", placeholder = "text") => {
    if (!textareaRef) return;
    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const selectedText = editingContent.substring(start, end);
    const textToInsert = selectedText || placeholder;
    const newText =
      editingContent.substring(0, start) + prefix + textToInsert + suffix + editingContent.substring(end);
    setEditingContent(newText);

    setTimeout(() => {
      const el = textareaRef;
      if (!el) return;
      const newCursorPos = start + prefix.length + (selectedText ? selectedText.length : 0);
      el.focus();
      el.setSelectionRange(newCursorPos, newCursorPos + (selectedText ? 0 : placeholder.length));
    }, 0);
  };

  const MarkdownToolbar = () => (
    <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-md border-b-0">
      <button
        type="button"
        onClick={() => insertMarkdown("**", "**", "bold text")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Bold"
      >
        <Bold className="w-4 h-4 text-gray-700" />
      </button>
      <button
        type="button"
        onClick={() => insertMarkdown("*", "*", "italic text")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Italic"
      >
        <Italic className="w-4 h-4 text-gray-700" />
      </button>
      <button
        type="button"
        onClick={() => insertMarkdown("[", "](url)", "link text")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Link"
      >
        <LinkIcon className="w-4 h-4 text-gray-700" />
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1" />
      <button
        type="button"
        onClick={() => insertMarkdown("- ", "", "list item")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Bullet List"
      >
        <List className="w-4 h-4 text-gray-700" />
      </button>
      <button
        type="button"
        onClick={() => insertMarkdown("1. ", "", "list item")}
        className="p-2 hover:bg-gray-200 rounded transition-colors"
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4 text-gray-700" />
      </button>
    </div>
  );

  const startEdit = (section: Exclude<EditingSection, null>) => {
    if (!profile) return;
    setEditingSection(section);
    if (section === "personal_statement") {
      setEditingContent(profile.personal_statement || "");
      return;
    }
    if (section === "key_issues") {
      const raw = (profile.written_responses || {})[section] ?? [];
      if (Array.isArray(raw)) setEditingContent(raw.join("\n"));
      else setEditingContent(String(raw || ""));
      return;
    }
    setEditingContent(String((profile.written_responses || {})[section] || ""));
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditingContent("");
  };

  const saveEdit = async (section: Exclude<EditingSection, null>) => {
    if (!profile) return;
    if (section === "personal_statement") {
      await saveProfile({ personal_statement: editingContent } as any);
    } else if (section === "key_issues") {
      const issues = editingContent
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      mergeWrittenResponses({ key_issues: issues });
    } else {
      mergeWrittenResponses({ [section]: editingContent });
    }
    setEditingSection(null);
    setEditingContent("");
    toast.success("Profile updated");
  };

  const handleUploadAvatar = async (f: File) => {
    if (!profile) return;
    try {
      const ext = f.name.split(".").pop();
      const path = `${profile.user_id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await saveProfile({ avatar_url: data.publicUrl } as any);
      toast.success("Profile photo updated");
    } catch (e: any) {
      toast.error(e.message || "Could not upload photo");
    }
  };

  const savePartySelection = async () => {
    if (!profile) return;
    const partyName = getPartyNameById(partyDraftId) ?? newPartyDraft?.name ?? null;
    mergeWrittenResponses({ party_id: partyDraftId, new_party: newPartyDraft });
    await saveProfile({ party: partyName } as any);
    setShowPartyModal(false);
  };

  const saveConstituencySelection = async () => {
    if (!profile) return;
    const c = getConstituencyById(constituencyDraftId);
    if (!c) return;
    mergeWrittenResponses({ constituency_id: c.id });
    await saveProfile({
      constituency_name: c.name,
      constituency_population: c.population,
      constituency_cook_pvi: c.pvi,
      constituency_url: c.wikipediaUrl,
    } as any);
    setShowConstituencyModal(false);
  };

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const personalStatement = profile.personal_statement || "";
  const constituencyDescription = String((profile.written_responses || {})["constituency_description"] || "");
  const keyIssuesRaw = (profile.written_responses || {})["key_issues"];
  const keyIssues: string[] = Array.isArray(keyIssuesRaw)
    ? keyIssuesRaw
    : String(keyIssuesRaw || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || "Profile"}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                )}
                {isMe && (
                  <label className="absolute -top-1 -right-1 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm cursor-pointer">
                    <Pencil className="w-3 h-3" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleUploadAvatar(e.target.files[0])}
                    />
                  </label>
                )}
              </div>
              <div>
                {isMe ? (
                  <input
                    className="text-2xl font-bold text-gray-900 mb-2 w-full bg-transparent outline-none"
                    value={profile.display_name || ""}
                    onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                    onBlur={() => void saveProfile({ display_name: profile.display_name } as any, true)}
                    placeholder="Your name"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{profile.display_name || "Student"}</h1>
                )}
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.constituency_name || "N/A"}</span>
                    {isMe && (
                      <button
                        onClick={() => setShowConstituencyModal(true)}
                        className="text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Change
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4" />
                    <span>{profile.party || "N/A"}</span>
                    {isMe && (
                      <button
                        onClick={() => setShowPartyModal(true)}
                        className="text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Change
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Population: {profile.constituency_population?.toLocaleString?.() ?? "N/A"} • Cook PVI:{" "}
                    {profile.constituency_cook_pvi || "N/A"}{" "}
                    {profile.constituency_url ? (
                      <a href={profile.constituency_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        Wikipedia
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs italic text-gray-500 whitespace-nowrap">
              {updatedAt ? new Date(updatedAt).toLocaleDateString() : ""}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Personal Statement</h2>
            {isMe && editingSection !== "personal_statement" && (
              <button onClick={() => startEdit("personal_statement")} className="text-blue-600 hover:text-blue-700 transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          {editingSection === "personal_statement" ? (
            <div className="space-y-3">
              <MarkdownToolbar />
              <textarea
                ref={setTextareaRef}
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Enter your personal statement..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <div className="text-xs text-gray-500">Supports markdown formatting</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void saveEdit("personal_statement")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button onClick={cancelEdit} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors">
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : personalStatement.trim() ? (
            <div className="space-y-2">
              {personalStatement.split("\n\n").length > 1 ? (
                <>
                  <div className={showFullStatement ? "" : "relative pb-6"}>
                    {showFullStatement ? (
                      <div className="text-gray-700 space-y-4">
                        {personalStatement.split("\n\n").map((para, index) => (
                          <p key={index}>{para}</p>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="text-gray-700 space-y-4">
                          {personalStatement.split("\n\n").slice(0, 2).map((para, index) => (
                            <p key={index}>{para}</p>
                          ))}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFullStatement(!showFullStatement)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors relative z-10"
                  >
                    {showFullStatement ? (
                      <>
                        Show less <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show more <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <p className="text-gray-700">{personalStatement}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 italic">Fill out this section to complete your profile.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Constituency Description</h2>
            {isMe && editingSection !== "constituency_description" && (
              <button onClick={() => startEdit("constituency_description")} className="text-blue-600 hover:text-blue-700 transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          {editingSection === "constituency_description" ? (
            <div className="space-y-3">
              <MarkdownToolbar />
              <textarea
                ref={setTextareaRef}
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Enter constituency description..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <div className="text-xs text-gray-500">Supports markdown formatting</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void saveEdit("constituency_description")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button onClick={cancelEdit} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors">
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : constituencyDescription.trim() ? (
            <div className="space-y-2">
              {constituencyDescription.split("\n\n").length > 1 ? (
                <>
                  <div className={showFullConstituency ? "" : "relative pb-6"}>
                    {showFullConstituency ? (
                      <div className="text-gray-700 space-y-4 whitespace-pre-line">{constituencyDescription}</div>
                    ) : (
                      <>
                        <div className="text-gray-700 whitespace-pre-line">{constituencyDescription.split("\n\n")[0]}</div>
                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFullConstituency(!showFullConstituency)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors relative z-10"
                  >
                    {showFullConstituency ? (
                      <>
                        Show less <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show more <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <p className="text-gray-700 whitespace-pre-line">{constituencyDescription}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 italic">Fill out this section to complete your profile.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Key Issues</h2>
            {isMe && editingSection !== "key_issues" && (
              <button onClick={() => startEdit("key_issues")} className="text-blue-600 hover:text-blue-700 transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          {editingSection === "key_issues" ? (
            <div className="space-y-3">
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Enter key issues (one per line)..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <div className="text-xs text-gray-500">Enter one issue per line.</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void saveEdit("key_issues")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button onClick={cancelEdit} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors">
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : keyIssues.length ? (
            <ul className="space-y-2">
              {keyIssues.map((issue, index) => (
                <li key={index} className="text-gray-700 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 italic">Fill out this section to complete your profile.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Legislation Written</h2>
            </div>
            <div className="space-y-3">
              {billsAuthored.length ? (
                billsAuthored.map((bill: any) => (
                  <div key={bill.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-gray-900">{bill.hr_label}</span>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">{bill.status}</span>
                    </div>
                    <p className="text-sm text-gray-700">{bill.title}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No legislation yet</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Legislation Cosponsored</h2>
            </div>
            <div className="space-y-3">
              {billsCosponsored.length ? (
                billsCosponsored.map((bill: any) => (
                  <div key={bill.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-gray-900">{bill.hr_label}</span>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">{bill.status}</span>
                    </div>
                    <p className="text-sm text-gray-700">{bill.title}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No legislation cosponsored yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Dear Colleague Letters</h2>
          </div>
          <p className="text-gray-600">Coming soon</p>
        </div>
      </main>

      {showPartyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Choose Party</h2>
              <button onClick={() => setShowPartyModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <PartySelection
                selectedParty={partyDraftId}
                newParty={newPartyDraft}
                onSelectParty={(pid) => setPartyDraftId(pid)}
                onCreateParty={(p) => setNewPartyDraft(p)}
              />
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button onClick={() => setShowPartyModal(false)} className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => void savePartySelection()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showConstituencyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Choose Constituency</h2>
              <button
                onClick={() => setShowConstituencyModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <ConstituencyPicker selected={constituencyDraftId} onSelect={(cid) => setConstituencyDraftId(cid)} />
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConstituencyModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveConstituencySelection()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                disabled={!constituencyDraftId}
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

