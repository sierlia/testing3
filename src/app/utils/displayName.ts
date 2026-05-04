export function displayPersonName(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Member";
  const [first, ...rest] = raw.split(",");
  const last = rest.join(",").trim();
  return last ? `${first.trim()} ${last}`.trim() : raw;
}

export function nameInputPlaceholder() {
  return "First Name, Last Name";
}
