/* ============================================================================
   Cloudflare Pages Function — POST /api/contact

   Google blocks Cloudflare's Worker egress IPs from POSTing to an Apps Script web
   app (a 401 sign-in page, regardless of headers), so the Function can't deliver
   the message itself. Instead it does the parts only a server can:
     1. RSA-decrypts the browser's { enc } payload with the private key,
     2. enriches it with IP / geo / ISP derived SERVER-SIDE from `request.cf`
        (so the browser never gathers geo and makes no third-party lookup),
     3. hands the enriched payload back to the browser as an OBFUSCATED blob.
   The BROWSER then relays that blob to Apps Script (which it *can* reach). The
   Turnstile token is left untouched here and verified by Apps Script, so it stays
   single-use.

   Env (Cloudflare Pages → Settings → Environment variables):
     PRIVATE_KEY   RSA-OAEP private key, PKCS8 base64 (pairs with data.js publicKey)
   (TURNSTILE_SECRET / APPS_SCRIPT_URL / SHARED_SECRET are no longer used.)
   ========================================================================== */

// Must match OBF_KEY in assets/js/app.js and Code.gs — the browser relays this blob
// to Apps Script, which de-obfuscates it with the same key.
const OBF_KEY = "7Qp2xL9vRt4Ke1Zc8Nb3Ym6Wd5Hs0Ja";

const JSON_HEADERS = { "Content-Type": "application/json" };
function json(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }

function b64ToBytes(b64) {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// XOR-then-base64, identical to app.js obfuscate() and reversible by Code.gs deob().
function obfuscate(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ^ (OBF_KEY.charCodeAt(i % OBF_KEY.length) & 0xff));
  return btoa(bin);
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
    if (!body || !body.enc || !body.enc.k) return json({ ok: false, error: "bad-request" });
    inner = await hybridDecrypt(body.enc, env.PRIVATE_KEY);
  } catch (err) {
    return json({ ok: false, error: "decrypt-failed" });
  }

  const token = inner.token || "";
  const fields = inner.fields || {};
  const clientMeta = inner.meta || {};

  if (!fields.name || !fields.email || !fields.subject || !fields.message) {
    return json({ ok: false, error: "missing-fields" });
  }

  // Server-derived signals from Cloudflare's edge — never gathered by the browser.
  const cf = request.cf || {};
  const ua = request.headers.get("User-Agent") || "";
  const p = uaParse(ua);
  const meta = Object.assign({}, clientMeta, {
    ip: request.headers.get("CF-Connecting-IP") || "",
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

  // Hand the enriched payload back to the browser as an obfuscated blob; the browser
  // relays it to Apps Script (which the Worker's own IP can't reach). Apps Script
  // verifies the (untouched, single-use) Turnstile token from inside the blob.
  const relay = obfuscate(JSON.stringify({ token: token, fields: fields, meta: meta }));
  return json({ ok: true, relay: relay });
}
