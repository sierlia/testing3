export const ANNOUNCEMENT_WORD_LIMIT = 250;
export const COMMENT_WORD_LIMIT = 150;

export function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function withinWordLimit(value: string, limit: number) {
  return wordCount(value) <= limit;
}

export function wordLimitClass(count: number, limit: number) {
  if (count > limit) return "text-red-600";
  if (count >= limit - 15) return "text-yellow-600";
  return "text-gray-400";
}
