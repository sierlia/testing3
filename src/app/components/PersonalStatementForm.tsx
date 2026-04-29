import { useState, useEffect } from "react";
import { Save, Check } from "lucide-react";

interface PersonalStatementFormProps {
  value: string;
  onChange: (value: string) => void;
}

export function PersonalStatementForm({
  value,
  onChange,
}: PersonalStatementFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const maxWords = 250;
  const minWords = 50;

  const wordCount =
    value.trim() === "" ? 0 : value.trim().split(/\s+/).length;
  const characterCount = value.length;

  // Autosave effect
  useEffect(() => {
    if (value.trim() === "") return;

    const timer = setTimeout(() => {
      setIsSaving(true);
      // Simulate save operation
      setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
      }, 500);
    }, 1500); // Autosave after 1.5 seconds of no typing

    return () => clearTimeout(timer);
  }, [value]);

  const getWordCountColor = () => {
    if (wordCount < minWords) return "text-red-600";
    if (wordCount > maxWords) return "text-red-600";
    if (wordCount >= maxWords - 20) return "text-yellow-600";
    return "text-gray-600";
  };

  const formatLastSaved = () => {
    if (!lastSaved) return "";
    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - lastSaved.getTime()) / 1000,
    );
    if (diff < 5) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        Write Your Personal Statement
      </h2>
      <p className="text-gray-600 mb-6">
        Introduce yourself to your constituents. Share your
        background, values, and why you want to serve in the
        congressional simulation.
      </p>

      <div className="space-y-4">
        <div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="I am representing this district because..."
            className="w-full h-64 px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span
              className={`font-medium ${getWordCountColor()}`}
            >
              {wordCount} / {maxWords} words
            </span>
            <span className="text-gray-500">
              {characterCount} characters
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSaving ? (
              <>
                <Save className="w-4 h-4 text-gray-400 animate-pulse" />
                <span className="text-gray-500">Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-gray-500">
                  Saved {formatLastSaved()}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {wordCount < minWords && wordCount > 0 && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
            Please write at least {minWords} words (currently{" "}
            {wordCount})
          </div>
        )}

        {wordCount > maxWords && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
            Please reduce your statement to {maxWords} words or
            fewer (currently {wordCount})
          </div>
        )}

        {wordCount >= minWords && wordCount <= maxWords && (
          <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-md px-4 py-2">
            Great! Your personal statement meets the
            requirements.
          </div>
        )}
      </div>
    </div>
  );
}