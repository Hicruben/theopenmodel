"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PortalFixture } from "@/lib/portal";

interface Snap { provider?: string; asOf?: string; fixtures?: PortalFixture[] }

const initials = (v: string) => v.split(/\s+/).filter(Boolean).slice(0, 3).map((p) => p[0]).join("").toUpperCase();

function Row({ f }: { f: PortalFixture }) {
  const home = f.participants.find((p) => p.role === "home") ?? f.participants[0];
  const away = f.participants.find((p) => p.role === "away") ?? f.participants[1];
  if (!home || !away) return null;
  const hasScore = f.score.home !== null && f.score.away !== null;
  const live = f.status.isLive;
  const time = new Date(f.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const homeWon = hasScore && (f.score.home ?? 0) > (f.score.away ?? 0);
  const awayWon = hasScore && (f.score.away ?? 0) > (f.score.home ?? 0);
  const inner = (
    <>
      <span className={`ls-state${live ? " is-live" : f.status.isFinished ? " is-ft" : ""}`}>
        {live && <i className="ls-dot" aria-hidden />}
        {f.status.shortName ?? (f.status.isFinished ? "FT" : time)}
      </span>
      <span className="ls-side" style={homeWon ? { fontWeight: 700 } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {home.imageUrl ? <img src={home.imageUrl} width={20} height={20} alt="" loading="lazy" /> : <i className="ls-mono" aria-hidden>{initials(home.name)}</i>}
        <span className="ls-name">{home.name}</span>
      </span>
      <span className={`ls-score${live ? " is-live" : ""}`}>{hasScore ? `${f.score.home}–${f.score.away}` : time}</span>
      <span className="ls-side" style={awayWon ? { fontWeight: 700 } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {away.imageUrl ? <img src={away.imageUrl} width={20} height={20} alt="" loading="lazy" /> : <i className="ls-mono" aria-hidden>{initials(away.name)}</i>}
        <span className="ls-name">{away.name}</span>
      </span>
    </>
  );
  return f.legacySlug
    ? <Link className="ls-row" href={`/match/${f.legacySlug}/`}>{inner}</Link>
    : <div className="ls-row">{inner}</div>;
}

function Group({ title, list, tone }: { title: string; list: PortalFixture[]; tone?: string }) {
  if (list.length === 0) return null;
  // group by competition
  const byLeague = new Map<string, PortalFixture[]>();
  for (const f of list) {
    const k = f.league.name ?? "Football";
    if (!byLeague.has(k)) byLeague.set(k, []);
    byLeague.get(k)!.push(f);
  }
  return (
    <section style={{ marginTop: 24 }}>
      <div className="lg-head"><h2 style={{ fontSize: 17 }} className={tone}>{title}</h2><span className="updated">{list.length}</span></div>
      {[...byLeague.entries()].map(([lg, fx]) => (
        <div key={lg} style={{ marginTop: 12 }}>
          <p className="ls-comp">{fx[0].league.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={fx[0].league.imageUrl} width={16} height={16} alt="" loading="lazy" />
          )}{lg}</p>
          <div className="ls-rows">{fx.map((f) => <Row key={f.id} f={f} />)}</div>
        </div>
      ))}
    </section>
  );
}

export function LiveScores({ initial, initialAsOf }: { initial: PortalFixture[]; initialAsOf: string | null }) {
  const [feed, setFeed] = useState({ fixtures: initial, asOf: initialAsOf });

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch(`/data/portal-live.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const s = await r.json() as Snap;
        if (!cancelled && s.provider === "api-football" && typeof s.asOf === "string" && Array.isArray(s.fixtures)) {
          setFeed({ fixtures: s.fixtures, asOf: s.asOf });
        }
      } catch { /* keep last snapshot */ }
    }
    void refresh();
    const id = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { cancelled = true; window.clearInterval(id); window.removeEventListener("focus", refresh); };
  }, []);

  const { live, finished, upcoming, updated } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const fx = [...feed.fixtures].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const todayFx = fx.filter((f) => f.startTime.slice(0, 10) === today);
    return {
      live: fx.filter((f) => f.status.isLive),
      finished: todayFx.filter((f) => f.status.isFinished),
      upcoming: todayFx.filter((f) => !f.status.isLive && !f.status.isFinished).slice(0, 60),
      updated: feed.asOf ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(feed.asOf)) : null,
    };
  }, [feed]);

  const empty = live.length === 0 && finished.length === 0 && upcoming.length === 0;

  return (
    <>
      <p className="updated" style={{ margin: "2px 0 0" }}>
        {live.length > 0 ? <><span className="ls-livebadge"><i className="ls-dot" aria-hidden />{live.length} live now</span> · </> : null}
        {updated ? `Live feed updated ${updated} · refreshes automatically` : "Awaiting the live feed"}
      </p>
      {empty && <p className="pagedesc" style={{ marginTop: 20 }}>No matches in the live window right now. Live scores appear here automatically when games kick off.</p>}
      <Group title="Live now" list={live} tone="" />
      <Group title="Finished today" list={finished} />
      <Group title="Coming up today" list={upcoming} />
    </>
  );
}
