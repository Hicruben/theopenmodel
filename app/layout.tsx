import type { Metadata } from "next";
import Link from "next/link";
import { Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { ScrollFx } from "./components/ScrollFx";
import { MainNav } from "./components/MainNav";
import { snapshotDates } from "@/lib/snapshots";
import "./globals.css";

const plex = IBM_Plex_Mono({ weight: ["400", "600"], subsets: ["latin"], variable: "--font-plex", display: "swap" });
const barlow = Barlow_Condensed({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-barlow", display: "swap" });

const SITE = "https://theopenmodel.com";
const UMAMI_WEBSITE_ID = "c4e2f8fe-d2eb-40a6-9566-da53ca89f14b";
const LATEST_SNAPSHOT = snapshotDates()[0];
const SNAPSHOT_LABEL = LATEST_SNAPSHOT
  ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" })
      .format(new Date(`${LATEST_SNAPSHOT}T00:00:00Z`))
  : null;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "The Open Model: football news, matches & clear predictions",
    template: "%s | The Open Model",
  },
  description:
    "Football news, upcoming matches and easy-to-read result probabilities. See what each percentage means and check past predictions, including the wrong ones.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plex.variable} ${barlow.variable}`}>
      <body>
        {process.env.NODE_ENV === "production" && (
          <script defer src="/stats.js" data-website-id={UMAMI_WEBSITE_ID} />
        )}
        <ScrollFx />
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="site">
          <div className="wrap inner">
            <Link href="/" className="brand">
              <span className="mark" aria-hidden><i /><i /></span>
              <span className="word">The Open Model</span>
            </Link>
            <MainNav
              snapshotHref={LATEST_SNAPSHOT ? `/snapshot/${LATEST_SNAPSHOT}/` : undefined}
              snapshotLabel={SNAPSHOT_LABEL ?? undefined}
            />
            {LATEST_SNAPSHOT && SNAPSHOT_LABEL && (
              <Link className="header-model-status" href={`/snapshot/${LATEST_SNAPSHOT}/`}>
                <span>Forecast saved</span><time dateTime={LATEST_SNAPSHOT}>{SNAPSHOT_LABEL}</time>
              </Link>
            )}
          </div>
        </header>
        <div id="main-content" tabIndex={-1}>{children}</div>
        <footer className="site">
          <div className="wrap cols">
            <div>
              <Link href="/" className="footer-brand">The Open Model<span>.</span></Link>
              <p style={{ margin: "0 0 10px", maxWidth: 430 }}>
                Predictions are published before kickoff and checked after full time. Correct and
                incorrect results both remain visible.
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
                Football statistical forecasts only; not betting or financial advice. Data sources and update times are shown where relevant.
              </p>
            </div>
            <div>
              <h4>Explore</h4>
              <ul>
                <li><Link href="/">Today&apos;s football</Link></li>
                <li><Link href="/matches/">Match predictions</Link></li>
                <li><Link href="/leagues/">Leagues</Link></li>
                <li><Link href="/news/">Football news</Link></li>
                <li><Link href="/tools/">Football tools</Link></li>
                <li><Link href="/tools/scenario/">What-if season simulator</Link></li>
                <li><Link href="/best-bets/">Most confident predictions</Link></li>
                <li><Link href="/movers/">Teams getting stronger or weaker</Link></li>
                <li><Link href="/snapshots/">Saved daily forecasts</Link></li>
                <li><Link href="/data/">Download data (CSV/JSON)</Link></li>
                <li><Link href="/guide/">How predictions work</Link></li>
                <li><Link href="/record/">Past predictions and results</Link></li>
                <li><Link href="/methodology/">Technical methodology</Link></li>
                <li><Link href="/about/">About</Link></li>
                <li><Link href="/privacy/">Privacy &amp; analytics</Link></li>
              </ul>
            </div>
            <div>
              <h4>Follow &amp; inspect</h4>
              <ul>
                <li><a href="https://github.com/Hicruben/world-cup-2026-prediction-model">GitHub (open source)</a></li>
                <li><a href="https://t.me/world26ai">Telegram</a></li>
                <li><Link href="/world-cup-2026/">World Cup 2026 archive</Link></li>
              </ul>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
