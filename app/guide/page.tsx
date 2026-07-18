import Link from "next/link";

export const metadata = {
  title: "Football predictions explained for beginners",
  description: "A simple guide to home wins, draws, away wins, percentages, team strength and season chances. No football or statistics knowledge needed.",
};

export default function Guide() {
  return (
    <main className="wrap prose beginner-guide">
      <p className="crumbs"><Link href="/">Home</Link> › How predictions work</p>
      <h1 className="pagetitle">Football predictions, explained from the beginning</h1>
      <p className="pagedesc">
        You do not need to know football or statistics to use this site. Start with the three
        possible match results, then read each percentage as an estimate rather than a promise.
      </p>

      <h2>1. What can happen in a football match?</h2>
      <p>
        One team plays at its own stadium: the <b>home team</b>. The visiting team is the
        <b> away team</b>. At the end of a normal league match, there are three possible results:
        the home team wins, neither team wins so the match is a <b>draw</b>, or the away team wins.
      </p>

      <div className="beginner-example" aria-label="Example football match probabilities">
        <span><small>Arsenal wins</small><strong>58%</strong></span>
        <span><small>Draw</small><strong>24%</strong></span>
        <span><small>Chelsea wins</small><strong>18%</strong></span>
      </div>

      <h2>2. What do the percentages mean?</h2>
      <p>
        The three numbers always add to 100%. In the example above, 58% means Arsenal would be
        expected to win about 58 times if 100 very similar matches could be played. It does not mean
        Arsenal will definitely win this match. The other 42% covers a draw or a Chelsea win.
      </p>

      <h2>3. How do we compare the teams?</h2>
      <p>
        We keep a running team-strength score based on results. Beating a strong team helps more than
        beating a weak one, and recent results keep the score current. This type of score is called an
        <b> Elo rating</b>. We also allow for the small advantage teams usually get from playing at home.
      </p>

      <h2>4. What does “average simulated goals” mean?</h2>
      <p>
        The model turns the difference in team strength into an average number of goals for each side.
        It then tests many possible scorelines, such as 0–0, 1–0 or 2–1. “1.7 average simulated goals”
        is an average across those imagined replays, not an exact score prediction. It is also different
        from the shot-by-shot expected-goals statistic shown during a live match.
      </p>

      <h2>5. How do season chances work?</h2>
      <p>
        To estimate a club&apos;s chance of winning its league, we replay the remaining season thousands
        of times. If a club finishes first in about 320 of 1,000 simulated seasons, its title chance is
        about 32%. Transfers, injuries and unexpected changes can still move the real season in a
        direction the current numbers do not expect.
      </p>

      <h2>6. How are past predictions checked?</h2>
      <p>
        We publish a prediction before the match, compare its most likely result with the final score,
        and keep both correct and incorrect results visible. The project&apos;s separate international model
        had 70 correct top picks from 102 completed World Cup matches through 15 July 2026. That history
        is evidence about past performance, not a guarantee for a future match.{" "}
        <Link href="/record/">See the past results</Link>.
      </p>

      <h2>7. What can the prediction miss?</h2>
      <p>
        Football contains luck, red cards, injuries, tactical changes and human decisions. A model can
        organise what is known before kickoff, but it cannot remove uncertainty. Treat a higher number
        as “more likely,” never as “certain.”
      </p>

      <div className="beginner-guide-actions">
        <Link href="/matches/" className="signal-button">See upcoming predictions <span aria-hidden>→</span></Link>
        <Link href="/methodology/" className="text-action">Read the technical methodology <span aria-hidden>↗</span></Link>
      </div>
    </main>
  );
}
