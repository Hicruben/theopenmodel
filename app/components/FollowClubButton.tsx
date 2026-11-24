"use client";

import { useEffect, useState } from "react";

export const MY_CLUBS_KEY = "tom_my_clubs_v1";

export function FollowClubButton({ slug, clubName }: { slug: string; clubName: string }) {
  const [followed, setFollowed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MY_CLUBS_KEY);
      if (raw) {
        const list = JSON.parse(raw) as string[];
        setFollowed(list.includes(slug));
      }
    } catch { /* ignore */ }
  }, [slug]);

  function toggle() {
    try {
      const raw = localStorage.getItem(MY_CLUBS_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      let next: string[];
      if (list.includes(slug)) {
        next = list.filter((x) => x !== slug);
        setFollowed(false);
      } else {
        next = [slug, ...list.filter((x) => x !== slug)].slice(0, 4);
        setFollowed(true);
      }
      localStorage.setItem(MY_CLUBS_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={followed}
      className="mono"
      style={{
        marginLeft: "auto",
        padding: "7px 12px",
        fontSize: 11,
        letterSpacing: ".05em",
        textTransform: "uppercase",
        cursor: "pointer",
        border: `1px solid ${followed ? "var(--accent)" : "var(--rule-strong)"}`,
        background: followed ? "var(--accent)" : "var(--panel)",
        color: followed ? "var(--button-ink)" : "var(--ink-soft)",
        fontWeight: followed ? 600 : 400,
      }}
      title={`Pin ${clubName} to your home page`}
    >
      {followed ? "★ Following" : "☆ Follow club"}
    </button>
  );
}
