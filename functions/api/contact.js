/* ============================================================================
   Cloudflare Pages Function — POST /api/contact

   Google blocks Cloudflare's Worker egress IPs from POSTing to an Apps Script web
   app (a 401 sign-in page, regardless of headers), so the Function can't deliver
   the message itself. Instead it does the parts only a server can:
     1. RSA-decrypts the browser's { enc } payload with the private key,
     2. enriches it with IP / geo / ISP derived SERVER-SIDE from `request.cf`
        (so the browser never gathers geo and makes no third-party lookup),
     3. hands the enriched payload back to the browser SEALED: encrypted and
        authenticated with keys derived from RELAY_SECRET, which only this Function
        and the Apps Script hold. The browser carries it but can't read or alter it.
   The BROWSER then relays that blob to Apps Script (which it *can* reach). The
   Turnstile token is left untouched here and verified by Apps Script, so it stays
   single-use.

   Env (Cloudflare Pages → Settings → Variables and Secrets):
     PRIVATE_KEY   RSA-OAEP private key, PKCS8 base64 (pairs with data.js publicKey)
     RELAY_SECRET  a secret equal to the Apps Script property RELAY_SECRET; never in the
                   page. Until it is set, the Function sends the older obfuscated relay,
                   which anyone can decode with OBF_KEY from app.js. Set it only after
                   Code.gs takes { sealed } (CONTACT_FORM_SETUP.md, "Sealed relay").
   (TURNSTILE_SECRET / APPS_SCRIPT_URL / SHARED_SECRET are no longer used.)
   ========================================================================== */

// The older relay, sent until RELAY_SECRET is set. Must match OBF_KEY in
// assets/js/app.js and Code.gs, which de-obfuscates it with the same key.
const OBF_KEY = "7Qp2xL9vRt4Ke1Zc8Nb3Ym6Wd5Hs0Ja";

const JSON_HEADERS = { "Content-Type": "application/json" };
function json(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: JSON_HEADERS }); }

function b64ToBytes(b64) {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function bytesToB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// XOR-then-base64, identical to app.js obfuscate() and reversible by Code.gs deob().
function obfuscate(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ^ (OBF_KEY.charCodeAt(i % OBF_KEY.length) & 0xff));
  return btoa(bin);
}

/* ---- the sealed relay ----------------------------------------------------------
   Apps Script has HMAC-SHA256 but no AES or RSA, so the cipher is built from HMAC;
   Code.gs openSealed() is the other half.
     prk        = HKDF-Extract(salt RELAY_SALT, RELAY_SECRET)               (SHA-256)
     kEnc, kMac = HKDF-Expand(prk, "v1 enc", 32), HKDF-Expand(prk, "v1 mac", 32)
     block i    = HMAC(kEnc, nonce ‖ i as 4 bytes, big-endian)   (the keystream)
     ciphertext = UTF-8 JSON XOR block 0 ‖ block 1 ‖ …
     tag        = HMAC(kMac, 0x01 ‖ nonce ‖ ciphertext)          (encrypt-then-MAC)
     sealed     = base64(0x01 ‖ nonce ‖ ciphertext ‖ tag), nonce = 16 random bytes */
const RELAY_VERSION = 1;
const RELAY_SALT = "karan98.in contact relay";
const NONCE_BYTES = 16;

async function relayKeys(secret) {
  const utf8 = new TextEncoder();
  const ikm = await crypto.subtle.importKey("raw", utf8.encode(secret), "HKDF", false, ["deriveBits"]);
  async function hmacKey(info) {
    const raw = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: utf8.encode(RELAY_SALT), info: utf8.encode(info) }, ikm, 256);
    return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  return { enc: await hmacKey("v1 enc"), mac: await hmacKey("v1 mac") };
}

async function seal(str, secret) {
  const keys = await relayKeys(secret);
  const pt = new TextEncoder().encode(str);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const start = 1 + NONCE_BYTES; // where the ciphertext starts
  const out = new Uint8Array(start + pt.length + 32);
  out[0] = RELAY_VERSION;
  out.set(nonce, 1);
  const counter = new Uint8Array(NONCE_BYTES + 4);
  counter.set(nonce);
  for (let i = 0, at = 0; at < pt.length; i++) {
    new DataView(counter.buffer).setUint32(NONCE_BYTES, i); // big-endian
    const block = new Uint8Array(await crypto.subtle.sign("HMAC", keys.enc, counter));
    for (let j = 0; j < block.length && at < pt.length; j++, at++) out[start + at] = pt[at] ^ block[j];
  }
  const signed = out.subarray(0, start + pt.length);
  out.set(new Uint8Array(await crypto.subtle.sign("HMAC", keys.mac, signed)), signed.length);
  return bytesToB64(out);
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

  // Hand the enriched payload back to the browser sealed; the browser relays it to
  // Apps Script (which the Worker's own IP can't reach). Apps Script verifies the
  // (untouched, single-use) Turnstile token from inside the blob.
  const payload = JSON.stringify({ token: token, fields: fields, meta: meta });
  const secret = String(env.RELAY_SECRET || "").trim();
  if (!secret) return json({ ok: true, relay: obfuscate(payload) }); // the older relay, until it's set
  try {
    return json({ ok: true, sealed: await seal(payload, secret) });
  } catch (err) {
    return json({ ok: false, error: "seal-failed" }); // the browser falls back to its own path
  }
}
