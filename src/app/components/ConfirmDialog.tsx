import { AlertCircle } from "lucide-react";

export type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  dialog,
  onClose,
}: {
  dialog: ConfirmDialogState | null;
  onClose: () => void;
}) {
  if (!dialog) return null;

  const confirm = async () => {
    await dialog.onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-gray-200 p-5">
          <div className={`mt-0.5 rounded-full p-2 ${dialog.danger ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{dialog.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{dialog.message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {dialog.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              dialog.danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {dialog.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
