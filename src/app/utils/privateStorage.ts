import { supabase } from "./supabase";

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export function storagePathFromUrl(value: string | null | undefined, bucket: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.startsWith("#") || trimmed.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
    return trimmed.replace(/^\/+/, "");
  }

  try {
    const url = new URL(trimmed);
    const publicMarker = `/storage/v1/object/public/${bucket}/`;
    const signedMarker = `/storage/v1/object/sign/${bucket}/`;
    const authenticatedMarker = `/storage/v1/object/authenticated/${bucket}/`;
    const marker = [publicMarker, signedMarker, authenticatedMarker].find((item) => url.pathname.includes(item));
    if (!marker) return null;
    return decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + marker.length));
  } catch {
    return null;
  }
}

export async function signedStorageUrl(bucket: string, value: string | null | undefined, expiresIn = 3600) {
  if (!value) return null;
  if (/^(data:|blob:)/i.test(value)) return value;
  const path = storagePathFromUrl(value, bucket);
  if (!path) return /^https?:\/\//i.test(value) ? value : null;

  const key = `${bucket}:${path}`;
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.url;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  signedUrlCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + expiresIn * 1000 });
  return data.signedUrl;
}

export function randomStoragePath(prefix: string, filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix.replace(/^\/+|\/+$/g, "")}/${random}.${extension}`;
}

export function storageFileHashUrl(bucket: string, path: string) {
  return `#/storage-file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
}

export function simulationPdfLinkHtml(path: string) {
  return `<p><a href="${storageFileHashUrl("simulation-pdfs", path)}" target="_blank" rel="noopener noreferrer">Open uploaded PDF</a></p>`;
}
