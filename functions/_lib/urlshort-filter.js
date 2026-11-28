/* ============================================================================
   What the link shortener won't make (used by functions/api/urlshort.js). It
   exports no onRequest handler, so Pages gives it no address of its own.

   Refused:
     - an ending (karan98.in/s/<ending>) with a swear word, a slur or an adult term
       in it; and a random code that happens to spell one is drawn again;
     - a long link with one in its host name or path ("blocked-words");
     - a long link to an adult site ("blocked-site"): the adult top-level domains, and
       whatever Cloudflare's family resolver (1.1.1.3, "1.1.1.1 for Families") blocks
       as adult content or malware. It answers 0.0.0.0 for those.

   No list is complete. Short words that hide inside ordinary ones (ass in "class",
   sex in "Sussex", cum in "document") count only as a word of their own, between
   hyphens, dots or slashes: "class" and "sussex" pass, "big-ass" doesn't. Longer
   ones count anywhere ("motherfucker"), except inside the real words in INNOCENT.
   Digits standing in for letters ("a55", "sh1t") are read as letters, letters
   typed twice ("fuuuck") as once, and spelled-out letters ("f-u-c-k") as a word.
   tests/urlshort-filter.test.mjs holds words that must pass and must not: add a
   case there when you change a list.
   ========================================================================== */

import { b64url } from "./urlshort.js";

// Counted anywhere, even inside a longer word.
const ANYWHERE = [
  // English
  "fuck", "fcuk", "phuck", "cunt", "bitch", "whore", "slut", "bastard", "twat", "wanker",
  "bollocks", "asshole", "arsehole", "dumbass", "fatass", "dickhead", "cocksucker", "goddamn",
  "bullshit", "shithead", "shitty", "dipshit", "horseshit", "batshit", "apeshit", "shitshow",
  "shitface", "shitstorm",
  // slurs
  "nigger", "nigga", "faggot", "raghead", "wetback", "killyourself",
  // sexual
  "porn", "hentai", "dildo", "blowjob", "handjob", "rimjob", "footjob", "cumshot", "jizz",
  "orgasm", "masturbat", "penis", "vagina", "boobs", "titties", "nsfw", "gangbang", "bukkake",
  "deepthroat", "fellatio", "cunnilingus",
  // adult sites whose names say nothing (more come from the resolver)
  "onlyfans", "fansly", "manyvids", "clips4sale", "chaturbate", "stripchat", "livejasmin",
  "bongacams", "camsoda", "myfreecams", "flirt4free", "xvideo", "xnxx", "xhamster", "redtube",
  "brazzers", "spankbang", "tnaflix", "drtuber", "fapello", "thothub", "literotica", "rule34",
  // Hindi and Punjabi, as they are typed in Latin letters
  "chutiya", "chutiye", "chutia", "chootiya", "chutmar", "madarchod", "maderchod", "madarchot",
  "behenchod", "bhenchod", "benchod", "bhainchod", "penchod", "bhosdi", "bhosda", "bhosadi",
  "bhosri", "gandu", "lavda", "lawda", "lavde", "lawde", "lodu", "chodu", "jhaatu", "haramkhor",
  "bhadwa", "bhadwe", "bhadva", "phuddi", "fuddi",
];

// Counted only as a word of their own (a plural -s or -es too).
const WORDS = [
  "ass", "arse", "shit", "dick", "cock", "cum", "anal", "sex", "sexy", "tits", "boob", "pussy",
  "fag", "rape", "rapist", "xxx", "horny", "milf", "dilf", "boner", "crap", "piss", "pissed",
  "wank", "orgy", "erotic", "erotica", "skank", "thot", "retard", "retarded", "tranny", "kike",
  "paki", "chinki", "kys", "fuk", "fukk", "fck", "stfu", "coomer", "hanime", "javhd", "missav",
  "beeg", "txxx",
  "chod", "chut", "gaand", "lund", "randi", "harami", "jhant", "lauda", "laude", "loda", "bkl",
  "bsdk", "mkc", "chinal",
];

// Real words and places that contain one of ANYWHERE.
const INNOCENT = ["scunthorpe", "penistone", "snigger", "niggard", "slutsky"];

// Top-level domains for adult sites.
const ADULT_TLDS = ["xxx", "porn", "sex", "adult"];

// Digits and signs that stand in for letters. 1 is tried as i and as l.
const LEET = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s", "!": "i" };

function leet(s, one) {
  return s.replace(/[0-9@$!]/g, c => (c === "1" ? one : LEET[c] || c));
}

// Each letter may be typed more than once: "fuuuck".
function pattern(word) {
  return leet(word, "i").split("").map(c => c.replace(/[^a-z0-9]/g, "\\$&") + "+").join("");
}

const ANYWHERE_RE = new RegExp(ANYWHERE.map(pattern).join("|"));
const WORD_RE = new RegExp("^(?:" + WORDS.map(pattern).join("|") + ")(?:e?s)?$");
const WORD_ANYWHERE_RE = new RegExp(WORDS.map(pattern).join("|"));
const INNOCENT_RE = new RegExp(INNOCENT.join("|"), "g");

// A run of one letter longer than three is read as three: enough for "xxx", and it keeps
// the patterns above from backtracking over a long run.
const squeeze = s => s.replace(/(.)\1{3,}/g, "$1$1$1");

// The ways a piece can be read: as typed, with its digits as letters (1 as i, then as l),
// and with digits as gaps between words ("ass2go" is "ass" and "go").
function readings(piece) {
  const p = squeeze(piece);
  const out = new Set([p, squeeze(leet(p, "i")), squeeze(leet(p, "l"))]);
  for (const part of p.split(/[0-9]+/)) if (part) out.add(part);
  return [...out];
}

function rude(piece) {
  return readings(piece).some(r => WORD_RE.test(r) || ANYWHERE_RE.test(r.replace(INNOCENT_RE, "-")));
}

// Pieces of text, split at anything but letters, digits and the signs read as letters.
// Runs of one- and two-letter pieces are joined too, so "f-u-c-k" and "fu-ck" are read
// as words, while "the-pen-is" stays three words.
function pieces(text) {
  const parts = String(text).toLowerCase().split(/[^a-z0-9@$!]+/).filter(Boolean);
  const out = parts.slice();
  let run = [];
  for (const p of parts.concat([""])) {
    if (p && p.length <= 2) { run.push(p); continue; }
    if (run.length > 1) out.push(run.join(""));
    run = [];
  }
  return out;
}

function rudeText(text) {
  return pieces(text).some(rude);
}

// A chosen ending (already lower case, letters, digits and hyphens).
export function endingRefused(slug) {
  return rudeText(slug);
}

// A random code: it has no hyphens to show where a word ends, so a short word anywhere
// in it counts. Another code is cheap.
export function codeRefused(code) {
  return readings(String(code).toLowerCase()).some(r => ANYWHERE_RE.test(r) || WORD_ANYWHERE_RE.test(r));
}

// A path that decodes is read decoded ("/%66uck" is "/fuck"; "%2566" is "%66", as a server
// reads it). One with an escape that doesn't decode (a stray "%", "%zz", "%FF") is read three
// ways, and a word in any of them counts, so the bad escape can't hide the others:
//   - as typed, where an escape's hex digits are letters too ("/%FAggot" as it is);
//   - each run of escapes decoded once, on its own, with bytes that aren't UTF-8 read as a
//     gap (U+FFFD): "/%66%75%63%6B%" is "/fuck%";
//   - as an address bar shows it: whole UTF-8 characters decoded, any other escape kept as
//     typed: "/%FA%67%67ot" is "/%FAggot".
const ESCAPES = /(?:%[0-9a-f]{2})+/gi;
const UTF8_LENGTH = b => (b < 0x80 ? 1 : b >= 0xc2 && b <= 0xdf ? 2 : b >= 0xe0 && b <= 0xef ? 3 : b >= 0xf0 && b <= 0xf4 ? 4 : 0);

function gapPath(path) {
  return path.replace(ESCAPES, run => {
    try { return decodeURIComponent(run); } catch (e) {
      return new TextDecoder().decode(Uint8Array.from(run.slice(1).split("%"), h => parseInt(h, 16)));
    }
  });
}

function shownPath(path) {
  return path.replace(ESCAPES, run => {
    try { return decodeURIComponent(run); } catch (e) { /* character by character */ }
    const esc = run.match(/%[0-9a-f]{2}/gi);
    let out = "";
    for (let i = 0; i < esc.length;) {
      const n = UTF8_LENGTH(parseInt(esc[i].slice(1), 16));
      if (n) {
        try { out += decodeURIComponent(esc.slice(i, i + n).join("")); i += n; continue; } catch (e) { /* as typed */ }
      }
      out += esc[i];
      i += 1;
    }
    return out;
  });
}

// The long link, as a URL: "blocked-site" for an adult top-level domain, "blocked-words"
// for a word in its host name or path, or "". The query and the fragment aren't read:
// they are mostly ids and tracking.
export function linkRefused(u) {
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (ADULT_TLDS.indexOf(host.slice(host.lastIndexOf(".") + 1)) >= 0) return "blocked-site";
  const p = u.pathname;
  let reads;
  try { reads = [decodeURIComponent(p)]; } catch (e) { reads = [p, gapPath(p), shownPath(p)]; }
  return rudeText(host) || reads.some(rudeText) ? "blocked-words" : "";
}

/* ---- Cloudflare's family resolver, over DNS-over-HTTPS (RFC 8484) ---------------- */

const FAMILY_DOH = "https://family.cloudflare-dns.com/dns-query";

// A query for the A records of `name`: id 0, recursion desired, one question (RFC 1035).
export function dnsQuery(name) {
  const bytes = [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  for (const label of name.split(".")) {
    if (!/^[a-z0-9_-]{1,63}$/i.test(label)) throw new Error("not a DNS name");
    bytes.push(label.length);
    for (let i = 0; i < label.length; i++) bytes.push(label.charCodeAt(i));
  }
  bytes.push(0, 0, 1, 0, 1); // the root, then type A, class IN
  if (bytes.length > 12 + 255 + 4) throw new Error("name too long");
  return new Uint8Array(bytes);
}

// true when the resolver can be asked about `name` (a trailing dot is dropped, as in
// familyBlocks). Anything else, such as an empty label ("www..example.com"), a label over
// 63 characters or a "*", is no name the DNS can hold: a link to it leads nowhere.
export function dnsName(name) {
  try { dnsQuery(String(name).toLowerCase().replace(/\.$/, "")); return true; } catch (e) { return false; }
}

// The response code of a DNS answer, and the addresses in its A records.
export function dnsAnswer(buf) {
  const b = new Uint8Array(buf);
  const u16 = i => {
    if (i + 1 >= b.length) throw new Error("truncated answer");
    return (b[i] << 8) | b[i + 1];
  };
  const rcode = u16(2) & 0x0f, questions = u16(4), answers = u16(6);
  let p = 12;
  function skipName() {
    for (;;) {
      if (p >= b.length) throw new Error("truncated answer");
      const len = b[p];
      if (len === 0) { p += 1; return; }
      if ((len & 0xc0) === 0xc0) { p += 2; return; } // a pointer ends the name
      if (len > 63) throw new Error("bad label");
      p += 1 + len;
    }
  }
  for (let i = 0; i < questions; i++) { skipName(); p += 4; }
  const a = [];
  for (let i = 0; i < answers; i++) {
    skipName();
    const type = u16(p), len = u16(p + 8);
    p += 10;
    if (p + len > b.length) throw new Error("truncated answer");
    if (type === 1 && len === 4) a.push(b[p] + "." + b[p + 1] + "." + b[p + 2] + "." + b[p + 3]);
    p += len;
  }
  return { rcode: rcode, a: a };
}

// true when the family resolver blocks the host. An IP address has no name to ask about,
// and a name that doesn't exist isn't blocked. Throws when the resolver can't be asked,
// so the caller can refuse to guess.
export async function familyBlocks(hostname, fetchImpl) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (/^\d+(\.\d+){3}$/.test(host) || host.charAt(0) === "[") return false;
  const res = await (fetchImpl || fetch)(FAMILY_DOH + "?dns=" + b64url(dnsQuery(host)), {
    headers: { Accept: "application/dns-message" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error("the family resolver answered " + res.status);
  const ans = dnsAnswer(await res.arrayBuffer());
  return ans.rcode === 0 && ans.a.indexOf("0.0.0.0") >= 0;
}
