import { useMemo } from "react";

export type NewParty = {
  name: string;
  platform: string;
  color: string;
};

const DEFAULT_PARTY_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#7c3aed", "#0f766e"];

export function defaultPartyColor(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("democrat")) return "#2563eb";
  if (normalized.includes("republican")) return "#dc2626";
  if (normalized.includes("green")) return "#16a34a";
  if (normalized.includes("libertarian")) return "#ca8a04";
  return "#2563eb";
}

export function PartyCreateForm({
  value,
  onChange,
  onCancel,
  onSubmit,
  submitting,
  submitLabel = "Create Party",
  requirePlatform = true,
}: {
  value: NewParty;
  onChange: (party: NewParty) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
  requirePlatform?: boolean;
}) {
  const platformWordCount = useMemo(() => (value.platform.trim() ? value.platform.trim().split(/\s+/).length : 0), [value.platform]);
  const maxPlatformWords = 100;
  const disabled = submitting || !value.name.trim() || (requirePlatform && !value.platform.trim()) || platformWordCount > maxPlatformWords;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Party Name *</label>
          <input
            value={value.name}
            onChange={(event) => {
              const name = event.target.value;
              onChange({ ...value, name, color: value.color || defaultPartyColor(name) });
            }}
            placeholder="e.g., Progressive Reform Party"
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={50}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Party Color *</label>
          <div className="flex flex-wrap items-center gap-2">
            {DEFAULT_PARTY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ ...value, color })}
                className={`h-8 w-8 rounded-full border-2 ${value.color === color ? "border-gray-900" : "border-white shadow ring-1 ring-gray-300"}`}
                style={{ backgroundColor: color }}
                aria-label={`Use party color ${color}`}
              />
            ))}
            <input
              type="color"
              value={value.color}
              onChange={(event) => onChange({ ...value, color: event.target.value })}
              className="h-8 w-8 cursor-pointer rounded-full border border-gray-300 bg-[conic-gradient(red,orange,yellow,green,cyan,blue,violet,red)] p-0 opacity-0"
              aria-label="Custom party color"
            />
            <span
              className="-ml-10 pointer-events-none h-8 w-8 rounded-full border-2 border-white shadow ring-1 ring-gray-300"
              style={{ background: "conic-gradient(red, orange, yellow, green, cyan, blue, violet, red)" }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Platform {requirePlatform ? "*" : ""}</label>
          <textarea
            value={value.platform}
            onChange={(event) => onChange({ ...value, platform: event.target.value })}
            placeholder="Describe the party's core values and policy priorities..."
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className={`mt-1 text-xs ${platformWordCount > maxPlatformWords ? "text-red-600" : "text-gray-500"}`}>
            {platformWordCount} / {maxPlatformWords} words
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-3">
          <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900">
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
