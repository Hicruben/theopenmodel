import Link from "next/link";
import { LEAGUES, leagueClubs } from "@/lib/data";
import { LeagueScenarioLab } from "../../components/LeagueScenarioLab";

export const metadata = {
  title: "What-if season simulator",
  description: "Make a team stronger or weaker, then see how its estimated chance of winning the league changes.",
};

export default function ScenarioTool() {
  const leagues = LEAGUES.map((league) => ({
    slug: league.slug,
    name: league.name,
    clubs: leagueClubs(league).map(({ club, slug, elo, logo }) => ({ club, slug, elo, logo })),
  }));

  return (
    <main className="scenario-page">
      <div className="wrap">
        <p className="crumbs"><Link href="/tools/">Tools</Link> › What-if season simulator</p>
        <div className="scenario-page-intro">
          <p className="tool-kicker">Try a different future</p>
          <h1>Make a team stronger.<br />See the season change.</h1>
          <p>
            Move a team-strength slider to represent a major signing, an injury problem or better form.
            The simulator then replays the season and updates each club&apos;s chance of finishing first.
          </p>
        </div>
      </div>

      <section className="scenario-stage">
        <div className="wrap">
          <LeagueScenarioLab leagues={leagues} />
        </div>
      </section>

      <div className="scenario-foot wrap mono">
        <span>These are imagined scenarios</span>
        <span>They are not predictions about a real transfer or injury</span>
        <Link href="/guide/">How to read the percentages ↗</Link>
      </div>
    </main>
  );
}
