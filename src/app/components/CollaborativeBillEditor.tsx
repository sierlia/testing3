import { useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { Editor, Extension, Mark } from "@tiptap/core";
import { isChangeOrigin } from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { Bold, Code, Heading1, Heading2, Italic, List, ListOrdered, Pilcrow, Quote, RemoveFormatting } from "lucide-react";
import { supabase } from "../utils/supabase";
import { YjsSupabaseProvider } from "../utils/yjsSupabaseProvider";

function colorFromId(id: string) {
  const colors = ["#2563eb", "#7c3aed", "#16a34a", "#dc2626", "#0ea5e9", "#ea580c"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const editAttributionPluginKey = new PluginKey("committeeEditAttribution");

const EditHighlight = Mark.create({
  name: "editHighlight",
  inclusive: false,

  addAttributes() {
    return {
      authorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-edit-author-id"),
        renderHTML: () => ({}),
      },
      authorName: {
        default: "Member",
        parseHTML: (element) => element.getAttribute("data-edit-author") ?? "Member",
        renderHTML: () => ({}),
      },
      color: {
        default: "#2563eb",
        parseHTML: (element) => element.getAttribute("data-edit-color") ?? "#2563eb",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-edit-highlight]" }];
  },

  renderHTML({ mark }) {
    const authorId = mark.attrs.authorId || "";
    const authorName = String(mark.attrs.authorName || "").trim() || "Member";
    const color = mark.attrs.color || "#2563eb";
    return [
      "span",
      {
        "data-edit-highlight": "true",
        "data-edit-author-id": authorId,
        "data-edit-author": authorName,
        "data-edit-color": color,
        class: "committee-edit-highlight",
        style: `--edit-color:${color}; background-color: ${hexToRgba(color, 0.16)}; box-shadow: inset 0 -0.45em 0 ${hexToRgba(color, 0.1)};`,
      },
      0,
    ];
  },
});

function createEditAttributionExtension({
  getAuthor,
  shouldSuppress,
}: {
  getAuthor: () => { id: string; name: string; color: string };
  shouldSuppress: () => boolean;
}) {
  return Extension.create({
    name: "editAttribution",

    addProseMirrorPlugins() {
      const editor = this.editor;

      return [
        new Plugin({
          key: editAttributionPluginKey,
          appendTransaction: (transactions, _oldState, newState) => {
            if (!editor.isEditable || shouldSuppress()) return null;

            const markType = newState.schema.marks.editHighlight;
            if (!markType) return null;

            const changedTransactions = transactions.filter(
              (transaction) =>
                transaction.docChanged && !transaction.getMeta(editAttributionPluginKey) && !isChangeOrigin(transaction),
            );
            if (!changedTransactions.length) return null;

            const ranges: Array<{ from: number; to: number }> = [];
            for (const transaction of changedTransactions) {
              transaction.mapping.maps.forEach((stepMap, mapIndex) => {
                stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
                  if (newEnd <= newStart) return;
                  // Only highlight pure insertions (typing/paste). Replacements are harder to
                  // slice precisely; skipping them avoids painting over existing text.
                  if (oldEnd !== oldStart) return;
                  const laterMaps = transaction.mapping.slice(mapIndex + 1);
                  ranges.push({
                    from: laterMaps.map(newStart, 1),
                    to: laterMaps.map(newEnd, -1),
                  });
                });
              });
            }
            if (!ranges.length) return null;

            const author = getAuthor();
            if (!author?.id) return null;
            const mark = markType.create({
              authorId: author.id,
              authorName: String(author.name || "").trim() || "Member",
              color: author.color,
            });
            const tr = newState.tr;
            const max = newState.doc.content.size;

            for (const range of ranges) {
              const from = Math.max(0, Math.min(range.from, max));
              const to = Math.max(from, Math.min(range.to, max));
              if (to > from) tr.addMark(from, to, mark);
            }

            if (!tr.docChanged) return null;
            tr.setMeta(editAttributionPluginKey, true);
            tr.setMeta("addToHistory", false);
            return tr;
          },
        }),
      ];
    },
  });
}

function CommitteeEditorToolbar({ editor }: { editor: Editor }) {
  const run = (command: () => void) => {
    command();
    editor.view.focus();
  };

  const buttons = [
    { label: "Paragraph", icon: Pilcrow, onClick: () => run(() => editor.chain().focus().setParagraph().run()) },
    { label: "Heading 1", icon: Heading1, onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run()) },
    { label: "Heading 2", icon: Heading2, onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run()) },
    { label: "Bold", icon: Bold, onClick: () => run(() => editor.chain().focus().toggleBold().run()) },
    { label: "Italic", icon: Italic, onClick: () => run(() => editor.chain().focus().toggleItalic().run()) },
    { label: "Bullet list", icon: List, onClick: () => run(() => editor.chain().focus().toggleBulletList().run()) },
    { label: "Numbered list", icon: ListOrdered, onClick: () => run(() => editor.chain().focus().toggleOrderedList().run()) },
    { label: "Quote", icon: Quote, onClick: () => run(() => editor.chain().focus().toggleBlockquote().run()) },
    { label: "Code block", icon: Code, onClick: () => run(() => editor.chain().focus().toggleCodeBlock().run()) },
    { label: "Clear", icon: RemoveFormatting, onClick: () => run(() => editor.chain().focus().unsetAllMarks().clearNodes().run()) },
  ];

  return (
    <div className="flex items-center gap-1 border border-gray-200 border-b-0 bg-gray-50 px-2 py-2 rounded-t-md">
      {buttons.map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-white hover:text-gray-900"
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

export function CollaborativeBillEditor({
  classId,
  committeeId,
  billId,
  initialHtml,
  editable = true,
}: {
  classId: string;
  committeeId: string;
  billId: string;
  initialHtml: string;
  editable?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [localUser, setLocalUser] = useState<{ id: string; name: string; color: string }>({ id: "", name: "Member", color: "#2563eb" });
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YjsSupabaseProvider | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const didInitRef = useRef(false);
  const suppressAttributionRef = useRef(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const hydratedFromSnapshotRef = useRef(false);
  const [collabStatus, setCollabStatus] = useState<"connecting" | "live" | "fallback">("connecting");

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      didInitRef.current = false;
      hydratedFromSnapshotRef.current = false;
      setReady(false);
      setCollabStatus("connecting");

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("display_name").eq("user_id", uid).maybeSingle();
      const name = (p as any)?.display_name ?? auth.user?.user_metadata?.name ?? "Member";
      // Keep authorName in highlights consistent: prefer a concrete non-empty name.
      const normalizedName = String(name || "").trim() || "Member";
      let color = colorFromId(uid);
      try {
        const { data: row } = await supabase
          .from("committee_member_colors")
          .select("color")
          .eq("committee_id", committeeId)
          .eq("user_id", uid)
          .maybeSingle();
        const existing = (row as any)?.color as string | undefined;
        if (existing) color = existing;
      } catch {
        // ignore
      }
      try {
        // Backfill if missing.
        const { data: assigned, error: cErr } = await supabase.rpc("ensure_committee_member_color", { target_committee: committeeId } as any);
        if (!cErr && typeof assigned === "string" && assigned) color = assigned;
      } catch {
        // ignore; fall back to deterministic colorFromId
      }
      setLocalUser({ id: uid, name: normalizedName, color });

      const ydoc = new Y.Doc();
      const awareness = new Awareness(ydoc);
      ydocRef.current = ydoc;
      awarenessRef.current = awareness;

      const provider = new YjsSupabaseProvider(
        {
          doc: ydoc,
          awareness,
          key: { classId, committeeId, billId },
          user: { id: uid, name: normalizedName, color },
        },
        () => {
          hydratedFromSnapshotRef.current = provider.getHydratedFromSnapshot();
          setCollabStatus(provider.getSubscribed() ? "live" : "connecting");
          mounted && setReady(true);
        },
      );
      providerRef.current = provider;
    };
    void setup();

    return () => {
      mounted = false;
      providerRef.current?.destroy();
      providerRef.current = null;
      setEditor((prev) => {
        prev?.destroy();
        return null;
      });
      setEditorError(null);
      ydocRef.current?.destroy();
      ydocRef.current = null;
    };
  }, [billId, classId, committeeId]);

  useEffect(() => {
    if (!ready || !ydocRef.current || !awarenessRef.current) return;

    try {
      setEditorError(null);
      const ed = new Editor({
        editable,
        extensions: [
          // StarterKit provides the base schema (doc/paragraph/text/etc).
          (StarterKit as any)?.configure ? StarterKit.configure({ history: false }) : (StarterKit as any),
          EditHighlight,
          createEditAttributionExtension({
            getAuthor: () => localUser,
            shouldSuppress: () => suppressAttributionRef.current,
          }),
          Collaboration.configure({ document: ydocRef.current }),
          CollaborationCursor.configure({
            provider: { awareness: awarenessRef.current } as any,
            user: { name: localUser.name, color: localUser.color },
          }),
        ],
        editorProps: {
          attributes: {
            class: "prose max-w-none focus:outline-none min-h-[420px] p-4 rounded-md border border-gray-200 bg-white",
          },
        },
        // Ensure schema is created with a doc node even before any remote steps arrive.
        content: "<p></p>",
      });

      setEditor(ed);
      setCollabStatus("live");
      return () => {
        ed.destroy();
        setEditor(null);
      };
    } catch (e: any) {
      // Fallback: if collaboration init fails for any reason, still show a non-collaborative editor
      // so the workspace doesn't crash. This also lets us surface the error to debug.
      try {
        const ed = new Editor({
          editable,
          extensions: [
            (StarterKit as any)?.configure ? StarterKit.configure({ history: false }) : (StarterKit as any),
            EditHighlight,
            createEditAttributionExtension({
              getAuthor: () => localUser,
              shouldSuppress: () => suppressAttributionRef.current,
            }),
          ],
          editorProps: {
            attributes: {
              class: "prose max-w-none focus:outline-none min-h-[420px] p-4 rounded-md border border-gray-200 bg-white",
            },
          },
          content: initialHtml || "<p></p>",
        });
        setEditor(ed);
        setEditorError(`Collaboration unavailable: ${e?.message || String(e)}`);
        setCollabStatus("fallback");
        return () => {
          ed.destroy();
          setEditor(null);
        };
      } catch (e2: any) {
        setEditor(null);
        setEditorError(e2?.message || e?.message || String(e2 || e));
        setCollabStatus("fallback");
      }
    }
  }, [ready, editable, localUser.id, localUser.name, localUser.color, initialHtml]);

  useEffect(() => {
    if (!editor) return;
    // If the doc was empty when we joined, seed it once from the bill text.
    if (didInitRef.current) return;
    didInitRef.current = true;
    // Seed from the original bill text if the collaborative document is still empty.
    // This ensures the editable version always starts with the original text.
    if (editor.getText().trim() === "") {
      suppressAttributionRef.current = true;
      try {
        editor.commands.setContent(initialHtml || "<p></p>", false);
      } finally {
        suppressAttributionRef.current = false;
      }
    }
  }, [editor, initialHtml]);

  if (editorError) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
        Could not start collaborative editor: {editorError}
      </div>
    );
  }

  if (!editor) {
    return <div className="text-sm text-gray-500">Loading editor...</div>;
  }

  return (
    <div>
      {collabStatus !== "live" && (
        <div className="mb-2 text-xs px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800">
          {collabStatus === "connecting" ? "Connecting collaboration..." : "Collaboration offline (local edits only)"}
        </div>
      )}
      {editable && <CommitteeEditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
