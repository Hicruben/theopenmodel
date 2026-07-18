"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { WhatIfLab } from "./WhatIfLab";

interface ScenarioClub {
  club: string;
  slug: string;
  elo: number;
  logo?: string;
}

interface ScenarioLeague {
  slug: string;
  name: string;
  clubs: ScenarioClub[];
}

export function LeagueScenarioLab({ leagues }: { leagues: ScenarioLeague[] }) {
  const tabsId = useId();
  const [activeSlug, setActiveSlug] = useState(leagues[0]?.slug ?? "");
  const active = leagues.find((league) => league.slug === activeSlug) ?? leagues[0];

  if (!active) return <p className="tool-empty">No league data is available.</p>;

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + offset + leagues.length) % leagues.length;
    setActiveSlug(leagues[nextIndex].slug);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']");
    buttons?.[nextIndex]?.focus();
  };

  return (
    <div className="league-scenario-tool">
      <div className="scenario-tabs" role="tablist" aria-label="Choose league">
        {leagues.map((league, index) => {
          const selected = league.slug === active.slug;
          return (
            <button
              key={league.slug}
              id={`${tabsId}-${league.slug}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              tabIndex={selected ? 0 : -1}
              className={selected ? "is-active" : ""}
              onClick={() => setActiveSlug(league.slug)}
              onKeyDown={(event) => moveTab(event, index)}
            >
              {league.name}
            </button>
          );
        })}
      </div>
      <div
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${active.slug}-tab`}
      >
        <WhatIfLab key={active.slug} clubs={active.clubs} adjustable={active.clubs.length} />
      </div>
    </div>
  );
}
