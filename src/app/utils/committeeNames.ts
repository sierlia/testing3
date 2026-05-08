export function committeeDisplayName(name: string | null | undefined) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "Committee";
  return /\bcommittee$/i.test(trimmed) ? trimmed : `${trimmed} Committee`;
}
