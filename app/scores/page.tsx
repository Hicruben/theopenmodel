import Link from "next/link";
import { portalFixtures, portalSnapshot } from "@/lib/portal";
import { LiveScores } from "../components/LiveScores";

export const metadata = {
  title: "Live football scores & results",
  description: "Live football scores, in-play matches and final results, updating automatically. Every match links to the model's pre-match prediction.",
};

export default function ScoresPage() {
  const snap = portalSnapshot();
  const initial = snap.provider === "api-football" ? portalFixtures() : [];
  const initialAsOf = snap.provider === "api-football" ? snap.asOf : null;

  return (
    <main className="wrap">
      <p className="crumbs"><Link href="/">Home</Link> › Scores</p>
      <h1 className="pagetitle" style={{ marginTop: 6 }}>Live scores &amp; results</h1>
      <p className="pagedesc">
        In-play matches and final results across the competitions in our live feed, updating on their
        own every 30 seconds. Each match links to the model&apos;s pre-match forecast — see the{" "}
        <Link href="/matches/">match centre</Link> for upcoming predictions and the{" "}
        <Link href="/record/">record</Link> for how the calls hold up.
      </p>
      <LiveScores initial={initial} initialAsOf={initialAsOf} />
    </main>
  );
}
