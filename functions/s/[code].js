/* ============================================================================
   Cloudflare Pages Function — GET /s/<code>: follow a short link

   Looks the code up in the URLSHORT KV namespace (written by /api/urlshort) and
   answers 302 to the saved URL. A 302, not a 301: browsers keep a 301 for good,
   so a link that is deleted or expires would carry on working for anyone who had
   used it. Codes are case-insensitive. Unknown codes get a small "no such link"
   page (404), and links past the lifetime their maker chose an "expired" page
   (410); if KV itself fails, a "try again in a minute" page (503), so a link that
   still exists is never reported as gone.

   Every request (GET and HEAD) is logged as a visit, through waitUntil after the
   answer has gone (see functions/_lib/urlshort.js).
   ========================================================================== */

import { logEvent } from "../_lib/urlshort.js";

const CODE_RE = /^[a-z0-9-]{1,40}$/;

function page(title, big, heading, text, button) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — karan98.in</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23f8f4ec'/%3E%3Ctext x='50' y='72' font-family='Georgia,serif' font-size='64' font-weight='700' fill='%236d28d9' text-anchor='middle'%3EJ%3C/text%3E%3C/svg%3E" />
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: #f8f4ec; color: #1c1917;
      display: grid; place-items: center; text-align: center;
      padding: 24px; min-height: 100vh;
    }
    .wrap { max-width: 32rem; }
    .code {
      font-family: Georgia, 'Playfair Display', serif;
      font-size: clamp(3rem, 15vw, 5.5rem); font-weight: 700;
      line-height: 1; color: #6d28d9; margin: 0 0 .5rem;
    }
    h1 { font-family: Georgia, serif; font-size: 1.5rem; font-weight: 600; margin: 0 0 .5rem; }
    p { color: #57534e; line-height: 1.6; margin: 0 auto 1.75rem; max-width: 26rem; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; min-height: 44px;
      text-decoration: none;
      background: #6d28d9; color: #fff; font-weight: 600; font-size: .95rem;
      padding: .7rem 1.4rem; border-radius: .6rem;
      transition: background .15s ease, transform .15s ease;
    }
    .btn:hover { background: #5b21b6; transform: translateY(-1px); }
    .btn:focus-visible { outline: 3px solid #6d28d9; outline-offset: 3px; }
    @media (prefers-color-scheme: dark) {
      body { background: #1c1917; color: #f5f5f4; }
      p { color: #a8a29e; }
      .code { color: #a78bfa; }
      .btn:focus-visible { outline-color: #a78bfa; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <p class="code" aria-hidden="true">${big}</p>
    <h1>${heading}</h1>
    <p>${text}</p>
    ${button}
  </main>
</body>
</html>`;
}

const NOT_FOUND = page("Link not found", "404", "This short link doesn’t lead anywhere.",
  "It may have been mistyped, or removed by its owner. Check the address you were sent.",
  `<a class="btn" href="/">Go to karan98.in</a>`);

// 410 rather than 404: the link did exist, and it won't be back.
const EXPIRED = page("Link expired", "410", "This link has expired.",
  "Short links on karan98.in last only as long as their maker chose. Ask whoever sent it for a new one.",
  `<a class="btn" href="/">Go to karan98.in</a>`);

// href="" reloads this same address. (Nothing here can say whether the link exists:
// the lookup itself failed.)
const UNAVAILABLE = page("Try again shortly", "503", "This link can’t be opened just now.",
  "Something went wrong on our side. Try again in a minute.",
  `<a class="btn" href="">Try again</a>`);

function htmlPage(method, status, body, extra) {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  return new Response(method === "HEAD" ? null : body, { status: status, headers: Object.assign(headers, extra || {}) });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const code = String(params.code || "").toLowerCase();
  const visit = (result, url, expires) => logEvent(context, { kind: "visit", code: code, url: url, result: result, expires: expires, actor: "" });
  let rec = null;
  if (env.URLSHORT && CODE_RE.test(code)) {
    try { rec = await env.URLSHORT.getWithMetadata("s:" + code); }
    catch (e) { visit("error"); return htmlPage(method, 503, UNAVAILABLE, { "Retry-After": "60" }); }
  }
  const to = rec && rec.value;
  // Only ever an http(s) URL: /api/urlshort stores nothing else, and this keeps it so.
  if (!to || !/^https?:\/\//i.test(to)) { visit("not-found"); return htmlPage(method, 404, NOT_FOUND); }
  // x: when it stops working, in ms (0 for never). Links made before lifetimes have none.
  const md = rec.metadata, ends = md && typeof md.x === "number" && md.x > 0 ? md.x : 0;
  if (ends && Date.now() >= ends) { visit("expired", to, ends); return htmlPage(method, 410, EXPIRED); }
  visit("redirect", to, ends);
  return new Response(null, {
    status: 302,
    headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
