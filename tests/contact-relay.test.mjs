/* ============================================================================
   The contact form's relay: functions/api/contact.js seals the record it enriched,
   the browser carries it, and functions/apps-script/Code.gs opens it.

   Runs the real Function and the real Code.gs (in tests/helpers/apps-script.mjs).
   No network, no real keys: the RSA pair and RELAY_SECRET are made for each run.

     node --test tests/
   ========================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, hkdfSync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { onRequestPost } from "../functions/api/contact.js";
import { loadCodeGs } from "./helpers/apps-script.mjs";

const { subtle } = globalThis.crypto;
const b64 = buf => Buffer.from(buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf).toString("base64");
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

// The page's own key for the older relay and the fallback, read from the page itself.
const APP_JS = read("../assets/js/app.js");
const OBF_KEY = /var OBF_KEY = "([^"]+)"/.exec(APP_JS)[1];

const pair = await subtle.generateKey(
  { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["encrypt", "decrypt"]);
const PUBLIC_KEY = b64(await subtle.exportKey("spki", pair.publicKey));
const PRIVATE_KEY = b64(await subtle.exportKey("pkcs8", pair.privateKey));
const SECRET = "test-only-" + randomBytes(32).toString("hex");

// What Cloudflare knows about the sender (documentation addresses and ASN only).
const CF = {
  country: "IN", city: "New Delhi", region: "Delhi", postalCode: "110001",
  latitude: "28.63080", longitude: "77.21680", asOrganization: "Example Broadband Ltd", asn: 64500,
  colo: "DEL", httpProtocol: "HTTP/2", tlsVersion: "TLSv1.3", timezone: "Asia/Kolkata",
};
const HEADERS = {
  "CF-Connecting-IP": "203.0.113.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9",
  Referer: "https://karan98.in/",
};
// The server-collected values that must not be readable in the Network tab.
const SERVER_ONLY = ["203.0.113.7", "New Delhi", "110001", "28.63080", "77.21680", "Example Broadband Ltd", "AS64500"];

const FIELDS = {
  name: "Asha Rao", email: "asha@example.org", subject: "Hello from the tests", org: "Example Org",
  message: "A message with ünïcödé, नमस्ते and an emoji 🌳, long enough to send.",
};
const META = {
  submittedAt: "2026-11-27T10:00:00.000Z", browser: "Chrome 131.0", platform: "Windows 10/11",
  otpStatus: "not-attempted", otpFlow: "fm3x9q2abcd", pageUrl: "https://karan98.in/#contact",
  userAgent: HEADERS["User-Agent"], screen: "1920x1080",
};
const PROPS = { TURNSTILE_SECRET: "test-turnstile-secret", RECIPIENT: "owner@example.com", RELAY_SECRET: SECRET };

// As hybridEncrypt in assets/js/app.js.
async function hybridEncrypt(plaintext, spkiB64) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const aes = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(plaintext));
  const pub = await subtle.importKey("spki", Buffer.from(spkiB64, "base64"), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const k = await subtle.encrypt({ name: "RSA-OAEP" }, pub, await subtle.exportKey("raw", aes));
  return { k: b64(k), iv: b64(iv), ct: b64(ct) };
}

// The browser's POST /api/contact, answered by the Function. Returns the answer's text,
// exactly what the Network tab shows, and its JSON.
async function viaFunction(env, { token = "tok-ok", fields = FIELDS, meta = META } = {}) {
  const enc = await hybridEncrypt(JSON.stringify({ token, fields, meta }), PUBLIC_KEY);
  const request = new Request("https://karan98.in/api/contact", {
    method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, HEADERS), body: JSON.stringify({ enc }),
  });
  Object.defineProperty(request, "cf", { value: CF });
  const res = await onRequestPost({ request, env: Object.assign({ PRIVATE_KEY }, env) });
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) };
}

// What the browser posts to the Apps Script for the Function's answer (as assets/js/app.js).
function relayBody(j) {
  if (!j || !j.ok) return null;
  return j.sealed ? { sealed: j.sealed } : j.relay ? { obf: j.relay } : null;
}

function xorDecode(b64text, key) {
  const bytes = Buffer.from(b64text, "base64");
  return Buffer.from(bytes.map((b, i) => b ^ (key.charCodeAt(i % key.length) & 0xff))).toString("utf8");
}

// The format as CONTACT_FORM_SETUP.md describes it, written again from the description
// with Node's own HKDF and HMAC, so a mistake on both sides of the real code shows up.
function refKeys(secret) {
  const k = info => Buffer.from(hkdfSync("sha256", secret.trim(), "karan98.in contact relay", info, 32));
  return { enc: k("v1 enc"), mac: k("v1 mac") };
}
function keystream(kEnc, nonce, length) {
  const out = Buffer.alloc(length);
  for (let i = 0; i * 32 < length; i++) {
    const n = Buffer.alloc(4);
    n.writeUInt32BE(i);
    createHmac("sha256", kEnc).update(Buffer.concat([nonce, n])).digest().copy(out, i * 32);
  }
  return out;
}
function refSeal(plaintext, secret, nonce = randomBytes(16)) {
  const { enc, mac } = refKeys(secret);
  const pt = Buffer.from(plaintext, "utf8"), ks = keystream(enc, nonce, pt.length);
  const head = Buffer.concat([Buffer.from([1]), nonce, Buffer.from(pt.map((b, i) => b ^ ks[i]))]);
  return Buffer.concat([head, createHmac("sha256", mac).update(head).digest()]).toString("base64");
}
function refOpen(sealed, secret, { checkTag = true } = {}) {
  const { enc, mac } = refKeys(secret);
  const blob = Buffer.from(sealed, "base64");
  const head = blob.subarray(0, blob.length - 32), tag = blob.subarray(blob.length - 32);
  if (checkTag && !timingSafeEqual(createHmac("sha256", mac).update(head).digest(), tag)) return null;
  const ct = head.subarray(17), ks = keystream(enc, head.subarray(1, 17), ct.length);
  return Buffer.from(ct.map((b, i) => b ^ ks[i])).toString("utf8");
}

test("round trip: the Function seals, Code.gs opens it, and writes the row and the email", async () => {
  const fn = await viaFunction({ RELAY_SECRET: SECRET });
  assert.equal(fn.status, 200);
  assert.equal(fn.json.ok, true);
  assert.equal(typeof fn.json.sealed, "string");
  assert.equal("relay" in fn.json, false, "no readable relay alongside the sealed one");

  const gs = loadCodeGs({ props: PROPS });
  assert.deepEqual(gs.post(relayBody(fn.json)), { ok: true });

  const [row] = gs.records();
  assert.equal(gs.records().length, 1);
  assert.equal(row["Name"], FIELDS.name);
  assert.equal(row["Email"], FIELDS.email);
  assert.equal(row["Message"], FIELDS.message);
  assert.equal(row["IP"], "203.0.113.7");
  assert.equal(row["City"], "New Delhi");
  assert.equal(row["State"], "Delhi");
  assert.equal(row["Postal"], "110001");
  assert.equal(row["Latitude"], "28.63080");
  assert.equal(row["Longitude"], "77.21680");
  assert.equal(row["ISP"], "Example Broadband Ltd");
  assert.equal(row["ASN"], "AS64500");
  assert.equal(row["CF colo"], "DEL");
  assert.equal(row["TLS version"], "TLSv1.3");
  assert.equal(row["Email verified"], "Not verified");

  const [mail] = gs.messageMails();
  assert.equal(gs.mails.length, 1);
  assert.equal(mail.to, "owner@example.com");
  assert.equal(mail.replyTo, FIELDS.email);
  assert.equal(mail.subject, "New message: " + FIELDS.subject);
  for (const v of ["203.0.113.7", "New Delhi", "Example Broadband Ltd"]) assert.ok(mail.htmlBody.includes(v), v);

  // The Turnstile token came through the relay untouched and was checked, once.
  assert.equal(gs.fetches.length, 1);
  assert.equal(gs.fetches[0].opts.payload.response, "tok-ok");
  assert.equal(gs.fetches[0].opts.payload.remoteip, "203.0.113.7");
});

test("round trip: a long message (more than 256 keystream blocks) arrives whole", async () => {
  const message = "🌳".repeat(2500) + " — the end";          // 10,000+ bytes of UTF-8
  const fn = await viaFunction({ RELAY_SECRET: SECRET }, { fields: Object.assign({}, FIELDS, { message }) });
  const gs = loadCodeGs({ props: PROPS });
  assert.deepEqual(gs.post(relayBody(fn.json)), { ok: true });
  assert.equal(gs.records()[0]["Message"], message);
});

test("a sealed relay still needs a good Turnstile token", async () => {
  const fn = await viaFunction({ RELAY_SECRET: SECRET }, { token: "tok-reused" });
  const gs = loadCodeGs({ props: PROPS });
  const res = gs.post(relayBody(fn.json));
  assert.equal(res.ok, false);
  assert.equal(res.error, "failed-captcha");
  assert.equal(gs.rows.length, 0);
  assert.equal(gs.mails.length, 0);
});

test("the /api/contact answer can't be read with anything found in the page", async () => {
  const fn = await viaFunction({ RELAY_SECRET: SECRET });
  for (const v of SERVER_ONLY) assert.ok(!fn.text.includes(v), `answer shows ${v}`);
  assert.ok(!Buffer.from(fn.json.sealed, "base64").toString("latin1").includes("203.0.113.7"));

  // Every string literal in the contact page's scripts, tried as an XOR key (OBF_KEY among them).
  const literals = new Set();
  for (const src of [APP_JS, read("../assets/js/data.js")]) {
    for (const m of src.matchAll(/"([^"\\\n]{8,})"|'([^'\\\n]{8,})'/g)) literals.add(m[1] || m[2]);
  }
  assert.ok(literals.has(OBF_KEY));
  for (const key of literals) {
    const text = xorDecode(fn.json.sealed, key);
    for (const v of SERVER_ONLY) assert.ok(!text.includes(v), `XOR with ${JSON.stringify(key.slice(0, 20))} shows ${v}`);
  }

  // The control: the older relay is readable with OBF_KEY, which is what this change ends.
  const old = await viaFunction({});
  assert.ok(xorDecode(old.json.relay, OBF_KEY).includes("203.0.113.7"));
});

test("a tampered sealed relay is refused before anything is read, checked or stored", async () => {
  const fn = await viaFunction({ RELAY_SECRET: SECRET });
  const good = Buffer.from(fn.json.sealed, "base64");
  const n = good.length;
  const flip = (i, bit = 1) => { const b = Buffer.from(good); b[i] ^= bit; return b.toString("base64"); };
  const cases = {
    "version byte": flip(0, 3),
    "first nonce byte": flip(1),
    "last nonce byte": flip(16, 0x80),
    "first ciphertext byte": flip(17),
    "a middle ciphertext byte": flip(17 + ((n - 49) >> 1), 0x10),
    "last ciphertext byte": flip(n - 33),
    "first tag byte": flip(n - 32),
    "last tag byte": flip(n - 1, 0x80),
    "one byte short": good.subarray(0, n - 1).toString("base64"),
    "one byte long": Buffer.concat([good, Buffer.from([0])]).toString("base64"),
    "tag removed": good.subarray(0, n - 32).toString("base64"),
    "only a header": good.subarray(0, 17).toString("base64"),
    "empty": "",
    "not base64": "%%%not-base64%%%",
    "a number": 12345,
    "an object": { k: "x" },
  };

  // The point of the tag: without it, flipping ciphertext bits would change the email
  // address to one the attacker picked, without knowing the key.
  const plain = refOpen(fn.json.sealed, SECRET);
  const at = 17 + Buffer.from(plain.slice(0, plain.indexOf(FIELDS.email)), "utf8").length;
  const forged = Buffer.from(good);
  Buffer.from(FIELDS.email).forEach((c, i) => { forged[at + i] ^= c ^ "asha@exomple.org".charCodeAt(i); });
  assert.ok(refOpen(forged.toString("base64"), SECRET, { checkTag: false }).includes("asha@exomple.org"));
  cases["the email address rewritten"] = forged.toString("base64");

  for (const [what, sealed] of Object.entries(cases)) {
    const gs = loadCodeGs({ props: PROPS });
    assert.deepEqual(gs.post({ sealed }), { ok: false, error: "bad-seal" }, what);
    assert.equal(gs.rows.length, 0, what + ": no row");
    assert.equal(gs.messageMails().length, 0, what + ": no message email");
    assert.equal(gs.fetches.length, 0, what + ": Turnstile not even asked");
  }
});

test("a relay sealed with another secret, or arriving before RELAY_SECRET is set, is refused", async () => {
  const fn = await viaFunction({ RELAY_SECRET: SECRET });
  for (const props of [
    Object.assign({}, PROPS, { RELAY_SECRET: "test-only-" + randomBytes(32).toString("hex") }),
    Object.assign({}, PROPS, { RELAY_SECRET: "" }),
    { TURNSTILE_SECRET: "x", RECIPIENT: "owner@example.com" },
  ]) {
    const gs = loadCodeGs({ props });
    assert.deepEqual(gs.post(relayBody(fn.json)), { ok: false, error: "bad-seal" });
    assert.equal(gs.rows.length, 0);
  }
});

test("a relay that doesn't open tells the owner once, not for every one", async () => {
  const fn = await viaFunction({ RELAY_SECRET: SECRET });
  const gs = loadCodeGs({ props: { TURNSTILE_SECRET: "x", RECIPIENT: "owner@example.com" } }); // no RELAY_SECRET yet
  gs.post(relayBody(fn.json));
  gs.post(relayBody(fn.json));
  gs.post({ sealed: "junk" });
  assert.equal(gs.mails.length, 1);
  const [alert] = gs.mails;
  assert.equal(alert.to, "owner@example.com");
  assert.match(alert.subject, /could not be opened/);
  assert.match(alert.body, /no RELAY_SECRET/);
  for (const v of [FIELDS.name, FIELDS.email, ...SERVER_ONLY]) assert.ok(!alert.body.includes(v), "alert shows " + v);
  assert.ok(gs.logs.some(l => l.level === "error"));

  // Once the property is set, the next message goes through as usual.
  gs.store.RELAY_SECRET = SECRET;
  const next = await viaFunction({ RELAY_SECRET: SECRET });
  assert.deepEqual(gs.post(relayBody(next.json)), { ok: true });
  assert.equal(gs.messageMails().length, 1);
});

test("rollout: without RELAY_SECRET the Function still sends the older relay, which Code.gs takes", async () => {
  const fn = await viaFunction({});
  assert.equal(fn.json.ok, true);
  assert.equal(typeof fn.json.relay, "string");
  assert.equal("sealed" in fn.json, false);
  const gs = loadCodeGs({ props: PROPS });
  assert.deepEqual(gs.post(relayBody(fn.json)), { ok: true });
  assert.equal(gs.records()[0]["IP"], "203.0.113.7");
});

test("rollout: an { obf } made as before this change (and as the GitHub Pages fallback makes it) is taken", () => {
  // Written out again, not imported: XOR with OBF_KEY, then base64.
  const payload = JSON.stringify({ token: "tok-ok", fields: FIELDS, meta: Object.assign({}, META, { ip: "198.51.100.9", city: "Patiala" }) });
  const bytes = Buffer.from(payload, "utf8");
  const obf = Buffer.from(bytes.map((b, i) => b ^ (OBF_KEY.charCodeAt(i % OBF_KEY.length) & 0xff))).toString("base64");
  for (const props of [PROPS, { TURNSTILE_SECRET: "x", RECIPIENT: "owner@example.com" }]) {
    const gs = loadCodeGs({ props });
    assert.deepEqual(gs.post({ obf }), { ok: true });
    assert.equal(gs.records()[0]["City"], "Patiala");
  }
});

test("the sealed and the older relay write the same Sheet row and send the same email", async () => {
  const sealed = loadCodeGs({ props: PROPS }), older = loadCodeGs({ props: PROPS });
  assert.deepEqual(sealed.post(relayBody((await viaFunction({ RELAY_SECRET: SECRET })).json)), { ok: true });
  assert.deepEqual(older.post(relayBody((await viaFunction({})).json)), { ok: true });
  assert.deepEqual(sealed.rows, older.rows);
  assert.deepEqual(sealed.mails, older.mails);
});

test("rotation: RELAY_SECRET_PREVIOUS opens relays sealed with the old secret until it is removed", async () => {
  const OLD = SECRET, NEW = "test-only-" + randomBytes(32).toString("hex");
  const fromOld = (await viaFunction({ RELAY_SECRET: OLD })).json, fromNew = (await viaFunction({ RELAY_SECRET: NEW })).json;
  const during = Object.assign({}, PROPS, { RELAY_SECRET: NEW, RELAY_SECRET_PREVIOUS: OLD });
  assert.deepEqual(loadCodeGs({ props: during }).post(relayBody(fromOld)), { ok: true });
  assert.deepEqual(loadCodeGs({ props: during }).post(relayBody(fromNew)), { ok: true });
  const after = Object.assign({}, PROPS, { RELAY_SECRET: NEW });
  assert.deepEqual(loadCodeGs({ props: after }).post(relayBody(fromOld)), { ok: false, error: "bad-seal" });
  assert.deepEqual(loadCodeGs({ props: after }).post(relayBody(fromNew)), { ok: true });
});

test("a secret pasted with spaces or a newline around it still matches", async () => {
  const fn = await viaFunction({ RELAY_SECRET: SECRET + "\n" });
  const gs = loadCodeGs({ props: Object.assign({}, PROPS, { RELAY_SECRET: "  " + SECRET + " " }) });
  assert.deepEqual(gs.post(relayBody(fn.json)), { ok: true });
});

test("the format is the one CONTACT_FORM_SETUP.md describes", async () => {
  const fn = await viaFunction({ RELAY_SECRET: SECRET });
  const blob = Buffer.from(fn.json.sealed, "base64");
  const plain = refOpen(fn.json.sealed, SECRET);
  assert.ok(plain, "the tag checks out");
  const inner = JSON.parse(plain);
  assert.deepEqual(inner.fields, FIELDS);
  assert.equal(inner.token, "tok-ok");
  assert.equal(inner.meta.ip, "203.0.113.7");
  assert.equal(blob[0], 1);
  assert.equal(blob.length, 1 + 16 + Buffer.byteLength(plain, "utf8") + 32);

  // Code.gs opens what the description alone produces.
  const gs = loadCodeGs({ props: PROPS });
  assert.deepEqual(gs.post({ sealed: refSeal(plain, SECRET) }), { ok: true });
  assert.equal(gs.records()[0]["ISP"], "Example Broadband Ltd");

  // A fresh nonce every time: the same message never seals the same way twice.
  const again = Buffer.from((await viaFunction({ RELAY_SECRET: SECRET })).json.sealed, "base64");
  assert.notDeepEqual(again.subarray(1, 17), blob.subarray(1, 17));
});
