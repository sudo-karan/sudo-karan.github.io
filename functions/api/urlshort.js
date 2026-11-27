/* ============================================================================
   Cloudflare Pages Function — /api/urlshort, the owner's link shortener
   (the page is /urlshort; following a link is functions/s/[code].js)

     POST   { url, slug? }   → { ok, code, short, url }   saves karan98.in/s/<code>
     DELETE ?code=<code>     → { ok }                      removes a link

   Both need `Authorization: Bearer <URLSHORT_KEY>`. Only the owner creates or
   deletes links: an open shortener on this domain would be a gift to phishers,
   and one flagged link could get the whole site flagged. Anyone can FOLLOW a link.

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
const MAX_URL = 4096;

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

// The long URL as typed → a URL object, or null. "example.com/page" gets https://.
// Only http(s) links to a real, dotted host (or an IP literal) are kept.
function normalizeUrl(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s || s.length > MAX_URL) return null;
  // An explicit scheme needs "://"; anything else is a bare address. That turns
  // "javascript:…" or "data:…" into an invalid https URL, and keeps
  // "example.com:8080/x" from being read as the scheme "example.com".
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  // The host as typed must have a dot (or be [IPv6]): URL parsing would turn a
  // bare "12345" into the address 0.0.48.57.
  const typed = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/?#]/)[0].replace(/^.*@/, "");
  if (typed.charAt(0) !== "[" && typed.replace(/:\d*$/, "").indexOf(".") < 0) return null;
  let u;
  try { u = new URL(s); } catch (e) { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const h = u.hostname;
  if (!h || (h.indexOf(".") < 0 && h.indexOf(":") < 0)) return null; // "localhost", "intranet"
  if (u.href.length > MAX_URL) return null;
  return u;
}

// A link to one of these short links would only bounce around (or loop).
function isShortLink(u, request) {
  const h = u.hostname.toLowerCase();
  const own = h === new URL(request.url).hostname.toLowerCase() || h === "karan98.in" || h === "www.karan98.in";
  return own && /^\/s\//i.test(u.pathname);
}

// Uniform over the alphabet: bytes ≥ 248 (31 × 8) are skipped, not wrapped.
function randomCode() {
  const out = [], buf = new Uint8Array(16);
  while (out.length < CODE_LEN) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && out.length < CODE_LEN; i++) {
      if (buf[i] < 248) out.push(ALPHABET[buf[i] % ALPHABET.length]);
    }
  }
  return out.join("");
}

async function create(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { body = null; }
  if (!body || typeof body !== "object") return json({ ok: false, error: "bad-request" }, 400);

  const u = normalizeUrl(body.url);
  if (!u) return json({ ok: false, error: "bad-url" }, 400);
  if (isShortLink(u, request)) return json({ ok: false, error: "self-link" }, 400);

  const kv = env.URLSHORT;
  const slug = String(body.slug == null ? "" : body.slug).trim().toLowerCase();
  let code = "";
  if (slug) {
    if (!SLUG_RE.test(slug)) return json({ ok: false, error: "bad-slug" }, 400);
    if ((await kv.get(PREFIX + slug)) !== null) return json({ ok: false, error: "slug-taken" }, 409);
    code = slug;
  } else {
    for (let i = 0; i < 5 && !code; i++) {
      const c = randomCode();
      if ((await kv.get(PREFIX + c)) === null) code = c;
    }
    if (!code) return json({ ok: false, error: "busy" }, 503);
  }

  await kv.put(PREFIX + code, u.href, { metadata: { t: Date.now() } });
  return json({ ok: true, code: code, short: new URL(request.url).origin + "/s/" + code, url: u.href });
}

async function remove(request, env) {
  const code = String(new URL(request.url).searchParams.get("code") || "").trim().toLowerCase();
  if (!CODE_RE.test(code) || (await env.URLSHORT.get(PREFIX + code)) === null) {
    return json({ ok: false, error: "not-found" }, 404);
  }
  await env.URLSHORT.delete(PREFIX + code);
  return json({ ok: true });
}

export async function onRequest({ request, env }) {
  const method = request.method;
  if (method !== "POST" && method !== "DELETE") return json({ ok: false, error: "method" }, 405, { Allow: "POST, DELETE" });
  if (!env.URLSHORT || !String(env.URLSHORT_KEY || "").trim()) return json({ ok: false, error: "not-set-up" }, 503);
  if (!(await isOwner(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    return method === "POST" ? await create(request, env) : await remove(request, env);
  } catch (e) {
    return json({ ok: false, error: "server" }, 500);
  }
}
