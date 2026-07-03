/* ============================================================================
   Google Apps Script — contact form handler for karan98.in.
   Verifies the Cloudflare Turnstile token, appends a row to the bound Sheet,
   and emails you. The website posts here directly (no Cloudflare Function).

   A single FIELDS list below is the source of truth for BOTH the Sheet columns
   and the email table, so the two can never drift out of sync — add a field
   once and it shows up in the row and the email.

   Script Properties (Project Settings → Script properties):
     TURNSTILE_SECRET  - Cloudflare Turnstile *secret* key (same widget as the
                         site key in the website's data.js)
     RECIPIENT         - where to email submissions
     SHEET_ID          - (optional) spreadsheet id; otherwise the bound sheet

   Deploy: Web app · Execute as: Me · Who has access: Anyone.
   After pasting: run doPost once → Allow all permissions (Sheets + external
   service + send email) → Deploy → Manage deployments → New version.
   NOTE: if the Sheet already has an old (shorter) header row, clear the Sheet
   once (select all → delete) so the new, wider header is written fresh.
   ========================================================================== */

// [ Column label , key in the record built by doPost() ]  — order = sheet order.
var FIELDS = [
  ['Time (IST)', 'time'],
  ['Name', 'name'], ['Email', 'email'], ['Subject', 'subject'], ['Organisation', 'org'], ['Message', 'message'],
  ['IP', 'ip'], ['Country', 'country'], ['City', 'city'], ['State', 'state'], ['Postal', 'postal'],
  ['Latitude', 'latitude'], ['Longitude', 'longitude'], ['ISP', 'isp'], ['ASN', 'asn'], ['Geo accuracy', 'accuracy'],
  ['Browser', 'browser'], ['Browser version', 'browserVersion'], ['OS', 'platform'], ['OS version', 'osVersion'],
  ['Device type', 'deviceType'], ['Device model', 'deviceModel'], ['CPU arch', 'architecture'], ['Bitness', 'bitness'],
  ['Device memory', 'deviceMemory'], ['CPU cores', 'cpuCores'], ['Touch points', 'touchPoints'], ['GPU', 'gpu'],
  ['Network', 'network'], ['Screen', 'screen'], ['Viewport', 'viewport'], ['Pixel ratio', 'pixelRatio'],
  ['Colour depth', 'colorDepth'], ['Orientation', 'orientation'], ['Colour scheme', 'colorScheme'],
  ['Reduced motion', 'reducedMotion'], ['Timezone', 'timezone'], ['UTC offset', 'timezoneOffset'],
  ['Language', 'language'], ['Languages', 'languages'], ['Cookies enabled', 'cookiesEnabled'],
  ['Do Not Track', 'doNotTrack'], ['Bot', 'bot'], ['Referer', 'referer'], ['Page URL', 'pageUrl'],
  ['User-Agent', 'userAgent']
];

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('TURNSTILE_SECRET') || '';
    var recipient = props.getProperty('RECIPIENT') || Session.getEffectiveUser().getEmail();
    var sheetId = props.getProperty('SHEET_ID') || '';

    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var f = data.fields || {}, m = data.meta || {};

    // Verify Cloudflare Turnstile (bot check). Secret stays here, server-side.
    if (secret) {
      var resp = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'post',
        payload: { secret: secret, response: data.token || '', remoteip: m.ip || '' },
        muteHttpExceptions: true
      });
      var vr = {};
      try { vr = JSON.parse(resp.getContentText()); } catch (e2) {}
      if (!vr.success) return out({ ok: false, error: 'failed-captcha', codes: vr['error-codes'] || [] });
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
      network: m.network, screen: m.screen, viewport: m.viewport, pixelRatio: m.pixelRatio,
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

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
  });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
