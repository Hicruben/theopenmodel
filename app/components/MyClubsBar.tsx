"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MY_CLUBS_KEY } from "./FollowClubButton";

export interface ClubBrief {
  slug: string;
  club: string;
  league: string;
  elo: number;
  nextMatch?: {
    slug: string;
    date: string;
    opponent: string;
    isHome: boolean;
    winProb: number;
  };
}

export function MyClubsBar({ clubs }: { clubs: ClubBrief[] }) {
  const [pinned, setPinned] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MY_CLUBS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPinned(parsed.filter((x) => typeof x === "string").slice(0, 4));
      }
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  const bySlug = useMemo(() => new Map(clubs.map((c) => [c.slug, c])), [clubs]);
  const followedClubs = useMemo(
    () => pinned.map((s) => bySlug.get(s)).filter((c): c is ClubBrief => Boolean(c)),
    [pinned, bySlug]
  );

  function addClub(slug: string) {
    if (!slug) return;
    const next = [slug, ...pinned.filter((x) => x !== slug)].slice(0, 4);
    setPinned(next);
    try { localStorage.setItem(MY_CLUBS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function removeClub(slug: string) {
    const next = pinned.filter((x) => x !== slug);
    setPinned(next);
    try { localStorage.setItem(MY_CLUBS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  if (!ready) return null;

  return (
    <section className="wrap" style={{ marginTop: 28, marginBottom: 8 }}>
      <div className="panel" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <span className="eyebrow plain">My clubs — saved on this device</span>
            {followedClubs.length === 0 && (
              <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-soft)" }}>
                Pin up to 4 clubs to see their next match win probability and fair odds every time you visit.
              </p>
            )}
          </div>
          <select
            aria-label="Pin a club to follow"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                addClub(e.target.value);
                e.target.value = "";
              }
            }}
            className="parlay-input"
            style={{ width: "auto", minWidth: 210, fontSize: 12.5, padding: "7px 10px" }}
          >
            <option value="">+ Pin a club ({followedClubs.length}/4)…</option>
            {clubs.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.club} ({c.league})
              </option>
            ))}
          </select>
        </div>

        {followedClubs.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginTop: 14 }}>
            {followedClubs.map((c) => (
              <div
                key={c.slug}
                style={{
                  border: "1px solid var(--rule-strong)",
                  borderRadius: 2,
                  background: "var(--paper)",
                  padding: "12px 14px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <Link href={`/team/${c.slug}/`} style={{ fontFamily: "var(--font-head)", fontSize: 19, fontWeight: 600, textDecoration: "none" }}>
                    {c.club}
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeClub(c.slug)}
                    className="parlay-clear-btn"
                    aria-label={`Unfollow ${c.club}`}
                  >
                    Remove
                  </button>
                </div>
                <div className="mono tnum" style={{ fontSize: 11, color: "var(--muted)" }}>
                  {c.league} · Elo {c.elo}
                </div>
                {c.nextMatch ? (
                  <Link
                    href={`/match/${c.nextMatch.slug}/`}
                    style={{
                      marginTop: 4,
                      paddingTop: 8,
                      borderTop: "1px solid var(--rule)",
                      textDecoration: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                      Next: {c.nextMatch.isHome ? "vs" : "@"} <b style={{ color: "var(--ink)" }}>{c.nextMatch.opponent}</b>{" "}
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>({c.nextMatch.date})</span>
                    </span>
                    <span className="mono tnum" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap" }}>
                      {(c.nextMatch.winProb * 100).toFixed(0)}% · {(1 / Math.max(0.01, c.nextMatch.winProb)).toFixed(2)}
                    </span>
                  </Link>
                ) : (
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    No upcoming fixture scheduled
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
