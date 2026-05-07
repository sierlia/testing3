const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function base64UrlFromBytes(bytes: number[]) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesFromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return [...atob(padded)].map((char) => char.charCodeAt(0));
}

export function memberCodeFromUserId(userId: string) {
  if (!uuidPattern.test(userId)) return encodeURIComponent(userId);
  const hex = userId.replace(/-/g, "");
  const bytes = hex.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) ?? [];
  return base64UrlFromBytes(bytes);
}

export function userIdFromMemberCode(code: string) {
  if (uuidPattern.test(code)) return code;
  try {
    const hex = bytesFromBase64Url(code).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    if (hex.length !== 32) return code;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return code;
  }
}

export function profilePath(userId: string | null | undefined) {
  return `/members/${memberCodeFromUserId(String(userId ?? "me"))}`;
}
