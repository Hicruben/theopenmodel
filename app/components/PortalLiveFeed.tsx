"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortalFixture } from "@/lib/portal";
import { Kickoff } from "./Kickoff";

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]).join("").toUpperCase();
}

function stateClass(fixture: PortalFixture) {
  if (fixture.status.isLive) return "portal-live-state is-live";
  if (fixture.status.isFinished) return "portal-live-state is-finished";
  return "portal-live-state";
}

interface PublicPortalSnapshot {
  provider?: string;
  asOf?: string;
  fixtures?: PortalFixture[];
}

export function PortalLiveFeed({
  initialFixtures,
  initialAsOf,
}: {
  initialFixtures: PortalFixture[];
  initialAsOf: string | null;
}) {
  const [feed, setFeed] = useState({ fixtures: initialFixtures, asOf: initialAsOf });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(`/data/portal-live.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const snapshot = await response.json() as PublicPortalSnapshot;
        if (
          !cancelled
          && snapshot.provider === "api-football"
          && typeof snapshot.asOf === "string"
          && Array.isArray(snapshot.fixtures)
        ) {
          setFeed({ fixtures: snapshot.fixtures, asOf: snapshot.asOf });
        }
      } catch {
        // Keep the last verified snapshot when the network or provider is unavailable.
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const fixtures = feed.fixtures;
  if (fixtures.length === 0 || !feed.asOf) return null;

  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...fixtures].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const todayFixtures = sorted.filter((fixture) => fixture.startTime.slice(0, 10) === today);
  const firstUpcomingDate = sorted.find((fixture) => !fixture.status.isFinished && fixture.startTime.slice(0, 10) >= today)
    ?.startTime.slice(0, 10);
  const windowFixtures = (todayFixtures.length > 0
    ? todayFixtures
    : sorted.filter((fixture) => fixture.startTime.slice(0, 10) === firstUpcomingDate)
  ).slice(0, 10);
  const liveCount = fixtures.filter((fixture) => fixture.status.isLive).length;
  const updatedLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(feed.asOf));

  if (windowFixtures.length === 0) return null;

  return (
    <section className="portal-section portal-live-centre" aria-labelledby="portal-live-title">
      <header className="portal-section-header">
        <div>
          <p className="portal-live-kicker"><i aria-hidden /> Live match updates</p>
          <h2 id="portal-live-title">{liveCount > 0 ? `${liveCount} matches live now` : "Scores and match times"}</h2>
          <p>Scores and match status come from the live feed. Predictions are calculated separately before the match.</p>
        </div>
        <span className="portal-live-updated">Last checked {updatedLabel}</span>
      </header>

      <div className="portal-live-grid">
        {windowFixtures.map((fixture) => {
          const home = fixture.participants.find((participant) => participant.role === "home") ?? fixture.participants[0];
          const away = fixture.participants.find((participant) => participant.role === "away") ?? fixture.participants[1];
          if (!home || !away) return null;
          const hasScore = fixture.score.home !== null && fixture.score.away !== null;
          const content = (
            <>
              <span className="portal-live-meta">
                <span>{fixture.league.name ?? "Football"}</span>
                <span className={stateClass(fixture)}>{fixture.status.shortName ?? fixture.status.name}</span>
              </span>
              <span className="portal-live-team">
                {home.imageUrl
                  ? <img src={home.imageUrl} width={27} height={27} alt="" aria-hidden />
                  : <i className="portal-live-monogram" aria-hidden>{initials(home.name)}</i>}
                <strong>{home.name}</strong>
                {hasScore && <b>{fixture.score.home}</b>}
              </span>
              <span className="portal-live-team">
                {away.imageUrl
                  ? <img src={away.imageUrl} width={27} height={27} alt="" aria-hidden />
                  : <i className="portal-live-monogram" aria-hidden>{initials(away.name)}</i>}
                <strong>{away.name}</strong>
                {hasScore && <b>{fixture.score.away}</b>}
              </span>
              {!hasScore && <Kickoff iso={fixture.startTime} style="time" />}
            </>
          );

          return fixture.legacySlug ? (
            <Link className="portal-live-row" href={`/match/${fixture.legacySlug}/`} key={fixture.id}>{content}</Link>
          ) : (
            <article className="portal-live-row" key={fixture.id}>{content}</article>
          );
        })}
      </div>
    </section>
  );
}
