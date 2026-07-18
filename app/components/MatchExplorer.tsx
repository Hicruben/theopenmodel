"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Kickoff } from "./Kickoff";

export type MatchExplorerOutcome = "home" | "draw" | "away";

export type MatchExplorerMatch = {
  slug: string;
  date: string;
  league: string;
  home: string;
  homeLogo?: string;
  away: string;
  awayLogo?: string;
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  explanation?: string;
};

export type MatchExplorerProps = {
  matches: MatchExplorerMatch[];
};

const OUTCOMES: MatchExplorerOutcome[] = ["home", "draw", "away"];
const CALLS_KEY = "the-open-model-match-calls-v1";

function toPercentage(value: number) {
  const percentage = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, percentage));
}

function outcomeLabel(outcome: MatchExplorerOutcome, match: MatchExplorerMatch) {
  if (outcome === "home") return match.home;
  if (outcome === "away") return match.away;
  return "Draw";
}

function getModelPick(match: MatchExplorerMatch): MatchExplorerOutcome {
  return OUTCOMES.reduce((best, outcome) =>
    match.probabilities[outcome] > match.probabilities[best] ? outcome : best
  );
}

function getFeedback(selection: MatchExplorerOutcome, match: MatchExplorerMatch) {
  const selectedLabel = outcomeLabel(selection, match);
  const selectedProbability = toPercentage(match.probabilities[selection]).toFixed(1);
  if (selection === getModelPick(match)) {
    return `You picked ${selectedLabel}. We estimate a ${selectedProbability}% chance, the highest of the three results.`;
  }

  const modelPick = getModelPick(match);
  return `You picked ${selectedLabel}, which we estimate at ${selectedProbability}%. Our highest estimate is ${outcomeLabel(modelPick, match)}.`;
}

export function MatchExplorer({ matches }: MatchExplorerProps) {
  const visibleMatches = matches.slice(0, 4);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, MatchExplorerOutcome>>({});
  const [shareStatus, setShareStatus] = useState("");
  const activeMatch = visibleMatches[activeIndex];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CALLS_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const valid = Object.fromEntries(
            Object.entries(parsed).filter((entry): entry is [string, MatchExplorerOutcome] =>
              typeof entry[0] === "string" && OUTCOMES.includes(entry[1] as MatchExplorerOutcome)
            ),
          );
          setSelections(valid);
        }
      }
    } catch {
      // The interaction still works when storage is unavailable.
    }
  }, []);

  if (!activeMatch) {
    return (
      <div className="match-explorer-root match-explorer-empty">
        <p>No upcoming matches are available.</p>
      </div>
    );
  }

  const selection = selections[activeMatch.slug];
  const isRevealed = selection !== undefined;
  const modelPick = getModelPick(activeMatch);

  function selectOutcome(outcome: MatchExplorerOutcome) {
    setSelections((current) => {
      const next = { ...current, [activeMatch.slug]: outcome };
      try {
        window.localStorage.setItem(CALLS_KEY, JSON.stringify(next));
      } catch {
        // Saving is progressive enhancement; never block the call itself.
      }
      return next;
    });
    setShareStatus("");
  }

  function resetCall() {
    setSelections((current) => {
      const next = { ...current };
      delete next[activeMatch.slug];
      try {
        window.localStorage.setItem(CALLS_KEY, JSON.stringify(next));
      } catch {
        // Reset still applies for this visit when storage is unavailable.
      }
      return next;
    });
    setShareStatus("");
  }

  async function shareCall() {
    if (!selection) return;
    const label = outcomeLabel(selection, activeMatch);
    const url = `${window.location.origin}/match/${activeMatch.slug}/`;
    const text = `My pick: ${label} in ${activeMatch.home} vs ${activeMatch.away}. The Open Model estimates a ${toPercentage(activeMatch.probabilities[selection]).toFixed(1)}% chance.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${activeMatch.home} v ${activeMatch.away}`, text, url });
        setShareStatus("Shared.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShareStatus("Your pick was copied to the clipboard.");
      } else {
        setShareStatus("Open the full prediction to copy its link.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Sharing is unavailable in this browser.");
    }
  }

  return (
    <section className="match-explorer-root" aria-labelledby="match-explorer-title">
      <header className="match-explorer-header">
        <h2 id="match-explorer-title" className="match-explorer-title">
          What do you think will happen?
        </h2>
        <p className="match-explorer-intro">
          Choose a match, pick a winner or a draw, then reveal our estimated chances. No football knowledge is required.
        </p>
        <p className="match-explorer-saved">
          {Object.keys(selections).length > 0
            ? `${Object.keys(selections).length} pick${Object.keys(selections).length === 1 ? "" : "s"} saved on this device`
            : "Your picks stay on this device"}
        </p>
      </header>

      <nav className="match-explorer-switcher" aria-label="Choose a match">
        <ol className="match-explorer-match-list">
          {visibleMatches.map((match, index) => {
            const isActive = index === activeIndex;
            const hasSelection = selections[match.slug] !== undefined;

            return (
              <li key={match.slug} className="match-explorer-match-item">
                <button
                  type="button"
                  className={`match-explorer-match${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => {
                    setActiveIndex(index);
                    setShareStatus("");
                  }}
                >
                  <span className="match-explorer-match-league">{match.league}</span>
                  <span className="match-explorer-match-teams">
                    {match.home} <span aria-hidden="true">vs</span> {match.away}
                  </span>
                  <span className="match-explorer-match-status">
                    {hasSelection ? "Picked" : <Kickoff iso={match.date} style="time" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <article className={`match-explorer-stage${isRevealed ? " is-revealed" : ""}`}>
        <div className="match-explorer-fixture">
          <p className="match-explorer-meta">
            <span>{activeMatch.league}</span>
            <Kickoff iso={activeMatch.date} />
          </p>
          <div className="match-explorer-team-row">
            <p className="match-explorer-team match-explorer-team-home">
              <span className="match-explorer-team-side">Playing at home</span>
              {activeMatch.homeLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeMatch.homeLogo} width={48} height={48} alt="" />
              )}
              <strong>{activeMatch.home}</strong>
            </p>
            <span className="match-explorer-versus" aria-hidden="true">vs</span>
            <p className="match-explorer-team match-explorer-team-away">
              <span className="match-explorer-team-side">Playing away</span>
              {activeMatch.awayLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeMatch.awayLogo} width={48} height={48} alt="" />
              )}
              <strong>{activeMatch.away}</strong>
            </p>
          </div>
        </div>

        <fieldset className="match-explorer-pick">
          <legend className="match-explorer-prompt">Choose the result you think is most likely</legend>
          <div className="match-explorer-options">
            {OUTCOMES.map((outcome) => {
              const isSelected = selection === outcome;

              return (
                <button
                  key={outcome}
                  type="button"
                  className={`match-explorer-option match-explorer-option-${outcome}${isSelected ? " is-selected" : ""}`}
                  aria-pressed={isSelected}
                  disabled={isRevealed}
                  onClick={() => selectOutcome(outcome)}
                >
                  <span className="match-explorer-option-key">
                    {outcome === "home" ? "Home team wins" : outcome === "away" ? "Away team wins" : "Neither team wins"}
                  </span>
                  <strong>{outcomeLabel(outcome, activeMatch)}</strong>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="match-explorer-reveal">
          {isRevealed ? (
            <>
              <p className="match-explorer-reveal-label">Our estimated chances</p>
              <div className="match-explorer-probabilities">
                {OUTCOMES.map((outcome) => (
                  <div
                    key={outcome}
                    className={`match-explorer-probability match-explorer-probability-${outcome}${outcome === modelPick ? " is-model-pick" : ""}`}
                  >
                    <span>{outcomeLabel(outcome, activeMatch)}</span>
                    <strong>{toPercentage(activeMatch.probabilities[outcome]).toFixed(1)}%</strong>
                    <span
                      className="match-explorer-probability-fill"
                      style={{ "--match-explorer-value": `${toPercentage(activeMatch.probabilities[outcome])}%` } as React.CSSProperties}
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
              <p className="match-explorer-feedback" aria-live="polite">
                {getFeedback(selection, activeMatch)}
              </p>
              <p className="match-explorer-reading">
                These three percentages add to 100%. They show what may happen, not what will happen.
              </p>
              {activeMatch.explanation && (
                <p className="match-explorer-explanation"><strong>Why?</strong> {activeMatch.explanation}</p>
              )}
              <div className="match-explorer-actions">
                <Link className="match-explorer-link" href={`/match/${activeMatch.slug}/`}>
                  See the full prediction
                </Link>
                <div className="match-explorer-secondary-actions">
                  <button type="button" className="match-explorer-reset" onClick={resetCall}>Change my pick</button>
                  <button type="button" className="match-explorer-share" onClick={shareCall}>Share my pick</button>
                </div>
              </div>
              <p className="match-explorer-share-status" aria-live="polite">{shareStatus}</p>
            </>
          ) : (
            <p className="match-explorer-locked">
              Choose one result to reveal our estimates.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
