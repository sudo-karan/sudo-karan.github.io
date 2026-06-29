/* ============================================================================
   Google Apps Script — paste this into a Google Sheet's Apps Script editor
   (Extensions → Apps Script), then deploy as a Web App. It receives verified
   submissions from the Cloudflare Pages Function (functions/api/contact.js),
   appends a row to the Sheet, and emails you. See CONTACT_FORM_SETUP.md.

   Script Properties to set (Project Settings → Script properties):
     SHARED_SECRET  - must match the SHARED_SECRET env var in Cloudflare Pages
     RECIPIENT      - where to email submissions (e.g. jaskaran.pta@gmail.com)
     SHEET_ID       - (optional) target spreadsheet id; defaults to the bound one
   ========================================================================== */

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('SHARED_SECRET') || '';
    var recipient = props.getProperty('RECIPIENT') || Session.getEffectiveUser().getEmail();
    var sheetId = props.getProperty('SHEET_ID') || '';

    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Only the Cloudflare Function (which knows the shared secret) may write.
    if (expected && data.secret !== expected) return out({ ok: false, error: 'unauthorized' });

    var f = data.fields || {}, m = data.meta || {};

    var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheets()[0];

    var headers = ['Time (IST)', 'Name', 'Email', 'Subject', 'Organisation', 'Message',
      'IP', 'Browser', 'Platform', 'ISP', 'ASN', 'Country', 'City', 'State', 'Postal',
      'Latitude', 'Longitude', 'Accuracy', 'Timezone', 'Colo', 'HTTP', 'TLS', 'Language', 'Referer', 'Bot', 'User-Agent'];
    if (sh.getLastRow() === 0) sh.appendRow(headers);

    var istTime = m.submittedAt
      ? Utilities.formatDate(new Date(m.submittedAt), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a')
      : Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a');

    sh.appendRow([istTime, f.name, f.email, f.subject, f.org, f.message,
      m.ip, m.browser, m.platform, m.isp, m.asn, m.country, m.city, m.state, m.postalCode,
      m.latitude, m.longitude, m.accuracy, m.timezone, m.colo, m.httpProtocol, m.tlsVersion,
      m.language, m.referer, m.bot, m.userAgent]);

    var rows = [
      ['Name', f.name], ['Email', f.email], ['Subject', f.subject], ['Organisation', f.org || '—'], ['Message', f.message],
      ['', ''],
      ['Time (IST)', istTime], ['IP', m.ip], ['Browser', m.browser], ['Platform', m.platform],
      ['ISP', m.isp], ['Location', [m.city, m.state, m.country].filter(String).join(', ')],
      ['Lat / Long', (m.latitude || '') + ', ' + (m.longitude || '') + ' (' + (m.accuracy || '') + ')'],
      ['Timezone', m.timezone], ['Language', m.language], ['Referer', m.referer || '—'],
      ['Bot', m.bot], ['User-Agent', m.userAgent]
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
