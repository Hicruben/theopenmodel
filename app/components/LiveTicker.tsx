"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Fixture } from "@/lib/fixtures";
import { matchProb } from "@/lib/model";
import { Kickoff } from "./Kickoff";

function TickerItems({ fixtures, duplicate = false }: { fixtures: Fixture[]; duplicate?: boolean }) {
  return (
    <div className="live-ticker-group" aria-hidden={duplicate || undefined}>
      {fixtures.map((fixture) => {
        const p = matchProb(fixture.home.elo, fixture.away.elo);
        return (
          <Link key={`${duplicate ? "copy-" : ""}${fixture.id}`} href={`/match/${fixture.slug}/`} className="live-ticker-item" tabIndex={duplicate ? -1 : undefined}>
            <span className="live-ticker-time"><Kickoff iso={fixture.date} style="time" /></span>
            <strong>{fixture.home.club}</strong>
            <span className="live-ticker-versus">v</span>
            <strong>{fixture.away.club}</strong>
            <span className="live-ticker-prob tnum">{Math.round(p.home * 100)}</span>
            <span className="live-ticker-prob is-draw tnum">{Math.round(p.draw * 100)}</span>
            <span className="live-ticker-prob is-away tnum">{Math.round(p.away * 100)}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function LiveTicker({ fixtures }: { fixtures: Fixture[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={`live-ticker${paused || !inView ? " is-paused" : ""}`} aria-label="Upcoming fixtures and current model probabilities">
      <div className="live-ticker-state"><span aria-hidden />Forecast stream</div>
      <div className="live-ticker-window">
        <div className="live-ticker-track">
          <TickerItems fixtures={fixtures} />
          <TickerItems fixtures={fixtures} duplicate />
        </div>
      </div>
      <button className="live-ticker-toggle" type="button" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}
