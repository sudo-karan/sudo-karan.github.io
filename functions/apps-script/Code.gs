/* ============================================================================
   Google Apps Script — paste into a Google Sheet's Apps Script editor
   (Extensions → Apps Script), then Deploy as a Web App. The site posts here
   directly; this script verifies the Cloudflare Turnstile token, appends a row
   to the Sheet, and emails you. No Cloudflare Function needed.

   Script Properties to set (Project Settings → Script properties):
     TURNSTILE_SECRET  - your Cloudflare Turnstile *secret* key (bot check)
     RECIPIENT         - where to email submissions (e.g. jaskaran.pta@gmail.com)
     SHEET_ID          - (optional) target spreadsheet id; defaults to bound sheet

   Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone.
   After editing, redeploy: Manage deployments → edit → Version: New version.
   ========================================================================== */

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('TURNSTILE_SECRET') || '';
    var recipient = props.getProperty('RECIPIENT') || Session.getEffectiveUser().getEmail();
    var sheetId = props.getProperty('SHEET_ID') || '';

    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var f = data.fields || {}, m = data.meta || {};
    Logger.log('doPost: hasToken=%s secretConfigured=%s fields=%s', !!data.token, !!secret, JSON.stringify(f));

    // Verify Cloudflare Turnstile (the bot check). Secret stays here, server-side.
    if (secret) {
      var resp = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'post',
        payload: { secret: secret, response: data.token || '', remoteip: m.ip || '' },
        muteHttpExceptions: true
      });
      var vr = {};
      try { vr = JSON.parse(resp.getContentText()); } catch (e2) {}
      Logger.log('turnstile: success=%s codes=%s', vr.success, JSON.stringify(vr['error-codes'] || []));
      if (!vr.success) return out({ ok: false, error: 'failed-captcha', codes: vr['error-codes'] || [] });
    } else {
      Logger.log('turnstile: SKIPPED (TURNSTILE_SECRET not set)');
    }

    // Basic server-side validation (don't trust the client alone)
    if (!f.name || !f.email || !f.subject || !f.message) { Logger.log('rejected: missing-fields'); return out({ ok: false, error: 'missing-fields' }); }

    var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheets()[0];

    var headers = ['Time (IST)', 'Name', 'Email', 'Subject', 'Organisation', 'Message',
      'IP', 'Browser', 'Platform', 'ISP', 'ASN', 'Country', 'City', 'State', 'Postal',
      'Latitude', 'Longitude', 'Accuracy', 'Timezone', 'Language', 'Screen', 'Referer', 'Bot', 'User-Agent'];
    if (sh.getLastRow() === 0) sh.appendRow(headers);

    var istTime = m.submittedAt
      ? Utilities.formatDate(new Date(m.submittedAt), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a')
      : Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a');

    Logger.log('writing row + emailing %s', recipient);
    sh.appendRow([istTime, f.name, f.email, f.subject, f.org, f.message,
      m.ip, m.browser, m.platform, m.isp, m.asn, m.country, m.city, m.state, m.postal,
      m.latitude, m.longitude, m.accuracy, m.timezone, m.language, m.screen, m.referer, 'No', m.userAgent]);

    var rows = [
      ['Name', f.name], ['Email', f.email], ['Subject', f.subject], ['Organisation', f.org || '—'], ['Message', f.message],
      ['', ''],
      ['Time (IST)', istTime], ['IP', m.ip], ['Browser', m.browser], ['Platform', m.platform],
      ['ISP', m.isp], ['Location', [m.city, m.state, m.country].filter(String).join(', ')],
      ['Lat / Long', (m.latitude || '') + ', ' + (m.longitude || '') + ' (' + (m.accuracy || '') + ')'],
      ['Timezone', m.timezone], ['Language', m.language], ['Referer', m.referer || '—'], ['User-Agent', m.userAgent]
    ];
    var html = '<h2 style="font-family:Arial,sans-serif">New message from karan98.in</h2>' +
      '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">';
    rows.forEach(function (r) {
      html += '<tr><td style="color:#6d28d9;vertical-align:top;border-bottom:1px solid #eee"><b>' + esc(r[0]) +
        '</b></td><td style="border-bottom:1px solid #eee">' + esc(r[1]).replace(/\n/g, '<br>') + '</td></tr>';
    });
    html += '</table>';

    MailApp.sendEmail({
      to: recipient,
      replyTo: f.email || recipient,
      subject: 'New message: ' + (f.subject || '(no subject)'),
      htmlBody: html,
      name: 'karan98.in contact form'
    });

    Logger.log('done: ok');
    return out({ ok: true });
  } catch (err) {
    Logger.log('ERROR: ' + err);
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
