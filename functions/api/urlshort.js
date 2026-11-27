/* ============================================================================
   Cloudflare Pages Function — /api/urlshort, the owner's link shortener
   (the page is /urlshort; following a link is functions/s/[code].js)

     POST   { url, slug?, rid? } → { ok, code, short, url }   saves karan98.in/s/<code>
     DELETE ?code=<code>         → { ok }                      removes a link

   Both need `Authorization: Bearer <URLSHORT_KEY>`. Only the owner creates or
   deletes links: an open shortener on this domain would be a gift to phishers,
   and one flagged link could get the whole site flagged. Anyone can FOLLOW a link.

   Writes are only taken on karan98.in itself (and localhost for development).
   Every Pages deployment stays reachable at its own <hash>.pages.dev address with
   the key it was built with, so without this check an old deployment would keep
   accepting a key the owner has since changed.

   Repeats are safe. The same ending for the same URL answers with the existing
   link instead of "taken". A random code is derived from `rid`, which the page
   keeps for a retry, so a create whose answer was lost finds its own link again.

   Env (Cloudflare Pages):
     URLSHORT      KV namespace binding, declared in wrangler.toml. That file is
                   this project's source of truth for bindings; one added in the
                   dashboard is ignored.
     URLSHORT_KEY  the owner key, an encrypted secret (Settings → Variables and
                   Secrets). Any long random string.
   Without either, every call answers 503 { error: "not-set-up" }.

   KV layout: "s:<code>" → the long URL, with metadata { t: created, ms }.
   Codes are case-insensitive (stored lowercase). Random ones are 6 characters
   from an alphabet without 0/o and 1/l/i, so they survive being read aloud.
   ========================================================================== */

const PREFIX = "s:";
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // 31 characters
const CODE_LEN = 6;                                 // 31^6 ≈ 887 million codes
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/; // a chosen ending: 3–40 characters
const CODE_RE = /^[a-z0-9-]{1,40}$/;                // anything that can be stored
const RID_RE = /^[A-Za-z0-9-]{16,64}$/;             // the page's request id
const MAX_URL = 4096;
// Hosts that may create or delete links. Reads (/s/<code>) work everywhere.
const WRITE_HOSTS = ["karan98.in", "www.karan98.in", "localhost", "127.0.0.1", "[::1]"];
// This site's own names: a link to a short link on one of them would only bounce around.
const PAGES_HOST = "sudo-karan-github-io.pages.dev";

function json(obj, status, extra) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign(headers, extra || {}) });
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// Compares digests of the two keys, so the time taken says nothing about the key.
async function isOwner(request, env) {
  const want = String(env.URLSHORT_KEY || "").trim();
  const m = /^Bearer\s+(\S.*)$/i.exec(request.headers.get("Authorization") || "");
  if (!want || !m) return false;
  const a = await sha256(m[1].trim()), b = await sha256(want);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// The long URL as typed → a URL object, or the reason it can't be kept:
// "bad-url", "too-long" or "credentials". "example.com/page" gets https://.
// Only http(s) links to a real, dotted host (or an IP literal) are kept.
function normalizeUrl(raw) {
  if (typeof raw !== "string") return "bad-url";
  let s = raw.trim();
  if (!s) return "bad-url";
  if (s.length > MAX_URL) return "too-long";
  // "mailto:…", "javascript:…", "data:…": some other scheme, written without "//", as
  // the page reads it too. (A dotted "scheme" is a host, "example.com:8080"; digits, a port.)
  const sch = /^([a-z][a-z0-9+.-]*):(?!\/\/)/i.exec(s);
  if (sch && sch[1].indexOf(".") < 0 && !/^\d*(?:[/?#]|$)/.test(s.slice(sch[0].length))) return "bad-url";
  // An explicit scheme needs "://"; anything else is a bare address. That turns
  // "javascript:…" or "data:…" into an invalid https URL, and keeps
  // "example.com:8080/x" from being read as the scheme "example.com".
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  // The host as typed must have a dot (or be [IPv6]): URL parsing would turn a
  // bare "12345" into the address 0.0.48.57.
  const typed = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/?#]/)[0].replace(/^.*@/, "");
  if (typed.charAt(0) !== "[" && typed.replace(/:\d*$/, "").indexOf(".") < 0) return "bad-url";
  let u;
  try { u = new URL(s); } catch (e) { return "bad-url"; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "bad-url";
  if (u.username || u.password) return "credentials";
  const h = u.hostname;
  if (!h || (h.indexOf(".") < 0 && h.indexOf(":") < 0)) return "bad-url"; // "localhost", "intranet"
  if (u.href.length > MAX_URL) return "too-long";  // é and the like grow when encoded
  return u;
}

// A link to one of these short links would only bounce around (or loop).
function isShortLink(u, request) {
  const h = u.hostname.toLowerCase().replace(/\.$/, "");   // "karan98.in." is karan98.in
  const own = h === new URL(request.url).hostname.toLowerCase() ||
    h === "karan98.in" || h === "www.karan98.in" ||
    h === PAGES_HOST || h.endsWith("." + PAGES_HOST);
  return own && /^\/s\//i.test(u.pathname);
}

// Six characters, uniform over the alphabet: bytes ≥ 248 (31 × 8) are skipped,
// not wrapped. With `seed`, the bytes come from SHA-256 of it, so the same seed
// always gives the same code; without, they are random.
async function makeCode(seed) {
  const out = [];
  for (let round = 0; out.length < CODE_LEN; round++) {
    const buf = seed ? await sha256(seed + ":" + round) : crypto.getRandomValues(new Uint8Array(16));
    for (let i = 0; i < buf.length && out.length < CODE_LEN; i++) {
      if (buf[i] < 248) out.push(ALPHABET[buf[i] % ALPHABET.length]);
    }
  }
  return out.join("");
}

async function create(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { body = null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "bad-request" }, 400);

  const u = normalizeUrl(body.url);
  if (typeof u === "string") return json({ ok: false, error: u }, 400);
  if (isShortLink(u, request)) return json({ ok: false, error: "self-link" }, 400);
  if (body.slug != null && typeof body.slug !== "string") return json({ ok: false, error: "bad-slug" }, 400);

  const kv = env.URLSHORT;
  const done = code => json({ ok: true, code: code, short: new URL(request.url).origin + "/s/" + code, url: u.href });
  const slug = String(body.slug || "").trim().toLowerCase();
  let code = "";
  if (slug) {
    if (!SLUG_RE.test(slug)) return json({ ok: false, error: "bad-slug" }, 400);
    const had = await kv.get(PREFIX + slug);
    if (had === u.href) return done(slug);   // made already, perhaps by a request whose answer was lost
    if (had !== null) return json({ ok: false, error: "slug-taken" }, 409);
    code = slug;
  } else {
    // The same rid walks the same codes, so a retry meets its own link on the way.
    const rid = typeof body.rid === "string" && RID_RE.test(body.rid) ? body.rid : "";
    for (let i = 0; i < 5 && !code; i++) {
      const c = await makeCode(rid ? "rid:" + rid + ":" + i : "");
      const had = await kv.get(PREFIX + c);
      if (had === null) code = c;
      else if (rid && had === u.href) return done(c);
    }
    if (!code) return json({ ok: false, error: "busy" }, 503);
  }

  // KV has no "write if absent": two creates of one ending at the same moment can both
  // pass the check above, and the later write wins. Only the owner creates links.
  await kv.put(PREFIX + code, u.href, { metadata: { t: Date.now() } });
  return done(code);
}

// Deleting is idempotent: a link that is already gone is still a success. (Reading
// first could also see a stale "missing" at a location KV hasn't caught up with yet.)
async function remove(request, env) {
  const code = String(new URL(request.url).searchParams.get("code") || "").trim().toLowerCase();
  if (!CODE_RE.test(code)) return json({ ok: false, error: "not-found" }, 404);
  await env.URLSHORT.delete(PREFIX + code);
  return json({ ok: true });
}

export async function onRequest({ request, env }) {
  const method = request.method;
  if (method !== "POST" && method !== "DELETE") return json({ ok: false, error: "method" }, 405, { Allow: "POST, DELETE" });
  if (WRITE_HOSTS.indexOf(new URL(request.url).hostname.toLowerCase()) < 0) return json({ ok: false, error: "wrong-host" }, 403);
  if (!env.URLSHORT || !String(env.URLSHORT_KEY || "").trim()) return json({ ok: false, error: "not-set-up" }, 503);
  if (!(await isOwner(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    return method === "POST" ? await create(request, env) : await remove(request, env);
  } catch (e) {
    return json({ ok: false, error: "server" }, 500);
  }
}
