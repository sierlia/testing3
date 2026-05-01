import { useMemo, useRef, useState } from "react";
import { Navigation } from "../components/Navigation";
import { AlertTriangle, Bold, Code, Eye, FileText, Heading1, Heading2, Info, Italic, List, ListOrdered, Pencil, Quote, Send } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { createBillForCurrentClass } from "../services/bills";
import { htmlToMarkdown, markdownToHtml } from "../utils/markdown";

type TextMode = "rich" | "markdown" | "preview";

type MarkdownField = "legislativeText" | "supportingText";

type FormData = {
  title: string;
  type: string;
  legislativeText: string;
  legislativeMarkdown: string;
  legislativeMode: TextMode;
  supportingText: string;
  supportingMarkdown: string;
  supportingMode: TextMode;
  placeHold: boolean;
};

function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}) {
  const wrapSelection = (before: string, after = before, placeholder = "text") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const prefixLine = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    onChange(next);
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const buttons = [
    { label: "Heading 1", icon: Heading1, onClick: () => prefixLine("# ") },
    { label: "Heading 2", icon: Heading2, onClick: () => prefixLine("## ") },
    { label: "Bold", icon: Bold, onClick: () => wrapSelection("**", "**") },
    { label: "Italic", icon: Italic, onClick: () => wrapSelection("*", "*") },
    { label: "Bullet list", icon: List, onClick: () => prefixLine("- ") },
    { label: "Numbered list", icon: ListOrdered, onClick: () => prefixLine("1. ") },
    { label: "Quote", icon: Quote, onClick: () => prefixLine("> ") },
    { label: "Code", icon: Code, onClick: () => wrapSelection("`", "`") },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-2">
      {buttons.map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          onClick={onClick}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-white hover:text-gray-900"
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
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
  const previewHtml = useMemo(() => (mode === "markdown" || mode === "preview" ? markdownToHtml(markdownValue) : htmlValue), [htmlValue, markdownValue, mode]);

  const setMode = (nextMode: TextMode) => {
    if (nextMode === mode) return;
    if (mode === "rich" && nextMode !== "rich") {
      onMarkdownChange(htmlToMarkdown(htmlValue));
    }
    if (mode !== "rich" && nextMode === "rich") {
      onHtmlChange(markdownToHtml(markdownValue));
    }
    onModeChange(nextMode);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <label className="block text-sm font-semibold text-gray-900">
          {label}
          {required ? " *" : ""}
        </label>
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
          {[
            { key: "rich" as const, icon: Pencil, label: "Rich" },
            { key: "markdown" as const, icon: FileText, label: "Markdown" },
            { key: "preview" as const, icon: Eye, label: "Preview" },
          ].map(({ key, icon: Icon, label: modeLabel }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === key ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              } ${key !== "rich" ? "border-l border-gray-300" : ""}`}
            >
              <Icon className="w-4 h-4" />
              {modeLabel}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <div className={`border rounded-md overflow-hidden ${error ? "border-red-500" : "border-gray-300"}`}>
        {mode === "rich" && (
          <ReactQuill
            theme="snow"
            value={htmlValue}
            onChange={onHtmlChange}
            placeholder={placeholder}
            className={minHeightClass}
            modules={{
              toolbar: [
                [{ header: [1, 2, 3, false] }],
                ["bold", "italic", "underline"],
                [{ list: "ordered" }, { list: "bullet" }, "blockquote", "code-block"],
                ["clean"],
              ],
            }}
          />
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
  const legislativeMarkdownRef = useRef<HTMLTextAreaElement | null>(null);
  const supportingMarkdownRef = useRef<HTMLTextAreaElement | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    type: "H.R. Bill",
    legislativeText: "",
    legislativeMarkdown: "",
    legislativeMode: "rich",
    supportingText: "",
    supportingMarkdown: "",
    supportingMode: "rich",
    placeHold: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const billTypes = [
    "H.R. Bill",
    "H.J. Res. (Joint Resolution)",
    "H. Con. Res. (Concurrent Resolution)",
    "H. Res. (Simple Resolution)",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const legislativeHtml = formData.legislativeMode === "rich" ? formData.legislativeText : markdownToHtml(formData.legislativeMarkdown);
    const supportingHtml = formData.supportingMode === "rich" ? formData.supportingText : markdownToHtml(formData.supportingMarkdown);
    
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
      const created = await createBillForCurrentClass({
        title: formData.title.trim(),
        legislativeText: legislativeHtml,
        supportingText: supportingHtml.replace(/<[^>]+>/g, "").trim() ? supportingHtml : null,
        status: formData.placeHold ? "draft" : "submitted",
      });
      toast.success("Bill submitted");
      navigate(`/bills/${created.id}`);
    } catch (error: any) {
      toast.error(error.message || "Could not submit bill");
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

        {/* Warning banner */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Important: Bill Text is Final</h3>
              <p className="text-sm text-red-800">
                Once submitted, the legislative text <strong>cannot be edited or repealed</strong>. 
                Please review carefully before submitting. You may only withdraw or place a hold on the bill.
              </p>
            </div>
          </div>
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

          {/* Place Hold Toggle */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                id="placeHold"
                checked={formData.placeHold}
                onChange={(e) => setFormData({ ...formData, placeHold: e.target.checked })}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="placeHold" className="font-semibold text-gray-900 cursor-pointer">
                  Place hold after submission
                </label>
                <div className="mt-2 flex items-start gap-2 text-sm text-gray-600">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                  <p>
                    Placing a hold signals to leadership that you do not want this bill to move forward 
                    in the legislative process at this time. The bill will remain in draft status until you 
                    remove the hold. You can toggle this at any time before the bill advances.
                  </p>
                </div>
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
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              <Send className="w-4 h-4" />
              Submit Bill
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
