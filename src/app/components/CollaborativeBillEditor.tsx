import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { EditorContent } from "@tiptap/react";
import { Editor, Extension, Mark } from "@tiptap/core";
import { isChangeOrigin } from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
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
import { getCurrentUser } from "../utils/currentUser";

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

export const EditHighlight = Mark.create({
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

export const DeleteHighlight = Mark.create({
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
      deletionId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-delete-id"),
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
    const deletionId = mark.attrs.deletionId || "";
    return [
      "span",
      {
        "data-delete-highlight": "true",
        "data-delete-author-id": authorId,
        "data-delete-author": authorName,
        "data-delete-color": color,
        "data-delete-id": deletionId,
        class: "committee-delete-highlight",
        style: `--edit-color:${color}; background-color: ${hexToRgba(color, 0.12)}; text-decoration-line: line-through; text-decoration-color: ${color}; text-decoration-thickness: 2px;`,
      },
      0,
    ];
  },
});

export const UnderlineMark = Mark.create({
  name: "underline",

  parseHTML() {
    const isUnderline = (value: unknown) => (String(value).includes("underline") ? null : false);
    return [{ tag: "u" }, { style: "text-decoration", getAttrs: isUnderline }, { style: "text-decoration-line", getAttrs: isUnderline }];
  },

  renderHTML() {
    return ["u", {}, 0];
  },
});

export const LinkMark = Mark.create({
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

export const TextAlignment = Extension.create({
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

function hasDeletedContent(doc: any, from: number, to: number) {
  let hasContent = false;
  doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (!node.isText) return true;
    const isTrackedChange = node.marks?.some((mark: any) => mark.type.name === "editHighlight" || mark.type.name === "deleteHighlight");
    if (!isTrackedChange && node.text) {
      hasContent = true;
      return false;
    }
    return false;
  });
  return hasContent;
}

type MarkedTextRange = { from: number; to: number; color: string; attrs: any; text: string };
type RestoreMenuState = MarkedTextRange & { x: number; y: number };

function makeChangeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizedRangeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stableYjsClientId(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Keep this away from 0 while staying in a compact positive integer range.
  return (hash >>> 0) % 2147483646 + 1;
}

function withYjsClientId<T>(doc: Y.Doc, clientId: number, fn: () => T) {
  const previousClientId = doc.clientID;
  doc.clientID = clientId;
  try {
    return fn();
  } finally {
    doc.clientID = previousClientId;
  }
}

function sameMarkAttrs(a: any, b: any) {
  const aDeletionId = String(a?.deletionId ?? "");
  const bDeletionId = String(b?.deletionId ?? "");
  if (aDeletionId || bDeletionId) return Boolean(aDeletionId && bDeletionId && aDeletionId === bDeletionId);
  return (
    String(a?.authorId ?? "") === String(b?.authorId ?? "") &&
    String(a?.authorName ?? "") === String(b?.authorName ?? "") &&
    String(a?.color ?? "") === String(b?.color ?? "")
  );
}

function rangeText(doc: any, from: number, to: number) {
  return doc.textBetween(from, to, "\n", "\n");
}

function nearestRange(ranges: MarkedTextRange[], pos: number) {
  return ranges.reduce<MarkedTextRange | null>((best, range) => {
    if (!best) return range;
    const rangeDistance = pos < range.from ? range.from - pos : pos > range.to ? pos - range.to : 0;
    const bestDistance = pos < best.from ? best.from - pos : pos > best.to ? pos - best.to : 0;
    return rangeDistance < bestDistance ? range : best;
  }, null);
}

function collectMarkedTextRanges(doc: any, markType: any, attrs: any): MarkedTextRange[] {
  const segments: Array<{ from: number; to: number }> = [];
  const hasStableDeletionId = Boolean(attrs?.deletionId);
  doc.descendants((node: any, nodePos: number) => {
    if (!node.isText || !node.text) return true;
    const mark = node.marks?.find((item: any) => item.type === markType && sameMarkAttrs(item.attrs, attrs));
    if (!mark) return true;
    segments.push({ from: nodePos, to: nodePos + node.nodeSize });
    return true;
  });

  const merged: Array<{ from: number; to: number }> = [];
  for (const segment of segments) {
    const current = merged[merged.length - 1];
    if (current && (hasStableDeletionId || segment.from <= current.to + 4)) current.to = segment.to;
    else merged.push({ ...segment });
  }

  return merged.map((range) => ({
    ...range,
    attrs,
    color: attrs?.color || "#2563eb",
    text: rangeText(doc, range.from, range.to),
  }));
}

function findMarkNearPosition(doc: any, pos: number, markType: any) {
  let clickedMark: any = null;
  const boundedPos = Math.max(0, Math.min(pos, doc.content.size));
  doc.nodesBetween(Math.max(0, boundedPos - 2), Math.min(doc.content.size, boundedPos + 2), (node: any) => {
    const mark = node.marks?.find((item: any) => item.type === markType);
    if (mark) {
      clickedMark = mark;
      return false;
    }
    return true;
  });
  if (clickedMark) return clickedMark;
  return doc.resolve(boundedPos).marks().find((item: any) => item.type === markType) ?? null;
}

function findMarkedTextRange(doc: any, pos: number, markType: any) {
  const clickedMark = findMarkNearPosition(doc, pos, markType);
  if (!clickedMark) return null;

  const ranges = collectMarkedTextRanges(doc, markType, clickedMark.attrs);
  return ranges.find((range) => pos >= range.from - 1 && pos <= range.to + 1) ?? nearestRange(ranges, pos);
}

function resolveRestoreRange(doc: any, restore: RestoreMenuState, markType: any) {
  const ranges = collectMarkedTextRanges(doc, markType, restore.attrs);
  if (!ranges.length) return null;
  const midpoint = Math.floor((restore.from + restore.to) / 2);
  const overlapping = ranges.filter((range) => range.to >= restore.from && range.from <= restore.to);
  const candidates = overlapping.length ? overlapping : ranges;
  const targetText = normalizedRangeText(restore.text);
  const exact = targetText ? candidates.find((range) => normalizedRangeText(range.text) === targetText) : null;
  return exact ?? nearestRange(candidates, midpoint);
}

function domSelectionDirection(): "backward" | "forward" | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = document.createRange();
  range.setStart(selection.anchorNode!, selection.anchorOffset);
  range.setEnd(selection.focusNode!, selection.focusOffset);
  return range.collapsed ? "backward" : "forward";
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
  getDeleteDirection,
  trackDeletes,
}: {
  getAuthor: () => { id: string; name: string; color: string };
  shouldSuppress: () => boolean;
  getDeleteDirection: () => "backward" | "forward" | null;
  trackDeletes: boolean;
}) {
  return Extension.create({
    name: "editAttribution",

    addProseMirrorPlugins() {
      const editor = this.editor;

      return [
        new Plugin({
          key: editAttributionPluginKey,
          filterTransaction: (transaction, state) => {
            if (!editor.isEditable || shouldSuppress() || !trackDeletes) return true;
            if (
              !transaction.docChanged ||
              isChangeOrigin(transaction) ||
              transaction.getMeta(editAttributionPluginKey) ||
              transaction.getMeta("restoreDeleteHighlight")
            ) return true;

            let touchesDeletedText = false;
            transaction.mapping.maps.forEach((stepMap) => {
              stepMap.forEach((oldStart, oldEnd) => {
                if (touchesDeletedText || oldEnd <= oldStart) return;
                state.doc.nodesBetween(oldStart, oldEnd, (node) => {
                  if (node.marks?.some((mark) => mark.type.name === "deleteHighlight")) {
                    touchesDeletedText = true;
                    return false;
                  }
                  return true;
                });
              });
            });

            return !touchesDeletedText;
          },
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
            const deletions: Array<{ at: number; slice: any; direction: "backward" | "forward" | null }> = [];
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
                  if (trackDeletes && oldEnd > oldStart) {
                    if (hasDeletedContent(transaction.before, oldStart, oldEnd)) {
                      deletions.push({
                        at: laterMaps.map(newStart, 1),
                        slice: transaction.before.slice(oldStart, oldEnd),
                        direction: getDeleteDirection(),
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
            const tr = newState.tr;
            const max = newState.doc.content.size;

            for (const range of ranges) {
              const from = Math.max(0, Math.min(range.from, max));
              const to = Math.max(from, Math.min(range.to, max));
              if (to > from) tr.addMark(from, to, editMark);
            }

            for (const deletion of [...deletions].sort((a, b) => b.at - a.at)) {
              const from = Math.max(0, Math.min(deletion.at, tr.doc.content.size));
              const matchingInsert = ranges.find((range) => range.from === from);
              const insertedSize = matchingInsert ? Math.max(0, matchingInsert.to - matchingInsert.from) : 0;
              const insertAt = deletion.direction === "backward" && matchingInsert ? Math.min(matchingInsert.to, tr.doc.content.size) : from;
              tr.replaceRange(insertAt, insertAt, deletion.slice);
              const to = insertAt + deletion.slice.size;
              const deleteMark = deleteMarkType.create({
                authorId: author.id,
                authorName: String(author.name || "").trim() || "Member",
                color: author.color,
                deletionId: makeChangeId(),
              });
              tr.removeMark(insertAt, to, editMarkType);
              tr.addMark(insertAt, to, deleteMark);
              if (deletions.length === 1) {
                const caret =
                  matchingInsert && deletion.direction === "backward"
                    ? from + insertedSize
                    : matchingInsert
                      ? to + insertedSize
                      : deletion.direction === "backward"
                        ? from
                        : to;
                tr.setSelection(TextSelection.create(tr.doc, Math.min(caret, tr.doc.content.size)));
              }
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

function CommitteeEditorToolbar({ editor, editable, trailingControls }: { editor: Editor; editable: boolean; trailingControls?: ReactNode }) {
  const [, setToolbarVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setToolbarVersion((version) => version + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

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
    { label: "Header 1", icon: Heading1, active: () => editor.isActive("heading", { level: 1 }), onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run()) },
    { label: "Header 2", icon: Heading2, active: () => editor.isActive("heading", { level: 2 }), onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run()) },
    { label: "Header 3", icon: Heading3, active: () => editor.isActive("heading", { level: 3 }), onClick: () => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run()) },
    { label: "Bold", icon: Bold, active: () => editor.isActive("bold"), onClick: () => run(() => editor.chain().focus().toggleBold().run()) },
    { label: "Italic", icon: Italic, active: () => editor.isActive("italic"), onClick: () => run(() => editor.chain().focus().toggleItalic().run()) },
    { label: "Underline", icon: Underline, active: () => editor.isActive("underline"), onClick: () => run(() => editor.chain().focus().toggleMark("underline").run()) },
    { label: "Hyperlink", icon: LinkIcon, active: () => editor.isActive("link"), onClick: setLink },
    { label: "Numbered list", icon: ListOrdered, active: () => editor.isActive("orderedList"), onClick: () => run(() => editor.chain().focus().toggleOrderedList().run()) },
    { label: "Bullet point list", icon: List, active: () => editor.isActive("bulletList"), onClick: () => run(() => editor.chain().focus().toggleBulletList().run()) },
    { label: "Align left", icon: AlignLeft, active: () => !editor.isActive({ textAlign: "center" }) && !editor.isActive({ textAlign: "right" }), onClick: () => setBlockAlignment(editor, "left") },
    { label: "Align center", icon: AlignCenter, active: () => editor.isActive({ textAlign: "center" }), onClick: () => setBlockAlignment(editor, "center") },
    { label: "Align right", icon: AlignRight, active: () => editor.isActive({ textAlign: "right" }), onClick: () => setBlockAlignment(editor, "right") },
    { label: "Remove formatting", icon: RemoveFormatting, active: () => false, onClick: () => run(() => editor.chain().focus().unsetMark("bold").unsetMark("italic").unsetMark("underline").unsetMark("link").clearNodes().run()) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border border-gray-200 border-b-0 bg-gray-50 px-2 py-2 rounded-t-md">
      <div className="flex flex-wrap items-center gap-1">
        {editable && buttons.map(({ label, icon: Icon, active, onClick }) => {
          const isActive = active();
          return (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={onClick}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  isActive ? "bg-gray-300 text-gray-900 hover:bg-gray-300" : "text-gray-700 hover:bg-white hover:text-gray-900"
                }`}
                aria-pressed={isActive}
              >
                <Icon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>{label}</TooltipContent>
          </Tooltip>
          );
        })}
      </div>
      {trailingControls && <div className="ml-auto flex items-center justify-end">{trailingControls}</div>}
    </div>
  );
}

export function CollaborativeBillEditor({
  classId,
  committeeId,
  billId,
  initialHtml,
  editable = true,
  documentId,
  storageColumn,
  trackDeletes = true,
  displayMode = "tracked",
  allowRestoreDeleted = true,
  toolbarControls,
}: {
  classId: string;
  committeeId: string;
  billId: string;
  initialHtml: string;
  editable?: boolean;
  documentId?: string;
  storageColumn?: string;
  trackDeletes?: boolean;
  displayMode?: "tracked" | "clean";
  allowRestoreDeleted?: boolean;
  toolbarControls?: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [localUser, setLocalUser] = useState<{ id: string; name: string; color: string }>({ id: "", name: "Member", color: "#2563eb" });
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YjsSupabaseProvider | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const lastSeededInitialHtmlRef = useRef<string | null>(null);
  const suppressAttributionRef = useRef(false);
  const deleteDirectionRef = useRef<"backward" | "forward" | null>(null);
  const selectionDirectionRef = useRef<"backward" | "forward" | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const hydratedFromSnapshotRef = useRef(false);
  const [collabStatus, setCollabStatus] = useState<"connecting" | "live" | "fallback">("connecting");
  const [restoreMenu, setRestoreMenu] = useState<RestoreMenuState | null>(null);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      hydratedFromSnapshotRef.current = false;
      lastSeededInitialHtmlRef.current = null;
      setReady(false);
      setCollabStatus("connecting");

      const user = await getCurrentUser();
      if (!mounted) return;
      const uid = user?.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("display_name,role").eq("user_id", uid).maybeSingle();
      if (!mounted) return;
      const name = (p as any)?.display_name ?? user?.user_metadata?.name ?? "Member";
      // Keep authorName in highlights consistent: prefer a concrete non-empty name.
      const baseName = String(name || "").trim() || "Member";
      const normalizedName = (p as any)?.role === "teacher" ? `${baseName} (Teacher)` : baseName;
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
      if (!mounted) return;
      try {
        // Backfill if missing.
        const { data: assigned, error: cErr } = await supabase.rpc("ensure_committee_member_color", { target_committee: committeeId } as any);
        if (!cErr && typeof assigned === "string" && assigned) color = assigned;
      } catch {
        // ignore; fall back to deterministic colorFromId
      }
      if (!mounted) return;
      setLocalUser({ id: uid, name: normalizedName, color });

      const ydoc = new Y.Doc();
      const awareness = new Awareness(ydoc);
      ydocRef.current = ydoc;
      awarenessRef.current = awareness;

      const provider = new YjsSupabaseProvider(
        {
          doc: ydoc,
          awareness,
          key: { classId, committeeId, billId, documentId, storageColumn },
          user: { id: uid, name: normalizedName, color },
        },
        () => {
          if (!mounted) return;
          hydratedFromSnapshotRef.current = provider.getHydratedFromSnapshot();
          setCollabStatus(provider.getSubscribed() ? "live" : "connecting");
          setReady(true);
        },
      );
      if (!mounted) {
        provider.destroy();
        awareness.destroy();
        ydoc.destroy();
        return;
      }
      providerRef.current = provider;
    };
    void setup();
    const fallbackTimer = window.setTimeout(() => {
      const provider = providerRef.current;
      if (!mounted || provider?.getSubscribed() || (provider && !provider.getInitialSynced())) return;
      setCollabStatus("fallback");
      setReady(true);
    }, 3500);

    return () => {
      mounted = false;
      window.clearTimeout(fallbackTimer);
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
  }, [billId, classId, committeeId, documentId, storageColumn]);

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
            getDeleteDirection: () => deleteDirectionRef.current ?? selectionDirectionRef.current,
            trackDeletes,
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
          handleDOMEvents: {
            mouseup: () => {
              selectionDirectionRef.current = domSelectionDirection();
              return false;
            },
            keyup: () => {
              selectionDirectionRef.current = domSelectionDirection();
              return false;
            },
          },
          handleKeyDown: (view, event) => {
            if (event.key === "Backspace" || event.key === "Delete") {
              selectionDirectionRef.current = domSelectionDirection() ?? selectionDirectionRef.current;
              deleteDirectionRef.current = view.state.selection.empty ? (event.key === "Backspace" ? "backward" : "forward") : null;
            }
            window.setTimeout(() => {
              deleteDirectionRef.current = null;
            }, 0);
            return false;
          },
        },
      });

      setEditor(ed);
      setCollabStatus((status) => (providerRef.current?.getSubscribed() ? "live" : status === "fallback" ? "fallback" : "connecting"));
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
              getDeleteDirection: () => deleteDirectionRef.current ?? selectionDirectionRef.current,
              trackDeletes,
            }),
          ],
          editorProps: {
            attributes: {
              class: "prose max-w-none focus:outline-none min-h-[420px] p-4 rounded-md border border-gray-200 bg-white",
            },
            handleDOMEvents: {
              mouseup: () => {
                selectionDirectionRef.current = domSelectionDirection();
                return false;
              },
              keyup: () => {
                selectionDirectionRef.current = domSelectionDirection();
                return false;
              },
            },
            handleKeyDown: (view, event) => {
              if (event.key === "Backspace" || event.key === "Delete") {
                selectionDirectionRef.current = domSelectionDirection() ?? selectionDirectionRef.current;
                deleteDirectionRef.current = view.state.selection.empty ? (event.key === "Backspace" ? "backward" : "forward") : null;
              }
              window.setTimeout(() => {
                deleteDirectionRef.current = null;
              }, 0);
              return false;
            },
          },
          content: initialHtml || "<p></p>",
        });
        setEditor(ed);
        setEditorError(null);
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
  }, [ready, localUser.id, localUser.name, localUser.color, initialHtml, trackDeletes]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const sourceHtml = initialHtml || "<p></p>";
    if (lastSeededInitialHtmlRef.current === sourceHtml) return;

    const seedIfEmpty = () => {
      if (editor.isDestroyed) return;
      const fragment = ydocRef.current?.getXmlFragment("default");
      const fragmentText = fragment?.toString().replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() ?? "";
      if (fragmentText || editor.getText().trim() !== "") {
        lastSeededInitialHtmlRef.current = sourceHtml;
        return;
      }
      suppressAttributionRef.current = true;
      try {
        const ydoc = ydocRef.current;
        const seedClientId = stableYjsClientId(`${classId}:${committeeId}:${billId}:${documentId ?? billId}:${storageColumn ?? "ydoc_base64"}`);
        if (ydoc) {
          withYjsClientId(ydoc, seedClientId, () => editor.commands.setContent(sourceHtml, false));
        } else {
          editor.commands.setContent(sourceHtml, false);
        }
        lastSeededInitialHtmlRef.current = sourceHtml;
      } finally {
        suppressAttributionRef.current = false;
      }
    };

    const delay = providerRef.current?.getHydratedFromSnapshot() ? 300 : 900;
    const timer = window.setTimeout(seedIfEmpty, delay);
    return () => window.clearTimeout(timer);
  }, [editor, initialHtml]);

  useEffect(() => {
    if (!restoreMenu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRestoreMenu(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [restoreMenu]);

  const showRestoreMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!allowRestoreDeleted) return;
    if (!editor) return;
    const target = event.target as HTMLElement | null;
    const deleted = target?.closest("[data-delete-highlight]") as HTMLElement | null;
    if (!deleted) {
      setRestoreMenu(null);
      return;
    }

    const pos = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
    if (typeof pos !== "number") return;
    const range = findMarkedTextRange(editor.state.doc, pos, editor.state.schema.marks.deleteHighlight);
    if (!range) return;
    event.preventDefault();
    setRestoreMenu({
      x: event.clientX,
      y: event.clientY,
      from: range.from,
      to: range.to,
      color: range.color || deleted.getAttribute("data-delete-color") || "#2563eb",
      attrs: range.attrs,
      text: range.text,
    });
  };

  const restoreDeletedText = () => {
    if (!editor || !restoreMenu) return;
    const markType = editor.state.schema.marks.deleteHighlight;
    const range = resolveRestoreRange(editor.state.doc, restoreMenu, markType);
    if (!range) {
      setRestoreMenu(null);
      return;
    }

    const from = Math.max(0, Math.min(range.from, editor.state.doc.content.size));
    const to = Math.max(from, Math.min(range.to, editor.state.doc.content.size));
    if (to <= from) {
      setRestoreMenu(null);
      return;
    }

    const tr = editor.state.tr.removeMark(from, to, markType);
    tr.setMeta("restoreDeleteHighlight", true);
    tr.setSelection(TextSelection.create(tr.doc, Math.min(to, tr.doc.content.size)));
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
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
    <div className={displayMode === "clean" ? "committee-clean-view" : ""} onMouseDown={showRestoreMenu} onContextMenu={showRestoreMenu}>
      {collabStatus !== "live" && (
        <div className="mb-2 text-xs px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800">
          {collabStatus === "connecting" ? "Connecting collaboration..." : "Collaboration offline (local edits only)"}
        </div>
      )}
      {(editable || toolbarControls) && <CommitteeEditorToolbar editor={editor} editable={editable} trailingControls={toolbarControls} />}
      <EditorContent editor={editor} />
      {allowRestoreDeleted && restoreMenu && (
        <div
          className="fixed z-50 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
          style={{ left: restoreMenu.x, top: restoreMenu.y, ["--restore-color" as any]: restoreMenu.color }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
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
