import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { AlignLeft, FileText, GripVertical, Mail, Maximize2, PanelLeft, Plus, Save, Trash2, Users } from "lucide-react";
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
  return AlignLeft;
}

export function ProfileLayoutEditor({ embedded = false }: { embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [sections, setSections] = useState<ProfileSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after">("before");
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const [sectionWordLimits, setSectionWordLimits] = useState<Record<string, number>>({});
  const [activeView, setActiveView] = useState<"editor" | "preview">("editor");
  const dragStartRef = useRef<{ key: string; startX: number; startY: number; moved: boolean; index: number } | null>(null);

  const markDirty = () => {
    if (embedded) window.dispatchEvent(new CustomEvent("gavel:profile-layout-dirty"));
  };

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
      const { data: cls } = await supabase.from("classes").select("settings").eq("id", activeClass).maybeSingle();
      setSectionWordLimits(((cls as any)?.settings?.profileSectionWordLimits ?? {}) as Record<string, number>);
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
    markDirty();
    setSections((prev) =>
      prev.map((section) => {
        if (section.section_key !== sectionKey) return section;
        const next = { ...section, ...patch };
        if (next.section_type === "organizations") next.width = "full";
        return next;
      }),
    );
  };

  const moveSectionTo = (fromKey: string, toKey: string, position: "before" | "after" = "before") => {
    markDirty();
    setSections((prev) => {
      const next = [...prev];
      const from = next.findIndex((section) => section.section_key === fromKey);
      const to = next.findIndex((section) => section.section_key === toKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const [item] = next.splice(from, 1);
      const targetIndex = next.findIndex((section) => section.section_key === toKey);
      next.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, item);
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
    markDirty();
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
      const { data: cls } = await supabase.from("classes").select("settings").eq("id", classId).maybeSingle();
      const nextSettings = {
        ...(((cls as any)?.settings ?? {}) as any),
        profileSectionWordLimits: sectionWordLimits,
      };
      const { error: settingsError } = await supabase.from("classes").update({ settings: nextSettings } as any).eq("id", classId);
      if (settingsError) throw settingsError;
      if (!embedded) toast.success("Profile layout saved");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not save profile layout");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!embedded) return;
    const saveFromSettings = () => {
      void saveLayout();
    };
    window.addEventListener("gavel:save-profile-layout", saveFromSettings);
    return () => window.removeEventListener("gavel:save-profile-layout", saveFromSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, classId, normalizedSections, sectionWordLimits]);

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

  const onPointerStart = (event: PointerEvent<HTMLButtonElement>, sectionKey: string) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { key: sectionKey, startX: event.clientX, startY: event.clientY, moved: false, index: normalizedSections.findIndex((section) => section.section_key === sectionKey) };
    setDraggingKey(sectionKey);
    setDragPointer({ x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragStartRef.current;
    if (!drag) return;
    drag.moved = drag.moved || Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4;
    setDragPointer({ x: event.clientX, y: event.clientY });
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-profile-section-key]"));
    const generousTarget = cards.find((card) => {
      const rect = card.getBoundingClientRect();
      return event.clientX >= rect.left - 48 && event.clientX <= rect.right + 48 && event.clientY >= rect.top - 48 && event.clientY <= rect.bottom + 48;
    });
    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const card = generousTarget ?? target?.closest<HTMLElement>("[data-profile-section-key]") ?? null;
    const key = card?.getAttribute("data-profile-section-key") ?? null;
    if (key && key !== drag.key) {
      const rect = card.getBoundingClientRect();
      setDragOverKey(key);
      setDragOverPosition(event.clientY > rect.top + rect.height / 2 ? "after" : "before");
    }
  };

  const finishPointerDrag = () => {
    const fromKey = dragStartRef.current?.key ?? draggingKey;
    const toKey = dragOverKey;
    const fromIndex = dragStartRef.current?.index ?? -1;
    const toIndex = normalizedSections.findIndex((section) => section.section_key === toKey);
    const noChange = (dragOverPosition === "before" && toIndex === fromIndex + 1) || (dragOverPosition === "after" && toIndex === fromIndex - 1);
    if (fromKey && toKey && fromKey !== toKey && !noChange) moveSectionTo(fromKey, toKey, dragOverPosition);
    dragStartRef.current = null;
    setDraggingKey(null);
    setDragOverKey(null);
    setDragOverPosition("before");
    setDragPointer(null);
  };

  const usedSingleTypes = new Set(sections.filter((section) => section.section_type !== "long_response").map((section) => section.section_type));

  const sampleLongResponse = (section: ProfileSection) => {
    if (section.section_key === "key_issues") return ["Clean water access", "Reliable public transit", "Student data privacy"];
    if (section.section_key === "constituency_description") return "District 7 includes dense neighborhoods, waterfront industry, and several public colleges. Residents are focused on housing affordability, infrastructure, and job training.";
    return "I represent a district where civic participation is practical, local, and deeply connected to everyday services. My priorities are transparent government, strong schools, and responsible budgeting.";
  };

  const renderPreviewSection = (section: ProfileSection) => {
    const span = section.width === "full" || section.section_type === "organizations" ? "md:col-span-2" : "";
    if (section.section_type === "legislation_written") {
      return (
        <section key={`preview-${section.section_key}`} className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${span}`}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">{section.title || "Untitled section"}</h2>
            </div>
            <span className="text-sm font-medium text-blue-600">All</span>
          </div>
          <div className="space-y-3">
            {[
              ["H.R. 12", "Civic Records Modernization Act", "Reported"],
              ["H.R. 18", "Community Transit Access Act", "Draft"],
            ].map(([label, title, status]) => (
              <div key={label} className="rounded-md bg-gray-50 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-gray-900">{label}</span>
                  <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">{status}</span>
                </div>
                <p className="text-sm text-gray-700">{title}</p>
              </div>
            ))}
          </div>
        </section>
      );
    }
    if (section.section_type === "organizations") {
      return (
        <section key={`preview-${section.section_key}`} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">{section.title || "Untitled section"}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium text-gray-900">Committees</div>
              <ul className="space-y-1 text-sm text-blue-600">
                <li>Education Committee</li>
                <li>Budget & Appropriations Committee</li>
              </ul>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-gray-900">Caucuses</div>
              <ul className="space-y-1 text-sm text-blue-600">
                <li>Student Privacy Caucus</li>
                <li>Infrastructure Working Group</li>
              </ul>
            </div>
          </div>
        </section>
      );
    }
    if (section.section_type === "dear_colleague_letters") {
      return (
        <section key={`preview-${section.section_key}`} className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${span}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">{section.title || "Untitled section"}</h2>
            </div>
            <span className="text-sm font-medium text-blue-600">All</span>
          </div>
          <div className="space-y-2">
            {["Seeking cosponsors for transit access", "Markup priorities for H.R. 12"].map((subject) => (
              <div key={subject} className="rounded-md bg-gray-50 p-3 text-sm">
                <div className="font-semibold text-gray-900">{subject}</div>
                <div className="mt-1 text-xs text-gray-500">{new Date().toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </section>
      );
    }
    const sample = sampleLongResponse(section);
    return (
      <section key={`preview-${section.section_key}`} className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${span}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">{section.title || "Untitled section"}</h2>
          <div className="text-xs italic text-gray-500">{new Date().toLocaleDateString()}</div>
        </div>
        {Array.isArray(sample) ? (
          <ul className="space-y-2">
            {sample.map((issue) => (
              <li key={issue} className="flex items-start text-gray-700">
                <span className="mr-2">&bull;</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-700">{sample}</p>
        )}
      </section>
    );
  };

  const content = (
    <main className={embedded ? "space-y-5" : "mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"}>
      <div className="mb-5 inline-flex rounded-md border border-gray-200 bg-white p-1 shadow-sm">
        {(["editor", "preview"] as const).map((view) => (
          <button key={view} type="button" onClick={() => setActiveView(view)} className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${activeView === view ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>
            {view}
          </button>
        ))}
      </div>

      {activeView === "editor" && <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
        {!embedded && (
          <button type="button" onClick={() => void saveLayout()} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Save className="h-4 w-4" />
            Save Layout
          </button>
        )}
      </div>}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading layout...</div>
      ) : activeView === "editor" ? (
        <div className="grid grid-cols-2 gap-4">
          {normalizedSections.map((section) => {
            const Icon = sectionIcon(section.section_type);
            const sourceIndex = dragStartRef.current?.index ?? -1;
            const targetIndex = normalizedSections.findIndex((row) => row.section_key === section.section_key);
            const beforeWouldChange = targetIndex !== sourceIndex + 1;
            const afterWouldChange = targetIndex !== sourceIndex - 1;
            const showMoveBefore = dragOverKey === section.section_key && draggingKey !== section.section_key && dragOverPosition === "before" && beforeWouldChange;
            const showMoveAfter = dragOverKey === section.section_key && draggingKey !== section.section_key && dragOverPosition === "after" && afterWouldChange;
            return (
              <div key={section.section_key} className={`relative ${section.width === "full" ? "col-span-2" : ""}`}>
              {showMoveBefore && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex -translate-y-1/2 items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/90 py-3 text-sm font-medium text-blue-700 shadow-sm">
                  Move here
                </div>
              )}
              <div
                data-profile-section-key={section.section_key}
                className={`rounded-lg border bg-white p-4 shadow-sm transition ${draggingKey === section.section_key ? "border-blue-300 opacity-50" : "border-gray-200"}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      onPointerDown={(event) => onPointerStart(event, section.section_key)}
                      onPointerMove={onPointerMove}
                      onPointerUp={finishPointerDrag}
                      onPointerCancel={finishPointerDrag}
                      className="touch-none rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                      aria-label={`Move ${section.title}`}
                    >
                      <GripVertical className="h-4 w-4 cursor-grab" />
                    </button>
                    <Icon className="h-4 w-4 text-blue-600" />
                    {section.section_type === "long_response" ? (
                      <input
                        value={section.title}
                        onChange={(event) => updateSection(section.section_key, { title: event.target.value })}
                        className="min-w-0 flex-1 border-b border-gray-300 bg-transparent text-base font-semibold text-gray-900 outline-none focus:border-blue-500"
                      />
                    ) : (
                      <div className="min-w-0 flex-1 text-base font-semibold text-gray-900">{section.title}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateSection(section.section_key, { width: section.width === "full" ? "half" : "full" })}
                      disabled={section.section_type === "organizations"}
                      className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={section.width === "full" ? "Make half width" : "Make full width"}
                    >
                      {section.width === "full" ? <PanelLeft className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => void requestDelete(section)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete section">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {section.section_type === "long_response" && (
                  <label className="mt-3 block text-xs font-semibold text-gray-600">
                    Max words
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={sectionWordLimits[section.section_key] ?? 1000}
                      onChange={(event) => {
                        markDirty();
                        const value = Math.min(2000, Math.max(1, Number(event.target.value) || 1000));
                        setSectionWordLimits((current) => ({ ...current, [section.section_key]: value }));
                      }}
                      className="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                )}
              </div>
              {showMoveAfter && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex translate-y-1/2 items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/90 py-3 text-sm font-medium text-blue-700 shadow-sm">
                  Move here
                </div>
              )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {normalizedSections.map(renderPreviewSection)}
        </div>
      )}
      {draggingKey && dragPointer && (
        <div
          className="pointer-events-none fixed z-[120] rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xl"
          style={{ left: dragPointer.x + 12, top: dragPointer.y + 12 }}
        >
          Moving section
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
