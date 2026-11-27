/* ============================================================================
   Shared by the link shortener's Functions: functions/api/urlshort.js (make and
   delete), functions/api/urlshort/log.js (the log, for the Apps Script) and
   functions/s/[code].js (following a link). It exports no onRequest handler,
   so Pages gives it no address of its own.

   The event log. Every link made or deleted, every refused write and every
   visit becomes a row in the D1 database bound as URLSHORT_DB. Cloudflare's
   servers can't call the Apps Script (Google refuses them), and KV's free plan
   allows only 1,000 writes a day, so the Apps Script pulls the rows into Google
   Sheets instead (syncShortLinks in functions/apps-script/Code.gs). Without the
   binding nothing is logged and everything else works the same.

   A row is written through context.waitUntil, after the answer has gone: a slow
   or failing database never delays an answer or changes it.
   ========================================================================== */

// Hosts that may write links or read the log; following a link (/s/<code>) works on any.
// Every Pages deployment stays reachable at its own <hash>.pages.dev address with the
// secrets it was built with, so without this check an old deployment would keep taking
// a key or secret that has since been changed.
export const SITE_HOSTS = ["karan98.in", "www.karan98.in", "localhost", "127.0.0.1", "[::1]"];

// Created on demand, in the same batch as each write, so there is no setup step.
export const EVENTS_TABLE = `CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, kind TEXT NOT NULL,
  code TEXT, url TEXT, result TEXT, expires INTEGER, actor TEXT,
  ip TEXT, country TEXT, region TEXT, city TEXT, postal TEXT, lat TEXT, lon TEXT, tz TEXT,
  asn TEXT, isp TEXT, colo TEXT, http TEXT, tls TEXT,
  ua TEXT, browser TEXT, os TEXT, device TEXT, lang TEXT, referer TEXT, client TEXT
)`;

// Every column but id, in the table's order.
export const EVENT_FIELDS = ["t", "kind", "code", "url", "result", "expires", "actor",
  "ip", "country", "region", "city", "postal", "lat", "lon", "tz",
  "asn", "isp", "colo", "http", "tls",
  "ua", "browser", "os", "device", "lang", "referer", "client"];

const INSERT = "INSERT INTO events (" + EVENT_FIELDS.join(", ") + ") VALUES (" +
  EVENT_FIELDS.map(() => "?").join(", ") + ")";

// At most n UTF-16 units, without leaving half of a character that needs two.
export function cut(s, n) {
  s = s == null ? "" : String(s);
  if (s.length <= n) return s;
  s = s.slice(0, n);
  const last = s.charCodeAt(n - 1);
  return last >= 0xd800 && last <= 0xdbff ? s.slice(0, -1) : s;
}

const text = v => (v == null ? "" : String(v));

// As uaParse in assets/js/app.js (the contact form's), plus a rough kind of device.
export function uaParse(ua) {
  ua = ua || "";
  let os = "Unknown";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) { const am = ua.match(/Android (\d+(\.\d+)?)/); os = am ? "Android " + am[1] : "Android"; }
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  let br = "Unknown", m;
  if ((m = ua.match(/Edg\/(\d+(\.\d+)?)/))) br = "Edge " + m[1];
  else if ((m = ua.match(/OPR\/(\d+(\.\d+)?)/))) br = "Opera " + m[1];
  else if (/Chrome\//.test(ua) && (m = ua.match(/Chrome\/(\d+(\.\d+)?)/))) br = "Chrome " + m[1];
  else if (/Firefox\//.test(ua) && (m = ua.match(/Firefox\/(\d+(\.\d+)?)/))) br = "Firefox " + m[1];
  else if (/Safari/.test(ua) && (m = ua.match(/Version\/(\d+(\.\d+)?)/))) br = "Safari " + m[1];
  return { browser: br, os: os, device: deviceOf(ua) };
}

// Crawlers, link previews (a short link pasted into a chat is fetched at once) and scripts.
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|embedly|iframely|headless|lighthouse|curl\/|wget\/|python|go-http-client|okhttp|java\/|libwww|httpclient|node-fetch|undici|axios|^node$/i;

// Simple tests, in this order: bots first (Googlebot's phone agent says "Mobile" too),
// then tablets (Android ones leave "Mobile" out), then phones. iPads that ask for the
// desktop site say "Macintosh" and count as desktops: only the browser could tell.
function deviceOf(ua) {
  if (!ua || BOT_RE.test(ua)) return "Bot";
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "Tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone|BlackBerry|Opera Mini/i.test(ua)) return "Mobile";
  return "Desktop";
}

// ev: { kind, code?, url?, result?, expires?, actor?, client? }. The rest comes from the
// request, named as functions/api/contact.js names it: Cloudflare's own idea of where
// the visitor is (from the IP address), never the browser's.
export function eventRow(request, ev) {
  const cf = request.cf || {};
  const h = request.headers;
  const ua = h.get("User-Agent") || "";
  const d = uaParse(ua);
  return {
    t: Date.now(), kind: ev.kind, code: cut(ev.code, 100), url: text(ev.url), result: text(ev.result),
    expires: typeof ev.expires === "number" ? ev.expires : null, actor: text(ev.actor),
    ip: cut(h.get("CF-Connecting-IP"), 100),
    country: text(cf.country), region: text(cf.region), city: text(cf.city), postal: text(cf.postalCode),
    lat: text(cf.latitude), lon: text(cf.longitude), tz: text(cf.timezone),
    asn: cf.asn ? "AS" + cf.asn : "", isp: text(cf.asOrganization), colo: text(cf.colo),
    http: text(cf.httpProtocol), tls: text(cf.tlsVersion),
    ua: cut(ua, 500), browser: d.browser, os: d.os, device: d.device,
    lang: cut(h.get("Accept-Language"), 200), referer: cut(h.get("Referer"), 500),
    client: text(ev.client),
  };
}

async function writeEvent(db, request, ev) {
  const row = eventRow(request, ev);
  await db.batch([db.prepare(EVENTS_TABLE), db.prepare(INSERT).bind(...EVENT_FIELDS.map(f => row[f]))]);
}

// Never throws and never waits: the write runs on after the answer has been sent.
export function logEvent(context, ev) {
  const db = context.env && context.env.URLSHORT_DB;
  if (!db) return;
  const done = writeEvent(db, context.request, ev)
    .catch(e => { console.error("urlshort log: " + (e && e.message ? e.message : e)); });
  try { context.waitUntil(done); } catch (e) { /* no waitUntil: the write still runs */ }
}

export async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

export async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

// base64url without padding, as the Apps Script writes it.
export function b64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Compares digests of the two strings, so the time taken says nothing about either.
export async function sameSecret(given, want) {
  const a = await sha256(given), b = await sha256(want);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// The key the Apps Script sends to the log: made from the secret it already holds,
// so there is no second secret to keep in step.
export async function logKey(gateSecret) {
  return b64url(await hmacSha256(gateSecret, "urlshort-log"));
}
