import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import {
  Award,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Flag,
  Mail,
  MapPin,
  Pencil,
  Save,
  Users,
  Vote,
  X,
} from "lucide-react";
import { Navigation } from "../components/Navigation";
import { BackButton } from "../components/BackButton";
import { CollapsibleText } from "../components/CollapsibleText";
import { ConstituencyPicker, getConstituencyById } from "../components/ConstituencyPicker";
import {
  getPartyIdByName,
  NewParty,
  PartySelection,
} from "../components/PartySelection";
import { supabase } from "../utils/supabase";
import { DefaultAvatar } from "../components/DefaultAvatar";
import { formatConstituencyFull, normalizeConstituencyId } from "../utils/constituency";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { useUnsavedChangesPrompt } from "../hooks/useUnsavedChangesPrompt";
import { displayPersonName, nameInputPlaceholder } from "../utils/displayName";
import { memberCodeFromUserId, uuidPattern } from "../utils/profileRoute";
import { getCurrentUser } from "../utils/currentUser";

type EditingSection = string | null;

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

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

type ProfileSectionType = "long_response" | "legislation_written" | "organizations" | "dear_colleague_letters" | "votes_cast";
type ProfileSectionRow = {
  id?: string;
  section_key: string;
  title: string;
  section_type: ProfileSectionType;
  width: "full" | "half";
  position: number;
};
type VoteCast = {
  id: string;
  vote: string;
  date: string;
  label: string;
  title: string;
  context: string;
  href: string;
};

const defaultProfileSections: ProfileSectionRow[] = [
  { section_key: "personal_statement", title: "Personal Statement", section_type: "long_response", width: "full", position: 0 },
  { section_key: "constituency_description", title: "Constituency Description", section_type: "long_response", width: "full", position: 1 },
  { section_key: "key_issues", title: "Key Issues", section_type: "long_response", width: "full", position: 2 },
  { section_key: "legislation_written", title: "Legislation Written", section_type: "legislation_written", width: "half", position: 3 },
  { section_key: "organizations", title: "Organizations", section_type: "organizations", width: "full", position: 4 },
  { section_key: "dear_colleague_letters", title: "Dear Colleague Letters", section_type: "dear_colleague_letters", width: "full", position: 5 },
  { section_key: "votes_cast", title: "Votes Cast", section_type: "votes_cast", width: "half", position: 6 },
];

const PROFILE_COLLAPSE_WORDS = 150;

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function mergeProfileSections(rows: ProfileSectionRow[]) {
  if (!rows.length) return defaultProfileSections;
  const byKey = new Set(rows.map((row) => row.section_key));
  const missing = defaultProfileSections
    .filter((section) => !byKey.has(section.section_key))
    .map((section, index) => ({ ...section, position: rows.length + index }));
  return [...rows, ...missing].map((section, index) => ({ ...section, position: index }));
}

export function StudentProfile() {
  const { id } = useParams();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [billsAuthored, setBillsAuthored] = useState<any[]>([]);
  const [billsCosponsored, setBillsCosponsored] = useState<any[]>([]);
  const [lettersAuthored, setLettersAuthored] = useState<any[]>([]);
  const [votesCast, setVotesCast] = useState<VoteCast[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [orgs, setOrgs] = useState<{ committees: Array<{ id: string; name: string }>; caucuses: Array<{ id: string; name: string }> }>({ committees: [], caucuses: [] });
  const [profileSections, setProfileSections] = useState<ProfileSectionRow[]>(defaultProfileSections);
  const [profileSectionWordLimits, setProfileSectionWordLimits] = useState<Record<string, number>>({});
  const [profileWordLimit, setProfileWordLimit] = useState(1000);

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
  const [unavailableConstituencies, setUnavailableConstituencies] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoModalTab, setPhotoModalTab] = useState<"upload" | "center">("upload");
  const [avatarPosition, setAvatarPosition] = useState({ x: 50, y: 50 });
  const [draggingAvatar, setDraggingAvatar] = useState(false);
  const [profileNameFocused, setProfileNameFocused] = useState(false);
  const avatarDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  useUnsavedChangesPrompt(Boolean(editingSection));

  useEffect(() => {
    (async () => {
      const currentUser = await getCurrentUser();
      const currentUserId = currentUser?.id ?? null;
      setAuthUserId(currentUserId);

      let uid = id === "me" || !id ? currentUserId : id;
      if (uid && !uuidPattern.test(uid)) {
        const { data: currentProfile } = currentUserId
          ? await supabase.from("profiles").select("class_id").eq("user_id", currentUserId).maybeSingle()
          : ({ data: null } as any);
        const classId = (currentProfile as any)?.class_id;
        const { data: candidates } = classId
          ? await supabase.from("profiles").select("user_id").eq("class_id", classId)
          : await supabase.from("profiles").select("user_id");
        uid = ((candidates ?? []) as any[]).find((candidate) => memberCodeFromUserId(candidate.user_id) === id)?.user_id ?? id;
      }
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
      const storedPosition = (pr.written_responses as any)?.avatar_position;
      if (storedPosition && typeof storedPosition.x === "number" && typeof storedPosition.y === "number") {
        setAvatarPosition({ x: storedPosition.x, y: storedPosition.y });
      }
      setUpdatedAt(pr.updated_at || pr.created_at || new Date().toISOString());
        if (pr.class_id) {
          const { data: cls } = await supabase.from("classes").select("settings").eq("id", pr.class_id).maybeSingle();
          setProfileWordLimit(Math.min(2000, Math.max(1, Number((cls as any)?.settings?.wordLimits?.profileLongResponse ?? 1000))));
          setProfileSectionWordLimits(((cls as any)?.settings?.profileSectionWordLimits ?? {}) as Record<string, number>);
      }

      let authoredQuery = supabase
        .from("bill_display")
        .select("id,hr_label,title,status,class_id")
        .eq("author_user_id", uid);
      if (pr.class_id) authoredQuery = authoredQuery.eq("class_id", pr.class_id);
      if (uid !== currentUserId) authoredQuery = authoredQuery.neq("status", "draft");
      const { data: ba } = await authoredQuery.order("bill_number");
      setBillsAuthored(ba ?? []);

      let cosponsoredQuery = supabase
        .from("bill_cosponsors")
        .select("bill_id,bills!inner(id,title,bill_number,status,class_id)")
        .eq("user_id", uid);
      if (pr.class_id) cosponsoredQuery = cosponsoredQuery.eq("bills.class_id", pr.class_id);
      const { data: bc } = await cosponsoredQuery;
      setBillsCosponsored(
        (bc ?? []).map((r: any) => ({
          id: r.bills.id,
          hr_label: `H.R. ${r.bills.bill_number}`,
          title: r.bills.title,
          status: r.bills.status,
        })),
      );

      let existingPartyId = (pr.written_responses as any)?.party_id ?? getPartyIdByName(pr.party);
      if (!existingPartyId && pr.class_id && pr.party) {
        const { data: existingParty } = await supabase
          .from("parties")
          .select("id")
          .eq("class_id", pr.class_id)
          .eq("name", pr.party)
          .maybeSingle();
        existingPartyId = (existingParty as any)?.id ?? null;
      }
      setPartyDraftId(existingPartyId ?? null);
      setNewPartyDraft((pr.written_responses as any)?.new_party ?? undefined);
      setConstituencyDraftId((pr.written_responses as any)?.constituency_id ?? null);

      if (pr.class_id) {
        const { data: directory } = await supabase.rpc("class_directory", { target_class: pr.class_id } as any);
        const taken = ((directory ?? []) as any[])
          .filter((row) => row.user_id !== uid)
          .map((row) => normalizeConstituencyId(row.constituency_name))
          .filter(Boolean) as string[];
        setUnavailableConstituencies(taken);

        const { data: sections } = await supabase
          .from("class_profile_sections")
          .select("id,section_key,title,section_type,width,position")
          .eq("class_id", pr.class_id)
          .order("position", { ascending: true });
        const rows = ((sections ?? []) as ProfileSectionRow[]).map((section) => ({
          ...section,
          width: section.section_type === "organizations" ? "full" : section.width,
        }));
        setProfileSections(mergeProfileSections(rows));
      } else {
        setUnavailableConstituencies([]);
        setProfileSections(defaultProfileSections);
      }

      const { data: cm } = await supabase
        .from("committee_members")
        .select("committee_id, committees!inner(id,name)")
        .eq("user_id", uid);
      const { data: ca } = await supabase
        .from("caucus_members")
        .select("caucus_id, caucuses!inner(id,title)")
        .eq("user_id", uid);
      setOrgs({
        committees: (cm ?? []).map((r: any) => ({ id: r.committees.id, name: r.committees.name })),
        caucuses: (ca ?? []).map((r: any) => ({ id: r.caucuses.id, name: r.caucuses.title })),
      });

      let lettersQuery = supabase.from("dear_colleague_letters").select("id,subject,created_at,class_id").eq("sender_user_id", uid);
      if (pr.class_id) lettersQuery = lettersQuery.eq("class_id", pr.class_id);
      const { data: letters } = await lettersQuery.order("created_at", { ascending: false }).limit(5);
      setLettersAuthored(letters ?? []);

      let committeeVotesQuery = supabase
        .from("bill_committee_votes")
        .select("bill_id,committee_id,vote,created_at,bills(id,hr_label,title),committees(id,name)")
        .eq("user_id", uid);
      let floorVotesQuery = supabase
        .from("bill_floor_votes")
        .select("session_id,bill_id,vote,created_at,bills(id,hr_label,title)")
        .eq("user_id", uid);
      if (pr.class_id) {
        committeeVotesQuery = committeeVotesQuery.eq("class_id", pr.class_id);
        floorVotesQuery = floorVotesQuery.eq("class_id", pr.class_id);
      }
      const [{ data: committeeVotes }, { data: floorVotes }] = await Promise.all([
        committeeVotesQuery.order("created_at", { ascending: false }).limit(8),
        floorVotesQuery.order("created_at", { ascending: false }).limit(8),
      ]);
      const mappedVotes: VoteCast[] = [
        ...((committeeVotes ?? []) as any[]).map((row) => ({
          id: `committee:${row.committee_id}:${row.bill_id}`,
          vote: row.vote,
          date: row.created_at,
          label: row.bills?.hr_label ?? "Bill",
          title: row.bills?.title ?? "",
          context: row.committees?.name ? `${row.committees.name} vote` : "Committee vote",
          href: `/bills/${row.bill_id}`,
        })),
        ...((floorVotes ?? []) as any[]).map((row) => ({
          id: `floor:${row.session_id}`,
          vote: row.vote,
          date: row.created_at,
          label: row.bills?.hr_label ?? "Bill",
          title: row.bills?.title ?? "",
          context: "Floor vote",
          href: `/bills/${row.bill_id}`,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
      setVotesCast(mappedVotes);
    })();
  }, [id]);

  useEffect(() => {
    if (!profile?.class_id) return;
    (async () => {
      const { data: sections } = await supabase
        .from("class_profile_sections")
        .select("id,section_key,title,section_type,width,position")
        .eq("class_id", profile.class_id)
        .order("position", { ascending: true });
      const rows = ((sections ?? []) as ProfileSectionRow[]).map((section) => ({
        ...section,
        width: section.section_type === "organizations" ? "full" : section.width,
      }));
      setProfileSections(mergeProfileSections(rows));
    })();
  }, [profile?.class_id]);

  const isMe = authUserId !== null && profile?.user_id === authUserId;
  const canChooseRepresentation = isMe && profile?.role !== "teacher";
  const emptySectionText = isMe ? "Fill out this section to complete your profile." : "No content";

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
    const sectionLimit = profileSectionWordLimits[section] ?? profileWordLimit;
    if (countWords(editingContent) > sectionLimit) {
      toast.error(`This section is limited to ${sectionLimit} words.`);
      return;
    }
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
    if (!/^image\/(png|jpeg)$/.test(f.type)) {
      toast.error("Profile pictures must be PNG or JPG files.");
      return;
    }
    try {
      const ext = f.name.split(".").pop();
      const path = `${profile.user_id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await saveProfile({ avatar_url: data.publicUrl } as any);
      window.dispatchEvent(new CustomEvent("gavel:avatar-updated", { detail: { userId: profile.user_id, avatarUrl: data.publicUrl } }));
      setPhotoModalTab("center");
      setPhotoModalOpen(true);
      toast.success("Profile photo updated");
    } catch (e: any) {
      toast.error(e.message || "Could not upload photo");
    }
  };

  const saveAvatarPosition = async (next = avatarPosition) => {
    if (!profile) return;
    const written = { ...(profile.written_responses || {}), avatar_position: next };
    await saveProfile({ written_responses: written } as any);
    setPhotoModalOpen(false);
  };

  const updateAvatarDrag = (clientX: number, clientY: number) => {
    const drag = avatarDragRef.current;
    if (!drag) return;
    const x = Math.max(0, Math.min(100, drag.baseX - ((clientX - drag.startX) / 2.8)));
    const y = Math.max(0, Math.min(100, drag.baseY - ((clientY - drag.startY) / 2.8)));
    setAvatarPosition({ x, y });
  };

  const savePartySelection = async () => {
    if (!profile) return;
    let partyName: string | null = null;
    let savedPartyId = partyDraftId;
    if (partyDraftId === "custom" && newPartyDraft?.name.trim()) {
      const me = (await getCurrentUser())?.id;
      if (!me || !profile.class_id) return;
      const { data: cls } = await supabase.from("classes").select("settings").eq("id", profile.class_id).maybeSingle();
      const requireApproval = !!(cls as any)?.settings?.parties?.requireApproval;
      const { data: created, error } = await supabase
        .from("parties")
        .upsert(
          {
            class_id: profile.class_id,
            name: newPartyDraft.name.trim(),
            platform: newPartyDraft.platform.trim(),
            color: newPartyDraft.color,
            created_by: me,
            approved: profile.role === "teacher" || !requireApproval,
          } as any,
          { onConflict: "class_id,name" },
        )
        .select("id,name")
        .single();
      if (error) {
        toast.error(error.message || "Could not create party");
        return;
      }
      savedPartyId = (created as any).id;
      partyName = (created as any).name;
      setPartyDraftId(savedPartyId);
      setNewPartyDraft(undefined);
    } else if (partyDraftId) {
      const { data: party } = await supabase.from("parties").select("name").eq("id", partyDraftId).maybeSingle();
      partyName = (party as any)?.name ?? null;
    }
    if (profile.party && partyName && profile.party !== partyName) {
      setConfirmDialog({
        title: "Switch party?",
        message: `Switch from ${profile.party} to ${partyName}?`,
        confirmLabel: "Switch",
        onConfirm: () => applyPartySelection(savedPartyId, partyName),
      });
      return;
    }
    if (profile.party && !partyName) {
      setConfirmDialog({
        title: "Leave party?",
        message: `Leave ${profile.party}?`,
        confirmLabel: "Leave",
        danger: true,
        onConfirm: () => applyPartySelection(savedPartyId, partyName),
      });
      return;
    }
    await applyPartySelection(savedPartyId, partyName);
  };

  const applyPartySelection = async (savedPartyId: string | null, partyName: string | null) => {
    mergeWrittenResponses({ party_id: savedPartyId, new_party: undefined });
    await saveProfile({ party: partyName } as any);
    setShowPartyModal(false);
  };

  const saveConstituencySelection = async () => {
    if (!profile) return;
    const c = getConstituencyById(constituencyDraftId);
    if (!c) return;
    if (unavailableConstituencies.includes(normalizeConstituencyId(c.id) ?? c.id)) {
      toast.error("That constituency has already been selected in this class");
      return;
    }
    mergeWrittenResponses({ constituency_id: c.id });
    await saveProfile({
      constituency_name: c.id.toUpperCase(),
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
  const shouldCollapseStatement = countWords(personalStatement) > PROFILE_COLLAPSE_WORDS;
  const shouldCollapseConstituency = countWords(constituencyDescription) > PROFILE_COLLAPSE_WORDS;
  const keyIssuesRaw = (profile.written_responses || {})["key_issues"];
  const keyIssues: string[] = Array.isArray(keyIssuesRaw)
    ? keyIssuesRaw
    : String(keyIssuesRaw || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
  const isTeacherProfile = profile.role === "teacher";
  const sampleBadge = isTeacherProfile && !isMe ? <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">Sample work</span> : null;
  const exampleEmptyText = isTeacherProfile && isMe ? "Input example response." : emptySectionText;

  const sectionTextValue = (sectionKey: string) => {
    if (sectionKey === "personal_statement") return profile.personal_statement || "";
    const raw = (profile.written_responses || {})[sectionKey];
    if (Array.isArray(raw)) return raw.filter(Boolean).join("\n");
    return String(raw || "");
  };

  const renderLongResponseSection = (section: ProfileSectionRow) => {
    const value = sectionTextValue(section.section_key);
    const lines = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return (
      <section key={section.section_key} className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${section.width === "full" ? "md:col-span-2" : ""}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
          <div className="flex items-center gap-3">
            {sampleBadge}
            <div className="text-xs italic text-gray-500">{updatedAt ? new Date(updatedAt).toLocaleDateString() : ""}</div>
            {isMe && editingSection !== section.section_key && (
              <button onClick={() => startEdit(section.section_key)} className="text-blue-600 transition-colors hover:text-blue-700">
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {editingSection === section.section_key ? (
          <div className="space-y-3">
            <textarea
              ref={setTextareaRef}
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              placeholder={isTeacherProfile && isMe ? "Input example response." : `Enter ${section.title.toLowerCase()}...`}
              rows={section.width === "full" ? 10 : 7}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            <div className={`text-xs ${countWords(editingContent) > profileWordLimit ? "text-red-600" : "text-gray-500"}`}>
              {countWords(editingContent)} / {profileWordLimit} words
            </div>
            {section.section_key === "key_issues" && <div className="text-xs text-gray-500">Enter one issue per line.</div>}
            <div className="flex items-center gap-2">
              <button
                onClick={() => void saveEdit(section.section_key)}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
              <button onClick={cancelEdit} className="flex items-center gap-2 px-4 py-2 text-gray-700 transition-colors hover:text-gray-900">
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        ) : value.trim() ? (
          section.section_key === "key_issues" && countWords(value) < 500 ? (
            <ul className="space-y-2">
              {lines.map((issue, index) => (
                <li key={`${section.section_key}-${index}`} className="flex items-start text-gray-700">
                  <span className="mr-2">&bull;</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          ) : (
            <CollapsibleText text={value} limit={500} className="text-gray-700" />
          )
        ) : (
          <p className="italic text-gray-400">{exampleEmptyText}</p>
        )}
      </section>
    );
  };

  const renderLegislationSection = (section: ProfileSectionRow) => (
    <section key={section.section_key} className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${section.width === "full" ? "md:col-span-2" : ""}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
        </div>
        <Link to={`/bills?sponsor=${profile?.user_id ?? ""}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
          All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="space-y-3">
        {billsAuthored.length ? (
          billsAuthored.map((bill: any) => (
            <Link key={bill.id} to={`/bills/${bill.id}`} className="block rounded-md bg-gray-50 p-3 transition-colors hover:bg-gray-100">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-gray-900">{bill.hr_label}</span>
                <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">{statusLabel(bill.status)}</span>
              </div>
              <p className="text-sm text-gray-700">{bill.title}</p>
            </Link>
          ))
        ) : (
          <p className="text-sm text-gray-500">No legislation yet</p>
        )}
      </div>
    </section>
  );

  const renderOrganizationsSection = (section: ProfileSectionRow) => (
    <section key={section.section_key} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:col-span-2">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium text-gray-900">
            <span>Committees</span>
            <Link to={`/committees?q=${encodeURIComponent(profile?.display_name ?? "")}`} className="mr-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
              All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {orgs.committees.length === 0 ? (
            <div className="text-sm text-gray-500">None</div>
          ) : (
            <ul className="space-y-1">
              {orgs.committees.map((c) => (
                <li key={c.id} className="text-sm">
                  <Link to={`/committees/${c.id}`} className="text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium text-gray-900">
            <span>Caucuses</span>
            <Link to={`/caucuses?q=${encodeURIComponent(profile?.display_name ?? "")}`} className="mr-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
              All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {orgs.caucuses.length === 0 ? (
            <div className="text-sm text-gray-500">None</div>
          ) : (
            <ul className="space-y-1">
              {orgs.caucuses.map((c) => (
                <li key={c.id} className="text-sm">
                  <Link to={`/caucuses/${c.id}`} className="text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );

  const renderLettersSection = (section: ProfileSectionRow) => (
    <section key={section.section_key} className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${section.width === "full" ? "md:col-span-2" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
        </div>
        <Link to={`/records?type=letter&author=${profile?.user_id ?? ""}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
          All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="space-y-2">
        {lettersAuthored.length ? lettersAuthored.map((letter) => (
          <Link key={letter.id} to={`/letters/${letter.id}`} className="block rounded-md bg-gray-50 p-3 text-sm hover:bg-gray-100">
            <div className="font-semibold text-gray-900">{letter.subject || "Dear Colleague Letter"}</div>
            <div className="mt-1 text-xs text-gray-500">{new Date(letter.created_at).toLocaleDateString()}</div>
          </Link>
        )) : <p className="text-sm text-gray-500">No Dear Colleague letters yet</p>}
      </div>
    </section>
  );

  const renderVotesCastSection = (section: ProfileSectionRow) => (
    <section key={section.section_key} className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${section.width === "full" ? "md:col-span-2" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
        </div>
        <Link to={`/records?type=vote&user=${profile?.user_id ?? ""}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
          All <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="space-y-2">
        {votesCast.length ? (
          votesCast.map((vote) => (
            <Link key={vote.id} to={vote.href} className="block rounded-md bg-gray-50 p-3 text-sm hover:bg-gray-100">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-gray-900">{vote.label} - {vote.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{vote.context} - {new Date(vote.date).toLocaleDateString()}</div>
                </div>
                <span className="shrink-0 rounded bg-blue-100 px-2 py-1 text-xs font-semibold uppercase text-blue-700">{vote.vote}</span>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-gray-500">No votes cast yet</p>
        )}
      </div>
    </section>
  );

  const renderProfileSection = (section: ProfileSectionRow) => {
    if (section.section_type === "legislation_written") return renderLegislationSection(section);
    if (section.section_type === "organizations") return renderOrganizationsSection(section);
    if (section.section_type === "dear_colleague_letters") return renderLettersSection(section);
    if (section.section_type === "votes_cast") return renderVotesCastSection(section);
    return renderLongResponseSection(section);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BackButton className="mb-4" />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => {
                  if (!isMe) return;
                  setPhotoModalOpen(true);
                  setPhotoModalTab("upload");
                }}
                disabled={!isMe}
                className="relative rounded-full text-left disabled:cursor-default"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || "Profile"}
                    className="w-16 h-16 rounded-full object-cover"
                    style={{ objectPosition: `${avatarPosition.x}% ${avatarPosition.y}%` }}
                  />
                ) : (
                  <DefaultAvatar className="w-16 h-16" iconClassName="w-8 h-8 text-gray-500" />
                )}
                {isMe && (
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700">
                    <Pencil className="w-3 h-3" />
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1 sm:min-w-[24rem]">
                {isMe ? (
                  <input
                    className="mb-2 w-full rounded-md border-2 border-dashed border-gray-300 bg-transparent px-3 py-1 text-2xl font-bold text-gray-900 outline-none hover:border-blue-300 focus:border-blue-500"
                    value={profileNameFocused ? (profile.display_name || "") : displayPersonName(profile.display_name || "")}
                    maxLength={64}
                    onChange={(e) => setProfile({ ...profile, display_name: e.target.value.slice(0, 64) })}
                    onFocus={() => setProfileNameFocused(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={() => {
                      setProfileNameFocused(false);
                      void saveProfile({ display_name: profile.display_name } as any, true);
                    }}
                    placeholder={nameInputPlaceholder()}
                    title="Enter your name as First Name, Last Name. If there is no comma, the full entry is treated as your first name."
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{displayPersonName(profile.display_name || "Student")}</h1>
                )}
                {isTeacherProfile ? (
                  <div className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">Teacher</div>
                ) : (
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{formatConstituencyFull(profile.constituency_name)}</span>
                      {canChooseRepresentation && (
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
                      {canChooseRepresentation && (
                        <button
                          onClick={() => setShowPartyModal(true)}
                          className="text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Change
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Cook PVI: {profile.constituency_cook_pvi || "N/A"}{" "}
                      {profile.constituency_url ? (
                        <a href={profile.constituency_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          Wikipedia
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {!isMe && (
                <Link
                  to={`/dear-colleague/compose?to=${encodeURIComponent(profile.user_id)}`}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Mail className="h-4 w-4" />
                  Send letter
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {profileSections.map(renderProfileSection)}
        </div>
        {false && (
        <>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Personal Statement</h2>
            <div className="flex items-center gap-3">
              {sampleBadge}
              <div className="text-xs italic text-gray-500">{updatedAt ? new Date(updatedAt).toLocaleDateString() : ""}</div>
              {isMe && editingSection !== "personal_statement" && (
                <button onClick={() => startEdit("personal_statement")} className="text-blue-600 hover:text-blue-700 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {editingSection === "personal_statement" ? (
            <div className="space-y-3">
              <textarea
                ref={setTextareaRef}
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Enter your personal statement..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
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
              {shouldCollapseStatement ? (
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
                          {truncateWords(personalStatement, PROFILE_COLLAPSE_WORDS).split("\n\n").map((para, index) => (
                            <p key={index}>{para}</p>
                          ))}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
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
            <p className="text-gray-400 italic">{emptySectionText}</p>
          )}
        </div>

        {!isTeacherProfile && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Constituency Description</h2>
            <div className="flex items-center gap-3">
              <div className="text-xs italic text-gray-500">{updatedAt ? new Date(updatedAt).toLocaleDateString() : ""}</div>
              {isMe && editingSection !== "constituency_description" && (
                <button onClick={() => startEdit("constituency_description")} className="text-blue-600 hover:text-blue-700 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {editingSection === "constituency_description" ? (
            <div className="space-y-3">
              <textarea
                ref={setTextareaRef}
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Enter constituency description..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
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
              {shouldCollapseConstituency ? (
                <>
                  <div className={showFullConstituency ? "" : "relative pb-6"}>
                    {showFullConstituency ? (
                      <div className="text-gray-700 space-y-4 whitespace-pre-line">{constituencyDescription}</div>
                    ) : (
                      <>
                        <div className="text-gray-700 whitespace-pre-line">{truncateWords(constituencyDescription, PROFILE_COLLAPSE_WORDS)}</div>
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
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
            <p className="text-gray-400 italic">{emptySectionText}</p>
          )}
        </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Key Issues</h2>
            <div className="flex items-center gap-3">
              {sampleBadge}
              <div className="text-xs italic text-gray-500">{updatedAt ? new Date(updatedAt).toLocaleDateString() : ""}</div>
              {isMe && editingSection !== "key_issues" && (
                <button onClick={() => startEdit("key_issues")} className="text-blue-600 hover:text-blue-700 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
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
            <p className="text-gray-400 italic">{emptySectionText}</p>
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
                  <Link key={bill.id} to={`/bills/${bill.id}`} className="block p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-gray-900">{bill.hr_label}</span>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">{statusLabel(bill.status)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{bill.title}</p>
                  </Link>
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
                  <Link key={bill.id} to={`/bills/${bill.id}`} className="block p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-gray-900">{bill.hr_label}</span>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">{statusLabel(bill.status)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{bill.title}</p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-gray-500">No legislation cosponsored yet</p>
              )}
            </div>
          </div>
        </div>

        {!isTeacherProfile && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Organizations</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-900 mb-2">Committees</div>
              {orgs.committees.length === 0 ? (
                <div className="text-sm text-gray-500">None</div>
              ) : (
                <ul className="space-y-1">
                  {orgs.committees.map((c) => (
                    <li key={c.id} className="text-sm">
                      <Link to={`/committees/${c.id}`} className="text-blue-600 hover:underline">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 mb-2">Caucuses</div>
              {orgs.caucuses.length === 0 ? (
                <div className="text-sm text-gray-500">None</div>
              ) : (
                <ul className="space-y-1">
                  {orgs.caucuses.map((c) => (
                    <li key={c.id} className="text-sm">
                      <Link to={`/caucuses/${c.id}`} className="text-blue-600 hover:underline">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Dear Colleague Letters</h2>
          </div>
          <p className="text-gray-600">Coming soon</p>
        </div>
        </>
        )}
      </main>

      {showPartyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowPartyModal(false)} className="absolute right-6 top-6 z-10 text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 pr-14">
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
          <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowConstituencyModal(false)}
              className="absolute right-6 top-6 z-10 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6 pr-14">
              <ConstituencyPicker selected={constituencyDraftId} unavailableIds={unavailableConstituencies} onSelect={(cid) => setConstituencyDraftId(cid)} />
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
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      {photoModalOpen && isMe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Profile picture</h2>
                <p className="text-sm text-gray-500">Upload or adjust how your photo is centered.</p>
              </div>
              <button type="button" onClick={() => setPhotoModalOpen(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <button type="button" onClick={() => setPhotoModalTab("upload")} className={`rounded-full px-4 py-2 text-sm font-semibold ${photoModalTab === "upload" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>Upload</button>
              <button type="button" onClick={() => setPhotoModalTab("center")} disabled={!profile.avatar_url} className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 ${photoModalTab === "center" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>Centering</button>
            </div>
            <div className="p-4 pt-0">
              {photoModalTab === "upload" ? (
                <label
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0];
                    if (file) void handleUploadAvatar(file);
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-10 text-center hover:border-blue-400 hover:bg-blue-50"
                >
                  <input type="file" className="hidden" accept="image/png,image/jpeg" onChange={(event) => event.target.files?.[0] && void handleUploadAvatar(event.target.files[0])} />
                  <Pencil className="mb-3 h-8 w-8 text-blue-600" />
                  <div className="text-sm font-semibold text-gray-900">Drag a file into this box or click to upload a profile picture.</div>
                  <div className="mt-2 text-xs text-gray-500">Accepted formats: PNG and JPG.</div>
                </label>
              ) : (
                <div className="space-y-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      avatarDragRef.current = { startX: event.clientX, startY: event.clientY, baseX: avatarPosition.x, baseY: avatarPosition.y };
                      setDraggingAvatar(true);
                    }}
                    onPointerMove={(event) => {
                      if (draggingAvatar) updateAvatarDrag(event.clientX, event.clientY);
                    }}
                    onPointerUp={() => {
                      setDraggingAvatar(false);
                      avatarDragRef.current = null;
                    }}
                    onPointerCancel={() => {
                      setDraggingAvatar(false);
                      avatarDragRef.current = null;
                    }}
                    className="relative mx-auto h-72 w-full touch-none overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                  >
                    {profile.avatar_url && <img src={profile.avatar_url} alt="Profile preview" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${avatarPosition.x}% ${avatarPosition.y}%` }} draggable={false} />}
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0_95px,rgba(17,24,39,0.48)_96px)]" />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(17,24,39,0.25)]" />
                  </div>
                  <p className="text-center text-sm text-gray-600">Drag the image to choose what sits in the circle.</p>
                  <button type="button" onClick={() => void saveAvatarPosition()} className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                    Save centering
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
