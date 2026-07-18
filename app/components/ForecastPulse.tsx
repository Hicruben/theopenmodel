"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Kickoff } from "./Kickoff";

export type ForecastPulseMatch = {
  slug: string;
  date: string;
  league: string;
  home: { slug: string; club: string; logo?: string };
  away: { slug: string; club: string; logo?: string };
  probabilities: { home: number; draw: number; away: number };
  xg: { home: number; away: number };
  explanation: string;
};

const FOLLOW_KEY = "the-open-model-followed-clubs-v1";

function readFollowed(): string[] {
  try {
    const value = window.localStorage.getItem(FOLLOW_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function countdownLabel(date: string, now: number) {
  const milliseconds = new Date(date).getTime() - now;
  if (milliseconds <= 0) return "Kickoff reached";
  const totalMinutes = Math.floor(milliseconds / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h to kickoff`;
  if (hours > 0) return `${hours}h ${minutes}m to kickoff`;
  return `${Math.max(1, minutes)}m to kickoff`;
}

function outcomeLabel(match: ForecastPulseMatch) {
  const outcomes = [
    { label: match.home.club, value: match.probabilities.home },
    { label: "Draw", value: match.probabilities.draw },
    { label: match.away.club, value: match.probabilities.away },
  ].sort((a, b) => b.value - a.value);
  const gap = outcomes[0].value - outcomes[1].value;
  const strength = gap < 0.045 ? "Tight call" : gap < 0.14 ? "Model lean" : "Clear edge";
  return { favorite: outcomes[0].label, gap, strength };
}

export function ForecastPulse({
  matches,
  snapshotDate,
}: {
  matches: ForecastPulseMatch[];
  snapshotDate: string;
}) {
  const [activeSlug, setActiveSlug] = useState(matches[0]?.slug ?? "");
  const [followed, setFollowed] = useState<string[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const saved = readFollowed();
    setFollowed(saved);
    const savedMatch = matches.find((match) =>
      saved.includes(match.home.slug) || saved.includes(match.away.slug)
    );
    if (savedMatch) setActiveSlug(savedMatch.slug);
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => window.clearInterval(timer);
  }, [matches]);

  const orderedMatches = useMemo(() => [...matches].sort((a, b) => {
    const aSaved = Number(followed.includes(a.home.slug) || followed.includes(a.away.slug));
    const bSaved = Number(followed.includes(b.home.slug) || followed.includes(b.away.slug));
    return bSaved - aSaved;
  }), [followed, matches]);

  const activeMatch = useMemo(
    () => matches.find((match) => match.slug === activeSlug) ?? matches[0],
    [activeSlug, matches],
  );

  if (!activeMatch) return null;

  const signal = outcomeLabel(activeMatch);
  const maxProbability = Math.max(
    activeMatch.probabilities.home,
    activeMatch.probabilities.draw,
    activeMatch.probabilities.away,
  );

  function toggleFollow(slug: string) {
    setFollowed((current) => {
      const next = current.includes(slug)
        ? current.filter((club) => club !== slug)
        : [...current, slug];
      try {
        window.localStorage.setItem(FOLLOW_KEY, JSON.stringify(next));
      } catch {
        // Following still works for this visit when storage is unavailable.
      }
      return next;
    });
  }

  const snapshot = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${snapshotDate}T00:00:00Z`));

  return (
    <section className="forecast-pulse" aria-labelledby="forecast-pulse-title">
      <header className="forecast-pulse-head">
        <div>
          <span className="forecast-pulse-kicker">Forecast pulse</span>
          <h2 id="forecast-pulse-title">Next on the model</h2>
        </div>
        <span className="forecast-pulse-snapshot">Snapshot · {snapshot}</span>
      </header>

      <nav className="forecast-pulse-tabs" aria-label="Choose an upcoming fixture">
        {orderedMatches.slice(0, 5).map((match, index) => (
          <button
            key={match.slug}
            type="button"
            className={match.slug === activeMatch.slug ? "is-active" : ""}
            aria-pressed={match.slug === activeMatch.slug}
            title={`${match.home.club} v ${match.away.club}`}
            onClick={() => setActiveSlug(match.slug)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <b>{match.home.club}</b>
            <i aria-hidden>v</i>
            <b>{match.away.club}</b>
          </button>
        ))}
      </nav>

      <article className="forecast-pulse-stage" key={activeMatch.slug}>
        <div className="forecast-pulse-meta">
          <span>{activeMatch.league}</span>
          <Kickoff iso={activeMatch.date} />
          <strong>{now ? countdownLabel(activeMatch.date, now) : "Next kickoff"}</strong>
        </div>

        <div className="forecast-pulse-teams">
          {[activeMatch.home, activeMatch.away].map((team, index) => {
            const isFollowed = followed.includes(team.slug);
            return (
              <div className={`forecast-pulse-team${index === 1 ? " is-away" : ""}`} key={team.slug}>
                {team.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={team.logo} width={58} height={58} alt={`${team.club} crest`} />
                ) : (
                  <span className="forecast-pulse-monogram" aria-hidden>{team.club.slice(0, 2)}</span>
                )}
                <h3>{team.club}</h3>
                <button
                  type="button"
                  className={`forecast-follow${isFollowed ? " is-followed" : ""}`}
                  aria-pressed={isFollowed}
                  aria-label={`${isFollowed ? "Remove saved club" : "Save club"}: ${team.club}`}
                  onClick={() => toggleFollow(team.slug)}
                >
                  {isFollowed ? "Saved" : "+ Save club"}
                </button>
              </div>
            );
          })}
          <span className="forecast-pulse-versus" aria-hidden>vs</span>
        </div>

        <div className="forecast-pulse-probabilities" aria-label="Model probabilities">
          <div className={activeMatch.probabilities.home === maxProbability ? "is-primary" : ""}>
            <span>Home</span>
            <b>{(activeMatch.probabilities.home * 100).toFixed(1)}%</b>
          </div>
          <div className={activeMatch.probabilities.draw === maxProbability ? "is-primary" : ""}>
            <span>Draw</span>
            <b>{(activeMatch.probabilities.draw * 100).toFixed(1)}%</b>
          </div>
          <div className={activeMatch.probabilities.away === maxProbability ? "is-primary" : ""}>
            <span>Away</span>
            <b>{(activeMatch.probabilities.away * 100).toFixed(1)}%</b>
          </div>
        </div>

        <div className="forecast-pulse-meter" aria-hidden>
          <span style={{ width: `${activeMatch.probabilities.home * 100}%` }} />
          <span style={{ width: `${activeMatch.probabilities.draw * 100}%` }} />
          <span style={{ width: `${activeMatch.probabilities.away * 100}%` }} />
        </div>

        <div className="forecast-pulse-reading">
          <p>
            <span>{signal.strength}</span>
            <strong>{signal.favorite}</strong>
          </p>
          <p>{activeMatch.explanation}</p>
          <dl>
            <div><dt>Expected goals</dt><dd>{activeMatch.xg.home.toFixed(2)}–{activeMatch.xg.away.toFixed(2)}</dd></div>
            <div><dt>Outcome gap</dt><dd>{(signal.gap * 100).toFixed(1)} pts</dd></div>
          </dl>
        </div>

        <footer className="forecast-pulse-actions">
          <Link href={`/match/${activeMatch.slug}/`}>Open full forecast <span aria-hidden>↗</span></Link>
          <a href="#live">Test yourself on four more <span aria-hidden>↓</span></a>
        </footer>
      </article>
    </section>
  );
}
