/* ============================================================================
   Cloudflare Pages Function — POST /api/urlshort/log: the link shortener's
   event log, for the Apps Script (syncShortLinks in functions/apps-script/Code.gs)

     POST { after, limit } → { ok, events: [rows with id > after, oldest first], last }

   Rows with id ≤ after are deleted first. The caller moves `after` past rows
   only once they are safely in the Sheet, so a run that fails part-way loses
   nothing: the next one is sent the same rows again. `limit` is 1…1000 (500 if
   left out); `last` is the id of the last row sent, or `after` when there are none.

   Needs `Authorization: Bearer <LOG_KEY>`, where LOG_KEY is base64url(HMAC-SHA256(
   URLSHORT_GATE_SECRET, "urlshort-log")). Only on karan98.in itself (and localhost),
   which is what the Apps Script calls: an older deployment at its <hash>.pages.dev
   address keeps the secret it was built with, and the log holds people's addresses,
   so one that leaked and was changed must not still open it there.

   Env: URLSHORT_DB (D1, see functions/_lib/urlshort.js) and URLSHORT_GATE_SECRET.
   Without either, 503 { error: "not-set-up" }.
   ========================================================================== */

import { SITE_HOSTS, EVENTS_TABLE, EVENT_FIELDS, logKey, sameSecret } from "../../_lib/urlshort.js";

const LIMIT_DEFAULT = 500, LIMIT_MAX = 1000;
const SELECT = "SELECT id, " + EVENT_FIELDS.join(", ") + " FROM events WHERE id > ? ORDER BY id LIMIT ?";

function json(obj, status, extra) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign(headers, extra || {}) });
}

// A number as sent, or digits as a number (Script Properties hold strings); else NaN.
function num(v) {
  if (typeof v === "string") return /^\d{1,15}$/.test(v) ? Number(v) : NaN;
  return typeof v === "number" ? v : NaN;
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405, { Allow: "POST" });
  if (SITE_HOSTS.indexOf(new URL(request.url).hostname.toLowerCase()) < 0) return json({ ok: false, error: "wrong-host" }, 403);
  const db = env.URLSHORT_DB, secret = String(env.URLSHORT_GATE_SECRET || "").trim();
  if (!db || !secret) return json({ ok: false, error: "not-set-up" }, 503);
  try {
    const m = /^Bearer\s+(\S.*)$/i.exec(request.headers.get("Authorization") || "");
    if (!m || !(await sameSecret(m[1].trim(), await logKey(secret)))) return json({ ok: false, error: "unauthorized" }, 401);

    let body;
    try { body = await request.json(); } catch (e) { body = null; }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "bad-request" }, 400);
    // `after` decides what is deleted, so anything but a plain id is refused rather
    // than guessed at. A `limit` out of range is only held to it.
    const after = body.after == null ? 0 : num(body.after);
    const n = body.limit == null ? LIMIT_DEFAULT : num(body.limit);
    if (!Number.isSafeInteger(after) || after < 0 || Number.isNaN(n)) return json({ ok: false, error: "bad-request" }, 400);
    const limit = Math.min(LIMIT_MAX, Math.max(1, Math.floor(n)));

    // One batch is one transaction: the rows sent are exactly those left after the delete.
    const out = await db.batch([
      db.prepare(EVENTS_TABLE),
      db.prepare("DELETE FROM events WHERE id <= ?").bind(after),
      db.prepare(SELECT).bind(after, limit),
    ]);
    const events = (out[2] && out[2].results) || [];
    return json({ ok: true, events: events, last: events.length ? events[events.length - 1].id : after });
  } catch (e) {
    return json({ ok: false, error: "server" }, 500);
  }
}
