"use client";

import { useId, useState, type CSSProperties } from "react";
import { matchProb } from "@/lib/model";

interface Club {
  slug: string;
  club: string;
  elo: number;
  logo?: string;
  country: string;
}

type ProbabilityStyle = CSSProperties & { "--tool-probability": string };

function ClubSelect({
  id,
  label,
  value,
  exclude,
  clubs,
  groups,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  exclude: string;
  clubs: Club[];
  groups: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="tool-team-select" htmlFor={id}>
      <span>{label}</span>
      <select id={id} className="clubselect" value={value} onChange={(event) => onChange(event.target.value)}>
        {groups.map((group) => (
          <optgroup label={group} key={group}>
            {clubs
              .filter((club) => club.country === group && club.slug !== exclude)
              .map((club) => (
                <option key={club.slug} value={club.slug}>{club.club} · strength {club.elo}</option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function MatchPicker({ clubs }: { clubs: Club[] }) {
  const pickerId = useId();
  const [homeSlug, setHomeSlug] = useState(clubs[0]?.slug ?? "");
  const [awaySlug, setAwaySlug] = useState(clubs[1]?.slug ?? "");

  if (clubs.length < 2) {
    return <p className="tool-empty">At least two clubs are needed to run a matchup.</p>;
  }

  const home = clubs.find((club) => club.slug === homeSlug) ?? clubs[0];
  const away = clubs.find((club) => club.slug === awaySlug && club.slug !== home.slug)
    ?? clubs.find((club) => club.slug !== home.slug)
    ?? clubs[1];
  const probabilities = matchProb(home.elo, away.elo);
  const outcomes = [
    { key: "home", label: home.club, shortLabel: "Home win", value: probabilities.home, tone: "is-home" },
    { key: "draw", label: "Draw", shortLabel: "Draw", value: probabilities.draw, tone: "is-draw" },
    { key: "away", label: away.club, shortLabel: "Away win", value: probabilities.away, tone: "is-away" },
  ];
  const leading = [...outcomes].sort((a, b) => b.value - a.value)[0];
  const groups = [...new Set(clubs.map((club) => club.country))];

  return (
    <section className="matchup-tool" aria-labelledby={`${pickerId}-title`}>
      <div className="matchup-tool-head">
        <div>
          <p className="tool-kicker">Compare two teams</p>
          <h2 id={`${pickerId}-title`}>Choose any two clubs and compare the possible results.</h2>
        </div>
        <p>The team on the left plays at home, which usually gives it a small advantage.</p>
      </div>

      <div className="matchup-controls">
        <div className="matchup-club-card">
          {home.logo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={home.logo} width={54} height={54} alt="" />
          )}
          <ClubSelect
            id={`${pickerId}-home`}
            label="Home team — plays at its stadium"
            value={home.slug}
            exclude={away.slug}
            clubs={clubs}
            groups={groups}
            onChange={setHomeSlug}
          />
          <span className="matchup-rating mono tnum">Team strength {home.elo} · {home.country}</span>
        </div>

        <button
          className="matchup-swap"
          type="button"
          aria-label="Swap the home and away teams"
          onClick={() => {
            setHomeSlug(away.slug);
            setAwaySlug(home.slug);
          }}
        >
          <span aria-hidden>⇄</span>
          Swap home / away
        </button>

        <div className="matchup-club-card is-away">
          {away.logo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={away.logo} width={54} height={54} alt="" />
          )}
          <ClubSelect
            id={`${pickerId}-away`}
            label="Away team — visits"
            value={away.slug}
            exclude={home.slug}
            clubs={clubs}
            groups={groups}
            onChange={setAwaySlug}
          />
          <span className="matchup-rating mono tnum">Team strength {away.elo} · {away.country}</span>
        </div>
      </div>

      <div className="matchup-output" role="status" aria-live="polite" aria-atomic="true">
        <div className="matchup-verdict">
          <span>Highest estimated chance</span>
          <strong>{leading.label}</strong>
          <b className="tnum">{(leading.value * 100).toFixed(1)}%</b>
          <small className="mono tnum">Average simulated goals {probabilities.xgHome.toFixed(2)}–{probabilities.xgAway.toFixed(2)}</small>
        </div>

        <div className="matchup-probabilities">
          {outcomes.map((outcome) => (
            <div className={`matchup-probability ${outcome.tone}`} key={outcome.key}>
              <span><b>{outcome.shortLabel}</b><small>{outcome.label}</small></span>
              <strong className="tnum">{(outcome.value * 100).toFixed(1)}%</strong>
              <span
                className="matchup-meter"
                style={{ "--tool-probability": `${outcome.value * 100}%` } as ProbabilityStyle}
                aria-hidden
              ><i /></span>
            </div>
          ))}
        </div>
      </div>

      <p className="matchup-note mono">
        The three result chances add to 100%. They update instantly when you change either team.
      </p>
    </section>
  );
}
