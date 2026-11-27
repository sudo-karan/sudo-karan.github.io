/* ============================================================================
   Google Apps Script — contact form handler for karan98.in.

   doPost accepts TWO request shapes so the form works on Cloudflare and GitHub Pages:
     1. { secret, fields, meta }  — forwarded by the Cloudflare Function (shared-secret).
     2. { obf }  — obfuscated blob posted from the browser (Turnstile verified here).

   doGet is a JSONP endpoint for the optional email-OTP verification:
     ?action=send-otp&email=…&callback=…    → emails a 6-digit code
     ?action=verify-otp&email=…&code=…&callback=…  → checks it

   With &app=ictd the same two actions serve the sign-in of the Odisha forest map
   (a separate Cloudflare Pages project, repository sudo-karan/ICTD_Project):
     send-otp   emails a code only to an address in ICTD_WHITELIST; any other address
                gets { sent: false, reason: 'not-listed' } and nothing is sent.
     verify-otp answers { verified: true, token }. The token is
                base64url(JSON { email, exp }) + '.' + base64url(HMAC-SHA256(ICTD_GATE_SECRET, payload)),
                where payload is the text before the dot, base64url has no padding and
                exp is in seconds, 10 minutes ahead. The map's Function checks it, because
                Google refuses calls from Cloudflare's servers and the browser carries the answer.
   The map's codes and hourly limits are kept apart from the contact form's, so a code
   for the one never works for the other. The daily cap (otpReserve) is shared: both
   spend the same Gmail quota.

   With &app=phd the same two actions serve the sign-in of the PhD Forest Stand Explorer
   (a separate Cloudflare Pages project, repository sudo-karan/phd-code). It has its own
   whitelist, secret, codes and hourly limits, and its answers don't say who is listed:
     send-otp   answers { ok: true, remaining } to any well-formed address that the
                hourly and daily limits allow, and e-mails a code only to an address in
                PHD_WHITELIST. A failed send isn't reported, and every answer waits until
                PHD_ANSWER_MS after the request began, so that sending mail doesn't show.
     verify-otp an address not on the list holds a decoy record that no code matches, so
                it gets the same 'wrong' and 'too-many' as a listed one. A right code for an
                address still on the list gets { verified: true, token }: the token as above,
                over { email, exp, aud: 'phd' }, signed with PHD_GATE_SECRET.
   It lets nobody in (not-set-up) if PHD_GATE_SECRET is missing or equals ICTD_GATE_SECRET.

   With &app=urlshort the same protocol as the PhD explorer's serves the link shortener
   (karan98.in/urlshort, in this repository), under the action names send-code and
   check-code, and every answer carries app: 'urlshort' (see urlshortAnswer). send-code also
   takes ts, the token of the page's Cloudflare Turnstile check, checked with TURNSTILE_SECRET
   (else { ok: false, reason: 'bot-check' }, the same for every address). Codes go only
   to URLSHORT_WHITELIST, answers don't say who is listed, and a right code gets
   { verified: true, token, exp }: the token over { email, exp, aud: 'urlshort' }, signed
   with URLSHORT_GATE_SECRET, good for URLSHORT_PASS_HOURS (default 24). Nobody gets one
   (not-set-up) if URLSHORT_GATE_SECRET is missing or equals ICTD's or PhD's.
   syncShortLinks() pulls the shortener's log (links made and deleted, every visit) from
   https://karan98.in/api/urlshort/log into the "Short links" and "Link visits" sheets;
   installShortLinkSync() runs it every 5 minutes.

   A single FIELDS list is the source of truth for BOTH the Sheet columns and the
   email table.

   Script Properties (Project Settings → Script properties):
     TURNSTILE_SECRET  - Cloudflare Turnstile secret key (for the { obf } path, and the link
                         shortener's code requests)
     RECIPIENT         - where to email submissions
     SHARED_SECRET     - must equal the Cloudflare Function's SHARED_SECRET env
     OBFUSCATION_KEY   - must equal OBF_KEY in the website's app.js (defaults below)
     OTP_DAILY_CAP     - (optional) max verification codes/day (default 85); the rest
                         of Gmail's ~100/day stays reserved for message notifications
     SHEET_ID          - (optional) spreadsheet id; otherwise the bound sheet
     ICTD_WHITELIST    - addresses allowed into the map, comma- or newline-separated
     ICTD_GATE_SECRET  - must equal the map's Cloudflare env ICTD_GATE_SECRET
     PHD_WHITELIST     - addresses allowed into the PhD explorer, comma- or newline-separated
     PHD_GATE_SECRET   - must equal the explorer's Cloudflare env PHD_GATE_SECRET, and not ICTD's
     URLSHORT_WHITELIST   - addresses allowed to make short links, comma- or newline-separated
     URLSHORT_GATE_SECRET - must equal the shortener's Cloudflare secret URLSHORT_GATE_SECRET,
                            and not ICTD's or PhD's
     URLSHORT_PASS_HOURS  - (optional) how long a shortener pass lasts, 1–720 hours (default 24)
     URLSHORT_TAB_ROWS    - (optional) rows each shortener log tab keeps, newest first,
                            1,000–200,000 (default 100,000)

   Deploy: Web app · Execute as: Me · Who has access: Anyone.
   After pasting: run doPost once → Allow all permissions → Deploy → New version.
   NOTE: this version adds an "Email verified" column — if the Sheet holds an older
   header, clear the Sheet once (select all → delete) so the new header writes fresh.
   ========================================================================== */

// Must match OBF_KEY in assets/js/app.js (overridable via the OBFUSCATION_KEY property).
var DEFAULT_OBF_KEY = '7Qp2xL9vRt4Ke1Zc8Nb3Ym6Wd5Hs0Ja';

// [ Column label , key in the record built by doPost() ]  — order = sheet order.
var FIELDS = [
  ['Time (IST)', 'time'],
  ['Name', 'name'], ['Email', 'email'], ['Email verified', 'emailVerified'],
  ['Subject', 'subject'], ['Organisation', 'org'], ['Message', 'message'],
  ['IP', 'ip'], ['Country', 'country'], ['City', 'city'], ['State', 'state'], ['Postal', 'postal'],
  ['Latitude', 'latitude'], ['Longitude', 'longitude'], ['ISP', 'isp'], ['ASN', 'asn'], ['Geo accuracy', 'accuracy'],
  ['Browser', 'browser'], ['Browser version', 'browserVersion'], ['OS', 'platform'], ['OS version', 'osVersion'],
  ['Device type', 'deviceType'], ['Device model', 'deviceModel'], ['CPU arch', 'architecture'], ['Bitness', 'bitness'],
  ['Device memory', 'deviceMemory'], ['CPU cores', 'cpuCores'], ['Touch points', 'touchPoints'], ['GPU', 'gpu'],
  ['Network', 'network'], ['Accept-Language', 'acceptLanguage'], ['CF colo', 'colo'],
  ['HTTP protocol', 'httpProtocol'], ['TLS version', 'tlsVersion'],
  ['Screen', 'screen'], ['Viewport', 'viewport'], ['Pixel ratio', 'pixelRatio'],
  ['Colour depth', 'colorDepth'], ['Orientation', 'orientation'], ['Colour scheme', 'colorScheme'],
  ['Reduced motion', 'reducedMotion'], ['Timezone', 'timezone'], ['UTC offset', 'timezoneOffset'],
  ['Language', 'language'], ['Languages', 'languages'], ['Cookies enabled', 'cookiesEnabled'],
  ['Do Not Track', 'doNotTrack'], ['Bot', 'bot'], ['Referer', 'referer'], ['Page URL', 'pageUrl'],
  ['User-Agent', 'userAgent']
];

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var turnstileSecret = props.getProperty('TURNSTILE_SECRET') || '';
    var sharedSecret = props.getProperty('SHARED_SECRET') || '';
    var obfKey = props.getProperty('OBFUSCATION_KEY') || DEFAULT_OBF_KEY;
    var recipient = props.getProperty('RECIPIENT') || Session.getEffectiveUser().getEmail();
    var sheetId = props.getProperty('SHEET_ID') || '';

    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var f, m;

    if (body.secret != null) {
      if (!sharedSecret || body.secret !== sharedSecret) return out({ ok: false, error: 'unauthorized' });
      f = body.fields || {}; m = body.meta || {};
    } else if (body.obf) {
      var inner = JSON.parse(deob(body.obf, obfKey));
      f = inner.fields || {}; m = inner.meta || {};
      if (turnstileSecret) {
        var resp = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'post',
          payload: { secret: turnstileSecret, response: inner.token || '', remoteip: m.ip || '' },
          muteHttpExceptions: true
        });
        var vr = {};
        try { vr = JSON.parse(resp.getContentText()); } catch (e2) {}
        if (!vr.success) return out({ ok: false, error: 'failed-captcha', codes: vr['error-codes'] || [] });
      }
    } else {
      return out({ ok: false, error: 'bad-request' });
    }

    if (!f.name || !f.email || !f.subject || !f.message) return out({ ok: false, error: 'missing-fields' });

    // --- Email-verified status. 'OTP-verified' is server-authoritative (our own
    // `ver_` cache — never the browser's claim). The "a code was sent but not
    // confirmed" flag is scoped to THIS submission's flow via a per-flow key set at
    // send time, so a code from an earlier attempt on the same address can't bleed
    // into a later message where the sender simply chose not to verify. ---
    var emailVerified = 'Not verified';
    try {
      var eh = otpHash(String(f.email).trim().toLowerCase());
      var vcache = CacheService.getScriptCache();
      var fsKey = m.otpFlow ? ('fs_' + flowKey(m.otpFlow)) : '';
      var flowSent = !!(fsKey && vcache.get(fsKey));
      if (flowSent) vcache.remove(fsKey); // one-time — this flow is now accounted for
      if (vcache.get('ver_' + eh)) {
        emailVerified = 'OTP-verified ✅';
        vcache.remove('ver_' + eh); // one-time — applies to this message
      } else if (m.otpStatus === 'limit-exhausted') {
        emailVerified = 'OTP limit reached, not verified ⚠️';   // used all 3 codes for the hour
      } else if (m.otpStatus === 'too-many-attempts') {
        emailVerified = 'Too many wrong attempts, not verified ⚠️';
      } else if (flowSent || m.otpStatus === 'sent-ignored') {
        // A code went out in THIS flow but was never confirmed. `flowSent` is our own
        // record for this flow, so an honest client that sent a code can't have it
        // silently dropped — while a *fresh* skip (no code this flow) reads no marker.
        emailVerified = 'OTP sent, not verified ⚠️';
      } else if (m.otpStatus === 'attempted-failed') {
        emailVerified = 'Verification unavailable ⚠️';          // couldn't send a code (service/quota)
      }
    } catch (eV) { /* leave as Not verified */ }

    var istTime = m.submittedAt
      ? Utilities.formatDate(new Date(m.submittedAt), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a')
      : Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a');

    var rec = {
      time: istTime, name: f.name, email: f.email, emailVerified: emailVerified,
      subject: f.subject, org: f.org || '', message: f.message,
      ip: m.ip, country: m.country, city: m.city, state: m.state, postal: m.postal,
      latitude: m.latitude, longitude: m.longitude, isp: m.isp, asn: m.asn, accuracy: m.accuracy,
      browser: m.browser, browserVersion: m.browserVersion, platform: m.platform, osVersion: m.osVersion,
      deviceType: m.deviceType, deviceModel: m.deviceModel, architecture: m.architecture, bitness: m.bitness,
      deviceMemory: m.deviceMemory, cpuCores: m.cpuCores, touchPoints: m.touchPoints, gpu: m.gpu,
      network: m.network, acceptLanguage: m.acceptLanguage, colo: m.colo, httpProtocol: m.httpProtocol,
      tlsVersion: m.tlsVersion, screen: m.screen, viewport: m.viewport, pixelRatio: m.pixelRatio,
      colorDepth: m.colorDepth, orientation: m.orientation, colorScheme: m.colorScheme,
      reducedMotion: m.reducedMotion, timezone: m.timezone, timezoneOffset: m.timezoneOffset,
      language: m.language, languages: m.languages, cookiesEnabled: m.cookiesEnabled,
      doNotTrack: m.doNotTrack, bot: 'No', referer: m.referer, pageUrl: m.pageUrl, userAgent: m.userAgent
    };

    // The row and the email don't wait on each other: a Sheet that refuses the row (full,
    // say) still lets the message reach the inbox, and a failed email still leaves the row.
    var stored = false, mailed = false;
    try {
      var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheets()[0];
      var header = FIELDS.map(function (fld) { return fld[0]; });
      var lastRow = sh.getLastRow();
      if (lastRow === 0) {
        sh.appendRow(header);
      } else if (lastRow === 1) {
        var have = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
        if (have.length !== header.length || have[0] !== header[0]) {
          sh.getRange(1, 1, 1, have.length).clearContent();
          sh.getRange(1, 1, 1, header.length).setValues([header]);
        }
      }
      sh.appendRow(FIELDS.map(function (fld) { var v = rec[fld[1]]; return v == null ? '' : sheetSafe(v); }));
      stored = true;
    } catch (eS) {
      console.error('doPost: the Sheet refused the message: ' + eS);
    }

    var html = '<h2 style="font-family:Arial,sans-serif;color:#4c1d95">New message from karan98.in</h2>' +
      '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">';
    FIELDS.forEach(function (fld) {
      var v = rec[fld[1]];
      if (v == null || v === '') return;
      html += '<tr><td style="color:#6d28d9;vertical-align:top;border-bottom:1px solid #eee;white-space:nowrap"><b>' +
        esc(fld[0]) + '</b></td><td style="border-bottom:1px solid #eee">' + esc(v).replace(/\n/g, '<br>') + '</td></tr>';
    });
    html += '</table>';

    try {
      MailApp.sendEmail({
        to: recipient,
        replyTo: f.email || recipient,
        subject: 'New message: ' + (f.subject || '(no subject)'),
        htmlBody: html,
        name: 'karan98.in contact form'
      });
      mailed = true;
    } catch (eM) {
      console.error('doPost: the notification email failed: ' + eM);
    }

    if (!stored && !mailed) return out({ ok: false, error: 'not-saved' });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

/* ---------------------------- OTP (JSONP GET) ----------------------------- */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action;
  var result;
  if (p.app === PHD_APP) return respond(phdAnswer(action, p.email, p.code), p.callback);
  if (p.app === URLSHORT_APP) return respond(urlshortAnswer(action, p.email, p.code, p.ts), p.callback);
  if (action === 'send-otp') result = sendOtp(p.email, p.flow, p.app);
  else if (action === 'verify-otp') result = verifyOtp(p.email, p.code, p.app);
  else result = { ok: true, note: 'POST only' };
  return respond(result, p.callback);
}

// JSONP when a (safe) callback name is given, else plain JSON.
function respond(obj, cb) {
  var jsonStr = JSON.stringify(obj);
  if (cb && /^[A-Za-z0-9_$]{1,64}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + jsonStr + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return out(obj);
}

function normEmail(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
function validEmail(x) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); }
function otpHash(email) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, 'otp:' + email);
  return Utilities.base64EncodeWebSafe(d).replace(/=+$/, '');
}
// Sanitised cache-key suffix for the client's per-submission flow id.
function flowKey(flow) { return String(flow == null ? '' : flow).replace(/[^A-Za-z0-9]/g, '').slice(0, 48); }

// Atomically reserve one code-send slot for today. Keeps OTP under OTP_DAILY_CAP
// AND always leaves >15 of Gmail's daily quota for message notifications.
function otpReserve() {
  if (MailApp.getRemainingDailyQuota() <= 15) return false;
  var cap = parseInt(PropertiesService.getScriptProperties().getProperty('OTP_DAILY_CAP') || '85', 10) || 85;
  var lock = LockService.getScriptLock();
  try { lock.waitLock(3000); } catch (e) { return false; }
  try {
    var props = PropertiesService.getScriptProperties();
    var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd');
    var q;
    try { q = JSON.parse(props.getProperty('otp_quota') || '{}'); } catch (e2) { q = {}; }
    if (!q || q.date !== today) q = { date: today, count: 0 };
    if (q.count >= cap) return false;
    q.count += 1;
    props.setProperty('otp_quota', JSON.stringify(q));
    return true;
  } finally {
    lock.releaseLock();
  }
}

function sendOtp(email, flow, app) {
  email = normEmail(email);
  if (!validEmail(email)) return { sent: false, reason: 'bad-email' };
  var ictd = app === ICTD_APP;
  if (ictd && !ictdSecret()) return { sent: false, reason: 'not-set-up' };
  if (ictd && !ictdListed(email)) return { sent: false, reason: 'not-listed' };
  var ns = ictd ? ICTD_NS : ''; // the map's limits and codes never mix with the contact form's
  var cache = CacheService.getScriptCache();
  var h = otpHash(email);
  // Fixed 1-hour window per email, max 3 codes (1 initial + 2 resends).
  var now = Date.now();
  var rl;
  try { rl = JSON.parse(cache.get(ns + 'rl_' + h) || 'null'); } catch (e) { rl = null; }
  if (!rl || (now - rl.first) >= 3600000) rl = { count: 0, first: now };
  var elapsed = now - rl.first;
  if (rl.count >= 3) {
    return { sent: false, reason: 'rate-limit', retryMins: Math.max(1, Math.ceil((3600000 - elapsed) / 60000)) };
  }
  if (!otpReserve()) return { sent: false, reason: 'quota' };
  var code = ictd ? ictdCode() : String(Math.floor(100000 + Math.random() * 900000));
  var body = 'Your karan98.in verification code is:\n\n    ' + code +
    '\n\nIt expires in 10 minutes. If you didn’t request this, you can safely ignore this email.\n\n— karan98.in';
  var mail = ictd ? ictdMail(email, code)
    : { to: email, subject: 'Your karan98.in verification code', body: body, name: 'karan98.in' };
  try {
    MailApp.sendEmail(mail);
  } catch (err) {
    return { sent: false, reason: 'send-failed' };
  }
  rl.count += 1;
  var ttl = Math.max(60, Math.ceil((3600000 - elapsed) / 1000)); // expire at the 1-hour edge
  cache.put(ns + 'rl_' + h, JSON.stringify(rl), ttl);
  if (flow && !ictd) cache.put('fs_' + flowKey(flow), '1', 900); // "a code went out in THIS flow"
  var held = { code: code, tries: 0 };
  if (ictd) held.exp = now + 600000; // a wrong try re-stores the code; this keeps it to 10 min from now
  cache.put(ns + 'code_' + h, JSON.stringify(held), 600); // 10 min
  return { sent: true, remaining: 3 - rl.count }; // codes left after this one (2, then 1, then 0)
}

function verifyOtp(email, code, app) {
  email = normEmail(email);
  code = String(code == null ? '' : code).trim();
  if (app === ICTD_APP) return verifyIctdOtp(email, code);
  var cache = CacheService.getScriptCache();
  var h = otpHash(email);
  var raw = cache.get('code_' + h);
  if (!raw) return { verified: false, reason: 'expired' };
  var rec;
  try { rec = JSON.parse(raw); } catch (e) { return { verified: false, reason: 'expired' }; }
  rec.tries = (rec.tries || 0) + 1;
  if (rec.tries > 5) { cache.remove('code_' + h); return { verified: false, reason: 'too-many' }; }
  if (code && code === rec.code) {
    cache.remove('code_' + h);
    cache.put('ver_' + h, '1', 900); // verified for 15 min — long enough to submit
    return { verified: true };
  }
  cache.put('code_' + h, JSON.stringify(rec), 600);
  return { verified: false, reason: 'wrong', triesLeft: Math.max(0, 5 - rec.tries) };
}

/* ------------------------ the map's sign-in (app=ictd) --------------------- */

var ICTD_APP = 'ictd';
var ICTD_NS = 'ictd_'; // cache-key prefix: the map's codes and hourly limits

function ictdSecret() {
  return String(PropertiesService.getScriptProperties().getProperty('ICTD_GATE_SECRET') || '').trim();
}

// Checked at verify too, so that taking an address off the list stops it at once.
// No list, or an empty one, lets nobody in.
function ictdListed(email) {
  if (!validEmail(email)) return false;
  var raw = PropertiesService.getScriptProperties().getProperty('ICTD_WHITELIST') || '';
  return raw.split(/[,\r\n]+/).some(function (x) { return normEmail(x) === email; });
}

// This code opens a gate, so it comes from getUuid rather than Math.random.
function ictdCode() {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid(), Utilities.Charset.UTF_8);
  var n = 0;
  for (var i = 0; i < 6; i++) n = (n * 256 + (d[i] & 0xff)) % 900000;
  return String(100000 + n);
}

function ictdMail(email, code) {
  return {
    to: email,
    subject: 'Your sign-in code for the Odisha forest decision layer',
    body: 'Your code to open the Odisha forest decision layer is:\n\n    ' + code +
      '\n\nIt expires in 10 minutes. If you didn’t request this, you can safely ignore this email.',
    name: 'Odisha forest decision layer'
  };
}

// The signature is over the base64url text before the dot. Apps Script keeps '=' padding; the token has none.
function ictdToken(email, secret) {
  var utf8 = Utilities.Charset.UTF_8;
  var claim = JSON.stringify({ email: email, exp: Math.floor(Date.now() / 1000) + 600 });
  var payload = Utilities.base64EncodeWebSafe(claim, utf8).replace(/=+$/, '');
  var sig = Utilities.computeHmacSha256Signature(payload, secret, utf8);
  return payload + '.' + Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '');
}

// Under the script lock, so that guesses made at the same moment can't share one try.
function verifyIctdOtp(email, code) {
  if (!ictdListed(email)) return { verified: false, reason: 'not-listed' };
  var secret = ictdSecret();
  if (!secret) return { verified: false, reason: 'not-set-up' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(3000); } catch (e) { return { verified: false, reason: 'busy' }; }
  try {
    var cache = CacheService.getScriptCache();
    var key = ICTD_NS + 'code_' + otpHash(email);
    var raw = cache.get(key);
    if (!raw) return { verified: false, reason: 'expired' };
    var rec;
    try { rec = JSON.parse(raw); } catch (e2) { return { verified: false, reason: 'expired' }; }
    var left = Math.ceil((rec.exp - Date.now()) / 1000);
    if (!(left > 0)) { cache.remove(key); return { verified: false, reason: 'expired' }; }
    rec.tries = (rec.tries || 0) + 1;
    if (rec.tries > 5) { cache.remove(key); return { verified: false, reason: 'too-many' }; }
    if (code && code === rec.code) {
      cache.remove(key);
      return { verified: true, token: ictdToken(email, secret) };
    }
    cache.put(key, JSON.stringify(rec), left);
    return { verified: false, reason: 'wrong', triesLeft: Math.max(0, 5 - rec.tries) };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------- the PhD explorer's sign-in (app=phd) ------------------ */

var PHD_APP = 'phd';
var PHD_NS = 'phd_'; // cache-key prefix: the explorer's codes and hourly limits
var PHD_ANSWER_MS = 4000; // every send-otp answer leaves this long after the request began

function phdAnswer(action, email, code) {
  if (action === 'send-otp') return phdSend(email);
  if (action === 'verify-otp') return phdVerify(email, code);
  return { ok: true, note: 'POST only' };
}

// Missing, blank, or the same as the map's: then nobody gets in.
function phdSecret() {
  var props = PropertiesService.getScriptProperties();
  var secret = String(props.getProperty('PHD_GATE_SECRET') || '').trim();
  var ictd = String(props.getProperty('ICTD_GATE_SECRET') || '').trim();
  return secret && secret !== ictd ? secret : '';
}

// Read on every request, so that the list changes with no new deployment. Checked at
// verify too, so that taking an address off the list stops it at once. No list lets nobody in.
function phdListed(email) {
  if (!validEmail(email)) return false;
  var raw = PropertiesService.getScriptProperties().getProperty('PHD_WHITELIST') || '';
  return raw.split(/[,\r\n]+/).some(function (x) { return normEmail(x) === email; });
}

// This code opens a gate, so it comes from getUuid rather than Math.random.
function phdCode() {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid(), Utilities.Charset.UTF_8);
  var n = 0;
  for (var i = 0; i < 6; i++) n = (n * 256 + (d[i] & 0xff)) % 900000;
  return String(100000 + n);
}

function phdMail(email, code) {
  return {
    to: email,
    subject: 'Your sign-in code for the PhD Forest Stand Explorer',
    body: 'Your code to open the PhD Forest Stand Explorer is:\n\n    ' + code +
      '\n\nIt expires in 10 minutes. If you didn’t request this, you can safely ignore this email.',
    name: 'PhD Forest Stand Explorer'
  };
}

// As ictdToken, with aud added: the explorer's Function takes no token without aud 'phd'.
function phdToken(email, secret) {
  var utf8 = Utilities.Charset.UTF_8;
  var claim = JSON.stringify({ email: email, exp: Math.floor(Date.now() / 1000) + 600, aud: PHD_APP });
  var payload = Utilities.base64EncodeWebSafe(claim, utf8).replace(/=+$/, '');
  var sig = Utilities.computeHmacSha256Signature(payload, secret, utf8);
  return payload + '.' + Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '');
}

function phdSend(email) {
  var start = Date.now();
  var answer = phdSendNow(normEmail(email), start);
  var wait = PHD_ANSWER_MS - (Date.now() - start);
  if (wait > 0) Utilities.sleep(wait);
  return answer;
}

// The same answer whether or not the address is listed: the hourly limit counts for any address,
// the daily cap is said to any address, and a failed send isn't reported, since only a listed
// address can fail.
function phdSendNow(email, now) {
  if (!validEmail(email)) return { ok: false, reason: 'bad-email' };
  if (!phdSecret()) return { ok: false, reason: 'not-set-up' };
  var listed = phdListed(email);
  var cache = CacheService.getScriptCache();
  var h = otpHash(email);
  var rl;
  try { rl = JSON.parse(cache.get(PHD_NS + 'rl_' + h) || 'null'); } catch (e) { rl = null; }
  if (!rl || (now - rl.first) >= 3600000) rl = { count: 0, first: now };
  var elapsed = now - rl.first;
  if (rl.count >= 3) {
    return { ok: false, reason: 'rate-limit', retryMins: Math.max(1, Math.ceil((3600000 - elapsed) / 60000)) };
  }
  // A slot is taken whether or not the address is listed: if only a listed one took it,
  // the next answer to anyone could show what this one was.
  if (!otpReserve()) return { ok: false, reason: 'quota' };
  var held = { tries: 0, exp: now + 600000 }; // without a code, a decoy: no code matches it
  if (listed) {
    held.code = phdCode();
    try { MailApp.sendEmail(phdMail(email, held.code)); } catch (err) { /* not reported: see above */ }
  }
  rl.count += 1;
  cache.put(PHD_NS + 'rl_' + h, JSON.stringify(rl), Math.max(60, Math.ceil((3600000 - elapsed) / 1000)));
  cache.put(PHD_NS + 'code_' + h, JSON.stringify(held), 600);
  return { ok: true, remaining: 3 - rl.count };
}

// Under the script lock, as the map's, so that guesses made at the same moment can't share one try.
function phdVerify(email, code) {
  email = normEmail(email);
  code = String(code == null ? '' : code).trim();
  var secret = phdSecret();
  if (!secret) return { verified: false, reason: 'not-set-up' };
  var listed = phdListed(email);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(3000); } catch (e) { return { verified: false, reason: 'busy' }; }
  try {
    var cache = CacheService.getScriptCache();
    var key = PHD_NS + 'code_' + otpHash(email);
    var raw = cache.get(key);
    if (!raw) return { verified: false, reason: 'expired' };
    var rec;
    try { rec = JSON.parse(raw); } catch (e2) { return { verified: false, reason: 'expired' }; }
    var left = Math.ceil((rec.exp - Date.now()) / 1000);
    if (!(left > 0)) { cache.remove(key); return { verified: false, reason: 'expired' }; }
    rec.tries = (rec.tries || 0) + 1;
    if (rec.tries > 5) { cache.remove(key); return { verified: false, reason: 'too-many' }; }
    if (listed && rec.code && code === rec.code) {
      cache.remove(key);
      return { verified: true, token: phdToken(email, secret) };
    }
    cache.put(key, JSON.stringify(rec), left);
    return { verified: false, reason: 'wrong', triesLeft: Math.max(0, 5 - rec.tries) };
  } finally {
    lock.releaseLock();
  }
}

/* ------------- the link shortener's makers (app=urlshort, karan98.in/urlshort) ------------- */

// The PhD explorer's protocol, with its own list, secret, codes and hourly limits; the
// daily cap is shared. A right code gets a pass the shortener's Function checks:
// { email, exp, aud: 'urlshort' } signed with URLSHORT_GATE_SECRET, good for
// URLSHORT_PASS_HOURS (default 24), so a maker isn't sent a code for every link.
var URLSHORT_APP = 'urlshort';
var URLSHORT_NS = 'urlshort_'; // cache-key prefix: the shortener's codes and hourly limits

// The page asks with send-code and check-code, not send-otp and verify-otp. A script from
// before the shortener (not updated yet, or rolled back) would hand those two on to the
// contact form's codes and email anyone a code that signs nobody in; these names it doesn't
// know, so it sends nothing and answers { ok: true, note: 'POST only' }. Every answer from
// here carries app: 'urlshort' (listed or not, so it says nothing about the list), which is
// how the page tells the two apart and says signing in isn't switched on yet.
function urlshortAnswer(action, email, code, ts) {
  var a = action === 'send-code' ? urlshortSend(email, ts)
    : action === 'check-code' ? urlshortVerify(email, code)
    : { ok: false, reason: 'bad-request' };
  a.app = URLSHORT_APP;
  return a;
}

// Missing, blank, or the same as the map's or the explorer's: then nobody gets a pass.
function urlshortSecret() {
  var props = PropertiesService.getScriptProperties();
  var secret = String(props.getProperty('URLSHORT_GATE_SECRET') || '').trim();
  var ictd = String(props.getProperty('ICTD_GATE_SECRET') || '').trim();
  var phd = String(props.getProperty('PHD_GATE_SECRET') || '').trim();
  return secret && secret !== ictd && secret !== phd ? secret : '';
}

// Read on every request, so that the list changes with no new deployment. Checked at
// verify too, so that taking an address off the list stops new passes at once.
function urlshortListed(email) {
  if (!validEmail(email)) return false;
  var raw = PropertiesService.getScriptProperties().getProperty('URLSHORT_WHITELIST') || '';
  return raw.split(/[,\r\n]+/).some(function (x) { return normEmail(x) === email; });
}

function urlshortPassHours() {
  var h = parseInt(PropertiesService.getScriptProperties().getProperty('URLSHORT_PASS_HOURS') || '24', 10);
  return Math.min(720, Math.max(1, h || 24));
}

function urlshortMail(email, code) {
  return {
    to: email,
    subject: 'Your code for making short links on karan98.in',
    body: 'Your code to make short links on karan98.in is:\n\n    ' + code +
      '\n\nIt expires in 10 minutes. If you didn’t request this, you can safely ignore this email.\n\n— karan98.in',
    name: 'karan98.in short links'
  };
}

// As phdToken, with aud 'urlshort' and the pass's own lifetime.
function urlshortToken(email, secret, exp) {
  var utf8 = Utilities.Charset.UTF_8;
  var claim = JSON.stringify({ email: email, exp: exp, aud: URLSHORT_APP });
  var payload = Utilities.base64EncodeWebSafe(claim, utf8).replace(/=+$/, '');
  var sig = Utilities.computeHmacSha256Signature(payload, secret, utf8);
  return payload + '.' + Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '');
}

function urlshortSend(email, ts) {
  var start = Date.now();
  var answer = urlshortSendNow(normEmail(email), start, ts);
  var wait = PHD_ANSWER_MS - (Date.now() - start);
  if (wait > 0) Utilities.sleep(wait);
  return answer;
}

// As phdSendNow: the same answer whether or not the address is listed.
// The page's Cloudflare check (the contact form's Turnstile widget, its token sent as ts) is
// checked with TURNSTILE_SECRET before the address is looked at, so its answer is the same for
// every address, and a failed check takes no slot of the hourly or daily limits. Without
// TURNSTILE_SECRET there is no check, as for the contact form. Only a token made for the page's
// own action (URLSHORT_TS_ACTION) counts.
var URLSHORT_TS_ACTION = 'urlshort-code';
function urlshortHuman(token) {
  var secret = String(PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET') || '').trim();
  if (!secret) return true;
  token = String(token == null ? '' : token);
  if (!token || token.length > 2048) return false;
  try {
    var resp = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post', payload: { secret: secret, response: token }, muteHttpExceptions: true
    });
    var vr = JSON.parse(resp.getContentText());
    return !!vr && vr.success === true && vr.action === URLSHORT_TS_ACTION;
  } catch (e) {
    return false;
  }
}

function urlshortSendNow(email, now, ts) {
  if (!validEmail(email)) return { ok: false, reason: 'bad-email' };
  if (!urlshortSecret()) return { ok: false, reason: 'not-set-up' };
  if (!urlshortHuman(ts)) return { ok: false, reason: 'bot-check' };
  var listed = urlshortListed(email);
  var cache = CacheService.getScriptCache();
  var h = otpHash(email);
  var rl;
  try { rl = JSON.parse(cache.get(URLSHORT_NS + 'rl_' + h) || 'null'); } catch (e) { rl = null; }
  if (!rl || (now - rl.first) >= 3600000) rl = { count: 0, first: now };
  var elapsed = now - rl.first;
  if (rl.count >= 3) {
    return { ok: false, reason: 'rate-limit', retryMins: Math.max(1, Math.ceil((3600000 - elapsed) / 60000)) };
  }
  if (!otpReserve()) return { ok: false, reason: 'quota' }; // listed or not, as phdSendNow
  var held = { tries: 0, exp: now + 600000 }; // without a code, a decoy: no code matches it
  if (listed) {
    held.code = phdCode();
    try { MailApp.sendEmail(urlshortMail(email, held.code)); } catch (err) { /* not reported: see phdSendNow */ }
  }
  rl.count += 1;
  cache.put(URLSHORT_NS + 'rl_' + h, JSON.stringify(rl), Math.max(60, Math.ceil((3600000 - elapsed) / 1000)));
  cache.put(URLSHORT_NS + 'code_' + h, JSON.stringify(held), 600);
  return { ok: true, remaining: 3 - rl.count };
}

// As phdVerify, under the script lock.
function urlshortVerify(email, code) {
  email = normEmail(email);
  code = String(code == null ? '' : code).trim();
  var secret = urlshortSecret();
  if (!secret) return { verified: false, reason: 'not-set-up' };
  var listed = urlshortListed(email);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(3000); } catch (e) { return { verified: false, reason: 'busy' }; }
  try {
    var cache = CacheService.getScriptCache();
    var key = URLSHORT_NS + 'code_' + otpHash(email);
    var raw = cache.get(key);
    if (!raw) return { verified: false, reason: 'expired' };
    var rec;
    try { rec = JSON.parse(raw); } catch (e2) { return { verified: false, reason: 'expired' }; }
    var left = Math.ceil((rec.exp - Date.now()) / 1000);
    if (!(left > 0)) { cache.remove(key); return { verified: false, reason: 'expired' }; }
    rec.tries = (rec.tries || 0) + 1;
    if (rec.tries > 5) { cache.remove(key); return { verified: false, reason: 'too-many' }; }
    if (listed && rec.code && code === rec.code) {
      cache.remove(key);
      var exp = Math.floor(Date.now() / 1000) + urlshortPassHours() * 3600;
      return { verified: true, token: urlshortToken(email, secret, exp), exp: exp };
    }
    cache.put(key, JSON.stringify(rec), left);
    return { verified: false, reason: 'wrong', triesLeft: Math.max(0, 5 - rec.tries) };
  } finally {
    lock.releaseLock();
  }
}

/* ------------- the link shortener's log, pulled into this spreadsheet ------------- */

// Google refuses calls from Cloudflare's servers, so the shortener keeps its events (links made
// and deleted, every visit) in a Cloudflare D1 database and this pulls them in. Run
// installShortLinkSync() once: it makes syncShortLinks() run every 5 minutes.
var URLSHORT_LOG_URL = 'https://karan98.in/api/urlshort/log';
var URLSHORT_LOG_PAGE = 500;

// The key the log endpoint takes: base64url(HMAC-SHA256(URLSHORT_GATE_SECRET, 'urlshort-log')).
function urlshortLogKey(secret) {
  var sig = Utilities.computeHmacSha256Signature('urlshort-log', secret, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '');
}

// [ column label, value from an event ]: the device columns match the contact form's names.
function urlshortClient(ev, k) {
  if (ev._client === undefined) { try { ev._client = JSON.parse(ev.client || '{}') || {}; } catch (e) { ev._client = {}; } }
  var v = ev._client[k];
  return v == null ? '' : String(v);
}
function urlshortTime(ms) { return ms ? Utilities.formatDate(new Date(ms), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a') : ''; }
var URLSHORT_PLACE_COLS = [
  ['IP', function (e) { return e.ip; }], ['Country', function (e) { return e.country; }],
  ['City', function (e) { return e.city; }], ['State', function (e) { return e.region; }],
  ['Postal', function (e) { return e.postal; }], ['Latitude', function (e) { return e.lat; }],
  ['Longitude', function (e) { return e.lon; }], ['Timezone', function (e) { return e.tz; }],
  ['ISP', function (e) { return e.isp; }], ['ASN', function (e) { return e.asn; }],
  ['Browser', function (e) { return e.browser; }], ['OS', function (e) { return e.os; }],
  ['Device type', function (e) { return e.device; }]
];
var URLSHORT_TAIL_COLS = [
  ['Accept-Language', function (e) { return e.lang; }], ['Referer', function (e) { return e.referer; }],
  ['CF colo', function (e) { return e.colo; }], ['HTTP protocol', function (e) { return e.http; }],
  ['TLS version', function (e) { return e.tls; }], ['User-Agent', function (e) { return e.ua; }]
];
var URLSHORT_MADE_COLS = [
  ['Time (IST)', function (e) { return urlshortTime(e.t); }],
  ['Event', function (e) {
    if (e.kind === 'delete') return 'Deleted';
    if (e.kind === 'denied') return 'Refused: ' + (e.result || '');
    return ({ 'new': 'Made', repeat: 'Made again (same link)', renewed: 'Renewed' })[e.result] || 'Made';
  }],
  ['Short link', function (e) { return e.code ? 'karan98.in/s/' + e.code : ''; }],
  ['Long URL', function (e) { return e.url; }],
  ['Works until (IST)', function (e) { return e.kind !== 'make' ? '' : e.expires ? urlshortTime(e.expires) : 'Never'; }],
  ['By', function (e) { return e.actor; }]
].concat(URLSHORT_PLACE_COLS, [
  ['Browser version', function (e) { return urlshortClient(e, 'browserVersion'); }],
  ['OS version', function (e) { return urlshortClient(e, 'osVersion'); }],
  ['Device model', function (e) { return urlshortClient(e, 'deviceModel'); }],
  ['Screen', function (e) { return urlshortClient(e, 'screen'); }],
  ['Viewport', function (e) { return urlshortClient(e, 'viewport'); }],
  ['Pixel ratio', function (e) { return urlshortClient(e, 'pixelRatio'); }],
  ['Colour scheme', function (e) { return urlshortClient(e, 'colorScheme'); }],
  ['Device timezone', function (e) { return urlshortClient(e, 'timezone'); }],
  ['UTC offset', function (e) { return urlshortClient(e, 'timezoneOffset'); }],
  ['Language', function (e) { return urlshortClient(e, 'language'); }],
  ['Languages', function (e) { return urlshortClient(e, 'languages'); }],
  ['Touch points', function (e) { return urlshortClient(e, 'touchPoints'); }],
  ['CPU cores', function (e) { return urlshortClient(e, 'cpuCores'); }],
  ['Device memory', function (e) { return urlshortClient(e, 'deviceMemory'); }],
  ['Network', function (e) { return urlshortClient(e, 'network'); }]
], URLSHORT_TAIL_COLS);
var URLSHORT_VISIT_COLS = [
  ['Time (IST)', function (e) { return urlshortTime(e.t); }],
  ['Short link', function (e) { return e.code ? 'karan98.in/s/' + e.code : ''; }],
  ['Result', function (e) {
    return ({ redirect: 'Opened', expired: 'Expired', 'not-found': 'Not found', error: 'Error' })[e.result] || String(e.result || '');
  }],
  ['Long URL', function (e) { return e.url; }]
].concat(URLSHORT_PLACE_COLS, URLSHORT_TAIL_COLS);

// How many rows each log tab keeps, newest first (Script Property URLSHORT_TAB_ROWS, default
// 100,000). A spreadsheet holds at most 10 million cells, and this one is the contact form's
// too: two full tabs come to about 6.6 million, so visits, however many, can't fill it.
function urlshortTabRows() {
  var n = parseInt(PropertiesService.getScriptProperties().getProperty('URLSHORT_TAB_ROWS') || '100000', 10);
  return Math.min(200000, Math.max(1000, n || 100000));
}

// The spreadsheet the contact form writes to: SHEET_ID if set, else the one this script
// belongs to (opened from the Sheet with Extensions → Apps Script).
function urlshortSpreadsheet() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';
  var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet to write to: open this script from the Sheet (Extensions → Apps Script), or set the Script Property SHEET_ID');
  return ss;
}

// The tab, made if it isn't there: last, so doPost's first tab stays the contact form's, with
// its header row frozen.
function urlshortTab(ss, name, cols) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name, ss.getNumSheets());
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[0]; })]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function urlshortAppend(ss, name, cols, events) {
  if (!events.length) return;
  var sh = urlshortTab(ss, name, cols);
  var rows = events.map(function (e) {
    return cols.map(function (c) { var v = c[1](e); return v == null ? '' : sheetSafe(v); });
  });
  var have = sh.getLastRow() - 1;                       // data rows, under the header
  var over = have + rows.length - urlshortTabRows();
  if (over > 0 && have > 0) sh.deleteRows(2, Math.min(over, have));   // the oldest go first
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, cols.length).setValues(rows);
}

// What an answer from the log means, in words that say what to do about it.
function urlshortWhy(code, text) {
  var t = String(text || '');
  if (code === 404 || code === 405) return 'karan98.in doesn\'t have the link shortener yet: merge the pull request and let its deployment finish';
  if (code === 503 && /not-set-up/.test(t)) return 'karan98.in\'s live deployment has no URLSHORT_GATE_SECRET or no D1 database: add the secret in Cloudflare (type Secret, Production), then Deployments → ⋯ → Retry deployment';
  if (code === 401) return 'this script\'s URLSHORT_GATE_SECRET isn\'t the same as Cloudflare\'s: copy one into the other (and retry the deployment if you changed Cloudflare\'s)';
  // a challenge page (403, or 503 for some modes) rather than the log's own JSON
  var challenge = /just a moment|challenge-platform|cf-chl|attention required/i.test(t);
  if (challenge || (code === 403 && !/wrong-host/.test(t))) return 'Cloudflare stopped Google\'s call, probably Bot Fight Mode (Security → Bots): turn it off, or skip it for /api/urlshort/log';
  if (code === 403) return 'the log answers only at karan98.in itself';
  if (code >= 500) return 'karan98.in had a problem; the next run tries again';
  return 'karan98.in answered in a way this script doesn\'t expect';
}

// Pulls new events into the "Short links" and "Link visits" sheets. The Function forgets events
// only once a later call shows they arrived here (it deletes ids up to `after`), so a failed run
// loses nothing: the next one fetches the same events again.
// Anything that goes wrong is thrown, so the run shows as Failed on the Executions page and
// Google's failure email says why: a Sheet that quietly stops filling would go unnoticed.
// Returns how many events it copied, or null if another run was still going.
function syncShortLinks() {
  var secret = urlshortSecret();
  if (!secret) throw new Error('syncShortLinks: add the Script Property URLSHORT_GATE_SECRET, the same value as Cloudflare\'s secret of that name (and not ICTD_GATE_SECRET\'s or PHD_GATE_SECRET\'s)');
  var lock = LockService.getUserLock(); // not the script lock, which the sign-ins hold briefly
  if (!lock.tryLock(1000)) return null; // the previous run is still going
  var wrote = 0;
  try {
    var props = PropertiesService.getScriptProperties();
    var ss = urlshortSpreadsheet();
    var key = urlshortLogKey(secret);
    for (var page = 0; page < 5; page++) {
      // "N": the Sheet has every event up to N. "N+M": a run stopped part-way through the page
      // after N, once its "Short links" rows (ids up to M) were in but before its visits were.
      var cur = String(props.getProperty('urlshort_log_last') || '0');
      var after = parseInt(cur, 10) || 0, madeDone = parseInt(cur.split('+')[1], 10) || 0;
      var resp = UrlFetchApp.fetch(URLSHORT_LOG_URL, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: false,
        headers: { Authorization: 'Bearer ' + key },
        payload: JSON.stringify({ after: after, limit: URLSHORT_LOG_PAGE })
      });
      if (resp.getResponseCode() !== 200) {
        var status = resp.getResponseCode(), text = resp.getContentText();
        throw new Error('HTTP ' + status + ': ' + urlshortWhy(status, text) + '. (It answered: ' + text.slice(0, 160) + ')');
      }
      var data;
      try { data = JSON.parse(resp.getContentText()); } catch (e) { data = null; }
      if (!data || data.ok !== true || !Array.isArray(data.events)) {
        var odd = resp.getContentText();
        throw new Error('HTTP 200: ' + urlshortWhy(200, odd) + '. (It answered: ' + odd.slice(0, 160) + ')');
      }
      var made = [], visits = [], last = after;
      data.events.forEach(function (ev) {
        if (!ev || typeof ev.id !== 'number') return;
        if (ev.id > last) last = ev.id;
        if (ev.kind === 'visit') visits.push(ev);
        else if (ev.id > madeDone) made.push(ev);
      });
      urlshortAppend(ss, 'Short links', URLSHORT_MADE_COLS, made);
      if (visits.length) props.setProperty('urlshort_log_last', after + '+' + last);
      urlshortAppend(ss, 'Link visits', URLSHORT_VISIT_COLS, visits);
      props.setProperty('urlshort_log_last', String(last));
      wrote += made.length + visits.length;
      if (data.events.length < URLSHORT_LOG_PAGE || last === after) return wrote;
    }
    return wrote;
  } catch (e) {
    console.error('syncShortLinks: ' + e);   // the next run (5 minutes) picks up where this one stopped
    throw e;
  } finally {
    lock.releaseLock();
  }
}

// Run once from the editor: it asks for permission to run on a timer and to call karan98.in.
// Safe to run again. It also makes both tabs at once and runs a first sync, so a setup problem
// shows right here, in words that say what to fix, instead of in a timer's failure email.
function installShortLinkSync() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncShortLinks') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncShortLinks').timeBased().everyMinutes(5).create();
  var ss = urlshortSpreadsheet();
  urlshortTab(ss, 'Short links', URLSHORT_MADE_COLS);
  urlshortTab(ss, 'Link visits', URLSHORT_VISIT_COLS);
  var n = syncShortLinks();   // throws, saying what to fix, if karan98.in doesn't answer as it should
  var msg = 'All set: the "Short links" and "Link visits" tabs are in "' + ss.getName() + '" and fill every 5 minutes. ' +
    (n === null ? 'A sync was already running.' : n ? n + ' event' + (n === 1 ? ' was' : 's were') + ' copied just now.' :
      'Nothing has been logged yet: make a link (or open one) and it shows here within 5 minutes.');
  console.log(msg);
  return msg;
}

/* ------------------------------- helpers --------------------------------- */

// A cell written from text that starts with = + - or @ is read as a formula. A visitor
// decides much of what lands in these rows (a message, a User-Agent, a Referer), and
// =IMAGE("https://…?"&A2) would send the Sheet's contents away when it is opened. A
// leading apostrophe keeps such text as text, and Sheets doesn't show it.
function sheetSafe(v) {
  return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function deob(b64, key) {
  var bytes = Utilities.base64Decode(b64);
  var out = [];
  for (var i = 0; i < bytes.length; i++) {
    var x = (bytes[i] & 0xff) ^ (key.charCodeAt(i % key.length) & 0xff);
    out.push(x > 127 ? x - 256 : x);
  }
  return Utilities.newBlob(out).getDataAsString('UTF-8');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
  });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
