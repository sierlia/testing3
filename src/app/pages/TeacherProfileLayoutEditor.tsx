import { useEffect, useMemo, useState, type DragEvent } from "react";
import { FileText, GripVertical, Layout, Mail, Maximize2, Minimize2, Plus, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "../components/Navigation";
import { ConfirmDialog, ConfirmDialogState } from "../components/ConfirmDialog";
import { supabase } from "../utils/supabase";

type SectionType = "long_response" | "legislation_written" | "organizations" | "dear_colleague_letters";
type ProfileSection = {
  id?: string;
  class_id: string;
  section_key: string;
  title: string;
  section_type: SectionType;
  width: "full" | "half";
  is_editable: boolean;
  position: number;
};

const defaultSections: Array<Omit<ProfileSection, "class_id">> = [
  { section_key: "personal_statement", title: "Personal Statement", section_type: "long_response", width: "full", is_editable: true, position: 0 },
  { section_key: "constituency_description", title: "Constituency Description", section_type: "long_response", width: "full", is_editable: true, position: 1 },
  { section_key: "key_issues", title: "Key Issues", section_type: "long_response", width: "full", is_editable: true, position: 2 },
  { section_key: "legislation_written", title: "Legislation Written", section_type: "legislation_written", width: "half", is_editable: false, position: 3 },
  { section_key: "organizations", title: "Organizations", section_type: "organizations", width: "full", is_editable: false, position: 4 },
  { section_key: "dear_colleague_letters", title: "Dear Colleague Letters", section_type: "dear_colleague_letters", width: "full", is_editable: false, position: 5 },
];

const typeLabels: Record<SectionType, string> = {
  long_response: "Long response",
  legislation_written: "Legislation written",
  organizations: "Organizations",
  dear_colleague_letters: "Dear Colleague letters",
};

function sectionIcon(type: SectionType) {
  if (type === "legislation_written") return FileText;
  if (type === "organizations") return Users;
  if (type === "dear_colleague_letters") return Mail;
  return Layout;
}

export function ProfileLayoutEditor({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [sections, setSections] = useState<ProfileSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
      const activeClass = (profile as any)?.class_id ?? null;
      setClassId(activeClass);
      if (!activeClass) return;
      const { data, error } = await supabase
        .from("class_profile_sections")
        .select("id,class_id,section_key,title,section_type,width,is_editable,position")
        .eq("class_id", activeClass)
        .order("position", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as ProfileSection[];
      setSections(rows.length ? rows : defaultSections.map((section) => ({ ...section, class_id: activeClass })));
    } catch (e: any) {
      toast.error(e.message || "Could not load profile layout");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const normalizedSections = useMemo(
    () => sections.map((section, index) => ({ ...section, position: index })),
    [sections],
  );

  const updateSection = (sectionKey: string, patch: Partial<ProfileSection>) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.section_key !== sectionKey) return section;
        const next = { ...section, ...patch };
        if (next.section_type === "organizations") next.width = "full";
        return next;
      }),
    );
  };

  const moveSectionTo = (fromKey: string, toKey: string) => {
    setSections((prev) => {
      const next = [...prev];
      const from = next.findIndex((section) => section.section_key === fromKey);
      const to = next.findIndex((section) => section.section_key === toKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const addSection = (type: SectionType = "long_response") => {
    if (!classId) return;
    if (type !== "long_response" && sections.some((section) => section.section_type === type)) {
      toast.error(`${typeLabels[type]} can only be added once`);
      return;
    }
    const stamp = Date.now();
    setSections((prev) => [
      ...prev,
      {
        class_id: classId,
        section_key: `custom_${stamp}`,
        title: type === "long_response" ? "New Response Section" : typeLabels[type],
        section_type: type,
        width: type === "organizations" ? "full" : "full",
        is_editable: true,
        position: prev.length,
      },
    ]);
  };

  const saveLayout = async () => {
    if (!classId) return toast.error("Open a class first");
    setSaving(true);
    try {
      const payload = normalizedSections.map((section) => ({
        class_id: classId,
        section_key: section.section_key,
        title: section.title.trim() || "Untitled section",
        section_type: section.section_type,
        width: section.section_type === "organizations" ? "full" : section.width,
        is_editable: section.is_editable,
        position: section.position,
      }));
      const { error } = await supabase.from("class_profile_sections").upsert(payload as any, { onConflict: "class_id,section_key" });
      if (error) throw error;
      toast.success("Profile layout saved");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not save profile layout");
    } finally {
      setSaving(false);
    }
  };

  const removeSectionNow = async (section: ProfileSection) => {
    if (!classId) return;
    if (section.id) {
      const { error } = await supabase.rpc("delete_profile_section_and_work", { target_class: classId, target_section_key: section.section_key } as any);
      if (error) return toast.error(error.message || "Could not delete section");
    }
    setSections((prev) => prev.filter((row) => row.section_key !== section.section_key));
    toast.success("Section deleted");
  };

  const requestDelete = async (section: ProfileSection) => {
    if (!classId) return;
    let count = 0;
    if (section.id && section.section_type === "long_response") {
      const { data } = await supabase.rpc("profile_section_work_count", { target_class: classId, target_section_key: section.section_key } as any);
      count = Number(data ?? 0);
    }
    const finalDelete = () => {
      setConfirmDialog({
        title: "Delete section?",
        message: "This section will be removed from every student profile in this class.",
        confirmLabel: "Delete section",
        danger: true,
        onConfirm: () => removeSectionNow(section),
      });
    };
    if (!count) {
      finalDelete();
      return;
    }
    setConfirmDialog({
      title: "Delete section with student work?",
      message: `${count} student${count === 1 ? " has" : "s have"} written work in this box. Deleting it will permanently delete that work.`,
      confirmLabel: "Proceed",
      danger: true,
      onConfirm: () => {
        window.setTimeout(() => {
          setConfirmDialog({
            title: "Permanently delete student work?",
            message: "This action cannot be undone. The section and all stored student responses for it will be permanently deleted.",
            confirmLabel: "Delete permanently",
            danger: true,
            onConfirm: () => removeSectionNow(section),
          });
        }, 0);
      },
    });
  };

  const onDragStart = (event: DragEvent<HTMLDivElement>, sectionKey: string) => {
    setDraggingKey(sectionKey);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sectionKey);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>, sectionKey: string) => {
    event.preventDefault();
    const fromKey = event.dataTransfer.getData("text/plain") || draggingKey;
    if (fromKey) moveSectionTo(fromKey, sectionKey);
    setDraggingKey(null);
  };

  const usedSingleTypes = new Set(sections.filter((section) => section.section_type !== "long_response").map((section) => section.section_type));

  const content = (
    <main className={embedded ? "space-y-5" : "mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"}>
      <div className="mb-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Edit Profile Layout</h1>
        <p className="mt-1 text-sm text-gray-600">
          Rename, reorder, add, resize, or remove profile sections for student profiles in this class.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["long_response", "legislation_written", "organizations", "dear_colleague_letters"] as SectionType[]).map((type) => {
            const Icon = sectionIcon(type);
            const disabled = type !== "long_response" && usedSingleTypes.has(type);
            return (
              <button key={type} type="button" onClick={() => addSection(type)} disabled={disabled} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" />
                <Icon className="h-4 w-4" />
                {typeLabels[type]}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => void saveLayout()} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          <Save className="h-4 w-4" />
          Save Layout
        </button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading layout...</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {normalizedSections.map((section, index) => {
            const Icon = sectionIcon(section.section_type);
            return (
              <div
                key={section.section_key}
                draggable
                onDragStart={(event) => onDragStart(event, section.section_key)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, section.section_key)}
                onDragEnd={() => setDraggingKey(null)}
                className={`rounded-lg border bg-white p-4 shadow-sm transition ${section.width === "full" ? "col-span-2" : ""} ${draggingKey === section.section_key ? "border-blue-300 opacity-60" : "border-gray-200"}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <GripVertical className="h-4 w-4 cursor-grab text-gray-400" />
                    <Icon className="h-4 w-4 text-blue-600" />
                    <input
                      value={section.title}
                      onChange={(event) => updateSection(section.section_key, { title: event.target.value })}
                      className="min-w-0 flex-1 border-b border-transparent bg-transparent text-base font-semibold text-gray-900 outline-none hover:border-gray-300 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateSection(section.section_key, { width: section.width === "full" ? "half" : "full" })}
                      disabled={section.section_type === "organizations"}
                      className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={section.width === "full" ? "Make half width" : "Make full width"}
                    >
                      {section.width === "full" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => void requestDelete(section)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete section">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-1">
                  <select value={section.section_type} onChange={(event) => updateSection(section.section_key, { section_type: event.target.value as SectionType })} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value} disabled={value !== section.section_type && value !== "long_response" && usedSingleTypes.has(value as SectionType)}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </main>
  );

  if (embedded) return content;
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      {content}
    </div>
  );
}

export function TeacherProfileLayoutEditor() {
  return <ProfileLayoutEditor />;
}
