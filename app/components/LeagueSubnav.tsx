import Link from "next/link";

// Sub-navigation shared across a league's hub pages (forecast, table, scorers, fixtures).
// Mirrors how mainstream football portals group a competition's sections.
const TABS = [
  { key: "forecast", label: "Forecast", href: "" },
  { key: "table", label: "Table", href: "table/" },
  { key: "scorers", label: "Top scorers", href: "scorers/" },
  { key: "fixtures", label: "Fixtures", href: "fixtures/" },
] as const;

export type LeagueTab = (typeof TABS)[number]["key"];

export function LeagueSubnav({ slug, current }: { slug: string; current: LeagueTab }) {
  return (
    <nav className="subtabs" aria-label="League sections">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/league/${slug}/${t.href}`}
          className={t.key === current ? "on" : undefined}
          aria-current={t.key === current ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
