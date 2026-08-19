/* ============================================================================
   Google Apps Script — contact form handler for karan98.in.

   doPost accepts TWO request shapes so the form works on Cloudflare and GitHub Pages:
     1. { secret, fields, meta }  — forwarded by the Cloudflare Function (shared-secret).
     2. { obf }  — obfuscated blob posted from the browser (Turnstile verified here).

   doGet is a JSONP endpoint for the optional email-OTP verification:
     ?action=send-otp&email=…&callback=…    → emails a 6-digit code
     ?action=verify-otp&email=…&code=…&callback=…  → checks it

   A single FIELDS list is the source of truth for BOTH the Sheet columns and the
   email table.

   Script Properties (Project Settings → Script properties):
     TURNSTILE_SECRET  - Cloudflare Turnstile secret key (for the { obf } path)
     RECIPIENT         - where to email submissions
     SHARED_SECRET     - must equal the Cloudflare Function's SHARED_SECRET env
     OBFUSCATION_KEY   - must equal OBF_KEY in the website's app.js (defaults below)
     OTP_DAILY_CAP     - (optional) max verification codes/day (default 85); the rest
                         of Gmail's ~100/day stays reserved for message notifications
     SHEET_ID          - (optional) spreadsheet id; otherwise the bound sheet

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

    // --- Email-verified status (server-authoritative: we trust our OWN cache, not
    // the browser's claim). 'sent_' marks that a code was actually emailed to this
    // address, so "code sent but never confirmed" is detected here and can't be
    // hidden by skipping the prompt or tampering with the payload. ---
    var emailVerified = 'Not verified';
    try {
      var eh = otpHash(String(f.email).trim().toLowerCase());
      var vcache = CacheService.getScriptCache();
      if (vcache.get('ver_' + eh)) {
        emailVerified = 'OTP-verified ✅';
        vcache.remove('ver_' + eh); // one-time — applies to this message
      } else if (vcache.get('sent_' + eh) || m.otpStatus === 'sent-ignored') {
        emailVerified = 'OTP sent, not verified ⚠️'; // a code was emailed but never confirmed
      } else if (m.otpStatus === 'attempted-failed') {
        emailVerified = 'Verification unavailable ⚠️'; // the code couldn't be sent (service/quota)
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
    sh.appendRow(FIELDS.map(function (fld) { var v = rec[fld[1]]; return v == null ? '' : v; }));

    var html = '<h2 style="font-family:Arial,sans-serif;color:#4c1d95">New message from karan98.in</h2>' +
      '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">';
    FIELDS.forEach(function (fld) {
      var v = rec[fld[1]];
      if (v == null || v === '') return;
      html += '<tr><td style="color:#6d28d9;vertical-align:top;border-bottom:1px solid #eee;white-space:nowrap"><b>' +
        esc(fld[0]) + '</b></td><td style="border-bottom:1px solid #eee">' + esc(v).replace(/\n/g, '<br>') + '</td></tr>';
    });
    html += '</table>';

    MailApp.sendEmail({
      to: recipient,
      replyTo: f.email || recipient,
      subject: 'New message: ' + (f.subject || '(no subject)'),
      htmlBody: html,
      name: 'karan98.in contact form'
    });

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
  if (action === 'send-otp') result = sendOtp(p.email);
  else if (action === 'verify-otp') result = verifyOtp(p.email, p.code);
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

function sendOtp(email) {
  email = normEmail(email);
  if (!validEmail(email)) return { sent: false, reason: 'bad-email' };
  var cache = CacheService.getScriptCache();
  var h = otpHash(email);
  // Fixed 1-hour window per email, max 3 codes (1 initial + 2 resends).
  var now = Date.now();
  var rl;
  try { rl = JSON.parse(cache.get('rl_' + h) || 'null'); } catch (e) { rl = null; }
  if (!rl || (now - rl.first) >= 3600000) rl = { count: 0, first: now };
  var elapsed = now - rl.first;
  if (rl.count >= 3) {
    return { sent: false, reason: 'rate-limit', retryMins: Math.max(1, Math.ceil((3600000 - elapsed) / 60000)) };
  }
  if (!otpReserve()) return { sent: false, reason: 'quota' };
  var code = String(Math.floor(100000 + Math.random() * 900000));
  var body = 'Your karan98.in verification code is:\n\n    ' + code +
    '\n\nIt expires in 10 minutes. If you didn’t request this, you can safely ignore this email.\n\n— karan98.in';
  try {
    MailApp.sendEmail({ to: email, subject: 'Your karan98.in verification code', body: body, name: 'karan98.in' });
  } catch (err) {
    return { sent: false, reason: 'send-failed' };
  }
  rl.count += 1;
  var ttl = Math.max(60, Math.ceil((3600000 - elapsed) / 1000)); // expire at the 1-hour edge
  cache.put('rl_' + h, JSON.stringify(rl), ttl);
  cache.put('sent_' + h, '1', ttl);                              // "a code was delivered here"
  cache.put('code_' + h, JSON.stringify({ code: code, tries: 0 }), 600); // 10 min
  return { sent: true, remaining: 3 - rl.count }; // codes left after this one (2, then 1, then 0)
}

function verifyOtp(email, code) {
  email = normEmail(email);
  code = String(code == null ? '' : code).trim();
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
    cache.remove('sent_' + h);       // verified supersedes the "code delivered" flag
    cache.put('ver_' + h, '1', 900); // verified for 15 min — long enough to submit
    return { verified: true };
  }
  cache.put('code_' + h, JSON.stringify(rec), 600);
  return { verified: false, reason: 'wrong', triesLeft: Math.max(0, 5 - rec.tries) };
}

/* ------------------------------- helpers --------------------------------- */

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
