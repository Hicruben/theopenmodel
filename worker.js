// Cloudflare Worker for theopenmodel.com.
//
// Static pages are served automatically from ./out via the ASSETS binding
// (configured in wrangler.jsonc). This Worker only exists to reproduce the two
// dynamic routes the old nginx origin proxied to the self-hosted Umami analytics
// instance, so first-party analytics keeps working after the server move:
//
//   /stats.js  -> Umami tracker script (adblock-resistant first-party alias)
//   /api/send  -> Umami event collection endpoint
//
// Umami lives at cup26matches.com:8443 (Cloudflare-proxied, valid cert). We proxy
// by hostname rather than raw IP so TLS/SNI matches the origin certificate.

const UMAMI_ORIGIN = "https://cup26matches.com:8443";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Canonicalize www -> apex (301); the site's canonical host is the bare domain.
    if (url.hostname === "www.theopenmodel.com") {
      url.hostname = "theopenmodel.com";
      return Response.redirect(url.toString(), 301);
    }

    // /best-bets/ was indexed and linked before it was renamed. The URL itself read as a
    // betting-tips page on a site that publishes no tips and claims no edge over
    // bookmakers, which put us in the one search neighbourhood we can never win and drew
    // readers who bounce. Redirected rather than dropped, so the little authority it has
    // moves to the honest name.
    if (url.pathname === "/best-bets" || url.pathname === "/best-bets/") {
      return Response.redirect(`${url.origin}/clearest-calls/`, 301);
    }

    if (url.pathname === "/stats.js") {
      // The old nginx aliased /stats.js to the real Umami script at /script.js.
      return proxyUmami(request, `${UMAMI_ORIGIN}/script.js`);
    }
    if (url.pathname === "/api/send") {
      return proxyUmami(request, `${UMAMI_ORIGIN}/api/send${url.search}`);
    }

    // Google Search Console file verification must resolve at its exact .html
    // path with 200; html_handling would otherwise 307 it to the extensionless
    // URL, which can fail Google's fetch. Serve the token directly.
    if (url.pathname === "/googlee6ec037890b1d70e.html") {
      return new Response("google-site-verification: googlee6ec037890b1d70e.html", {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // Everything else is a static asset (html_handling resolves clean URLs;
    // misses fall through to out/404.html via not_found_handling).
    return env.ASSETS.fetch(request);
  },
};

async function proxyUmami(request, target) {
  const headers = new Headers(request.headers);
  // Umami attributes sessions/geo by client IP; preserve the real visitor IP.
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  // Drop the inbound Host so fetch sets it to cup26matches.com (cert match).
  headers.delete("host");

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const upstream = await fetch(target, init);
  // Re-wrap so we can hand the body back with a mutable header set.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}
