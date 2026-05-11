import { storagePathFromUrl } from "./privateStorage";

const allowedTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

const allowedAttrs = new Set(["class", "data-delete-highlight", "data-edit-highlight", "href", "rel", "style", "target"]);

function isSafeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("//")) return false;
  return /^(https?:|mailto:|\/(?!\/)|#)/i.test(trimmed);
}

function cleanStyle(value: string) {
  const allowed = value
    .split(";")
    .map((part) => part.trim())
    .filter((part) =>
      /^text-align:\s*(left|center|right)$/i.test(part)
      || /^font-weight:\s*(bold|[1-9]00)$/i.test(part)
      || /^font-style:\s*italic$/i.test(part)
      || /^text-decoration(-line)?:\s*(underline|line-through)$/i.test(part)
    );
  return allowed.join("; ");
}

export function sanitizeHtml(html: string | null | undefined) {
  if (!html || typeof document === "undefined") return html || "";
  const template = document.createElement("template");
  template.innerHTML = html;

  const visit = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        const text = document.createTextNode(element.textContent || "");
        element.replaceWith(text);
        return;
      }

      for (const attr of Array.from(element.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on") || !allowedAttrs.has(name)) {
          element.removeAttribute(attr.name);
          continue;
        }
        if (name === "href") {
          const pdfPath = storagePathFromUrl(attr.value, "simulation-pdfs");
          if (pdfPath) element.setAttribute(attr.name, `#/storage-file?bucket=simulation-pdfs&path=${encodeURIComponent(pdfPath)}`);
          else if (!isSafeUrl(attr.value)) element.removeAttribute(attr.name);
        }
        if (name === "style") {
          const cleaned = cleanStyle(attr.value);
          if (cleaned) element.setAttribute("style", cleaned);
          else element.removeAttribute("style");
        }
      }

      if (tag === "a") {
        element.setAttribute("rel", "noopener noreferrer");
        if (!element.getAttribute("target")) element.setAttribute("target", "_blank");
      }
    }

    for (const child of Array.from(node.childNodes)) visit(child);
  };

  for (const child of Array.from(template.content.childNodes)) visit(child);
  return template.innerHTML;
}
