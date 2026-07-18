import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface NewsItem { title: string; link: string; date: string; src: string; img?: string | null }

let cache: { updated: string | null; items: NewsItem[] } | null = null;

export function latestNews(n = 10, filter?: string[]): NewsItem[] {
  if (!cache) {
    try {
      cache = JSON.parse(readFileSync(join(process.cwd(), "data", "news.json"), "utf8"));
      cache!.items = cache!.items.map((item) => ({
        ...item,
        img: item.img
          ?.replace(/&amp;/g, "&")
          .replace("/ace/standard/240/", "/ace/standard/976/")
          ?? item.img,
      }));
    }
    catch { cache = { updated: null, items: [] }; }
  }
  let items = cache!.items;
  if (filter?.length) {
    const keys = filter.map((k) => k.toLowerCase());
    items = items.filter((i) => keys.some((k) => i.title.toLowerCase().includes(k)));
  }
  return items.slice(0, n);
}

export function newsUpdatedAt(): string | null {
  latestNews(1);
  return cache?.updated ?? null;
}

export function formatNewsDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600e3);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
