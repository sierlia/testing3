import { ExternalLink, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { randomStoragePath, storageFileHashUrl } from "../utils/privateStorage";
import { supabase } from "../utils/supabase";

export function SimulationPdfUpload({
  title,
  description,
  path,
  uploadPrefix,
  disabled = false,
  onUploaded,
}: {
  title: string;
  description?: string;
  path?: string | null;
  uploadPrefix: string;
  disabled?: boolean;
  onUploaded: (path: string) => void | Promise<void>;
}) {
  const upload = async (file: File | null | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      toast.error("Upload a PDF file.");
      return;
    }
    try {
      const nextPath = randomStoragePath(uploadPrefix, file.name);
      const { error } = await supabase.storage.from("simulation-pdfs").upload(nextPath, file, { upsert: false, contentType: "application/pdf" });
      if (error) throw error;
      await onUploaded(nextPath);
      toast.success("PDF uploaded");
    } catch (error: any) {
      toast.error(error.message || "Could not upload PDF");
    }
  };

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4 text-blue-600" />
            {title}
          </div>
          {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
          {path ? (
            <a href={storageFileHashUrl("simulation-pdfs", path)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">
              <ExternalLink className="h-4 w-4" />
              Open uploaded PDF
            </a>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No PDF uploaded yet.</p>
          )}
        </div>
        {!disabled && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Upload className="h-4 w-4" />
            {path ? "Replace PDF" : "Upload PDF"}
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  );
}
