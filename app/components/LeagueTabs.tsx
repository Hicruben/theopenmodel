import Link from "next/link";
import { LEAGUES, flagUrl } from "@/lib/data";

export function LeagueTabs({ current }: { current?: string }) {
  return (
    <nav className="tabs" aria-label="Leagues">
      {LEAGUES.map((l) => (
        <Link key={l.slug} href={`/league/${l.slug}/`} className={l.slug === current ? "on" : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="flag" src={flagUrl(l.flagCode, 20)} width={16} height={12} alt="" />
          <span className="full">{l.name}</span>
          <span className="short">{l.name.split(" ")[0]}</span>
        </Link>
      ))}
    </nav>
  );
}
