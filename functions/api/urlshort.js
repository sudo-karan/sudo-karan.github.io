/* ============================================================================
   Cloudflare Pages Function — /api/urlshort, the link shortener
   (the page is /urlshort; following a link is functions/s/[code].js, and the
   event log is functions/api/urlshort/log.js)

     POST   { url, slug?, rid?, ttl?, client? } → { ok, code, short, url, expires }
     DELETE ?code=<code>                         → { ok }

   Who may write, by the Authorization header:
     Bearer <URLSHORT_KEY>  the owner: any link, any lifetime, deletes any link.
     Pass <token>           an email pass: the Apps Script (app=urlshort) mails a code
                            only to addresses on its allow list, and swaps a right code
                            for a signed pass. Links last 10 minutes to 30 days, and a
                            pass deletes only links made with a pass for its address.
   Nobody else makes links: an open shortener on this domain would be a gift to
   phishers, and one flagged link could get the whole site flagged. Anyone can
   FOLLOW a link until it expires.

   Writes are only taken on karan98.in itself (and localhost for development).
   Every Pages deployment stays reachable at its own <hash>.pages.dev address with
   the key it was built with, so without this check an old deployment would keep
   accepting a key the owner has since changed.

   Repeats are safe. The same ending for the same URL answers with the existing
   link instead of "taken". A random code is derived from `rid`, which the page
   keeps for a retry, so a create whose answer was lost finds its own link again.

   Lifetimes. `ttl` is in seconds: 24 hours if left out; 600…2592000 with a pass;
   0 (never) or 600…315360000 with the owner key. An expired link answers 410 and
   its ending stays reserved for 30 days, during which only its maker (or the
   owner) can renew it; then KV drops the record and the ending is free again.

   Env (Cloudflare Pages):
     URLSHORT              KV namespace binding, declared in wrangler.toml. That
                           file is this project's source of truth for bindings;
                           one added in the dashboard is ignored.
     URLSHORT_KEY          the owner key, an encrypted secret (Settings → Variables
                           and Secrets). Any long random string.
     URLSHORT_GATE_SECRET  the secret the Apps Script signs passes with (the same
                           value as its Script Property), also an encrypted secret.
                           Changing it signs everyone out.
     URLSHORT_DB           optional D1 binding for the event log (see the log).
   Without the KV binding, or with neither secret, every call answers
   503 { error: "not-set-up" }.

   KV layout: "s:<code>" → the long URL, with metadata
     { t: created ms, x: expires ms or 0 (never), by: "o" | "e", e: emailId }.
   emailId (passes only) is the first 22 characters of base64url(SHA-256(
   "urlshort:" + email)): enough to know a maker again without keeping the address.
   Links made before lifetimes have { t } only: they never expire, and only the
   owner can delete them.
   Codes are case-insensitive (stored lowercase). Random ones are 6 characters
   from an alphabet without 0/o and 1/l/i, so they survive being read aloud.
   ========================================================================== */

import { SITE_HOSTS, logEvent, cut, sha256, hmacSha256, b64url, sameSecret } from "../_lib/urlshort.js";

const PREFIX = "s:";
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // 31 characters
const CODE_LEN = 6;                                 // 31^6 ≈ 887 million codes
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/; // a chosen ending: 3–40 characters
const CODE_RE = /^[a-z0-9-]{1,40}$/;                // anything that can be stored
const RID_RE = /^[A-Za-z0-9-]{16,64}$/;             // the page's request id
const MAX_URL = 4096;
// Hosts that may create or delete links (see SITE_HOSTS). Reads (/s/<code>) work everywhere.
const WRITE_HOSTS = SITE_HOSTS;
// This site's own names: a link to a short link on one of them would only bounce around.
const PAGES_HOST = "sudo-karan-github-io.pages.dev";

const DAY = 86400;                    // seconds
const TTL_DEFAULT = DAY;
const TTL_MIN = 600;                  // 10 minutes
const TTL_MAX_PASS = 30 * DAY;
const TTL_MAX_OWNER = 3650 * DAY;
const GRACE_S = 30 * DAY;             // how long KV keeps a record after it expires
const PASS_AUD = "urlshort";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // as the Apps Script's validEmail
// The maker's device details (the page's `client`), kept for the log only.
const CLIENT_KEYS = 40, CLIENT_VALUE = 300, CLIENT_BYTES = 4096;

function json(obj, status, extra) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign(headers, extra || {}) });
}

const secretOf = v => String(v || "").trim();

function fromB64url(s) {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("not base64url");
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

async function emailId(email) {
  return b64url(await sha256("urlshort:" + email)).slice(0, 22);
}

// A pass is P.S, where P is base64url of the JSON { email, exp, aud } and S is
// base64url of its HMAC-SHA256 under URLSHORT_GATE_SECRET. Nothing in P is believed
// until S checks out, so only a pass with a good signature can be "expired".
async function readPass(token, secret) {
  const bad = { error: "unauthorized" };
  const dot = token.lastIndexOf(".");
  if (!secret || dot < 1 || dot === token.length - 1) return bad;
  const p = token.slice(0, dot);
  if (!(await sameSecret(token.slice(dot + 1), b64url(await hmacSha256(secret, p))))) return bad;
  let claim;
  try { claim = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(fromB64url(p))); } catch (e) { return bad; }
  if (!claim || typeof claim !== "object" || claim.aud !== PASS_AUD) return bad;
  const email = typeof claim.email === "string" ? claim.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || typeof claim.exp !== "number" || !isFinite(claim.exp)) return bad;
  if (claim.exp * 1000 <= Date.now()) return { error: "pass-expired" };
  return { email: email, id: await emailId(email) };
}

// { owner: true }, { email, id } for a pass, or { error }. The owner key is compared
// by digests, so the time taken says nothing about the key.
async function caller(request, env) {
  const auth = request.headers.get("Authorization") || "";
  let m = /^Bearer\s+(\S.*)$/i.exec(auth);
  if (m) {
    const want = secretOf(env.URLSHORT_KEY);
    return want && await sameSecret(m[1].trim(), want) ? { owner: true } : { error: "unauthorized" };
  }
  m = /^Pass\s+(\S.*)$/i.exec(auth);
  if (m) return readPass(m[1].trim(), secretOf(env.URLSHORT_GATE_SECRET));
  return { error: "unauthorized" };
}

const actorOf = who => (who.owner ? "owner" : who.email);
// Made with a pass for this same address. (The owner's links, and those made before
// lifetimes, have no emailId.)
const madeBy = (md, who) => !!md && typeof md.e === "string" && !!who.id && md.e === who.id;
// When a record stops working, in ms; 0 for never (and for links made before lifetimes).
const endsOf = md => (md && typeof md.x === "number" && md.x > 0 ? md.x : 0);
const isOver = (md, now) => endsOf(md) > 0 && now >= endsOf(md);

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

// Seconds the link lasts, or -1. A whole number only: "600" or 600.5 is a mistake to
// report, not to round. 0 (never) is the owner's alone.
function lifetime(ttl, owner) {
  if (ttl == null) return TTL_DEFAULT;
  if (!Number.isInteger(ttl)) return -1;
  if (owner && ttl === 0) return 0;
  return ttl >= TTL_MIN && ttl <= (owner ? TTL_MAX_OWNER : TTL_MAX_PASS) ? ttl : -1;
}

// The page's device details → JSON for the log, or "". Only flat string, number or
// boolean values are kept, each cut to 300 characters, at most 40 of them and 4 KB
// in all. Anything else is dropped rather than refused: it only feeds the log.
function clientJson(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return "";
  const out = Object.create(null);    // so a key named "__proto__" stays data
  const enc = new TextEncoder();
  let n = 0, size = 2;                // "{}"
  for (const k of Object.keys(c)) {
    if (n >= CLIENT_KEYS) break;
    const v = c[k];
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
    const s = cut(String(v), CLIENT_VALUE);
    const add = enc.encode(JSON.stringify(k) + ":" + JSON.stringify(s)).length + (n ? 1 : 0);
    if (size + add > CLIENT_BYTES) continue;
    out[k] = s; n++; size += add;
  }
  return JSON.stringify(out);
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

async function create(context, who) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { body = null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "bad-request" }, 400);

  const u = normalizeUrl(body.url);
  if (typeof u === "string") return json({ ok: false, error: u }, 400);
  if (isShortLink(u, request)) return json({ ok: false, error: "self-link" }, 400);
  if (body.slug != null && typeof body.slug !== "string") return json({ ok: false, error: "bad-slug" }, 400);
  const slug = String(body.slug || "").trim().toLowerCase();
  if (slug && !SLUG_RE.test(slug)) return json({ ok: false, error: "bad-slug" }, 400);
  const ttl = lifetime(body.ttl, !!who.owner);
  if (ttl < 0) return json({ ok: false, error: "bad-ttl" }, 400);

  const kv = env.URLSHORT;
  const now = Date.now();
  const done = (code, expires, result) => {
    logEvent(context, { kind: "make", code: code, url: u.href, result: result, expires: expires, actor: actorOf(who), client: clientJson(body.client) });
    return json({ ok: true, code: code, short: new URL(request.url).origin + "/s/" + code, url: u.href, expires: expires });
  };
  let code = "", renewal = false;
  if (slug) {
    const had = await kv.getWithMetadata(PREFIX + slug);
    if (had.value !== null) {
      const over = isOver(had.metadata, now);
      // made already, perhaps by a request whose answer was lost
      if (!over && had.value === u.href) return done(slug, endsOf(had.metadata), "repeat");
      // An expired ending stays its maker's until KV drops it, so a link someone
      // printed can't quietly start leading somewhere else.
      if (!over || !(who.owner || madeBy(had.metadata, who))) return json({ ok: false, error: "slug-taken" }, 409);
      renewal = true;
    }
    code = slug;
  } else {
    // The same rid walks the same codes, so a retry meets its own link on the way.
    const rid = typeof body.rid === "string" && RID_RE.test(body.rid) ? body.rid : "";
    for (let i = 0; i < 5 && !code; i++) {
      const c = await makeCode(rid ? "rid:" + rid + ":" + i : "");
      const had = await kv.getWithMetadata(PREFIX + c);
      if (had.value === null) code = c;
      else if (rid && had.value === u.href && !isOver(had.metadata, now)) return done(c, endsOf(had.metadata), "repeat");
    }
    if (!code) return json({ ok: false, error: "busy" }, 503);
  }

  // KV has no "write if absent": two creates of one ending at the same moment can both
  // pass the check above, and the later write wins. Makers are few and allow-listed.
  const x = ttl ? now + ttl * 1000 : 0;
  const metadata = who.owner ? { t: now, x: x, by: "o" } : { t: now, x: x, by: "e", e: who.id };
  // KV drops a timed record 30 days after it stops working; until then the address
  // says "expired" and the ending stays reserved.
  await kv.put(PREFIX + code, u.href, x ? { metadata: metadata, expiration: Math.ceil(x / 1000) + GRACE_S } : { metadata: metadata });
  return done(code, x, renewal ? "renewed" : "new");
}

// The owner's deletes are idempotent and blind: a link that is already gone is still a
// success, and reading first could see a stale "missing" at a location KV hasn't caught
// up with yet. A pass has to read first, to know whose link it is; if that read says
// "missing", nothing is deleted, since a blind delete there could remove a link that
// someone else made a moment ago.
async function remove(context, who) {
  const { request, env } = context;
  const code = String(new URL(request.url).searchParams.get("code") || "").trim().toLowerCase();
  if (!CODE_RE.test(code)) return json({ ok: false, error: "not-found" }, 404);
  let url = "";
  if (!who.owner) {
    const had = await env.URLSHORT.getWithMetadata(PREFIX + code);
    if (had.value !== null) {
      if (!madeBy(had.metadata, who)) return deny(context, "not-yours", 403);
      url = had.value;
      await env.URLSHORT.delete(PREFIX + code);
    }
  } else {
    await env.URLSHORT.delete(PREFIX + code);
  }
  logEvent(context, { kind: "delete", code: code, url: url, result: "deleted", actor: actorOf(who) });
  return json({ ok: true });
}

// Refused writes are logged too (with the ending a DELETE named), so that someone
// trying keys or passes shows up in the Sheet.
function deny(context, error, status) {
  const { request } = context;
  const code = request.method === "DELETE" ? String(new URL(request.url).searchParams.get("code") || "").trim().toLowerCase() : "";
  logEvent(context, { kind: "denied", code: code, result: error, actor: "" });
  return json({ ok: false, error: error }, status);
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  if (method !== "POST" && method !== "DELETE") return json({ ok: false, error: "method" }, 405, { Allow: "POST, DELETE" });
  if (WRITE_HOSTS.indexOf(new URL(request.url).hostname.toLowerCase()) < 0) return deny(context, "wrong-host", 403);
  if (!env.URLSHORT || (!secretOf(env.URLSHORT_KEY) && !secretOf(env.URLSHORT_GATE_SECRET))) return json({ ok: false, error: "not-set-up" }, 503);
  try {
    const who = await caller(request, env);
    if (who.error) return deny(context, who.error, 401);
    return method === "POST" ? await create(context, who) : await remove(context, who);
  } catch (e) {
    return json({ ok: false, error: "server" }, 500);
  }
}
