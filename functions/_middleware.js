/* ============================================================================
   Cloudflare Pages middleware — runs for EVERY request to karan98.in.

   This repo (the portfolio) is a single-page site. It owns "/", "/assets/*",
   "/api/*" and "/.well-known/*". GitHub Pages (sudo-karan.github.io) hosts the
   same site AND the separate project folders such as /ICTD_Project. The goal:
   every project at sudo-karan.github.io/<name> is reachable at karan98.in/<name>
   with the URL left on karan98.in. Any project you publish works automatically;
   no per-project rule needed.

   Why we DON'T key off a local 404: Cloudflare Pages auto-detects this site as a
   single-page app (index.html present, no explicit setting) and serves
   index.html with a 200 for any unmatched path — so "/ICTD_Project" would render
   the home page, never a 404, and a 404-triggered proxy would never fire.
   Instead we answer the site's own paths locally and proxy everything else to
   the mirror, falling back to the local response only when the mirror lacks it.

   Safe by construction: the mirror host is hard-coded (not an open proxy), the
   site's own high-traffic paths never leave Cloudflare, only GET/HEAD are
   proxied (GitHub Pages serves static content only), and GitHub's trailing-slash
   redirect is rewritten to a relative path so visitors never bounce to github.io.
   ========================================================================== */

const MIRROR_HOST = "sudo-karan.github.io";

// Paths THIS repo serves itself — always answered locally, never proxied.
// (A project literally named "assets", "api" or ".well-known" would collide,
// but none do.)
function isOwnPath(pathname) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/assets/")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/.well-known/")) return true;
  // A top-level file — one path segment with an extension — is this repo's own
  // static file: /index.html, /404.html, /robots.txt, /sitemap.xml,
  // /favicon.ico, /site.webmanifest, etc. GitHub Pages projects are always
  // subdirectories (/<project>/...), so they never match this and still proxy.
  if (/^\/[^/]+\.[^/]+$/.test(pathname)) return true;
  return false;
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // The portfolio + its Functions own these routes.
  if (isOwnPath(url.pathname)) return next();

  // GitHub Pages only serves static GET/HEAD; anything else stays on this site.
  if (request.method !== "GET" && request.method !== "HEAD") return next();

  // Everything else → try the same path on GitHub Pages (the mirror).
  const ghUrl = new URL(request.url);
  ghUrl.protocol = "https:";
  ghUrl.hostname = MIRROR_HOST;
  ghUrl.port = "";

  // Forward the request, but strip anything that shouldn't reach a different
  // operator (GitHub): the Host (so Pages routes by the target host), the
  // visitor's credentials (Cookie/Authorization — e.g. Cloudflare's own zone
  // cookies), and all Cloudflare-internal cf-* headers (incl. cf-connecting-ip,
  // which would leak the visitor IP). GitHub Pages is static and needs none of
  // these; caching/content-negotiation headers (Accept, If-None-Match, …) stay.
  const fwdHeaders = new Headers(request.headers);
  fwdHeaders.delete("host");
  fwdHeaders.delete("cookie");
  fwdHeaders.delete("authorization");
  for (const name of [...fwdHeaders.keys()]) {
    if (name.toLowerCase().startsWith("cf-")) fwdHeaders.delete(name);
  }

  let gh;
  try {
    gh = await fetch(ghUrl.toString(), { method: request.method, headers: fwdHeaders, redirect: "manual" });
  } catch (e) {
    return next(); // mirror unreachable → let this site respond
  }

  // Keep the visitor on karan98.in: rewrite a same-host redirect (e.g. GitHub's
  // 301 from /ICTD_Project to /ICTD_Project/) back to a relative path.
  if (gh.status >= 300 && gh.status < 400) {
    const loc = gh.headers.get("Location");
    if (loc) {
      let to = null;
      try { to = new URL(loc, ghUrl); } catch (e) { to = null; }
      if (to && to.hostname === MIRROR_HOST) {
        const h = new Headers(gh.headers);
        h.set("Location", to.pathname + to.search + to.hash); // relative → stays on karan98.in
        return new Response(null, { status: gh.status, headers: h });
      }
    }
  }

  // Mirror doesn't have it either → fall back to this site's own response
  // (its 404 page). Anything else from the mirror (200, real errors) → serve it.
  if (gh.status === 404) return next();
  return gh;
}
