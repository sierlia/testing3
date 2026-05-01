import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation } from "../components/Navigation";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  Bold,
  Eye,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pencil,
  RemoveFormatting,
  Send,
  Underline,
} from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { createBillForCurrentClass, fetchBillDetail, updateBillDraftForCurrentClass } from "../services/bills";
import { htmlToMarkdown, markdownToHtml } from "../utils/markdown";

type TextMode = "default" | "markdown" | "preview";

type FormData = {
  title: string;
  type: string;
  legislativeText: string;
  legislativeMarkdown: string;
  legislativeMode: TextMode;
  supportingText: string;
  supportingMarkdown: string;
  supportingMode: TextMode;
};

type FormattingAction = {
  label: string;
  icon: any;
  onClick: () => void;
  active?: boolean;
};

function FormattingToolbar({ actions }: { actions: FormattingAction[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-2">
      {actions.map(({ label, icon: Icon, onClick, active }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClick}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                active ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-white hover:text-gray-900"
              }`}
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

function sanitizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function stripMarkdownFormatting(value: string) {
  return value
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\s*([-*]|\d+\.)\s+/gm, "")
    .replace(/^:::\s*(left|center|right)\s*$/gim, "")
    .replace(/^:::\s*$/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\+\+([^+]+)\+\+/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/<u>(.*?)<\/u>/gi, "$1");
}

function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}) {
  const setSelection = (start: number, end = start) => {
    const el = textareaRef.current;
    if (!el) return;
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start, end);
    }, 0);
  };

  const replaceRange = (start: number, end: number, replacement: string, selectionStart: number, selectionEnd = selectionStart) => {
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    setSelection(selectionStart, selectionEnd);
  };

  const wrapSelection = (before: string, after = before, placeholder = "text") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    replaceRange(start, end, `${before}${selected}${after}`, start + before.length, start + before.length + selected.length);
  };

  const transformSelectedLines = (transform: (line: string) => string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = value.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const block = value.slice(lineStart, lineEnd);
    const transformed = block
      .split("\n")
      .map((line) => (line.trim() ? transform(line) : line))
      .join("\n");
    replaceRange(lineStart, lineEnd, transformed, lineStart, lineStart + transformed.length);
  };

  const prefixLines = (prefix: string) => {
    transformSelectedLines((line) => `${prefix}${line.replace(/^#{1,3}\s+/, "").replace(/^\s*([-*]|\d+\.)\s+/, "")}`);
  };

  const alignSelection = (alignment: "left" | "center" | "right") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const selected = value.slice(start, end) || "text";
    const replacement = `::: ${alignment}\n${selected}\n:::`;
    replaceRange(start, end, replacement, start + alignment.length + 5, start + alignment.length + 5 + selected.length);
  };

  const addLink = () => {
    const url = sanitizeUrl(window.prompt("Enter link URL") || "");
    if (!url) return;
    wrapSelection("[", `](${url})`, "link text");
  };

  const removeFormatting = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const hasSelection = end > start;
    const targetStart = hasSelection ? start : 0;
    const targetEnd = hasSelection ? end : value.length;
    const cleaned = stripMarkdownFormatting(value.slice(targetStart, targetEnd));
    replaceRange(targetStart, targetEnd, cleaned, targetStart, targetStart + cleaned.length);
  };

  const actions: FormattingAction[] = [
    { label: "Header 1", icon: Heading1, onClick: () => prefixLines("# ") },
    { label: "Header 2", icon: Heading2, onClick: () => prefixLines("## ") },
    { label: "Header 3", icon: Heading3, onClick: () => prefixLines("### ") },
    { label: "Bold", icon: Bold, onClick: () => wrapSelection("**", "**") },
    { label: "Italic", icon: Italic, onClick: () => wrapSelection("*", "*") },
    { label: "Underline", icon: Underline, onClick: () => wrapSelection("++", "++") },
    { label: "Hyperlink", icon: LinkIcon, onClick: addLink },
    { label: "Numbered list", icon: ListOrdered, onClick: () => prefixLines("1. ") },
    { label: "Bullet point list", icon: List, onClick: () => prefixLines("- ") },
    { label: "Align left", icon: AlignLeft, onClick: () => alignSelection("left") },
    { label: "Align center", icon: AlignCenter, onClick: () => alignSelection("center") },
    { label: "Align right", icon: AlignRight, onClick: () => alignSelection("right") },
    { label: "Remove formatting", icon: RemoveFormatting, onClick: removeFormatting },
  ];

  return <FormattingToolbar actions={actions} />;
}

function MarkdownEnabledEditor({
  label,
  description,
  required,
  error,
  htmlValue,
  markdownValue,
  mode,
  textareaRef,
  onHtmlChange,
  onMarkdownChange,
  onModeChange,
  placeholder,
  minHeightClass,
}: {
  label: string;
  description: string;
  required?: boolean;
  error?: string;
  htmlValue: string;
  markdownValue: string;
  mode: TextMode;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onHtmlChange: (value: string) => void;
  onMarkdownChange: (value: string) => void;
  onModeChange: (mode: TextMode) => void;
  placeholder: string;
  minHeightClass: string;
}) {
  const quillRef = useRef<ReactQuill | null>(null);
  const previewHtml = useMemo(() => (mode === "markdown" || mode === "preview" ? markdownToHtml(markdownValue) : htmlValue), [htmlValue, markdownValue, mode]);

  const setMode = (nextMode: TextMode) => {
    if (nextMode === mode) return;
    if (mode === "default" && nextMode !== "default") {
      onMarkdownChange(htmlToMarkdown(htmlValue));
    }
    if (mode !== "default" && nextMode === "default") {
      onHtmlChange(markdownToHtml(markdownValue));
    }
    onModeChange(nextMode);
  };

  const getQuill = () => quillRef.current?.getEditor();

  const toggleQuillFormat = (format: string, value: any = true) => {
    const quill = getQuill();
    if (!quill) return;
    quill.focus();
    const range = quill.getSelection(true);
    const current = quill.getFormat();
    const currentValue = current[format];
    const isActive = value === true ? Boolean(currentValue) : currentValue === value;
    if ((format === "header" || format === "list") && range) {
      quill.formatLine(range.index, Math.max(range.length, 1), format, isActive ? false : value, "user");
    } else {
      quill.format(format, isActive ? false : value, "user");
    }
  };

  const setQuillAlignment = (alignment: "left" | "center" | "right") => {
    const quill = getQuill();
    if (!quill) return;
    quill.focus();
    const range = quill.getSelection(true);
    if (!range) return;
    quill.formatLine(range.index, Math.max(range.length, 1), "align", alignment === "left" ? false : alignment, "user");
  };

  const addQuillLink = () => {
    const quill = getQuill();
    if (!quill) return;
    quill.focus();
    const existing = String(quill.getFormat().link || "");
    const url = sanitizeUrl(window.prompt("Enter link URL", existing) || "");
    if (!url) {
      quill.format("link", false, "user");
      return;
    }
    quill.format("link", url, "user");
  };

  const removeQuillFormatting = () => {
    const quill = getQuill();
    if (!quill) return;
    quill.focus();
    const range = quill.getSelection(true);
    if (!range) return;
    quill.removeFormat(range.index, Math.max(range.length, 1), "user");
  };

  const defaultActions: FormattingAction[] = [
    { label: "Header 1", icon: Heading1, onClick: () => toggleQuillFormat("header", 1) },
    { label: "Header 2", icon: Heading2, onClick: () => toggleQuillFormat("header", 2) },
    { label: "Header 3", icon: Heading3, onClick: () => toggleQuillFormat("header", 3) },
    { label: "Bold", icon: Bold, onClick: () => toggleQuillFormat("bold") },
    { label: "Italic", icon: Italic, onClick: () => toggleQuillFormat("italic") },
    { label: "Underline", icon: Underline, onClick: () => toggleQuillFormat("underline") },
    { label: "Hyperlink", icon: LinkIcon, onClick: addQuillLink },
    { label: "Numbered list", icon: ListOrdered, onClick: () => toggleQuillFormat("list", "ordered") },
    { label: "Bullet point list", icon: List, onClick: () => toggleQuillFormat("list", "bullet") },
    { label: "Align left", icon: AlignLeft, onClick: () => setQuillAlignment("left") },
    { label: "Align center", icon: AlignCenter, onClick: () => setQuillAlignment("center") },
    { label: "Align right", icon: AlignRight, onClick: () => setQuillAlignment("right") },
    { label: "Remove formatting", icon: RemoveFormatting, onClick: removeQuillFormatting },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <label className="block text-sm font-semibold text-gray-900">
          {label}
          {required ? " *" : ""}
        </label>
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
          {[
            { key: "default" as const, icon: Pencil, label: "Default" },
            { key: "markdown" as const, icon: FileText, label: "Markdown" },
            { key: "preview" as const, icon: Eye, label: "Preview" },
          ].map(({ key, icon: Icon, label: modeLabel }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === key ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              } ${key !== "default" ? "border-l border-gray-300" : ""}`}
            >
              <Icon className="w-4 h-4" />
              {modeLabel}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <div className={`bill-editor-shell border rounded-md overflow-hidden ${error ? "border-red-500" : "border-gray-300"}`}>
        {mode === "default" && (
          <>
            <FormattingToolbar actions={defaultActions} />
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={htmlValue}
              onChange={onHtmlChange}
              placeholder={placeholder}
              className={`bill-default-editor ${minHeightClass}`}
              modules={{ toolbar: false }}
            />
          </>
        )}
        {mode === "markdown" && (
          <>
            <MarkdownToolbar textareaRef={textareaRef} value={markdownValue} onChange={onMarkdownChange} />
            <textarea
              ref={textareaRef}
              value={markdownValue}
              onChange={(e) => onMarkdownChange(e.target.value)}
              placeholder={placeholder}
              className={`w-full ${minHeightClass} p-4 font-mono text-sm outline-none resize-y`}
            />
          </>
        )}
        {mode === "preview" && <div className={`prose max-w-none bg-white ${minHeightClass} p-4`} dangerouslySetInnerHTML={{ __html: previewHtml }} />}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CreateBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const legislativeMarkdownRef = useRef<HTMLTextAreaElement | null>(null);
  const supportingMarkdownRef = useRef<HTMLTextAreaElement | null>(null);
  const draftId = searchParams.get("draft");
  const [formData, setFormData] = useState<FormData>({
    title: "",
    type: "H.R. Bill",
    legislativeText: "",
    legislativeMarkdown: "",
    legislativeMode: "default",
    supportingText: "",
    supportingMarkdown: "",
    supportingMode: "default",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingDraft, setSavingDraft] = useState(false);

  const billTypes = [
    "H.R. Bill",
    "H.J. Res. (Joint Resolution)",
    "H. Con. Res. (Concurrent Resolution)",
    "H. Res. (Simple Resolution)",
  ];

  useEffect(() => {
    if (!draftId) return;
    void (async () => {
      try {
        const { bill } = await fetchBillDetail(draftId);
        if (bill.status !== "draft") {
          toast.error("Only draft bills can be edited");
          return navigate(`/bills/${draftId}`);
        }
        setFormData((prev) => ({
          ...prev,
          title: bill.title ?? "",
          legislativeText: bill.legislative_text ?? "",
          supportingText: bill.supporting_text ?? "",
          legislativeMarkdown: htmlToMarkdown(bill.legislative_text ?? ""),
          supportingMarkdown: htmlToMarkdown(bill.supporting_text ?? ""),
        }));
      } catch (error: any) {
        toast.error(error.message || "Could not load draft");
      }
    })();
  }, [draftId, navigate]);

  const buildBillPayload = () => {
    const legislativeHtml = formData.legislativeMode === "default" ? formData.legislativeText : markdownToHtml(formData.legislativeMarkdown);
    const supportingHtml = formData.supportingMode === "default" ? formData.supportingText : markdownToHtml(formData.supportingMarkdown);
    return {
      legislativeHtml,
      supportingHtml,
      supportingText: supportingHtml.replace(/<[^>]+>/g, "").trim() ? supportingHtml : null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { legislativeHtml, supportingText } = buildBillPayload();
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!legislativeHtml.replace(/<[^>]+>/g, "").trim()) newErrors.legislativeText = "Legislative text is required";
    // Supporting text is optional by default (teacher-configurable tabs can remove it)

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      if (draftId) {
        await updateBillDraftForCurrentClass(draftId, {
          title: formData.title.trim(),
          legislativeText: legislativeHtml,
          supportingText,
          status: "submitted",
        });
        toast.success("Bill submitted");
        navigate(`/bills/${draftId}`);
        return;
      }
      const created = await createBillForCurrentClass({
        title: formData.title.trim(),
        legislativeText: legislativeHtml,
        supportingText,
        status: "submitted",
      });
      toast.success("Bill submitted");
      navigate(`/bills/${created.id}`);
    } catch (error: any) {
      toast.error(error.message || "Could not submit bill");
    }
  };

  const handleSaveDraft = async () => {
    const { legislativeHtml, supportingText } = buildBillPayload();
    if (!formData.title.trim() && !legislativeHtml.replace(/<[^>]+>/g, "").trim() && !supportingText) {
      toast.error("Add a title or bill text before saving");
      return;
    }
    setSavingDraft(true);
    try {
      const title = formData.title.trim() || "Untitled draft";
      const legislativeText = legislativeHtml.replace(/<[^>]+>/g, "").trim() ? legislativeHtml : "<p></p>";
      const saved = draftId
        ? await updateBillDraftForCurrentClass(draftId, { title, legislativeText, supportingText, status: "draft" })
        : await createBillForCurrentClass({ title, legislativeText, supportingText, status: "draft" });
      toast.success("Draft saved");
      navigate(`/bills/create?draft=${saved.id}`, { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Could not save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Bill</h1>
          <p className="text-gray-600">
            Draft legislation to be submitted to the clerk's office
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Legislative Title */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-2">
              Legislative Title *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., An Act to Improve Public Education Funding"
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
          </div>

          {/* Legislative Type */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label htmlFor="type" className="block text-sm font-semibold text-gray-900 mb-2">
              Legislative Type *
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {billTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <MarkdownEnabledEditor
            label="Legislative Text"
            description="The official text of your proposed legislation"
            required
            error={errors.legislativeText}
            htmlValue={formData.legislativeText}
            markdownValue={formData.legislativeMarkdown}
            mode={formData.legislativeMode}
            textareaRef={legislativeMarkdownRef}
            onHtmlChange={(value) => setFormData({ ...formData, legislativeText: value })}
            onMarkdownChange={(value) => setFormData({ ...formData, legislativeMarkdown: value })}
            onModeChange={(mode) => setFormData((prev) => ({ ...prev, legislativeMode: mode }))}
            placeholder="Section 1. Short Title..."
            minHeightClass="min-h-[300px]"
          />

          <MarkdownEnabledEditor
            label="Supporting Text"
            description="Explain the reasoning and purpose behind this legislation"
            error={errors.supportingText}
            htmlValue={formData.supportingText}
            markdownValue={formData.supportingMarkdown}
            mode={formData.supportingMode}
            textareaRef={supportingMarkdownRef}
            onHtmlChange={(value) => setFormData({ ...formData, supportingText: value })}
            onMarkdownChange={(value) => setFormData({ ...formData, supportingMarkdown: value })}
            onModeChange={(mode) => setFormData((prev) => ({ ...prev, supportingMode: mode }))}
            placeholder="This bill addresses..."
            minHeightClass="min-h-[200px]"
          />

          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Important: Bill Text is Final</h3>
                <p className="text-sm text-red-800">
                  Once submitted, the legislative text <strong>cannot be edited or repealed</strong>.
                  Save a draft if you need to keep working before submission.
                </p>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate("/bills")}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors font-medium"
            >
              Cancel
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={savingDraft}
                className="flex items-center gap-2 px-6 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-60 transition-colors font-medium"
              >
                <FileText className="w-4 h-4" />
                {savingDraft ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                <Send className="w-4 h-4" />
                Submit Bill
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
