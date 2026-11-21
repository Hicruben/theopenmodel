import Link from "next/link";
import { upcomingFixtures } from "@/lib/fixtures";
import { matchProb, marketProbs } from "@/lib/model";
import { ParlayBuilder, type ParlayFixture } from "../../components/ParlayBuilder";

export const metadata = {
  title: "Parlay & accumulator reality check — true model odds",
  description:
    "Combine upcoming football matches from Europe's top five leagues to calculate true combined win probability, fair accumulator odds, and expected value.",
  alternates: { canonical: "/tools/parlay/" },
};

export default function ParlayToolPage() {
  const fixtures: ParlayFixture[] = upcomingFixtures(36).map((f) => {
    const p = matchProb(f.home.elo, f.away.elo);
    const mk = marketProbs(f.home.elo, f.away.elo);
    return {
      id: f.id,
      slug: f.slug,
      date: f.date,
      leagueSlug: f.league.slug,
      leagueName: f.league.name,
      home: f.home.club,
      away: f.away.club,
      probs: {
        home: p.home,
        draw: p.draw,
        away: p.away,
        over25: mk.over25,
        btts: mk.btts,
      },
    };
  });

  return (
    <main className="scenario-page">
      <div className="wrap">
        <p className="crumbs"><Link href="/tools/">Tools</Link> › Parlay reality check</p>
        <div className="scenario-page-intro">
          <p className="tool-kicker">Accumulator math, without the hype</p>
          <h1>Combine fixtures.<br />Check the true odds.</h1>
          <p>
            Pick outcomes from upcoming matches across Europe&apos;s top five leagues.
            The calculator multiplies our Elo → Dixon-Coles probabilities to show the real hit rate,
            break-even fair parlay odds, and whether a bookmaker&apos;s price has mathematical value.
          </p>
        </div>
      </div>

      <section className="scenario-stage">
        <div className="wrap">
          <ParlayBuilder fixtures={fixtures} />
        </div>
      </section>

      <div className="scenario-foot wrap mono">
        <span>Assumes independent match outcomes</span>
        <span>Useful estimates, never guarantees</span>
        <Link href="/guide/">How to read the percentages ↗</Link>
      </div>
    </main>
  );
}
