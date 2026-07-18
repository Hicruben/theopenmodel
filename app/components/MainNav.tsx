"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/matches/", label: "Predictions" },
  { href: "/news/", label: "News" },
  { href: "/leagues/", label: "Leagues" },
  { href: "/tools/", label: "Tools" },
  { href: "/guide/", label: "How it works", compact: true },
  { href: "/record/", label: "Past results", compact: true },
];

export function MainNav() {
  const pathname = usePathname();
  const currentPath = pathname.replace(/\/$/, "");

  return (
    <nav className="main" aria-label="Primary navigation">
      {LINKS.map((link) => {
        const targetPath = link.href.replace(/\/$/, "");
        const active = targetPath === ""
          ? currentPath === ""
          : currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${link.compact ? "hide-sm " : ""}${active ? "is-active" : ""}`.trim()}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
      <Link href="/#live" className="cta">Try a prediction <span aria-hidden>↗</span></Link>
    </nav>
  );
}
