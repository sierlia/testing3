import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { formatSchool, SchoolOption, searchSchools } from "../services/schools";

function sameSchool(a: SchoolOption, b: SchoolOption) {
  return a.id === b.id || (a.name.toLowerCase() === b.name.toLowerCase() && (a.state ?? "") === (b.state ?? ""));
}

export function SchoolSelector({
  id,
  value,
  onChange,
  placeholder = "Search schools...",
  required,
  disabled,
}: {
  id?: string;
  value: SchoolOption[];
  onChange: (schools: SchoolOption[]) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const blurTimerRef = useRef<number | null>(null);

  const availableResults = useMemo(
    () => results.filter((school) => !value.some((selected) => sameSchool(selected, school))),
    [results, value],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || disabled) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchSchools(trimmed)
        .then((schools) => {
          if (!cancelled) setResults(schools);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [disabled, query]);

  const selectSchool = (school: SchoolOption) => {
    onChange([...value, school]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const removeSchool = (school: SchoolOption) => {
    onChange(value.filter((selected) => !sameSchool(selected, school)));
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((school) => (
            <Badge key={`${school.id}:${school.name}`} variant="secondary" className="max-w-full gap-1 py-1 pl-2 pr-1">
              <span className="truncate">{formatSchool(school)}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                onClick={() => removeSchool(school)}
                disabled={disabled}
                aria-label={`Remove ${school.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          id={id}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimerRef.current = window.setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          className="pl-9"
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
          disabled={disabled}
          required={required && value.length === 0}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}

        {open && query.trim().length >= 2 && (
          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            {availableResults.length > 0 ? (
              availableResults.map((school) => (
                <button
                  type="button"
                  key={`${school.id}:${school.name}`}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSchool(school)}
                >
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">{school.name}</span>
                    {(school.city || school.state) && <span className="block truncate text-xs text-gray-500">{[school.city, school.state].filter(Boolean).join(", ")}</span>}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">{loading ? "Searching..." : "No matching schools found."}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
