"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// The nav is the clearest statement of what this site is for, so it leads with the
// question only we answer — how a club's season ends — rather than with live scores and
// news, which FlashForm-style apps do far better and which invited exactly the comparison
// we lose. Scores and news still exist; they are no longer what we claim to be.
const LINKS = [
  { href: "/", label: "Today" },
  { href: "/leagues/", label: "Season outlook" },
  { href: "/matches/", label: "Predictions" },
  { href: "/record/", label: "Track record" },
  { href: "/data/", label: "Free data" },
  { href: "/tools/", label: "Tools" },
  { href: "/guide/", label: "How it works" },
];

// On desktop these lower-priority links collapse first; on mobile all show in the drawer.
const COMPACT = new Set(["/tools/", "/guide/", "/data/"]);

export function MainNav({ snapshotHref, snapshotLabel }: { snapshotHref?: string; snapshotLabel?: string } = {}) {
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
        {snapshotHref && snapshotLabel && (
          <Link href={snapshotHref} className="drawer-only nav-snapshot">
            Forecast saved <time>{snapshotLabel}</time>
          </Link>
        )}
      </nav>
    </>
  );
}
