import { useEffect, useRef, useState, type MouseEvent } from "react";
import { EditorContent } from "@tiptap/react";
import { Editor, Extension, Mark } from "@tiptap/core";
import { isChangeOrigin } from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
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

const DeleteHighlight = Mark.create({
  name: "deleteHighlight",
  inclusive: false,

  addAttributes() {
    return {
      authorId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-delete-author-id"),
        renderHTML: () => ({}),
      },
      authorName: {
        default: "Member",
        parseHTML: (element) => element.getAttribute("data-delete-author") ?? "Member",
        renderHTML: () => ({}),
      },
      color: {
        default: "#2563eb",
        parseHTML: (element) => element.getAttribute("data-delete-color") ?? "#2563eb",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-delete-highlight]" }];
  },

  renderHTML({ mark }) {
    const authorId = mark.attrs.authorId || "";
    const authorName = String(mark.attrs.authorName || "").trim() || "Member";
    const color = mark.attrs.color || "#2563eb";
    return [
      "span",
      {
        "data-delete-highlight": "true",
        "data-delete-author-id": authorId,
        "data-delete-author": authorName,
        "data-delete-color": color,
        class: "committee-delete-highlight",
        style: `--edit-color:${color}; background-color: ${hexToRgba(color, 0.12)}; text-decoration-line: line-through; text-decoration-color: ${color}; text-decoration-thickness: 2px;`,
      },
      0,
    ];
  },
});

const UnderlineMark = Mark.create({
  name: "underline",

  parseHTML() {
    const isUnderline = (value: unknown) => (String(value).includes("underline") ? null : false);
    return [{ tag: "u" }, { style: "text-decoration", getAttrs: isUnderline }, { style: "text-decoration-line", getAttrs: isUnderline }];
  },

  renderHTML() {
    return ["u", {}, 0];
  },
});

const LinkMark = Mark.create({
  name: "link",
  inclusive: false,

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[href]" }];
  },

  renderHTML({ mark }) {
    return [
      "a",
      {
        href: mark.attrs.href,
        target: "_blank",
        rel: "noopener noreferrer",
        class: "text-blue-700 underline",
      },
      0,
    ];
  },
});

const TextAlignment = Extension.create({
  name: "textAlignment",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || null,
            renderHTML: (attributes) => (attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {}),
          },
        },
      },
    ];
  },
});

function sanitizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function deletedOriginalText(doc: any, from: number, to: number) {
  const pieces: string[] = [];
  doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (!node.isText) return true;
    const isTrackedChange = node.marks?.some((mark: any) => mark.type.name === "editHighlight" || mark.type.name === "deleteHighlight");
    if (!isTrackedChange && node.text) {
      const textStart = Math.max(from, pos);
      const textEnd = Math.min(to, pos + node.nodeSize);
      const sliceStart = Math.max(0, textStart - pos);
      const sliceEnd = Math.max(sliceStart, textEnd - pos);
      pieces.push(node.text.slice(sliceStart, sliceEnd));
    }
    return false;
  });
  return pieces.join("");
}

function setBlockAlignment(editor: Editor, alignment: "left" | "center" | "right") {
  const { state, view } = editor;
  const { from, to } = state.selection;
  const tr = state.tr;
  let changed = false;

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "paragraph" && node.type.name !== "heading") return true;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: alignment === "left" ? null : alignment }, node.marks);
    changed = true;
    return false;
  });

  if (!changed) {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== "paragraph" && node.type.name !== "heading") continue;
      tr.setNodeMarkup($from.before(depth), undefined, { ...node.attrs, textAlign: alignment === "left" ? null : alignment }, node.marks);
      changed = true;
      break;
    }
  }

  if (changed) view.dispatch(tr.scrollIntoView());
  view.focus();
}

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

            const editMarkType = newState.schema.marks.editHighlight;
            const deleteMarkType = newState.schema.marks.deleteHighlight;
            if (!editMarkType || !deleteMarkType) return null;

            const changedTransactions = transactions.filter(
              (transaction) =>
                transaction.docChanged && !transaction.getMeta(editAttributionPluginKey) && !isChangeOrigin(transaction),
            );
            if (!changedTransactions.length) return null;

            const ranges: Array<{ from: number; to: number }> = [];
            const deletions: Array<{ at: number; text: string }> = [];
            for (const transaction of changedTransactions) {
              transaction.mapping.maps.forEach((stepMap, mapIndex) => {
                stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
                  const laterMaps = transaction.mapping.slice(mapIndex + 1);
                  if (newEnd > newStart) {
                    ranges.push({
                      from: laterMaps.map(newStart, 1),
                      to: laterMaps.map(newEnd, -1),
                    });
                  }
                  if (oldEnd > oldStart) {
                    const text = deletedOriginalText(transaction.before, oldStart, oldEnd);
                    if (text) {
                      deletions.push({
                        at: laterMaps.map(newStart, 1),
                        text,
                      });
                    }
                  }
                });
              });
            }
            if (!ranges.length && !deletions.length) return null;

            const author = getAuthor();
            if (!author?.id) return null;
            const editMark = editMarkType.create({
              authorId: author.id,
              authorName: String(author.name || "").trim() || "Member",
              color: author.color,
            });
            const deleteMark = deleteMarkType.create({
              authorId: author.id,
              authorName: String(author.name || "").trim() || "Member",
              color: author.color,
            });
            const tr = newState.tr;
            const max = newState.doc.content.size;

            for (const range of ranges) {
              const from = Math.max(0, Math.min(range.from, max));
              const to = Math.max(from, Math.min(range.to, max));
              if (to > from) tr.addMark(from, to, editMark);
            }

            for (const deletion of [...deletions].sort((a, b) => b.at - a.at)) {
              const from = Math.max(0, Math.min(deletion.at, tr.doc.content.size));
              tr.insertText(deletion.text, from);
              const to = from + deletion.text.length;
              tr.removeMark(from, to, editMarkType);
              tr.addMark(from, to, deleteMark);
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

  const setLink = () => {
    const existing = String(editor.getAttributes("link").href || "");
    const url = sanitizeUrl(window.prompt("Enter link URL", existing) || "");
    if (!url) {
      run(() => editor.chain().focus().extendMarkRange("link").unsetMark("link").run());
      return;
    }
    run(() => editor.chain().focus().extendMarkRange("link").setMark("link", { href: url }).run());
  };

  const buttons = [
    { label: "Header 1", icon: Heading1, onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run()) },
    { label: "Header 2", icon: Heading2, onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run()) },
    { label: "Header 3", icon: Heading3, onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run()) },
    { label: "Bold", icon: Bold, onClick: () => run(() => editor.chain().focus().toggleBold().run()) },
    { label: "Italic", icon: Italic, onClick: () => run(() => editor.chain().focus().toggleItalic().run()) },
    { label: "Underline", icon: Underline, onClick: () => run(() => editor.chain().focus().toggleMark("underline").run()) },
    { label: "Hyperlink", icon: LinkIcon, onClick: setLink },
    { label: "Numbered list", icon: ListOrdered, onClick: () => run(() => editor.chain().focus().toggleOrderedList().run()) },
    { label: "Bullet point list", icon: List, onClick: () => run(() => editor.chain().focus().toggleBulletList().run()) },
    { label: "Align left", icon: AlignLeft, onClick: () => setBlockAlignment(editor, "left") },
    { label: "Align center", icon: AlignCenter, onClick: () => setBlockAlignment(editor, "center") },
    { label: "Align right", icon: AlignRight, onClick: () => setBlockAlignment(editor, "right") },
    { label: "Remove formatting", icon: RemoveFormatting, onClick: () => run(() => editor.chain().focus().unsetAllMarks().clearNodes().run()) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border border-gray-200 border-b-0 bg-gray-50 px-2 py-2 rounded-t-md">
      {buttons.map(({ label, icon: Icon, onClick }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClick}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 transition-colors hover:bg-white hover:text-gray-900"
            >
              <Icon className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>{label}</TooltipContent>
        </Tooltip>
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
  const [restoreMenu, setRestoreMenu] = useState<{ x: number; y: number; pos: number; color: string } | null>(null);

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
          DeleteHighlight,
          UnderlineMark,
          LinkMark,
          TextAlignment,
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
            DeleteHighlight,
            UnderlineMark,
            LinkMark,
            TextAlignment,
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

  useEffect(() => {
    if (!restoreMenu) return;
    const close = () => setRestoreMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [restoreMenu]);

  const handleEditorContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!editor) return;
    const target = event.target as HTMLElement | null;
    const deleted = target?.closest("[data-delete-highlight]") as HTMLElement | null;
    if (!deleted) {
      setRestoreMenu(null);
      return;
    }

    const pos = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
    if (typeof pos !== "number") return;
    event.preventDefault();
    setRestoreMenu({
      x: event.clientX,
      y: event.clientY,
      pos,
      color: deleted.getAttribute("data-delete-color") || "#2563eb",
    });
  };

  const restoreDeletedText = () => {
    if (!editor || !restoreMenu) return;
    editor.chain().focus().setTextSelection(restoreMenu.pos).extendMarkRange("deleteHighlight").unsetMark("deleteHighlight").run();
    setRestoreMenu(null);
  };

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
    <div onContextMenu={handleEditorContextMenu}>
      {collabStatus !== "live" && (
        <div className="mb-2 text-xs px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800">
          {collabStatus === "connecting" ? "Connecting collaboration..." : "Collaboration offline (local edits only)"}
        </div>
      )}
      {editable && <CommitteeEditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
      {restoreMenu && (
        <div
          className="fixed z-50 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
          style={{ left: restoreMenu.x, top: restoreMenu.y, ["--restore-color" as any]: restoreMenu.color }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={restoreDeletedText}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Restore text
          </button>
        </div>
      )}
    </div>
  );
}
