import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
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
        () => mounted && setReady(true),
      );
      providerRef.current = provider;
    };
    void setup();

    return () => {
      mounted = false;
      providerRef.current?.destroy();
      providerRef.current = null;
      ydocRef.current?.destroy();
      ydocRef.current = null;
    };
  }, [billId, classId, committeeId]);

  const editor = useEditor(
    ready && ydocRef.current && awarenessRef.current
      ? {
          editable,
          extensions: [
            // Explicit base schema to avoid "Schema is missing its top node type ('doc')" crashes.
            Document,
            Paragraph,
            Text,
            Bold,
            Italic,
            Collaboration.configure({
              // Use a named fragment so multiple editors don't collide.
              fragment: ydocRef.current.getXmlFragment("prosemirror"),
            }),
            CollaborationCursor.configure({
              provider: { awareness: awarenessRef.current } as any,
              user: { name: localUser.name, color: localUser.color },
            }),
          ],
          editorProps: {
            attributes: {
              class:
                "prose max-w-none focus:outline-none min-h-[420px] p-4 rounded-md border border-gray-200 bg-white",
            },
          },
        }
      : undefined,
    [ready, editable, localUser.name, localUser.color],
  );

  useEffect(() => {
    if (!editor) return;
    // If the doc was empty when we joined, seed it once from the bill text.
    if (didInitRef.current) return;
    didInitRef.current = true;
    if (editor.getText().trim() === "") {
      editor.commands.setContent(initialHtml || "<p></p>", false);
    }
  }, [editor, initialHtml]);

  if (!editor) {
    return <div className="text-sm text-gray-500">Loading editor…</div>;
  }

  return <EditorContent editor={editor} />;
}
