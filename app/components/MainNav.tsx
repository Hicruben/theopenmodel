"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/scores/", label: "Scores" },
  { href: "/matches/", label: "Predictions" },
  { href: "/news/", label: "News" },
  { href: "/leagues/", label: "Leagues" },
  { href: "/tools/", label: "Tools" },
  { href: "/guide/", label: "How it works" },
  { href: "/record/", label: "Past results" },
];

// On desktop these lower-priority links collapse first; on mobile all show in the drawer.
const COMPACT = new Set(["/tools/", "/guide/", "/record/"]);

export function MainNav() {
  const pathname = usePathname();
  const currentPath = pathname.replace(/\/$/, "");
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const isActive = (href: string) => {
    const t = href.replace(/\/$/, "");
    return t === "" ? currentPath === "" : currentPath === t || currentPath.startsWith(`${t}/`);
  };

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="primary-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`nav-toggle-bars${open ? " is-open" : ""}`} aria-hidden><i /><i /><i /></span>
      </button>

      {open && <button type="button" className="nav-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}

      <nav id="primary-nav" className={`main${open ? " is-open" : ""}`} aria-label="Primary navigation">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${COMPACT.has(link.href) ? "hide-sm " : ""}${isActive(link.href) ? "is-active" : ""}`.trim()}
            aria-current={isActive(link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
        <Link href="/#live" className="cta">Try a prediction <span aria-hidden>↗</span></Link>
      </nav>
    </>
  );
}
