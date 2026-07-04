/* ============================================================================
   Cloudflare Pages Function — POST /api/contact

   The browser hybrid-encrypts {token, fields, meta} with the public key in
   data.js and POSTs { enc } here. This Function:
     1. RSA-decrypts the payload with the private key (env, never in the repo),
     2. verifies the Cloudflare Turnstile token,
     3. enriches with IP / geo / ISP derived SERVER-SIDE from `request.cf`
        (so the browser never sends them and makes no third-party geo calls),
     4. forwards server→server to the Apps Script web app (which logs + emails).

   The whole thing is invisible in the visitor's Network tab except the opaque
   { enc } blob. Env (Cloudflare Pages → Settings → Environment variables):
     PRIVATE_KEY       RSA-OAEP private key, PKCS8 base64 (pairs with data.js publicKey)
     TURNSTILE_SECRET  Cloudflare Turnstile secret key
     APPS_SCRIPT_URL   the Apps Script /exec URL
     SHARED_SECRET     secret the Apps Script checks (proves this Function sent it)

   `retryable` in error responses tells the browser whether the Turnstile token
   was already spent: retryable failures happen BEFORE siteverify, so the browser
   may safely fall back to its obfuscated direct path with the same token.
   ========================================================================== */

const JSON_HEADERS = { "Content-Type": "application/json" };
function json(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }

function b64ToBytes(b64) {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function hybridDecrypt(enc, pkcs8B64) {
  const priv = await crypto.subtle.importKey("pkcs8", b64ToBytes(pkcs8B64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  const rawKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, b64ToBytes(enc.k));
  const aesKey = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(enc.iv) }, aesKey, b64ToBytes(enc.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

function uaParse(ua) {
  ua = ua || "";
  let os = "Unknown";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) { const m = ua.match(/Android (\d+(\.\d+)?)/); os = m ? "Android " + m[1] : "Android"; }
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  let br = "Unknown", m;
  if ((m = ua.match(/Edg\/(\d+(\.\d+)?)/))) br = "Edge " + m[1];
  else if ((m = ua.match(/OPR\/(\d+(\.\d+)?)/))) br = "Opera " + m[1];
  else if (/Chrome\//.test(ua) && (m = ua.match(/Chrome\/(\d+(\.\d+)?)/))) br = "Chrome " + m[1];
  else if (/Firefox\//.test(ua) && (m = ua.match(/Firefox\/(\d+(\.\d+)?)/))) br = "Firefox " + m[1];
  else if (/Safari/.test(ua) && (m = ua.match(/Version\/(\d+(\.\d+)?)/))) br = "Safari " + m[1];
  return { browser: br, platform: os };
}

export async function onRequestPost({ request, env }) {
  let inner;
  try {
    const body = await request.json();
    if (!body || !body.enc || !body.enc.k) return json({ ok: false, error: "bad-request", retryable: true });
    inner = await hybridDecrypt(body.enc, env.PRIVATE_KEY);
  } catch (err) {
    // Decrypt/parse failed → the Turnstile token was never spent → safe to retry.
    return json({ ok: false, error: "decrypt-failed", retryable: true });
  }

  const token = inner.token || "";
  const fields = inner.fields || {};
  const clientMeta = inner.meta || {};

  // Validate BEFORE spending the captcha so validation failures stay retryable.
  if (!fields.name || !fields.email || !fields.subject || !fields.message) {
    return json({ ok: false, error: "missing-fields", retryable: true });
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";

  // Verify Turnstile — this SPENDS the single-use token, so any failure past here
  // is NOT retryable (the browser must not re-send it on the fallback path).
  if (env.TURNSTILE_SECRET) {
    let vr = {};
    try {
      const form = new FormData();
      form.append("secret", env.TURNSTILE_SECRET);
      form.append("response", token);
      if (ip) form.append("remoteip", ip);
      vr = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form }).then((r) => r.json());
    } catch (e) { vr = {}; }
    if (!vr.success) return json({ ok: false, error: "failed-captcha", retryable: false, codes: vr["error-codes"] || [] });
  }

  // Server-derived signals from Cloudflare's edge — never sent by the browser.
  const cf = request.cf || {};
  const ua = request.headers.get("User-Agent") || "";
  const p = uaParse(ua);
  const meta = Object.assign({}, clientMeta, {
    ip: ip,
    country: cf.country || "",
    city: cf.city || "",
    state: cf.region || "",
    postal: cf.postalCode || "",
    latitude: cf.latitude || "",
    longitude: cf.longitude || "",
    isp: cf.asOrganization || "",
    asn: cf.asn ? "AS" + cf.asn : "",
    accuracy: "ip",
    colo: cf.colo || "",
    httpProtocol: cf.httpProtocol || "",
    tlsVersion: cf.tlsVersion || "",
    acceptLanguage: request.headers.get("Accept-Language") || "",
    referer: request.headers.get("Referer") || clientMeta.referer || "",
    userAgent: ua || clientMeta.userAgent || ""
  });
  if (!meta.browser) meta.browser = p.browser;
  if (!meta.platform) meta.platform = p.platform;
  if (!meta.timezone) meta.timezone = cf.timezone || "";

  // Forward server→server to Apps Script (invisible to the browser).
  // Apps Script runs doPost on the POST (committing the Sheet row + email), then
  // 302-redirects to a script.googleusercontent.com "echo" URL that renders the
  // result. Cloudflare Workers' fetch sends NO User-Agent by default, which makes
  // Google serve a 401 sign-in page instead of running the app — so we send a real
  // browser User-Agent on BOTH hops (this is the actual fix). A 302 to the echo
  // host means doPost already ran, so if that echo body is ever unreadable we still
  // treat it as delivered.
  const FWD_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html;q=0.9,*/*;q=0.8"
  };
  try {
    const resp = await fetch(env.APPS_SCRIPT_URL, {
      method: "POST",
      redirect: "manual", // detect the 302 ourselves so we can use it as the success signal
      headers: Object.assign({ "Content-Type": "text/plain;charset=utf-8" }, FWD_HEADERS),
      body: JSON.stringify({ secret: env.SHARED_SECRET, fields: fields, meta: meta })
    });

    const isRedirect = resp.status >= 300 && resp.status < 400;
    const loc = isRedirect ? resp.headers.get("Location") : null;
    const ranDoPost = !!(loc && /script\.googleusercontent\.com/.test(loc));

    // Read Apps Script's real answer from the echo (GET, same UA, no body).
    let parsed = null, echoStatus = 0, echoText = "";
    try {
      const echo = loc ? await fetch(loc, { method: "GET", headers: FWD_HEADERS }) : resp;
      echoStatus = echo.status;
      echoText = await echo.text();
      try { parsed = JSON.parse(echoText); } catch (_) { parsed = null; }
    } catch (_) { parsed = null; }

    if (parsed && parsed.ok === true) return json({ ok: true });
    if (parsed && parsed.ok === false) return json({ ok: false, error: parsed.error || "delivery-failed", retryable: false });

    // Couldn't read the body, but the POST 302'd to Google's echo host → doPost has
    // already committed the row + email (its only rejectable condition, a bad shared
    // secret, is impossible here since the Worker owns it). Treat as delivered.
    if (ranDoPost) return json({ ok: true, note: "delivered-unconfirmed" });

    // No 302 and no JSON → Google blocked the first hop; doPost never ran → real failure.
    return json({
      ok: false, error: "delivery-failed", retryable: false,
      status: resp.status, echoStatus: echoStatus,
      detail: String(echoText || "").replace(/\s+/g, " ").slice(0, 200)
    });
  } catch (err) {
    // Captcha already spent — don't have the browser retry with the same token.
    return json({ ok: false, error: "delivery-failed", retryable: false, detail: String((err && err.message) || err) });
  }
}
