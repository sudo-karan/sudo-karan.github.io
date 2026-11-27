/* ============================================================================
   The parts of the Apps Script runtime that Code.gs's doPost uses, so that the
   real functions/apps-script/Code.gs can run under Node's test runner.

   Bytes follow Apps Script's rules strictly: they come back as arrays of signed
   numbers (-128 to 127), a Byte[] argument holding anything else is refused, and
   each method takes only the overloads Google lists (see @types/google-apps-script).
   So code that passes here doesn't lean on anything more lenient than Google is.
   ========================================================================== */
import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CODE_GS = readFileSync(new URL("../../functions/apps-script/Code.gs", import.meta.url), "utf8");

const signed = buf => Array.from(buf, b => (b > 127 ? b - 256 : b));

function bytesIn(arr, where) {
  if (!Array.isArray(arr)) throw new TypeError(`${where}: expected Byte[], got ${typeof arr}`);
  return Buffer.from(arr.map(v => {
    if (!Number.isInteger(v) || v < -128 || v > 127) throw new RangeError(`${where}: ${v} is not a byte (-128 to 127)`);
    return v & 0xff;
  }));
}

function textIn(s, charset, where) {
  if (typeof s !== "string") throw new TypeError(`${where}: expected a string, got ${typeof s}`);
  if (charset !== undefined && charset !== "UTF-8") throw new TypeError(`${where}: unknown charset ${charset}`);
  return Buffer.from(s, "utf8");
}

// String or Byte[], as computeDigest, base64Encode and newBlob take either.
function dataIn(data, charset, where) {
  return typeof data === "string" ? textIn(data, charset, where) : bytesIn(data, where);
}

function typeList(args) {
  return args.filter(a => a !== undefined).map(a => (Array.isArray(a) ? "number[]" : typeof a)).join(",");
}

// Padded, standard base64 only; Java's decoder refuses the rest, and so does this.
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function blob(buf) {
  return {
    getBytes: () => signed(buf),
    getDataAsString(charset) {
      if (charset !== undefined && charset !== "UTF-8") throw new TypeError("getDataAsString: unknown charset " + charset);
      return buf.toString("utf8");
    },
  };
}

const Utilities = {
  Charset: { UTF_8: "UTF-8" },
  DigestAlgorithm: { MD5: "MD5", SHA_256: "SHA_256" },
  // (Byte[], Byte[]) or (String, String) or (String, String, Charset)
  computeHmacSha256Signature(value, key, charset) {
    let v, k;
    if (typeof value === "string" && typeof key === "string") {
      v = textIn(value, charset, "computeHmacSha256Signature value");
      k = textIn(key, charset, "computeHmacSha256Signature key");
    } else if (Array.isArray(value) && Array.isArray(key) && charset === undefined) {
      v = bytesIn(value, "computeHmacSha256Signature value");
      k = bytesIn(key, "computeHmacSha256Signature key");
    } else {
      throw new TypeError(`Cannot find method computeHmacSha256Signature(${typeList([value, key, charset])})`);
    }
    if (!k.length) throw new Error("Empty key"); // as Java's SecretKeySpec
    return signed(createHmac("sha256", k).update(v).digest());
  },
  computeDigest(algorithm, value, charset) {
    const alg = { MD5: "md5", SHA_256: "sha256" }[algorithm];
    if (!alg) throw new TypeError("computeDigest: unknown algorithm " + algorithm);
    return signed(createHash(alg).update(dataIn(value, charset, "computeDigest")).digest());
  },
  base64Decode(encoded) {
    if (typeof encoded !== "string" || !B64.test(encoded)) throw new Error("Could not decode string.");
    return signed(Buffer.from(encoded, "base64"));
  },
  base64Encode(data, charset) { return dataIn(data, charset, "base64Encode").toString("base64"); },
  base64EncodeWebSafe(data, charset) {
    return dataIn(data, charset, "base64EncodeWebSafe").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  },
  newBlob(data) { return blob(dataIn(data, undefined, "newBlob")); },
  // Only needs to be the same for the same instant: rows from two runs are compared.
  formatDate(date, timeZone, format) { return `${date.toISOString()} (${timeZone}, ${format})`; },
  getUuid: () => randomUUID(),
  sleep() {},
};

function sheet() {
  const rows = [];
  return {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => rows.reduce((n, r) => Math.max(n, r.length), 0),
    appendRow(r) { rows.push(Array.from(r)); },
    getRange(row, col, nRows, nCols) {
      return {
        getValues: () => rows.slice(row - 1, row - 1 + nRows).map(r => Array.from({ length: nCols }, (_, i) => r[col - 1 + i] ?? "")),
        clearContent() { for (let i = row - 1; i < row - 1 + nRows; i++) rows[i] = []; },
        setValues(values) { values.forEach((v, i) => { rows[row - 1 + i] = Array.from(v); }); },
      };
    },
  };
}

/**
 * Loads Code.gs afresh. props are its Script Properties; turnstile(payload) decides
 * whether siteverify says yes (by default, to the token "tok-ok").
 * Returns post(body) → doPost's parsed answer, and what the script did: the Sheet's
 * rows, the emails sent, the URLs fetched, the cache and the console.
 */
export function loadCodeGs({ props = {}, quota = 100, turnstile = p => p.response === "tok-ok" } = {}) {
  const store = Object.assign({}, props);
  const cache = new Map();
  const mails = [], fetches = [], logs = [];
  const sh = sheet();
  const ss = { getSheets: () => [sh], getSheetByName: () => null, getNumSheets: () => 1 };
  const lock = { waitLock() {}, tryLock: () => true, releaseLock() {} };
  const say = level => (...a) => { logs.push({ level, text: a.join(" ") }); };

  const ctx = vm.createContext({
    Utilities,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setProperty: (k, v) => { store[k] = String(v); },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: k => (cache.has(k) ? cache.get(k) : null),
        put: (k, v, ttl) => { cache.set(k, String(v)); },
        remove: k => { cache.delete(k); },
      }),
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => "script-owner@example.com" }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    // copied out of the script's realm, so mails from two runs compare as plain objects
    MailApp: { sendEmail(m) { mails.push(Object.assign({}, m)); }, getRemainingDailyQuota: () => quota },
    UrlFetchApp: {
      fetch(url, opts) {
        fetches.push({ url, opts });
        const ok = /turnstile\/v0\/siteverify$/.test(url) && turnstile(opts.payload);
        return { getContentText: () => JSON.stringify(ok ? { success: true } : { success: false, "error-codes": ["invalid-input-response"] }) };
      },
    },
    ContentService: {
      MimeType: { JSON: "JSON", JAVASCRIPT: "JAVASCRIPT" },
      createTextOutput(content) { return { content, setMimeType() { return this; } }; },
    },
    LockService: { getScriptLock: () => lock, getUserLock: () => lock },
    console: { log: say("log"), info: say("info"), warn: say("warn"), error: say("error") },
  });
  vm.runInContext(CODE_GS, ctx, { filename: "Code.gs" });

  return {
    ctx, store, cache, mails, fetches, logs, rows: sh.rows,
    post(body) {
      const contents = typeof body === "string" ? body : JSON.stringify(body);
      return JSON.parse(ctx.doPost({ postData: { contents } }).content);
    },
    // The Sheet's data rows as { column label: value }.
    records() {
      const [head, ...rest] = sh.rows;
      return rest.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
    },
    messageMails: () => mails.filter(m => /^New message: /.test(m.subject)),
  };
}
