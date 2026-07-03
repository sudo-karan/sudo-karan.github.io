/* ============================================================================
   Google Apps Script — contact form handler for karan98.in.

   Accepts TWO request shapes so the form works on Cloudflare and GitHub Pages:
     1. { secret, fields, meta }  — forwarded by the Cloudflare Function, which
        already verified Turnstile and derived IP/geo server-side. We just check
        the shared secret and record it.
     2. { obf }  — the GitHub-Pages fallback: an obfuscated blob posted straight
        from the browser. We de-obfuscate it, then verify Turnstile here.

   A single FIELDS list is the source of truth for BOTH the Sheet columns and the
   email table, so they can never drift out of sync.

   Script Properties (Project Settings → Script properties):
     TURNSTILE_SECRET  - Cloudflare Turnstile secret key (for the { obf } path)
     RECIPIENT         - where to email submissions
     SHARED_SECRET     - must equal the Cloudflare Function's SHARED_SECRET env
     OBFUSCATION_KEY   - must equal OBF_KEY in the website's app.js (defaults below)
     SHEET_ID          - (optional) spreadsheet id; otherwise the bound sheet

   Deploy: Web app · Execute as: Me · Who has access: Anyone.
   After pasting: run doPost once → Allow all permissions (Sheets + external
   service + send email) → Deploy → Manage deployments → New version.
   NOTE: if the Sheet already has an old (shorter) header row, clear the Sheet
   once (select all → delete) so the new, wider header is written fresh.
   ========================================================================== */

// Must match OBF_KEY in assets/js/app.js (overridable via the OBFUSCATION_KEY property).
var DEFAULT_OBF_KEY = '7Qp2xL9vRt4Ke1Zc8Nb3Ym6Wd5Hs0Ja';

// [ Column label , key in the record built by doPost() ]  — order = sheet order.
var FIELDS = [
  ['Time (IST)', 'time'],
  ['Name', 'name'], ['Email', 'email'], ['Subject', 'subject'], ['Organisation', 'org'], ['Message', 'message'],
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
      // Trusted path — the Cloudflare Function verified Turnstile + added geo.
      // Require SHARED_SECRET to be configured AND match (never accept unauthenticated).
      if (!sharedSecret || body.secret !== sharedSecret) return out({ ok: false, error: 'unauthorized' });
      f = body.fields || {}; m = body.meta || {};
    } else if (body.obf) {
      // Direct (GitHub Pages) path — de-obfuscate, then verify Turnstile here.
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

    // Validate required fields.
    if (!f.name || !f.email || !f.subject || !f.message) return out({ ok: false, error: 'missing-fields' });

    var istTime = m.submittedAt
      ? Utilities.formatDate(new Date(m.submittedAt), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a')
      : Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a');

    // One flat record keyed the same way as FIELDS drives both outputs.
    var rec = {
      time: istTime, name: f.name, email: f.email, subject: f.subject, org: f.org || '', message: f.message,
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

    // --- Sheet: header (kept in sync with FIELDS) + one row ---
    var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheets()[0];
    var header = FIELDS.map(function (fld) { return fld[0]; });
    var lastRow = sh.getLastRow();
    if (lastRow === 0) {
      sh.appendRow(header);
    } else if (lastRow === 1) {
      // Only a header exists (no data yet). If it's an older/narrower header from a
      // previous version, realign it in place so new wide rows don't land mislabeled.
      var have = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      if (have.length !== header.length || have[0] !== header[0]) {
        sh.getRange(1, 1, 1, have.length).clearContent();
        sh.getRange(1, 1, 1, header.length).setValues([header]);
      }
    }
    // If real data already sits under a stale header, we leave it alone (clearing the
    // sheet once, per the setup doc, is the intended migration) and just append.
    sh.appendRow(FIELDS.map(function (fld) { var v = rec[fld[1]]; return v == null ? '' : v; }));

    // --- Email: same fields, skipping the ones we couldn't capture ---
    var html = '<h2 style="font-family:Arial,sans-serif;color:#4c1d95">New message from karan98.in</h2>' +
      '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">';
    FIELDS.forEach(function (fld) {
      var v = rec[fld[1]];
      if (v == null || v === '') return; // keep the email clean — only what we captured
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

function doGet() { return out({ ok: true, note: 'POST only' }); }

// Reverse of app.js obfuscate(): base64-decode, XOR with the key, decode UTF-8.
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
