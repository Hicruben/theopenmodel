"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { NewsItem } from "@/lib/news";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const FALLBACK_IMAGE = "/images/hero-stadium.jpg";

interface NewsSnapshot {
  updated: string | null;
  items: NewsItem[];
}

const NewsContext = createContext<NewsSnapshot | null>(null);

function isValidDate(value: string) {
  return Number.isFinite(Date.parse(value));
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.replace(/&amp;/g, "&"));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseNewsItem(value: unknown): NewsItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const link = safeHttpUrl(item.link);
  if (
    typeof item.title !== "string"
    || !item.title.trim()
    || item.title.length > 500
    || !link
    || typeof item.date !== "string"
    || !isValidDate(item.date)
    || typeof item.src !== "string"
    || !item.src.trim()
    || item.src.length > 100
  ) return null;

  return {
    title: item.title.trim(),
    link,
    date: new Date(item.date).toISOString(),
    src: item.src.trim(),
    img: item.img == null
      ? null
      : safeHttpUrl(typeof item.img === "string"
          ? item.img.replace("/ace/standard/240/", "/ace/standard/976/")
          : item.img),
  };
}

function parseNewsSnapshot(value: unknown): NewsSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  if (!Array.isArray(snapshot.items)) return null;

  const items = snapshot.items
    .map(parseNewsItem)
    .filter((item): item is NewsItem => item !== null)
    .slice(0, 40);
  if (!items.length) return null;

  const updated = typeof snapshot.updated === "string" && isValidDate(snapshot.updated)
    ? new Date(snapshot.updated).toISOString()
    : null;
  return { updated, items };
}

function cleanTitle(title: string) {
  return title.replace(/[—–]/g, "-");
}

function formatNewsDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function useNews() {
  const news = useContext(NewsContext);
  if (!news) throw new Error("Portal news components must be wrapped in PortalNewsFeed");
  return news;
}

export function PortalNewsFeed({
  initialStories,
  initialUpdated,
  children,
}: {
  initialStories: NewsItem[];
  initialUpdated: string | null;
  children: ReactNode;
}) {
  const initial = useMemo(() => parseNewsSnapshot({
    updated: initialUpdated,
    items: initialStories,
  }) ?? { updated: null, items: [] }, [initialStories, initialUpdated]);
  const [snapshot, setSnapshot] = useState<NewsSnapshot>(initial);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/data/news-live.json?t=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const next = parseNewsSnapshot(await response.json());
        if (active && next) setSnapshot(next);
      } catch {
        // Network, parsing and validation failures intentionally keep the last good snapshot.
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, []);

  return <NewsContext.Provider value={snapshot}>{children}</NewsContext.Provider>;
}

export function PortalNewsUpdated() {
  const { updated } = useNews();
  return updated ? <span>News updated {formatNewsDate(updated)}</span> : null;
}

export function PortalLeadStory() {
  const { items } = useNews();
  const leadStory = items.find((story) => story.img) ?? items[0];

  if (!leadStory) {
    return (
      <Link className="portal-lead-story is-fallback" href="/matches/">
        <span className="portal-lead-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FALLBACK_IMAGE} width={1280} height={800} alt="A floodlit football stadium" />
        </span>
        <span className="portal-lead-copy">
          <span className="portal-story-meta"><span>The daily forecast</span></span>
          <h2>Football&apos;s next matches, measured before kickoff.</h2>
          <span className="portal-story-action">Explore predictions <i aria-hidden>→</i></span>
        </span>
      </Link>
    );
  }

  return (
    <a className="portal-lead-story" href={leadStory.link} target="_blank" rel="noopener nofollow">
      <span className="portal-lead-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={leadStory.img ?? FALLBACK_IMAGE}
          width={1280}
          height={800}
          alt={cleanTitle(leadStory.title)}
        />
      </span>
      <span className="portal-lead-copy">
        <span className="portal-story-meta">
          <span>Top story</span>
          <span>{leadStory.src}</span>
          <time dateTime={leadStory.date}>{formatNewsDate(leadStory.date)}</time>
        </span>
        <h2>{cleanTitle(leadStory.title)}</h2>
        <span className="portal-story-action">Read the full report <i aria-hidden>↗</i></span>
      </span>
    </a>
  );
}

export function PortalNewsCards() {
  const { items } = useNews();
  const leadStory = items.find((story) => story.img) ?? items[0];
  const newsCards = items
    .filter((story) => story.img && story.link !== leadStory?.link)
    .slice(0, 6);

  return (
    <div className="portal-news-grid">
      {newsCards.map((story) => (
        <a className="portal-news-card" href={story.link} target="_blank" rel="noopener nofollow" key={story.link}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={story.img!} width={480} height={300} alt={cleanTitle(story.title)} loading="lazy" />
          <span className="portal-news-copy">
            <span className="portal-story-meta">
              <span>{story.src}</span>
              <time dateTime={story.date}>{formatNewsDate(story.date)}</time>
            </span>
            <strong>{cleanTitle(story.title)}</strong>
            <span>Read story <i aria-hidden>↗</i></span>
          </span>
        </a>
      ))}
    </div>
  );
}
