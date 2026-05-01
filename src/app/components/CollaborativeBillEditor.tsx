import { useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { supabase } from "../utils/supabase";
import { YjsSupabaseProvider } from "../utils/yjsSupabaseProvider";

function colorFromId(id: string) {
  const colors = ["#2563eb", "#7c3aed", "#16a34a", "#dc2626", "#0ea5e9", "#ea580c"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
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
  const [localUser, setLocalUser] = useState<{ name: string; color: string }>({ name: "Member", color: "#2563eb" });
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YjsSupabaseProvider | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const didInitRef = useRef(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const hydratedFromSnapshotRef = useRef(false);
  const [collabStatus, setCollabStatus] = useState<"connecting" | "live" | "fallback">("connecting");

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("display_name").eq("user_id", uid).maybeSingle();
      const name = (p as any)?.display_name ?? auth.user?.user_metadata?.name ?? "Member";
      const color = colorFromId(uid);
      setLocalUser({ name, color });

      const ydoc = new Y.Doc();
      const awareness = new Awareness(ydoc);
      ydocRef.current = ydoc;
      awarenessRef.current = awareness;

      const provider = new YjsSupabaseProvider(
        {
          doc: ydoc,
          awareness,
          key: { classId, committeeId, billId },
          user: { id: uid, name, color },
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
          extensions: [(StarterKit as any)?.configure ? StarterKit.configure({ history: false }) : (StarterKit as any)],
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
  }, [ready, editable, localUser.name, localUser.color, initialHtml]);

  useEffect(() => {
    if (!editor) return;
    // If the doc was empty when we joined, seed it once from the bill text.
    if (didInitRef.current) return;
    didInitRef.current = true;
    // Important: only seed from the bill's original text if we *didn't* hydrate
    // from a previously persisted Yjs snapshot. Otherwise we risk overwriting
    // the canonical collaborative state on reopen.
    if (!hydratedFromSnapshotRef.current && editor.getText().trim() === "") {
      editor.commands.setContent(initialHtml || "<p></p>", false);
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
    return <div className="text-sm text-gray-500">Loading editor…</div>;
  }

  return (
    <div>
      {collabStatus !== "live" && (
        <div className="mb-2 text-xs px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800">
          {collabStatus === "connecting" ? "Connecting collaborationâ€¦" : "Collaboration offline (local edits only)"}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
