export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const codeChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function memberCodeFromUserId(userId: string) {
  if (!uuidPattern.test(userId)) return encodeURIComponent(userId);
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let value = hash >>> 0;
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += codeChars[value % codeChars.length];
    value = Math.floor(value / codeChars.length);
  }
  return code;
}

export function profilePath(userId: string | null | undefined) {
  return `/members/${memberCodeFromUserId(String(userId ?? "me"))}`;
}
