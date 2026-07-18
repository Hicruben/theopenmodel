import Link from "next/link";

export const metadata = {
  title: "About — who runs The Open Model and why",
  description: "An independent football prediction project that explains its percentages and keeps correct and incorrect past results visible.",
};

export default function About() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "The Open Model",
    url: "https://theopenmodel.com",
    description: "Independent football prediction project with a public, checkable World Cup track record.",
    foundingDate: "2026",
    sameAs: [
      "https://github.com/Hicruben/world-cup-2026-prediction-model",
      "https://t.me/world26ai",
      "https://cup26matches.com",
    ],
  };

  return (
    <main className="wrap prose">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="crumbs"><Link href="/">Home</Link> › About</p>
      <h1 className="pagetitle" style={{ fontSize: "clamp(26px, 3.6vw, 40px)" }}>About The Open Model</h1>
      <p className="pagedesc" style={{ fontSize: 15.5 }}>
        An independent football prediction project that explains what each number means and keeps
        both correct and incorrect past results visible.
      </p>

      <h2>Where this started</h2>
      <p>
        The Open Model began as an <a href="https://github.com/Hicruben/world-cup-2026-prediction-model">open-source
        World Cup 2026 prediction model</a>. It compares team strength, estimates possible scores
        and turns those scores into a chance of each match result. Through 15 July 2026, its top pick
        was correct in <b>70 of 102 completed matches</b>, and it identified all four semi-finalists
        before the quarter-finals. The tournament record is still being updated at{" "}
        <a href="https://cup26matches.com">cup26matches.com</a>.
      </p>
      <p>
        We then adapted the same type of score-probability framework for club football, using European
        club-strength ratings. This site covers Europe&apos;s top five leagues. The club model starts
        its own results history when the 2026–27 league season begins in August.
      </p>

      <h2>Who runs it</h2>
      <p>
        The Open Model is an independent project run by one developer. AI tools may help draft
        analysis, but match percentages come from the statistical model rather than a language model.
        Important factual claims are checked against current sources before publication. There is no
        bookmaker sponsor and no promise of guaranteed wins.
      </p>

      <h2>The rules we can&apos;t break</h2>
      <p>
        <b>Predictions are published before kickoff.</b> The public World Cup repository and archive
        provide a checkable publication trail for the international model.
      </p>
      <p>
        <b>Incorrect results stay visible.</b> A result given a 70% chance still does not happen about
        three times in ten. When a top pick is wrong, it remains on the{" "}
        <Link href="/record/">past-results page</Link>.
      </p>
      <p>
        <b>The method is explained.</b> The <Link href="/guide/">beginner&apos;s guide</Link> explains
        the percentages, while the <Link href="/methodology/">technical methodology</Link> documents
        the calculations. Current club outputs can be inspected in the{" "}
        <Link href="/data/">data downloads</Link>.
      </p>
      <p>
        <b>Probabilities, not tips.</b> We estimate what may happen. We do not sell picks or promise
        wins, and the site should not be treated as betting advice.
      </p>

      <h2>Data &amp; sources</h2>
      <p>
        Team-strength ratings come from <a href="http://clubelo.com">ClubElo</a>. The current scheduled
        matches, squads and player images come from API-Football. Live scores and match events will
        come from Sportmonks when that feed is active. News headlines are attributed and linked to
        the original publisher. Check the relevant download or repository for its specific reuse terms.
      </p>

      <h2>Contact</h2>
      <p>
        The fastest routes: open an issue on{" "}
        <a href="https://github.com/Hicruben/world-cup-2026-prediction-model">GitHub</a> or message
        the <a href="https://t.me/world26ai">Telegram channel</a>. Corrections are especially
        welcome — the whole point of this project is being checkable.
      </p>
    </main>
  );
}
