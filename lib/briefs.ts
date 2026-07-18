// Model briefs: original analysis pieces hooked to a real news story. We host only our own
// words — the source is credited and linked, never copied.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Brief {
  slug: string;
  date: string;
  title: string;
  clubs: string[];
  sourceName: string;
  sourceLink: string;
  sourceTitle: string;
  body: string;        // markdown-lite: **bold**, [text](href), \n\n paragraphs
  img?: string | null;
  imgCaption?: string;
  factcheck?: string;
}

let cache: Brief[] | null = null;

export function allBriefs(): Brief[] {
  if (!cache) {
    try { cache = (JSON.parse(readFileSync(join(process.cwd(), "data", "briefs.json"), "utf8")).items as Brief[]).sort((a, b) => b.date.localeCompare(a.date)); }
    catch { cache = []; }
  }
  return cache!;
}

export function briefBySlug(slug: string): Brief | undefined {
  return allBriefs().find((b) => b.slug === slug);
}

export function briefsForClub(clubSlug: string, n = 3): Brief[] {
  return allBriefs().filter((b) => b.clubs.includes(clubSlug)).slice(0, n);
}

// tiny markdown: paragraphs + ## headers + - lists + **bold** + [text](url)
export function mdLite(md: string): string {
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => s
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return esc.split(/\n\n+/).map((block) => {
    const b = block.trim();
    if (b.startsWith("### ")) return `<h3>${inline(b.slice(4))}</h3>`;
    if (b.startsWith("## ")) return `<h2>${inline(b.slice(3))}</h2>`;
    if (b.split("\n").every((ln) => ln.trim().startsWith("- "))) {
      return `<ul>${b.split("\n").map((ln) => `<li>${inline(ln.trim().slice(2))}</li>`).join("")}</ul>`;
    }
    return `<p>${inline(b)}</p>`;
  }).join("");
}
