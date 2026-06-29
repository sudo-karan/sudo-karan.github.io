/* ============================================================================
   Cloudflare Pages Function — POST /api/contact
   Verifies a Cloudflare Turnstile token (secret stays server-side), enriches the
   submission with request metadata, and forwards it to a Google Apps Script web
   app that logs to a Sheet + emails. The Turnstile token is single-use and is
   NEVER stored — it is verified and discarded. Secrets come from encrypted
   Cloudflare env vars, never from the repo or the client.

   Required env vars (Cloudflare Pages → Settings → Environment variables):
     TURNSTILE_SECRET_KEY   - Turnstile secret (defaults to the public TEST key)
     APPS_SCRIPT_URL        - the Apps Script web-app /exec URL
     SHARED_SECRET          - shared secret guarding the Apps Script endpoint
   ========================================================================== */

const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA"; // always-passes test key
const LIMITS = { name: 120, email: 160, subject: 160, org: 160, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CORS so the form works cross-origin too (e.g. opened from the GitHub Pages
// mirror sudo-karan.github.io, posting to https://karan98.in/api/contact).
// No cookies/credentials are used, so "*" is safe; abuse is handled by Turnstile
// + honeypot + the shared secret to Apps Script.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, CORS),
  });
}

// Preflight for cross-origin POSTs.
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function clean(s, max) { return String(s == null ? "" : s).trim().slice(0, max || 1000); }

function parseUA(ua) {
  ua = ua || "";
  let os = "Unknown";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) os = (ua.match(/OS (\d+[_\.]\d+)/) ? "iOS " + ua.match(/OS (\d+[_\.]\d+)/)[1].replace("_", ".") : "iOS");
  else if (/Android/.test(ua)) os = (ua.match(/Android (\d+(\.\d+)?)/) ? "Android " + ua.match(/Android (\d+(\.\d+)?)/)[1] : "Android");
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  let br = "Unknown", m;
  if ((m = ua.match(/Edg\/(\d+(\.\d+)?)/))) br = "Edge " + m[1];
  else if ((m = ua.match(/OPR\/(\d+(\.\d+)?)/))) br = "Opera " + m[1];
  else if (/Chrome/.test(ua) && (m = ua.match(/Chrome\/(\d+(\.\d+)?)/))) br = "Chrome " + m[1];
  else if (/Firefox/.test(ua) && (m = ua.match(/Firefox\/(\d+(\.\d+)?)/))) br = "Firefox " + m[1];
  else if (/Safari/.test(ua) && (m = ua.match(/Version\/(\d+(\.\d+)?)/))) br = "Safari " + m[1];
  return { browser: br, platform: os };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "bad-request" }, 400); }

  // Honeypot: bots fill the hidden "website" field. Pretend success, drop silently.
  if (clean(body.website, 200)) return json({ ok: true });

  const fields = {
    name: clean(body.name, LIMITS.name),
    email: clean(body.email, LIMITS.email),
    subject: clean(body.subject, LIMITS.subject),
    org: clean(body.org, LIMITS.org),
    message: clean(body.message, LIMITS.message),
  };

  // Server-side validation (never trust the client)
  if (!fields.name || !fields.email || !fields.subject || !fields.message) {
    return json({ ok: false, error: "missing-fields" }, 400);
  }
  if (!EMAIL_RE.test(fields.email)) return json({ ok: false, error: "bad-email" }, 400);
  if (fields.message.length < 10) return json({ ok: false, error: "short-message" }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "";

  // Verify Turnstile (token is single-use; verified then discarded — never stored)
  const token = clean(body.token, 4000);
  if (!token) return json({ ok: false, error: "missing-captcha" }, 400);
  const secret = env.TURNSTILE_SECRET_KEY || TURNSTILE_TEST_SECRET;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  let ts;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    ts = await r.json();
  } catch (e) { return json({ ok: false, error: "captcha-error" }, 502); }
  if (!ts || !ts.success) {
    // Surface Turnstile's error-codes so the cause is unambiguous, e.g.
    // invalid-input-secret (wrong/missing secret), invalid-input-response
    // (token doesn't match this secret = key-pair mismatch / expired),
    // timeout-or-duplicate (token reused).
    return json({ ok: false, error: "failed-captcha", codes: (ts && ts["error-codes"]) || [], hostname: (ts && ts.hostname) || "" }, 400);
  }

  // Enrich with request metadata (Cloudflare provides geo/IP/ISP server-side, no
  // browser geolocation prompt — collected silently per the owner's request).
  const cf = request.cf || {};
  const ua = request.headers.get("User-Agent") || "";
  const det = parseUA(ua);
  const meta = {
    submittedAt: new Date().toISOString(),
    ip,
    browser: det.browser,
    platform: det.platform,
    userAgent: ua,
    isp: cf.asOrganization || "",
    asn: cf.asn || "",
    country: cf.country || "",
    city: cf.city || "",
    state: cf.region || "",
    regionCode: cf.regionCode || "",
    postalCode: cf.postalCode || "",
    latitude: cf.latitude || "",
    longitude: cf.longitude || "",
    accuracy: "ip",
    timezone: cf.timezone || "",
    colo: cf.colo || "",
    httpProtocol: cf.httpProtocol || "",
    tlsVersion: cf.tlsVersion || "",
    language: request.headers.get("Accept-Language") || "",
    referer: request.headers.get("Referer") || "",
    bot: "No",
  };

  // Forward to Apps Script (server→server, no CORS). Token is NOT forwarded.
  if (!env.APPS_SCRIPT_URL) {
    // Not configured yet (e.g. before setup). Don't 500 — let the client know.
    return json({ ok: false, error: "not-configured" }, 503);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await fetch(env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env.SHARED_SECRET || "", fields, meta }),
      signal: ac.signal,
      redirect: "follow",
    });
    if (!r.ok) return json({ ok: false, error: "delivery-failed", status: r.status }, 502);
    const out = await r.json().catch(() => ({}));
    if (out && out.ok === false) return json({ ok: false, error: out.error || "delivery-rejected" }, 502);
  } catch (e) {
    return json({ ok: false, error: "delivery-error", detail: String((e && e.message) || e) }, 502);
  } finally {
    clearTimeout(timer);
  }

  return json({ ok: true });
}
// Other HTTP methods get an automatic 405 from Cloudflare Pages.
