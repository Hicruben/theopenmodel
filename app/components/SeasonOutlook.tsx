import Link from "next/link";
import type { SeasonOdds } from "@/lib/season";
import type { SeasonMovement, OddsMove } from "@/lib/movement";
import { pct } from "@/lib/ui";

// The question a supporter actually has is not "what is this club's rating" but "how does
// our season end, and is it going better or worse than last week". The projection alone is
// read once; the projection next to what it was seven days ago is worth coming back to.

const pp = (d: number) => `${d > 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)}pp`;

function Move({ move, goodWhenUp }: { move: OddsMove; goodWhenUp: boolean }) {
  // Below a tenth of a point the change is simulation noise, not news.
  if (Math.abs(move.delta) < 0.001) {
    return <span className="outlook-flat">no change</span>;
  }
  const good = goodWhenUp ? move.delta > 0 : move.delta < 0;
  return (
    <span className={good ? "outlook-up" : "outlook-down"}>
      {move.delta > 0 ? "▲" : "▼"} {pp(move.delta)}
    </span>
  );
}

function Cell({
  label, value, move, goodWhenUp, emphasis,
}: { label: string; value: number; move?: OddsMove; goodWhenUp: boolean; emphasis?: boolean }) {
  return (
    <div className={`outlook-cell${emphasis ? " lead" : ""}`}>
      <div className="outlook-label">{label}</div>
      <div className="outlook-value tnum">{pct(value)}</div>
      {move && <div className="outlook-move tnum"><Move move={move} goodWhenUp={goodWhenUp} /></div>}
    </div>
  );
}

export function SeasonOutlook({
  club, odds, movement, leagueSlug, leagueName,
}: {
  club: string;
  odds: SeasonOdds;
  movement: SeasonMovement | null;
  leagueSlug: string;
  leagueName: string;
}) {
  // A 20-team league has no top-four race worth showing to a club with no chance of it,
  // and no relegation story for a title contender. Show what is live for this club.
  const showTitle = odds.title >= 0.005 || odds.top4 >= 0.5;
  const showReleg = odds.releg >= 0.005 || odds.top4 < 0.25;

  // Before a league kicks off nothing has moved yet, and a column of "no change" reads as
  // a broken feature rather than an honest one. Drop the movement entirely until there is
  // some, and say why.
  const moved = movement != null && [movement.title, movement.top4, movement.releg, movement.xPts]
    .some((m) => Math.abs(m.delta) >= 0.001);
  const mv = moved ? movement : null;

  return (
    <section className="outlook panel" aria-labelledby="outlook-h">
      <div className="outlook-head">
        <h2 id="outlook-h">How {club}&apos;s season ends</h2>
        <span className="outlook-sub">
          From 5,000 simulated seasons, re-run every day
          {mv && <> · change over the last {mv.daysApart} days</>}
        </span>
      </div>

      <div className="outlook-grid">
        {showTitle && (
          <Cell label="Win the league" value={odds.title} move={mv?.title} goodWhenUp emphasis={odds.title >= 0.15} />
        )}
        <Cell label="Finish top four" value={odds.top4} move={mv?.top4} goodWhenUp />
        {showReleg && (
          <Cell label="Get relegated" value={odds.releg} move={mv?.releg} goodWhenUp={false} emphasis={odds.releg >= 0.25} />
        )}
        <div className="outlook-cell">
          <div className="outlook-label">Expected points</div>
          <div className="outlook-value tnum">{odds.avgPts.toFixed(0)}</div>
          {odds.ptsLo != null && odds.ptsHi != null && (
            <div className="outlook-move tnum">
              <span className="outlook-flat">usually {odds.ptsLo}–{odds.ptsHi}</span>
            </div>
          )}
        </div>
      </div>

      {mv?.headline && (
        <p className="outlook-story">
          {Math.abs(mv.headline.move.delta) < 0.001 ? (
            <>Nothing meaningful has moved since {mv.comparedWith}.</>
          ) : (
            <>
              <b>This week:</b> {club}&apos;s {mv.headline.label} moved from{" "}
              {pct(mv.headline.move.then)} to <b>{pct(mv.headline.move.now)}</b>
              {mv.elo.delta !== 0 && (
                <> — the model&apos;s rating of them {mv.elo.delta > 0 ? "rose" : "fell"}{" "}
                {Math.abs(mv.elo.delta).toFixed(0)} points over the same stretch</>
              )}
              .
            </>
          )}
        </p>
      )}

      {!moved && (
        <p className="outlook-story">
          These numbers start moving once the league is under way — each result feeds back into
          the club&apos;s rating, and the season is re-simulated the following morning.
        </p>
      )}

      <p className="outlook-foot">
        Probabilities, not predictions: a 20% relegation risk means one season in five, not
        safety. Every match this forecast rests on is{" "}
        <Link href="/record/">published before kickoff and scored afterwards</Link>, and the{" "}
        <Link href={`/league/${leagueSlug}/table/`}>full {leagueName} projection</Link> shows
        where everyone else lands.
      </p>
    </section>
  );
}
