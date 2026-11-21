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
    <main className="wrap" style={{ maxWidth: 1120 }}>
      <p className="crumbs">
        <Link href="/">Home</Link> › <Link href="/tools/">Tools</Link> › Parlay reality check
      </p>
      <section style={{ marginBottom: 22 }}>
        <span className="eyebrow plain">Accumulator calculator</span>
        <h1 style={{ margin: "6px 0 8px" }}>Parlay &amp; accumulator reality check</h1>
        <p style={{ fontSize: 15, color: "var(--ink-soft)", maxWidth: 720, margin: 0 }}>
          Pick outcomes from upcoming matches to see the true combined probability from our Elo → Dixon-Coles model, the break-even fair odds, and whether a bookmaker&apos;s parlay price offers positive mathematical value.
        </p>
      </section>

      <ParlayBuilder fixtures={fixtures} />
    </main>
  );
}
