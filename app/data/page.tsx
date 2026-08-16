import Link from "next/link";

export const metadata = {
  title: "Download prediction data as CSV or JSON (CC BY 4.0)",
  description:
    "Free football prediction datasets: season forecasts, match-result probabilities, team-strength ratings and the model's backtest — CSV/JSON, openly licensed under CC BY 4.0.",
};

const SITE = "https://theopenmodel.com";

const FILES = [
  { path: "/data/predictions.csv", desc: "The ledger: every prediction published before kickoff, with the result once played", fmt: "CSV" },
  { path: "/data/predictions.json", desc: "Same as above, JSON with metadata", fmt: "JSON" },
  { path: "/data/season-forecast.csv", desc: "All 96 clubs: team strength, expected points and season chances", fmt: "CSV" },
  { path: "/data/season-forecast.json", desc: "Same as above, JSON with metadata", fmt: "JSON" },
  { path: "/data/fixtures-2026-27.csv", desc: "All 1,752 matches: home win, draw, away win and average simulated goals", fmt: "CSV" },
  { path: "/data/fixtures-2026-27.json", desc: "Same as above, JSON with metadata", fmt: "JSON" },
  { path: "/data/elo-ratings.csv", desc: "Current team-strength score (Elo) for every covered club", fmt: "CSV" },
  { path: "/data/wc-backtest.json", desc: "World Cup model backtest: 913 internationals, walk-forward, with calibration bins", fmt: "JSON" },
];

const DATASETS_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Dataset",
      name: "The Open Model — 2026-27 season forecast",
      description:
        "Title, top-4 and relegation probabilities plus expected points for all 96 clubs in the Premier League, La Liga, Serie A, Bundesliga and Ligue 1, from 5,000 Monte Carlo season simulations. Updated with each site build.",
      url: `${SITE}/data/`,
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: "The Open Model", url: SITE },
      distribution: [
        { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}/data/season-forecast.csv` },
        { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/season-forecast.json` },
      ],
    },
    {
      "@type": "Dataset",
      name: "The Open Model — 2026-27 match probabilities",
      description:
        "Pre-match home/draw/away probabilities and simulated goal averages for all 1,752 fixtures of the 2026-27 top-five-league season, from Elo ratings and a Dixon-Coles bivariate Poisson model.",
      url: `${SITE}/data/`,
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: "The Open Model", url: SITE },
      distribution: [
        { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}/data/fixtures-2026-27.csv` },
        { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/fixtures-2026-27.json` },
      ],
    },
    {
      "@type": "Dataset",
      name: "The Open Model — pre-kickoff prediction ledger",
      description:
        "Every match prediction published before kickoff across the Premier League, La Liga, Serie A, Bundesliga and Ligue 1, with the probabilities, the date the prediction was committed to a public git repository, and the result once the match was played. Misses are retained.",
      url: `${SITE}/record/`,
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: "The Open Model", url: SITE },
      distribution: [
        { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}/data/predictions.csv` },
        { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/predictions.json` },
      ],
    },
    {
      "@type": "Dataset",
      name: "World Cup 2026 model — walk-forward backtest",
      description:
        "Out-of-sample backtest of the open-source World Cup 2026 model on 913 real internationals: RPS, Brier, log-loss, accuracy and 10-bin calibration data.",
      url: `${SITE}/record/`,
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: "The Open Model", url: SITE },
      distribution: [
        { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/wc-backtest.json` },
      ],
    },
  ],
};

export default function DataPage() {
  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(DATASETS_JSONLD) }} />
      <p className="crumbs"><Link href="/">Home</Link> › Data</p>
      <h1 className="pagetitle">Download the prediction data</h1>
      <p className="pagedesc">
        The current numbers behind the site, free to download and reuse. The files update with each
        site build and keep stable URLs.
      </p>
      <div className="panel tight" style={{ marginTop: 22 }}>
        <table className="data">
          <thead><tr><th>File</th><th>Contents</th><th className="r">Format</th></tr></thead>
          <tbody>
            {FILES.map((f) => (
              <tr key={f.path}>
                <td className="num"><a href={f.path} download>{f.path.split("/").pop()}</a></td>
                <td style={{ color: "var(--ink-soft)", fontSize: 13 }}>{f.desc}</td>
                <td className="num r" style={{ color: "var(--muted)" }}>{f.fmt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>These files will stay free, and these URLs will not move</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--ink-soft)" }}>
          Nothing on this page will ever move behind a paywall, a sign-up or an API key, and the file
          paths above are permanent. If a column is ever added it will be added at the end; existing
          columns will not be renamed or reordered. If a file must ever be retired it will keep
          returning its final contents rather than disappearing.
        </p>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>
          This matters because open football data has been unreliable: sources are withdrawn when the
          licensing behind them changes, and the scripts and papers depending on them break. Every
          number here is produced by this project&apos;s own model from public inputs, so there is no
          third party who can switch it off. Build on it.
        </p>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>predictions.csv — columns</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--ink-soft)" }}>
          One row per match the model has published a prediction for. Rows appear before kickoff with
          the result columns empty, and are filled in after full time — including the ones the model
          got wrong.
        </p>
        <table className="data">
          <thead><tr><th>Column</th><th>Meaning</th></tr></thead>
          <tbody>
            {[
              ["kickoff", "Kickoff time, ISO 8601 UTC"],
              ["league", "League slug, e.g. premier-league"],
              ["home, away", "Club names"],
              ["pHome, pDraw, pAway", "Model probabilities; sum to 1"],
              ["modelPick", "The model's most likely outcome: home, draw or away"],
              ["lockedOn", "Date the prediction was committed to the public repository"],
              ["homeGoals, awayGoals", "Final score; empty until played"],
              ["result", "Actual outcome: home, draw or away; empty until played"],
              ["correct", "Whether modelPick matched result; empty until played"],
            ].map(([col, meaning]) => (
              <tr key={col}>
                <td className="num" style={{ whiteSpace: "nowrap" }}>{col}</td>
                <td style={{ color: "var(--ink-soft)", fontSize: 13 }}>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>
          <b>lockedOn is checkable.</b> Each dated file under <code>data/snapshots/</code> in the{" "}
          <a href="https://github.com/Hicruben/theopenmodel">public repository</a> was committed on
          that date, so the git history is independent evidence that a prediction existed before its
          match — not a claim you have to take on trust.
        </p>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>License: CC BY 4.0 — free to use, with attribution</h2>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>
          All datasets on this page are licensed under{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0</a>.
          Use them in articles, research, apps or models — commercially too. The only condition:
          credit <b>The Open Model</b> and link to <b>theopenmodel.com</b>. Suggested citation:{" "}
          <i>&quot;Data: The Open Model (theopenmodel.com), CC BY 4.0.&quot;</i>
        </p>
      </div>

      <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 18 }}>
        Dated forecast history lives on the <Link href="/snapshots/">saved-forecasts page</Link>, and
        the model&apos;s accuracy record on the <Link href="/record/">past-results page</Link>.{" "}
        <Link href="/guide/">How to read the numbers</Link> ·{" "}
        <Link href="/methodology/">technical methodology</Link>. Team-strength source:{" "}
        <a href="http://clubelo.com">ClubElo</a>. Scheduled matches, squads and player images:
        API-Football. Live scores and events: Sportmonks when active.
      </p>
    </main>
  );
}
