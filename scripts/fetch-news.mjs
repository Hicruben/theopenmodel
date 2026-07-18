#!/usr/bin/env node
// Headline aggregator: pull football RSS feeds → data/news.json (title + link + source only —
// we never host article text, so there is no copyright or duplicate-content exposure).
// Tolerant: on any failure the previous news.json is kept.
import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";

const FEEDS = [
  { src: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { src: "The Guardian", url: "https://www.theguardian.com/football/rss" },
  { src: "Sky Sports", url: "https://www.skysports.com/rss/12040" },
];

function destination(name, fallback) {
  const configured = process.env[name]?.trim() || fallback;
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}

const destinations = [...new Set([
  destination("NEWS_DESTINATION", "data/news.json"),
  destination("NEWS_PUBLIC_DESTINATION", "public/data/news-live.json"),
])];

function stageAtomicWrite(file, contents) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = resolve(dirname(file), `.${basename(file)}.${process.pid}.${randomUUID()}.tmp`);
  writeFileSync(temporary, contents, "utf8");
  return {
    commit() { renameSync(temporary, file); },
    cleanup() {
      try { unlinkSync(temporary); }
      catch { /* already committed or never created */ }
    },
  };
}

const unescape = (s) => s
  .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').trim();

async function pull(feed) {
  const res = await fetch(feed.url, { headers: { "user-agent": "theopenmodel.com news module" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${feed.src} ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20);
  return items.map((m) => {
    const block = m[1];
    const g = (tag) => (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)) ?? [])[1] ?? "";
    // thumbnail: media:thumbnail / media:content / enclosure — take the last (usually largest) url
    const media = [...block.matchAll(/<(?:media:thumbnail|media:content|enclosure)[^>]*url="([^"]+)"[^>]*>/g)]
      .map((x) => x[1]).filter((u) => /\.(jpg|jpeg|png|webp)/i.test(u) || u.includes("img"));
    return {
      title: unescape(g("title")),
      link: unescape(g("link") || g("guid")),
      date: new Date(g("pubDate") || Date.now()).toISOString(),
      src: feed.src,
      img: media.length ? media[media.length - 1] : null,
    };
  }).filter((x) => x.title && x.link.startsWith("http"));
}

try {
  const all = (await Promise.allSettled(FEEDS.map(pull)))
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!all.length) throw new Error("no items from any feed");
  // de-dup near-identical titles, newest first, cap 40
  const seen = new Set();
  const items = all
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((x) => {
      const k = x.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    })
    .slice(0, 40);
  const contents = JSON.stringify({ updated: new Date().toISOString(), items }, null, 1);
  const staged = [];
  try {
    for (const file of destinations) staged.push(stageAtomicWrite(file, contents));
    for (const write of staged) write.commit();
  } finally {
    for (const write of staged) write.cleanup();
  }
  console.log(`✓ news: ${items.length} headlines from ${new Set(items.map((i) => i.src)).size} sources → ${destinations.join(", ")}`);
} catch (e) {
  console.log(`⚠ news fetch failed (${String(e).slice(0, 120)}) — keeping previous news files`);
  if (process.env.NEWS_FAIL_ON_ERROR === "true") process.exitCode = 1;
}
