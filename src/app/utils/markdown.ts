function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(value: string) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return text;
}

function flushParagraph(lines: string[], output: string[]) {
  if (!lines.length) return;
  output.push(`<p>${lines.map(renderInlineMarkdown).join("<br />")}</p>`);
  lines.length = 0;
}

function flushList(items: string[], ordered: boolean, output: string[]) {
  if (!items.length) return;
  const tag = ordered ? "ol" : "ul";
  output.push(`<${tag}>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${tag}>`);
  items.length = 0;
}

export function markdownToHtml(markdown: string) {
  const output: string[] = [];
  const paragraph: string[] = [];
  const listItems: string[] = [];
  let orderedList = false;
  let inCodeBlock = false;
  const codeLines: string[] = [];

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith("```")) {
      flushParagraph(paragraph, output);
      flushList(listItems, orderedList, output);
      if (inCodeBlock) {
        output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines.length = 0;
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph(paragraph, output);
      flushList(listItems, orderedList, output);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph(paragraph, output);
      flushList(listItems, orderedList, output);
      const level = heading[1].length;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph(paragraph, output);
      flushList(listItems, orderedList, output);
      output.push(`<blockquote><p>${renderInlineMarkdown(quote[1])}</p></blockquote>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph(paragraph, output);
      if (listItems.length && orderedList) flushList(listItems, orderedList, output);
      orderedList = false;
      listItems.push(unordered[1]);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph(paragraph, output);
      if (listItems.length && !orderedList) flushList(listItems, orderedList, output);
      orderedList = true;
      listItems.push(ordered[1]);
      continue;
    }

    flushList(listItems, orderedList, output);
    paragraph.push(line.trim());
  }

  if (inCodeBlock) output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  flushParagraph(paragraph, output);
  flushList(listItems, orderedList, output);

  return output.join("\n") || "<p></p>";
}

export function htmlToMarkdown(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html || "";

  const readNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (!(node instanceof HTMLElement)) return "";

    const children = Array.from(node.childNodes).map(readNode).join("");
    switch (node.tagName.toLowerCase()) {
      case "strong":
      case "b":
        return `**${children}**`;
      case "em":
      case "i":
        return `*${children}*`;
      case "code":
        return `\`${children}\``;
      case "br":
        return "\n";
      case "a":
        return `[${children}](${node.getAttribute("href") || ""})`;
      case "li":
        return children.trim();
      default:
        return children;
    }
  };

  const blocks = Array.from(root.children).map((element) => {
    const tag = element.tagName.toLowerCase();
    const text = Array.from(element.childNodes).map(readNode).join("").trim();
    if (!text) return "";
    if (tag === "h1") return `# ${text}`;
    if (tag === "h2") return `## ${text}`;
    if (tag === "h3") return `### ${text}`;
    if (tag === "blockquote") return text.split("\n").map((line) => `> ${line}`).join("\n");
    if (tag === "pre") return `\`\`\`\n${element.textContent || ""}\n\`\`\``;
    if (tag === "ul") return Array.from(element.children).map((li) => `- ${readNode(li).trim()}`).join("\n");
    if (tag === "ol") return Array.from(element.children).map((li, index) => `${index + 1}. ${readNode(li).trim()}`).join("\n");
    return text;
  });

  return blocks.filter(Boolean).join("\n\n");
}
