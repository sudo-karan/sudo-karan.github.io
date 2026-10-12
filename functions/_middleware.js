/* ============================================================================
   Cloudflare Pages middleware — runs for EVERY request to karan98.in.

   The portfolio (this repo) and its Functions (/api/*) answer their own routes.
   Anything this site doesn't have — a GitHub Pages project folder such as
   /ICTD_Project — is transparently mirrored from sudo-karan.github.io, so
   karan98.in/ICTD_Project serves that project with the URL left on karan98.in.
   Any project you publish to sudo-karan.github.io/<name> works automatically;
   no per-project rule needed.

   Safe by construction: it only reaches out when THIS site returns 404, the
   mirror host is hard-coded (not an open proxy), and GitHub's trailing-slash
   redirect is rewritten back to karan98.in so visitors never bounce to github.io.
   ========================================================================== */

const MIRROR_HOST = "sudo-karan.github.io";

export async function onRequest(context) {
  const { request, next } = context;

  // Let the portfolio + /api/* handle their own routes first.
  const res = await next();
  if (res.status !== 404) return res; // found here → done; only 404s fall through

  // Not found on karan98.in → try the same path on GitHub Pages.
  const reqUrl = new URL(request.url);
  const ghUrl = new URL(request.url);
  ghUrl.protocol = "https:";
  ghUrl.hostname = MIRROR_HOST;
  ghUrl.port = "";

  // Forward the request but drop the karan98.in Host so GitHub Pages routes by
  // the target URL (sudo-karan.github.io), not the original host.
  const fwdHeaders = new Headers(request.headers);
  fwdHeaders.delete("host");
  fwdHeaders.delete("cf-connecting-ip");
  const init = { method: request.method, headers: fwdHeaders, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

  let gh;
  try {
    gh = await fetch(ghUrl.toString(), init);
  } catch (e) {
    return res; // mirror unreachable → keep our original 404
  }

  // Keep the visitor on karan98.in: rewrite a same-host redirect (e.g. GitHub's
  // 301 from /ICTD_Project to /ICTD_Project/) back to this origin.
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

  // GitHub Pages doesn't have it either → return our real 404 (not GitHub's).
  if (gh.status === 404) return res;
  return gh;
}
