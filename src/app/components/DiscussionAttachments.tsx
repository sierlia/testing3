import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Link as LinkIcon, Paperclip, Search, X } from "lucide-react";
import { Link } from "react-router";
import { supabase } from "../utils/supabase";
import { getCurrentUser } from "../utils/currentUser";

export type DiscussionAttachment = {
  type: "bill" | "record" | "letter";
  id: string;
  label: string;
  href: string;
  description?: string;
};

function normalizeAttachments(value: unknown): DiscussionAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      type: item?.type === "record" || item?.type === "letter" ? item.type : "bill",
      id: String(item?.id ?? ""),
      label: String(item?.label ?? ""),
      href: String(item?.href ?? ""),
      description: item?.description ? String(item.description) : undefined,
    }))
    .filter((item) => item.id && item.label && item.href);
}

export function parseDiscussionAttachments(value: unknown) {
  return normalizeAttachments(value);
}

export function AttachmentList({ attachments }: { attachments?: DiscussionAttachment[] | null }) {
  const items = normalizeAttachments(attachments);
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={`${item.type}:${item.id}`}
          to={item.href}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          <LinkIcon className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

export function AttachmentPicker({
  value,
  onChange,
}: {
  value: DiscussionAttachment[];
  onChange: (next: DiscussionAttachment[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"legislation" | "records">("legislation");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DiscussionAttachment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (!open || loaded) return;
    const load = async () => {
      const uid = (await getCurrentUser())?.id;
      if (!uid) return;
      const { data: profile } = await supabase.from("profiles").select("class_id").eq("user_id", uid).maybeSingle();
      const classId = (profile as any)?.class_id;
      if (!classId) return;
      const [bills, records, letters] = await Promise.all([
        supabase.from("bill_display").select("id,hr_label,title,status").eq("class_id", classId).neq("status", "deleted").order("bill_number", { ascending: true }),
        supabase.from("custom_records").select("id,type,title,created_at").eq("class_id", classId).order("created_at", { ascending: false }),
        supabase.from("dear_colleague_letters").select("id,subject,created_at").eq("class_id", classId).order("created_at", { ascending: false }).limit(50),
      ]);
      const billOptions: DiscussionAttachment[] = ((bills as any).data ?? []).map((bill: any) => ({
        type: "bill" as const,
        id: bill.id,
        label: `${bill.hr_label}: ${bill.title}`,
        href: `/bills/${bill.id}`,
        description: String(bill.status ?? "").replace(/_/g, " "),
      }));
      const recordOptions: DiscussionAttachment[] = ((records as any).data ?? []).map((record: any) => ({
        type: "record" as const,
        id: record.id,
        label: record.title || "Untitled record",
        href: `/records?record=${record.id}`,
        description: String(record.type ?? "record").replace(/_/g, " "),
      }));
      const letterOptions: DiscussionAttachment[] = ((letters as any).data ?? []).map((letter: any) => ({
        type: "letter" as const,
        id: letter.id,
        label: letter.subject || "Untitled letter",
        href: `/letters/${letter.id}`,
        description: "Dear Colleague letter",
      }));
      setOptions([...billOptions, ...recordOptions, ...letterOptions]);
      setLoaded(true);
    };
    void load();
  }, [loaded, open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((option) => {
      const inTab = tab === "legislation" ? option.type === "bill" : option.type !== "bill";
      return inTab && (!q || option.label.toLowerCase().includes(q) || (option.description ?? "").toLowerCase().includes(q));
    });
  }, [options, query, tab]);

  const toggle = (item: DiscussionAttachment) => {
    const exists = value.some((selected) => selected.type === item.type && selected.id === item.id);
    onChange(exists ? value.filter((selected) => !(selected.type === item.type && selected.id === item.id)) : [...value, item]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${value.length ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
      >
        <Paperclip className="h-3.5 w-3.5" />
        {value.length ? `${value.length} attached` : "Attach"}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-[150] mb-2 w-[28rem] max-w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-200 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search legislation or records..." className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mt-2 grid grid-cols-2 rounded-md bg-gray-100 p-1 text-sm font-medium">
              <button type="button" onClick={() => setTab("legislation")} className={`rounded px-2 py-1.5 ${tab === "legislation" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"}`}>Legislation</button>
              <button type="button" onClick={() => setTab("records")} className={`rounded px-2 py-1.5 ${tab === "records" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"}`}>Records</button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {visible.map((item) => {
              const selected = value.some((entry) => entry.type === item.type && entry.id === item.id);
              return (
                <button key={`${item.type}:${item.id}`} type="button" onClick={() => toggle(item)} className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm ${selected ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50"}`}>
                  <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-normal break-words font-medium leading-5">{item.label}</span>
                  </span>
                  {selected ? <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" /> : null}
                </button>
              );
            })}
            {!visible.length && <div className="p-4 text-center text-sm text-gray-500">{loaded ? "No matches." : "Loading..."}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
