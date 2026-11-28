/* ============================================================================
   What the link shortener won't make: functions/_lib/urlshort-filter.js, and how
   functions/api/urlshort.js uses it. No network: Cloudflare's family resolver is
   answered here, in its own wire format.

     node --test "tests/*.test.mjs"
   ========================================================================== */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { endingRefused, codeRefused, linkRefused, dnsQuery, dnsAnswer, familyBlocks, dnsName } from "../functions/_lib/urlshort-filter.js";
import { onRequest } from "../functions/api/urlshort.js";

const b64url = bytes => Buffer.from(bytes).toString("base64url");

/* ---- endings ---- */

const REFUSED_ENDINGS = [
  "fuck", "fuck-off", "f-u-c-k", "fu-ck", "fuuuck", "motherfucker", "fcuk", "sh1t", "shit", "bullshit",
  "a55", "ass", "big-ass", "asses", "c0ck", "8008s", "cunt", "bitch", "b1tch", "wanker", "twat",
  "porn", "p0rn", "pornhub", "xxx", "sex", "s3x", "nsfw", "onlyfans", "rule34", "hentai", "xvideos",
  "nigger", "faggot", "retard", "kys",
  "bhenchod", "behen-chod", "chutiya", "madarchod", "bhosdike", "gandu", "lund", "bsdk", "mkc",
];
const ALLOWED_ENDINGS = [
  "resume", "cv", "phd-thesis", "data-gov-in", "class", "glass", "compass", "passport", "assam",
  "assignment", "assessment", "bass-guitar", "sussex", "essex", "middlesex", "sextant", "scunthorpe",
  "penistone", "analytics", "canal", "cocktail", "peacock", "hancock", "dickens", "dickinson",
  "therapist", "grape", "document", "cucumber", "cumulative", "hello", "shell", "title", "petition",
  "shiitake", "yamashita", "matsushita", "snigger", "niggardly", "nigeria", "arsenal", "scrap",
  "pissarro", "wankel", "fukuoka", "retardant", "pakistan", "chutney", "uganda", "gandhi",
  "the-pen-is-mightier", "slutsky", "bitcoin", "skunk", "xyz-123", "a1b2c3",
];

test("endings with a swear word, a slur or an adult term are refused", () => {
  for (const e of REFUSED_ENDINGS) assert.equal(endingRefused(e), true, e);
});

test("ordinary endings that only contain such letters pass", () => {
  for (const e of ALLOWED_ENDINGS) assert.equal(endingRefused(e), false, e);
});

/* ---- random codes ---- */

// As makeCode in functions/api/urlshort.js.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
function makeCode(seed) {
  const out = [];
  for (let round = 0; out.length < 6; round++) {
    const buf = createHash("sha256").update(seed + ":" + round).digest();
    for (let i = 0; i < buf.length && out.length < 6; i++) if (buf[i] < 248) out.push(ALPHABET[buf[i] % 31]);
  }
  return out.join("");
}

test("a random code that spells a word anywhere in it is refused", () => {
  for (const c of ["k4ssxy", "2fuckz", "x5exz9", "cumzz2", "zzporn", "8008sz"]) assert.equal(codeRefused(c), true, c);
  for (const c of ["abcdef", "k7m2pq", "zz9hj4", "nb3qwe"]) assert.equal(codeRefused(c), false, c);
  // Few are: drawing again is cheap.
  let n = 0;
  for (let i = 0; i < 20000; i++) if (codeRefused(makeCode("sample:" + i))) n++;
  assert.ok(n > 0 && n < 400, `${n} of 20,000 random codes refused`);
});

/* ---- long links ---- */

test("long links with a word in the host or path are refused; adult top-level domains too", () => {
  for (const s of ["https://example.com/fuck-this", "https://www.pornhub.com/view", "https://free-sex.example/",
    "https://f-u-c-k.example.com/", "https://www.reddit.com/r/nsfw/", "https://example.com/%66uck", "https://example.com/a/sh1t",
    // one escape that doesn't decode doesn't hide the others, before or after them
    "https://example.com/%66%75%63%6B%", "https://www.reddit.com/r/%6Esfw/%FF", "https://example.com/%E0%A4%A/f%75ck",
    "https://example.com/%zz/%66uck", "https://example.com/%70%6F%72%6E%FF",
    // an escape that isn't UTF-8 shows as typed, and its hex digits are letters too; as a gap,
    // it leaves a word on its own; and the raw path counts as well
    "https://example.com/%FAggot", "https://example.com/%BAstard", "https://example.com/%FFuck",
    "https://example.com/%FA%67%67ot", "https://example.com/%FFshit", "https://example.com/x%FFrape",
    "https://example.com/%DA%BAstard/%FF", "https://example.com/%B1tch", "https://example.com/kick-%A55",
    "https://example.com/%5Fuck/%FF", "https://example.com/%FA%67%67%6F%74"]) {
    assert.equal(linkRefused(new URL(s)), "blocked-words", s);
  }
  for (const s of ["https://anything.xxx/", "https://site.porn/x", "https://x.adult", "https://y.sex/", "https://z.XXX./"]) {
    assert.equal(linkRefused(new URL(s)), "blocked-site", s);
  }
  for (const s of ["https://www.scunthorpe-united.co.uk/", "https://www.sussex.ac.uk/", "https://analytics.google.com/",
    "https://en.wikipedia.org/wiki/Essex", "https://www.matsushita.co.jp/", "https://karan98.in/resume",
    "https://data.gov.in/", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.dickssportinggoods.com/",
    "https://example.com/%E0%A4%A", // a broken escape is read as sent
    "https://example.com/caf%E9/class%2Fnotes", "https://example.com/%F0%9F%91%8D%E2%80%8D/glass", // Latin-1, an emoji
    "https://example.com/%2566uck", // decoded once, as a server does: "%66uck"
    "https://example.com/%5Ex", "https://example.com/hello%20world", // a path that decodes is read decoded: "^x"
    "https://example.com/the%E2%80%8Bpen%E2%80%8Bis-mightier", // words apart, as with hyphens
    "https://example.com/?q=porn"]) { // the query isn't read: mostly ids and tracking
    assert.equal(linkRefused(new URL(s)), "", s);
  }
});

/* ---- the family resolver, in DNS wire format ---- */

test("the DNS query is RFC 8484's own example for www.example.com", () => {
  assert.equal(b64url(dnsQuery("www.example.com")), "AAABAAABAAAAAAAAA3d3dwdleGFtcGxlA2NvbQAAAQAB");
  assert.throws(() => dnsQuery("bad..name"));
  assert.throws(() => dnsQuery("x".repeat(64) + ".com"));
});

// An answer as a resolver sends it: the question again, then CNAMEs and A records.
function answer(name, { a = [], cname = null, rcode = 0 } = {}) {
  const q = Buffer.from(dnsQuery(name)).subarray(12);
  const records = [];
  if (cname) {
    const target = Buffer.from(dnsQuery(cname)).subarray(12, -4);
    records.push(Buffer.concat([Buffer.from([0xc0, 12, 0, 5, 0, 1, 0, 0, 1, 44, 0, target.length]), target]));
  }
  for (const ip of a) records.push(Buffer.from([0xc0, 12, 0, 1, 0, 1, 0, 0, 1, 44, 0, 4, ...ip.split(".").map(Number)]));
  const head = Buffer.from([0, 0, 0x81, 0x80 | rcode, 0, 1, 0, records.length, 0, 0, 0, 0]);
  return Buffer.concat([head, q, ...records]);
}

test("DNS answers are read: blocked (0.0.0.0), through a CNAME, not found", () => {
  assert.deepEqual(dnsAnswer(answer("bad.example", { a: ["0.0.0.0"] })), { rcode: 0, a: ["0.0.0.0"] });
  assert.deepEqual(dnsAnswer(answer("www.example.com", { cname: "edge.example.net", a: ["93.184.215.14"] })), { rcode: 0, a: ["93.184.215.14"] });
  assert.deepEqual(dnsAnswer(answer("nope.example", { rcode: 3 })), { rcode: 3, a: [] });
  assert.throws(() => dnsAnswer(answer("bad.example", { a: ["0.0.0.0"] }).subarray(0, 40)));
});

function resolver(table) {
  const asked = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    asked.push({ url: u, accept: init.headers.Accept });
    const q = Buffer.from(u.searchParams.get("dns"), "base64url");
    const labels = [];
    for (let p = 12; q[p]; p += q[p] + 1) labels.push(q.subarray(p + 1, p + 1 + q[p]).toString());
    const name = labels.join(".");
    const r = table[name];
    if (r === "down") return new Response("oops", { status: 502 });
    return new Response(answer(name, r || { a: ["192.0.2.10"] }), { headers: { "Content-Type": "application/dns-message" } });
  };
  return { fetchImpl, asked };
}

test("familyBlocks asks Cloudflare's family resolver and believes only 0.0.0.0", async () => {
  const r = resolver({ "bad.example": { a: ["0.0.0.0"] }, "nope.example": { rcode: 3 }, "down.example": "down" });
  assert.equal(await familyBlocks("bad.example", r.fetchImpl), true);
  assert.equal(await familyBlocks("BAD.example.", r.fetchImpl), true);
  assert.equal(await familyBlocks("good.example", r.fetchImpl), false);
  assert.equal(await familyBlocks("nope.example", r.fetchImpl), false);
  await assert.rejects(familyBlocks("down.example", r.fetchImpl));
  const n = r.asked.length;
  assert.equal(await familyBlocks("192.0.2.7", r.fetchImpl), false);
  assert.equal(await familyBlocks("[2001:db8::1]", r.fetchImpl), false);
  assert.equal(r.asked.length, n, "an IP address isn't looked up");
  assert.equal(r.asked[0].url.origin + r.asked[0].url.pathname, "https://family.cloudflare-dns.com/dns-query");
  assert.equal(r.asked[0].accept, "application/dns-message");
});

/* ---- the API: functions/api/urlshort.js with the filter in place ---- */

const KEY = "test-only-owner-key";
let kv, events, waits, doh, realFetch;

beforeEach(() => {
  const m = new Map();
  kv = {
    m,
    async getWithMetadata(k) { const r = m.get(k); return r ? { value: r.value, metadata: r.metadata } : { value: null, metadata: null }; },
    async put(k, value, opts) { m.set(k, { value, metadata: (opts && opts.metadata) || null }); },
    async delete(k) { m.delete(k); },
  };
  events = []; waits = [];
  doh = resolver({ "flagged.example": { a: ["0.0.0.0"] }, "down.example": "down" });
  realFetch = globalThis.fetch;
  globalThis.fetch = doh.fetchImpl;
});
afterEach(() => { globalThis.fetch = realFetch; });

// A D1 stand-in that keeps what the log writes.
const db = {
  prepare(sql) { return { sql, bind: (...args) => ({ sql, args }) }; },
  async batch(stmts) { const ins = stmts.find(s => /^INSERT/.test(s.sql)); if (ins) events.push(ins.args); },
};

async function make(body) {
  const request = new Request("https://karan98.in/api/urlshort", {
    method: "POST", headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const res = await onRequest({ request, env: { URLSHORT: kv, URLSHORT_KEY: KEY, URLSHORT_DB: db }, waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  return { status: res.status, body: await res.json() };
}

test("the API refuses a rude ending, a rude link and an adult site, stores nothing, and logs who tried", async () => {
  assert.deepEqual(await make({ url: "https://example.com/", slug: "f-u-c-k" }), { status: 400, body: { ok: false, error: "blocked-slug" } });
  assert.deepEqual(await make({ url: "https://example.com/bullshit" }), { status: 400, body: { ok: false, error: "blocked-words" } });
  assert.deepEqual(await make({ url: "https://girls.xxx/" }), { status: 400, body: { ok: false, error: "blocked-site" } });
  assert.deepEqual(await make({ url: "https://flagged.example/page", slug: "my-page" }), { status: 400, body: { ok: false, error: "blocked-site" } });
  assert.equal(kv.m.size, 0);
  // [t, kind, code, url, result, expires, actor, ...]: the log's column order
  assert.deepEqual(events.map(e => [e[1], e[2], e[3], e[4], e[6]]), [
    ["denied", "f-u-c-k", "https://example.com/", "blocked-slug", "owner"],
    ["denied", "", "https://example.com/bullshit", "blocked-words", "owner"],
    ["denied", "", "https://girls.xxx/", "blocked-site", "owner"],
    ["denied", "my-page", "https://flagged.example/page", "blocked-site", "owner"],
  ]);
});

test("the API makes nothing when the resolver can't be asked", async () => {
  assert.deepEqual(await make({ url: "https://down.example/", slug: "fine-ending" }), { status: 503, body: { ok: false, error: "check-failed" } });
  assert.equal(kv.m.size, 0);
});

test("a host no DNS name can be is a bad URL, not a resolver outage, and nobody is asked", async () => {
  const NOT_NAMES = ["www..example.com", "a*b.example.com", "exa!mple.com", "a".repeat(64) + ".com", "x." + "abcdefghi.".repeat(26) + "com"];
  for (const h of NOT_NAMES) {
    assert.equal(dnsName(h), false, h);
    assert.deepEqual(await make({ url: "https://" + h + "/page" }), { status: 400, body: { ok: false, error: "bad-url" } }, h);
  }
  assert.equal(doh.asked.length, 0);
  assert.equal(kv.m.size, 0);
  // still names: a trailing dot, an underscore, digits, and an international name as URL parsing writes it
  for (const h of ["example.com.", "ex_ample.com", "192.0.2.7", "xn--bcher-kva.example", "a".repeat(63) + ".com"]) assert.equal(dnsName(h), true, h);
  assert.equal((await make({ url: "https://bücher.example/" })).status, 200);
  assert.equal((await make({ url: "https://ex_ample.com/" })).status, 200);
  assert.equal((await make({ url: "https://[2001:db8::1]/" })).status, 200);
});

test("the API makes an ordinary link, after asking about its host", async () => {
  const r = await make({ url: "https://www.sussex.ac.uk/study", slug: "sussex-uni" });
  assert.equal(r.status, 200);
  assert.equal(r.body.code, "sussex-uni");
  assert.equal(kv.m.get("s:sussex-uni").value, "https://www.sussex.ac.uk/study");
  assert.deepEqual(doh.asked.map(a => Buffer.from(a.url.searchParams.get("dns"), "base64url").equals(Buffer.from(dnsQuery("www.sussex.ac.uk")))), [true]);
});

test("a random code that spells a word is skipped, the same way on a retry", async () => {
  // a request id whose first code is refused
  let rid = "";
  for (let i = 0; !rid; i++) {
    const r = "test-rid-" + String(i).padStart(8, "0");
    if (codeRefused(makeCode("rid:" + r + ":0")) && !codeRefused(makeCode("rid:" + r + ":1"))) rid = r;
  }
  const first = await make({ url: "https://example.com/a", rid });
  assert.equal(first.status, 200);
  assert.equal(first.body.code, makeCode("rid:" + rid + ":1"));
  const again = await make({ url: "https://example.com/a", rid }); // the answer was lost: try again
  assert.equal(again.body.code, first.body.code);
  assert.equal(kv.m.size, 1);
});
