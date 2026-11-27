/* karan98.in/urlshort: the link shortener.
   Plain JS in one IIFE with no globals of its own (the vendored QR library defines
   `qrcode`, and a sign-in code request defines its JSONP callback while it is out).
   Strings from the user, the server or storage only ever reach the page through
   textContent and setAttribute, and every localStorage access is guarded. */
(function () {
  'use strict';

  var API = '/api/urlshort';
  // The Apps Script that emails sign-in codes: contact.fallbackEndpoint in assets/js/data.js,
  // which this page doesn't load. Google sends no CORS headers, so it answers in JSONP.
  var CODE_SERVICE = 'https://script.google.com/macros/s/AKfycbx-6-WldWnNAUi5_32S-lzvAVF2ndzKoatiOGCeaAVbYQLNilbpnyMo2dE46pn7hXAO/exec';
  var KEY_STORE = 'urlshort:key';
  var PASS_STORE = 'urlshort:pass';
  var RECENT_STORE = 'urlshort:recent';
  var MAX_RECENT = 200;      // the list is the only place a link can be deleted, so keep plenty
  var SHOWN_RECENT = 20;     // … and show the newest of them until "Show all" is pressed
  var SVGNS = 'http://www.w3.org/2000/svg';
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
  var CODE_RE = /^[a-z0-9-]{1,64}$/;
  var KEY_RE = /^[\x20-\x7e]{1,1024}$/;     // what an HTTP header can carry (keys are trimmed first)
  var PASS_RE = /^[A-Za-z0-9_-]{8,2048}\.[A-Za-z0-9_-]{16,128}$/;   // base64url claim, a dot, its signature
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;                       // what the Apps Script accepts
  var BIDI_RE = /[‎‏‪-‮⁦-⁩]/g;
  // A link lasts from 10 minutes to 30 days, 24 hours unless chosen. Only the owner key
  // can also keep one for good.
  var TTL_MIN = 600, TTL_MAX = 2592000, TTL_DEFAULT = 86400;

  var MSG = {
    emptyUrl: 'Paste a long link first.',
    badUrl: 'That doesn’t look like a web address. Try something like example.com/page.',
    tooLong: 'That link is longer than 4,096 characters, which is the most a short link can hold.',
    scheme: 'Only web links, starting with http or https, can be shortened.',
    selfLink: 'That’s already a karan98.in short link. Paste the original long link instead.',
    creds: 'Links with a name or password before the @ can’t be shortened. Remove that part and try again.',
    email: 'That looks like an email address. Paste a web link instead.',
    badSlug: 'Use 3–40 letters, numbers or hyphens, with no hyphen at either end.',
    slugTaken: 'That ending is already taken. Try another, or leave it blank.',
    needKey: 'Enter the owner key to continue.',
    badKey: 'That key didn’t work. Check it and try again.',
    staleKey: 'The remembered key didn’t work. Enter the current one.',
    staleTabKey: 'The key entered earlier didn’t work. Enter the current one.',
    keyChars: 'That key didn’t work: a key can only use plain keyboard characters.',
    keyLong: 'That key didn’t work: a key can be at most 1,024 characters.',
    keyToDelete: 'Enter the owner key to finish deleting the link.',
    needEmail: 'Enter your email address to get a code.',
    badEmail: 'That doesn’t look like an email address. Check it and try again.',
    codeSent: 'If that address is on the list, a code is on its way.',
    needCode: 'Enter the 6-digit code from the email.',
    wrongCode: 'That code isn’t right. Check it and try again.',
    lastTry: 'That code isn’t right, and that was its last try. Send a new code.',
    codeExpired: 'That code has expired. Send a new code.',
    tooManyTries: 'Too many wrong tries for that code. Send a new code.',
    signInBusy: 'The sign-in service is busy. Try again in a moment.',
    signInOff: 'Signing in by email isn’t switched on yet.',
    quota: 'No more sign-in codes can be sent today. Please try again tomorrow.',
    signInOffline: 'Couldn’t reach the sign-in service. Check your connection and try again.',
    sendFailed: 'Couldn’t send a code just now. Please try again.',
    signInFailed: 'Couldn’t sign you in just now. Please try again.',
    signToDelete: 'Sign in to finish deleting the link.',
    passExpired: 'Your sign-in has run out. Send a new code to carry on.',
    passRejected: 'That sign-in wasn’t accepted. Send a new code to carry on.',
    notYours: 'Only the person who made this link, or the site’s owner, can delete it.',
    ttlEmpty: 'Enter how long the link should last.',
    ttlNaN: 'Enter a number, like 90 minutes or 3 days.',
    ttlShort: 'A link has to last at least 10 minutes.',
    ttlLong: 'A link can last at most 30 days.',
    badTtl: 'That length isn’t allowed here. Choose from 10 minutes to 30 days.',
    neverGone: '“Never” is only for the owner key, so the link will last 24 hours.',
    notSetUp: 'The shortener isn’t switched on yet.',
    wrongHost: 'Links can only be made and deleted at karan98.in/urlshort.',
    clipEmpty: 'The clipboard is empty. Copy a link first, then tap Paste.',
    clipDenied: 'Couldn’t read the clipboard. Press and hold the field to paste instead.',
    copyKeys: 'Couldn’t copy automatically. Select the link and copy it with Ctrl+C or ⌘C.',
    copyTouch: 'Couldn’t copy automatically. Press and hold the link to copy it.',
    listTabOnly: 'This browser’s storage is full, so this list is kept for this tab only.',
    listOff: 'This browser isn’t keeping data for this site, so this list is kept for this tab only.',
    listGone: 'That link is already off the list.',
    offline: 'Couldn’t reach the shortener. Check your connection and try again.',
    server: 'Something went wrong on the server. Please try again.',
    deleteFailed: 'Couldn’t delete that link. Please try again.'
  };

  function $(id) { return document.getElementById(id); }
  var form = $('shortenForm');
  if (!form) return;
  // Never work inside a frame: the page around it could steer clicks into making or
  // deleting links. _headers forbids framing /urlshort; this covers any address that
  // slips past (an odd spelling of it, a copy served elsewhere).
  if (window.top !== window.self) {
    var framed = document.querySelectorAll('.tool, .recent');
    for (var fi = 0; fi < framed.length; fi++) framed[fi].hidden = true;
    return;
  }

  var urlIn = $('url'), slugIn = $('slug'), keyIn = $('ownerKey'), rememberIn = $('rememberKey');
  var keyBox = $('keyBox'), shortenBtn = $('shorten'), btnLabel = shortenBtn.querySelector('.btn-label');
  var note = $('formNote'), noteText = $('formNoteText'), retryBtn = $('retry'), forgetBtn = $('forgetKey');
  var keyState = $('keyState'), keyStateText = $('keyStateText'), keyStateIcon = $('keyStateIcon'), signOutBtn = $('signOut');
  var emailMode = $('emailMode'), emailIn = $('email'), sendBtn = $('sendCode'), codeField = $('codeField');
  var otpIn = $('otp'), verifyBtn = $('verify'), resendBtn = $('resend'), modeBtn = $('modeSwitch'), keyField = $('keyField');
  var ttlChips = $('ttlChips'), ttlCustom = $('ttlCustom'), ttlNum = $('ttlNum'), ttlUnit = $('ttlUnit'), ttlHint = $('ttlHint');
  var neverChip = $('ttlNever'), ttlInputs = ttlChips.querySelectorAll('input[name="ttl"]');
  var neverIn = neverChip.querySelector('input'), defaultIn = ttlChips.querySelector('input[value="' + TTL_DEFAULT + '"]');
  var pasteBtn = $('paste'), statusEl = $('status'), result = $('result'), shortA = $('short'), openA = $('open');
  var copyBtn = $('copy'), shareBtn = $('share'), againBtn = $('again'), copyMsg = $('copyMsg'), ksNote = $('ksNote');
  var qrBox = $('qr'), qrFigure = $('qrFigure'), qrSave = $('qrSave'), qrSvgBtn = $('qrSvg');
  var origEl = $('orig'), dateEl = $('resultDate'), resultExp = $('resultExp'), resultExpText = $('resultExpText');
  var list = $('recent'), emptyBox = $('recentEmpty'), countEl = $('recentCount'), recentTitle = $('recentTitle');
  var moreBox = $('recentMoreBox'), moreBtn = $('recentMore');

  var fields = {
    url: { input: urlIn, box: $('urlField'), err: $('urlErr') },
    slug: { input: slugIn, box: $('slugField'), err: $('slugErr') },
    ttl: { input: ttlNum, box: ttlCustom, err: $('ttlErr') },
    key: { input: keyIn, box: keyField, err: $('keyErr') },
    email: { input: emailIn, box: $('emailField'), err: $('emailErr') },
    otp: { input: otpIn, box: codeField, err: $('codeErr') }
  };

  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(motion && motion.matches); }
  var coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  function touch() { return !!(coarse && coarse.matches); }

  /* ---- storage: always guarded; the page keeps working in memory without it ---- */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  // '' if storage takes writes; else 'full' (the space every page on karan98.in shares is
  // used up, though what is there can still be read) or 'off' (the browser keeps no data)
  var lsWhy = (function () {
    try { window.localStorage.setItem('urlshort:probe', '1'); window.localStorage.removeItem('urlshort:probe'); return ''; }
    catch (e) {
      var n = e && e.name, c = e && e.code;
      return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || c === 22 || c === 1014 ? 'full' : 'off';
    }
  }());
  var lsOk = !lsWhy;   // the stored list is this tab's list (false: this tab's changes didn't fit)

  /* ---- who makes links: the owner key, or a pass from an email code ---- */
  function cleanKey(v) {
    v = typeof v === 'string' ? v.trim() : '';
    return KEY_RE.test(v) ? v : '';
  }
  function normEmail(v) { return typeof v === 'string' ? v.trim().toLowerCase() : ''; }
  // A pass is the claim { email, exp (seconds), aud } as base64url JSON, a dot, and the
  // Apps Script's signature over it. Only the server can check the signature: the page
  // reads the claim to say who is signed in. Anything else counts as no pass.
  function readPass(t) {
    if (typeof t !== 'string' || !PASS_RE.test(t)) return null;
    var c;
    try {
      var b = t.slice(0, t.indexOf('.')).replace(/-/g, '+').replace(/_/g, '/'), bin, pct = '';
      while (b.length % 4) b += '=';
      bin = window.atob(b);
      for (var i = 0; i < bin.length; i++) pct += '%' + ('0' + bin.charCodeAt(i).toString(16)).slice(-2);
      c = JSON.parse(window.decodeURIComponent(pct));   // the claim is UTF-8
    } catch (e) { return null; }
    if (!c || typeof c !== 'object' || c.aud !== 'urlshort') return null;
    var email = normEmail(c.email);
    if (email.length > 254 || !EMAIL_RE.test(email)) return null;
    if (typeof c.exp !== 'number' || !isFinite(c.exp) || c.exp <= 0) return null;
    return { token: t, email: email, exp: c.exp };
  }

  // One credential at a time, in this tab and in storage: the newest one saved, by any tab, wins.
  var memKey = cleanKey(lsGet(KEY_STORE));   // the owner key in use, remembered or for this tab only
  var remembered = !!memKey;
  var memPass = memKey ? null : readPass(lsGet(PASS_STORE));   // else the pass in use
  var passSaved = !!memPass;
  var lastEmail = '';   // the address to offer again when a new code is needed
  // A pass that ran out while the page was closed would only be refused. (While the page is
  // open, the server's answer decides, so a fresh pass is never dropped for this device's clock.)
  if (memPass && memPass.exp * 1000 <= Date.now()) {
    lastEmail = memPass.email;
    memPass = null;
    passSaved = false;
    lsDel(PASS_STORE);
  }
  var memRecent = null;        // this tab's own copy of the list, once a change to it couldn't be saved
  var mode = 'email';          // what the sign-in panel asks for: 'email' (a code) or 'key'
  var pendingCreate = false;   // a link waits to be made until the panel has a sign-in
  var pendingDelete = '';      // the code of a delete that waits for a sign-in
  var signing = false;         // a sign-in code request is out
  var sentTo = '';             // the address the code field is for ('' until a code is sent)

  function httpUrl(s) {
    if (typeof s !== 'string' || !s || s.length > 8192) return '';
    try {
      var u = new URL(s);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
    } catch (e) { return ''; }
  }
  function shortFor(s, code) {
    var h = httpUrl(s);
    return h && /\/s\/[a-z0-9-]+$/i.test(h) ? h : 'https://karan98.in/s/' + code;
  }
  // when a link stops working, in ms: 0 for never; undefined when not known (links made
  // before links could expire, which never do)
  function expiry(v) { return typeof v === 'number' && v >= 0 && v < 8.64e15 ? Math.floor(v) : undefined; }
  function cleanEntry(o) {
    if (!o || typeof o !== 'object') return null;
    var code = typeof o.code === 'string' ? o.code.toLowerCase() : '';
    if (!CODE_RE.test(code)) return null;
    var t = typeof o.t === 'number' && o.t > 0 && o.t < 8.64e15 ? o.t : 0;
    var out = { code: code, short: shortFor(o.short, code), url: httpUrl(o.url), t: t }, x = expiry(o.x);
    if (x !== undefined) out.x = x;
    return out;
  }
  function readRecent() {
    var raw = memRecent;
    // storage, unless this tab holds changes it couldn't save (full storage still reads)
    if (lsOk || !raw) {
      raw = [];
      var s = lsGet(RECENT_STORE);
      if (s) { try { raw = JSON.parse(s); } catch (e) { raw = []; } }
    }
    if (!Array.isArray(raw)) raw = [];
    var out = [], seen = Object.create(null);
    for (var i = 0; i < raw.length && out.length < MAX_RECENT; i++) {
      var e = cleanEntry(raw[i]);
      if (e && !seen[e.code]) { seen[e.code] = true; out.push(e); }
    }
    return out;
  }
  // Saves the list, newest first. Returns '' or, when not all of it could be saved, what
  // to tell the user. Storage is shared with every page on karan98.in and can fill up:
  // then as many of the newest are saved as fit (fewer always fit in less room). If not
  // even the newest fits, or the browser keeps no data, the list stays in this tab's
  // memory, and every later change tries storage again.
  function saveRecent(items) { return lsSet(RECENT_STORE, JSON.stringify(items)); }
  function writeRecent(items) {
    memRecent = items.slice(0, MAX_RECENT);
    if (saveRecent(memRecent)) { lsOk = true; return ''; }
    var lo = 0, hi = memRecent.length;   // the newest lo fit; the newest hi don't
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (saveRecent(memRecent.slice(0, mid))) lo = mid; else hi = mid;
    }
    // each write that worked was bigger than the one before, so the last is the newest lo
    if (!lo) { lsOk = false; return lsWhy === 'off' ? MSG.listOff : MSG.listTabOnly; }
    lsOk = true;
    var gone = items.length - lo;   // counting one the 200 cap drops on the way
    return 'This browser’s storage is full, so the ' + (gone === 1 ? 'oldest link is' : gone + ' oldest links are') +
      ' off the list. ' + (gone === 1 ? 'It still works.' : 'They still work.');
  }

  /* ---- small DOM helpers (no innerHTML anywhere) ---- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(name) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', 'i');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var u = document.createElementNS(SVGNS, 'use');
    u.setAttribute('href', '#i-' + name);
    s.appendChild(u);
    return s;
  }
  function bare(u) { return String(u).replace(/^https?:\/\//i, ''); }
  function splitShort(u) {
    var b = bare(u), i = b.lastIndexOf('/') + 1;
    return [b.slice(0, i), b.slice(i)];
  }
  function prettyUrl(u) {
    try {
      var x = new URL(u), rest = x.pathname + x.search + x.hash;
      try { rest = decodeURI(rest); } catch (e) { /* keep it encoded */ }
      return [x.host.replace(/^www\./i, ''), rest === '/' ? '' : rest.replace(BIDI_RE, '')];
    } catch (e) { return [String(u || ''), '']; }
  }
  function fillShort(a, short) {
    var p = splitShort(short);
    a.textContent = '';
    a.appendChild(el('span', 'host', p[0]));
    a.appendChild(el('span', 'code', p[1]));
  }
  // The destination without its scheme: the host in ink, then the rest. With `wrap`
  // (the keepsake's two-line caption) the rest prefers to break after / ? & # or =.
  function fillOrig(node, url, wrap) {
    node.textContent = '';
    if (!url) { node.removeAttribute('title'); return; }
    var p = prettyUrl(url);
    node.appendChild(el('span', 'o-host', p[0]));
    if (p[1]) {
      var path = el('span', 'o-path');
      if (wrap) {
        var parts = p[1].split(/([/?&#=])/), buf = '';
        for (var i = 0; i < parts.length; i++) {
          buf += parts[i];
          if (i % 2 === 1) {   // a separator closes a chunk
            path.appendChild(document.createTextNode(buf));
            path.appendChild(document.createElement('wbr'));
            buf = '';
          }
        }
        if (buf) path.appendChild(document.createTextNode(buf));
      } else {
        path.textContent = p[1];
      }
      node.appendChild(path);
    }
    node.setAttribute('title', url);
  }

  var dateFmt = null, dayFmt = null;
  try {
    dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  } catch (e) { /* plain dates below */ }
  function fmtDate(t) { var d = new Date(t); return dateFmt ? dateFmt.format(d) : d.toDateString(); }
  function ago(t) {
    var s = (Date.now() - t) / 1000;
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    if (s < 7 * 86400) { var n = Math.floor(s / 86400); return n + (n === 1 ? ' day ago' : ' days ago'); }
    var d = new Date(t);
    if (d.getFullYear() === new Date().getFullYear() && dayFmt) return dayFmt.format(d);
    return fmtDate(t);
  }
  // "28 Nov 2026, 4:48 pm", in this device's time
  function fmtWhen(t) {
    var d = new Date(t), h = d.getHours(), m = d.getMinutes();
    return fmtDate(t) + ', ' + (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm');
  }
  // a recent row's word on when its link stops working, to the nearest minute or hour
  function expiresIn(x) {
    if (x === 0) return 'Never expires';
    var left = x - Date.now();
    if (left <= 0) return 'Expired';
    var mins = Math.max(1, Math.round(left / 60000));
    if (mins < 60) return 'Expires in ' + mins + ' min';
    var hrs = Math.round(left / 3600000);
    if (hrs <= 24) return 'Expires in ' + hrs + ' h';
    var d = new Date(x);
    return 'Expires ' + (d.getFullYear() === new Date().getFullYear() && dayFmt ? dayFmt.format(d) : fmtDate(x));
  }

  /* ---- announcements and field errors ---- */
  var announceTimer = 0;
  function announce(msg) {
    statusEl.textContent = '';
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { statusEl.textContent = msg; }, 50);
  }
  // A fault in what was typed: marked on the field, said, and focused. `how` 'say' shows a
  // word that isn't one (the sign-in service is down, say) without marking the field, and
  // 'calm' also sets it in ink instead of red. `to`: focus that instead, or nothing (null).
  function setError(name, msg, how, to) {
    var f = fields[name];
    f.err.lastElementChild.textContent = msg;
    f.err.classList.toggle('calm', how === 'calm');
    f.err.hidden = false;
    f.box.classList.toggle('invalid', !how);
    if (how) f.input.removeAttribute('aria-invalid');
    else f.input.setAttribute('aria-invalid', 'true');
    if (to !== null) (to || f.input).focus();
    announce(msg);
  }
  function clearError(name) {
    var f = fields[name];
    if (f.err.hidden) return;
    f.err.hidden = true;
    f.err.classList.remove('calm');
    // aria-describedby still points here, and hidden text it points at is read out
    f.err.lastElementChild.textContent = '';
    f.box.classList.remove('invalid');
    f.input.removeAttribute('aria-invalid');
  }
  function showNote(msg, retry, calm) {
    noteText.textContent = msg;
    note.classList.toggle('calm', !!calm);
    retryBtn.hidden = !retry;
    note.hidden = false;
    announce(msg);
  }
  function hideNote() { note.hidden = true; }

  /* ---- how long a link lasts ---- */
  function checkedTtl() {
    for (var i = 0; i < ttlInputs.length; i++) if (ttlInputs[i].checked) return ttlInputs[i];
    return defaultIn;
  }
  function syncCustom() { ttlCustom.hidden = ttlHint.hidden = checkedTtl().value !== 'custom'; }
  // in seconds, 0 for never; or, for a custom length that won't do, what is wrong with it
  function readTtl() {
    var c = checkedTtl();
    if (c.value !== 'custom') return Number(c.value);
    var s = ttlNum.value.trim().replace(',', '.');
    if (!s) return MSG.ttlEmpty;
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return MSG.ttlNaN;
    var secs = Math.round(parseFloat(s) * Number(ttlUnit.value));
    return secs < TTL_MIN ? MSG.ttlShort : secs > TTL_MAX ? MSG.ttlLong : secs;
  }
  // on the custom length when that is chosen, else said under the choices
  function ttlProblem(msg) {
    var c = checkedTtl();
    if (c.value === 'custom') setError('ttl', msg);
    else setError('ttl', msg, 'say', c);
  }
  var lastPreset = TTL_DEFAULT;   // what Custom starts from: the length chosen before it
  // "Never" is the owner key's: shown while that is in use or being asked for. Losing it
  // while chosen (Forget key, say) falls back to 24 hours, and says so; `quiet` at load,
  // where a browser may have brought back a choice the page no longer offers.
  function syncNever(quiet) {
    var on = !!memKey || (keyOpen() && mode === 'key');
    ttlChips.classList.toggle('has-never', on);
    neverChip.hidden = !on;
    if (on || !neverIn.checked) return;
    defaultIn.checked = true;
    lastPreset = TTL_DEFAULT;
    syncCustom();
    if (!quiet) setError('ttl', MSG.neverGone, 'calm', null);
  }
  // in words that read well: 10 minutes, 60 minutes, 24 hours, 7 days
  function prefillCustom() {
    var s = lastPreset;
    var unit = s >= 172800 && s % 86400 === 0 ? 86400 : s >= 7200 && s % 3600 === 0 ? 3600 : s ? 60 : 3600;
    ttlNum.value = String(s ? s / unit : 24);
    ttlUnit.value = String(unit);
  }
  ttlChips.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t || t.name !== 'ttl') return;
    clearError('ttl');
    if (t.value !== 'custom') lastPreset = Number(t.value);
    else if (!ttlNum.value.trim()) prefillCustom();
    syncCustom();
  });
  ttlNum.addEventListener('input', function () { clearError('ttl'); });
  ttlUnit.addEventListener('change', function () { clearError('ttl'); });

  /* ---- the sign-in panel: an email code, or the owner key ---- */
  function keyOpen() { return !keyBox.hidden; }
  function haveCred() { return !!(memKey || memPass); }
  function codeStep() { return !codeField.hidden; }
  function panelField() { return mode === 'key' ? keyIn : codeStep() ? otpIn : emailIn; }
  function setMode(m) {
    mode = m;
    emailMode.hidden = m !== 'email';
    keyField.hidden = m !== 'key';
    modeBtn.textContent = m === 'email' ? 'Use the owner key instead' : 'Use an email code instead';
    syncNever();
  }
  function openKeyBox(m) {
    if (!keyOpen()) {
      // a new code is asked for with the address used last
      if (!emailIn.value && lastEmail) emailIn.value = lastEmail;
      keyBox.hidden = false;
      keyBox.classList.remove('opening');
      void keyBox.offsetWidth;   // restart the unfold
      keyBox.classList.add('opening');
      // the panel grows as it unfolds, so the field given focus can end up below the fold
      keyBox.addEventListener('animationend', function shown(ev) {
        if (ev.target !== keyBox) return;
        keyBox.removeEventListener('animationend', shown);
        var f = document.activeElement;
        if (f && keyBox.contains(f)) bringIntoView(f);
      });
    }
    if (m && m !== mode) setMode(m); else syncNever();
    syncPaste();
  }
  function closeKeyBox() {
    keyBox.hidden = true;
    keyBox.classList.remove('opening');
    keyIn.value = '';
    clearError('key');
    clearError('email');
    resetCode();
    pendingDelete = '';
    pendingCreate = false;
    syncNever();
    syncPaste();
  }
  // back to asking for an address: a code is only good for the address it went to
  function resetCode() {
    sentTo = '';
    codeField.hidden = true;
    sendBtn.hidden = false;
    otpIn.value = '';
    clearError('otp');
  }
  // after an answer arrives, focus moves only if the user hasn't moved on meanwhile
  function stillHere() {
    var a = document.activeElement;
    return !a || a === document.body || a === shortenBtn || keyBox.contains(a);
  }
  // says who is signed in, or where the key in use lives, so a credential is never invisible
  function syncKeyUi() {
    var pass = !memKey && memPass;
    keyState.hidden = !memKey && !pass;
    forgetBtn.hidden = !memKey;
    signOutBtn.hidden = !pass;
    keyStateIcon.setAttribute('href', pass ? '#i-mail' : '#i-key');
    keyStateText.textContent = pass ? 'Signed in as ' : remembered ? 'Key remembered on this device.' : 'Key kept for this tab only.';
    if (pass) {
      keyStateText.appendChild(el('span', 'who', pass.email));
      if (!passSaved) keyStateText.appendChild(document.createTextNode(' (this tab only)'));
    }
    syncNever();
  }
  // the credential for the next request: a key typed into the open panel, else the one in use
  function pickKey() {
    var typed = keyOpen() && mode === 'key' ? keyIn.value.trim() : '';
    if (typed) return { key: typed, typed: true };
    if (memKey) return { key: memKey, typed: false, saved: remembered };
    return memPass ? { pass: memPass, typed: false } : null;
  }
  // A code was just verified: this pass is the credential from now on, for this tab, and
  // on this device when Remember is ticked (which then drops a remembered key).
  function keepPass(p) {
    memPass = p;
    memKey = '';
    remembered = false;
    if (rememberIn.checked) {
      passSaved = lsSet(PASS_STORE, p.token);
      if (passSaved) lsDel(KEY_STORE);
    } else { lsDel(PASS_STORE); passSaved = false; }
    lastEmail = p.email;
    syncKeyUi();
  }
  // Drops this pass (with none given, the one in use), here and in storage. A different
  // one saved meanwhile by another tab is left alone.
  function forgetPass(p) {
    if (memPass && (!p || memPass.token === p.token)) { lastEmail = memPass.email; memPass = null; passSaved = false; }
    if (!p || lsGet(PASS_STORE) === p.token) lsDel(PASS_STORE);
    syncKeyUi();
  }
  // a request with this credential just succeeded: keep a typed key, and remember it if asked
  function acceptKey(k) {
    if (!k.typed) {
      // It came from memory or storage (another tab saved it, say), so a panel still asking
      // for one is moot: unless something is typed in it or a code is on its way, a delete
      // waits on it (doDelete closes the panel for its own), or nothing is at hand any more
      // (Forget key or Sign out since).
      if (keyOpen() && haveCred() && !keyIn.value.trim() && !codeStep() && !signing && !pendingDelete) closeKeyBox();
      return;
    }
    memKey = k.key;
    memPass = null;
    passSaved = false;
    if (rememberIn.checked) {
      remembered = lsSet(KEY_STORE, k.key);
      if (remembered) lsDel(PASS_STORE);
    } else { lsDel(KEY_STORE); remembered = false; }
    closeKeyBox();
    syncKeyUi();
  }
  function keyProblem(key) { return key.length > 1024 ? MSG.keyLong : MSG.keyChars; }
  // The server refused this key: drop it, and say whether it was the one typed just now.
  // A different key remembered meanwhile (by another tab) is left alone. The panel opens
  // first, so a link chosen to last for good keeps "Never".
  function rejectKey(k) {
    if (!k || memKey === k.key) { memKey = ''; remembered = false; }
    if (!k || cleanKey(lsGet(KEY_STORE)) === k.key) lsDel(KEY_STORE);
    openKeyBox('key');
    syncKeyUi();
    setError('key', k && !k.typed ? (k.saved ? MSG.staleKey : MSG.staleTabKey) : MSG.badKey);
    keyIn.select();
  }
  // The server refused this pass (it ran out, or isn't valid here): drop it and ask for a
  // new code, with the address filled in. Whatever was waiting carries on once signed in.
  function rejectPass(k, err) {
    forgetPass(k.pass);
    openKeyBox('email');
    resetCode();
    emailIn.value = k.pass.email;
    setError('email', err === 'pass-expired' ? MSG.passExpired : MSG.passRejected, 'calm');
  }
  forgetBtn.addEventListener('click', function () {
    var never = neverIn.checked;
    lsDel(KEY_STORE);
    memKey = '';
    remembered = false;
    syncKeyUi();
    shortenBtn.focus();
    // one announcement, so the fall-back from "Never" (syncNever) isn't talked over
    announce('Key forgotten. Making a link will ask for it again.' + (never && !neverIn.checked ? ' ' + MSG.neverGone : ''));
  });
  // Signing out is for handing the device on, so the address goes too: the next person
  // isn't shown it, or offered to send it a code.
  signOutBtn.addEventListener('click', function () {
    forgetPass(null);
    lastEmail = '';
    emailIn.value = '';
    shortenBtn.focus();
    announce('Signed out. Making a link will ask you to sign in again.');
  });
  // a delete waiting for a sign-in says so where the panel waits
  function askToDelete(focus) {
    var to = focus ? undefined : null;
    if (mode === 'key') setError('key', MSG.keyToDelete, '', to);
    else setError(codeStep() ? 'otp' : 'email', MSG.signToDelete, 'calm', to);
  }
  modeBtn.addEventListener('click', function () {
    var to = mode === 'email' ? 'key' : 'email';
    keyIn.value = '';   // a key typed into a field that is going away isn't left behind
    clearError('key');
    clearError('email');
    clearError('otp');
    setMode(to);
    syncPaste();
    if (pendingDelete) askToDelete(true);
    else panelField().focus();
  });

  /* ---- sign-in codes, from the Apps Script ---- */
  var jsonpN = 0;
  function jsonp(params) {
    return new Promise(function (resolve, reject) {
      var cb = 'urlshortCode' + (++jsonpN) + '_' + Date.now(), s = document.createElement('script');
      var settled = false;
      var timer = setTimeout(function () { done(new Error('timeout')); }, 15000);   // answers wait 4 s by design
      function done(err, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (s.parentNode) s.parentNode.removeChild(s);
        // an answer that turns up after all finds a stand-in that tidies up, not an error
        if (err) window[cb] = function () { try { delete window[cb]; } catch (e) { window[cb] = undefined; } };
        else { try { delete window[cb]; } catch (e) { window[cb] = undefined; } }
        if (err) reject(err); else resolve(data && typeof data === 'object' ? data : {});
      }
      window[cb] = function (data) { done(null, data); };
      s.onerror = function () { done(new Error('network')); };
      // loaded without calling back: not an answer (a sign-in page, say)
      s.onload = function () { done(new Error('no answer')); };
      var q = 'callback=' + cb;
      for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) q += '&' + k + '=' + encodeURIComponent(params[k]);
      s.src = CODE_SERVICE + '?' + q;
      document.head.appendChild(s);
    });
  }
  var signBtn = null;
  // a code request is out: its button says so, and the fields hold still
  function setSigning(btn) {
    if (signBtn) { signBtn.classList.remove('is-busy'); signBtn.removeAttribute('aria-disabled'); }
    signBtn = btn;
    signing = !!btn;
    if (btn) { btn.classList.add('is-busy'); btn.setAttribute('aria-disabled', 'true'); }
    syncLocks();
  }
  function tooManyCodes(m) {
    var n = typeof m === 'number' && isFinite(m) && m >= 1 ? Math.ceil(m) : 60;
    return 'Too many codes have been asked for that address. Try again in ' +
      (n === 1 ? 'a minute' : n >= 60 ? 'an hour' : 'about ' + n + ' minutes') + '.';
  }
  // a code request that failed: no answer at all, or something that wasn't one
  function codeTrouble(err, sending) {
    return err && err.message === 'no answer' ? (sending ? MSG.sendFailed : MSG.signInFailed) : MSG.signInOffline;
  }
  // Asks for a code. Every answer takes a few seconds by design, and a code is said to be
  // on its way whether or not the address is on the list: nothing here tells who is.
  function sendCode(again) {
    if (signing || busy) return;
    var where = again ? 'otp' : 'email';
    var email = again ? sentTo : normEmail(emailIn.value);
    clearError('email');
    clearError('otp');
    if (!email) { setError('email', MSG.needEmail); return; }
    if (email.length > 254 || !EMAIL_RE.test(email)) { setError('email', MSG.badEmail); return; }
    setSigning(again ? resendBtn : sendBtn);
    announce('Sending a code…');
    // send-code, not send-otp: a script from before the shortener doesn't know it, so it
    // sends nothing (see urlshortAnswer in Code.gs), and its answer has no app: 'urlshort'
    jsonp({ app: 'urlshort', action: 'send-code', email: email }).then(function (r) {
      var to = stillHere() ? undefined : null;
      setSigning(null);
      if (!keyOpen()) return;   // done another way meanwhile (the owner key, say): nothing to say
      if (r.app !== 'urlshort') { setError(where, MSG.signInOff, 'say', to); return; }
      if (r.ok === true) { codeSent(email); return; }
      if (r.reason === 'bad-email') { resetCode(); setError('email', MSG.badEmail, '', to); return; }
      setError(where, r.reason === 'rate-limit' ? tooManyCodes(r.retryMins) : r.reason === 'quota' ? MSG.quota :
        r.reason === 'not-set-up' ? MSG.signInOff : MSG.sendFailed, 'say', to);
    }, function (err) {
      var to = stillHere() ? undefined : null;
      setSigning(null);
      if (keyOpen()) setError(where, codeTrouble(err, true), 'say', to);
    });
  }
  function codeSent(email) {
    var here = stillHere() && mode === 'email';
    sentTo = email;
    codeField.hidden = false;
    sendBtn.hidden = true;   // the code step has its own "Send a new code"
    otpIn.value = '';
    clearError('otp');
    // the field's description says a code may be on its way; anyone who moved on hears it instead
    if (here) otpIn.focus(); else announce(MSG.codeSent);
  }
  function verifyCode() {
    if (signing || busy) return;
    var code = otpIn.value.replace(/\D/g, '');
    clearError('otp');
    if (code.length !== 6) { setError('otp', MSG.needCode); return; }
    var email = sentTo;
    setSigning(verifyBtn);
    announce('Checking the code…');
    jsonp({ app: 'urlshort', action: 'check-code', email: email, code: code }).then(function (r) {
      var here = stillHere(), to = here ? undefined : null, again = here ? resendBtn : null;
      setSigning(null);
      // signed in another way meanwhile (the owner key, say): that one stays
      if (!keyOpen()) return;
      if (r.app !== 'urlshort') { setError('otp', MSG.signInOff, 'say', to); return; }
      var p = r.verified === true ? readPass(r.token) : null;
      if (p && p.email === email) { signedIn(p, here); return; }
      var left = typeof r.triesLeft === 'number' && isFinite(r.triesLeft) ? Math.max(0, Math.floor(r.triesLeft)) : -1;
      if (r.verified === true) setError('otp', MSG.signInFailed, 'say', to);
      else if (r.reason === 'wrong' && left === 0) setError('otp', MSG.lastTry, '', again);
      else if (r.reason === 'wrong') {
        setError('otp', left > 0 ? 'That code isn’t right. ' + left + (left === 1 ? ' try' : ' tries') + ' left.' : MSG.wrongCode, '', to);
        if (here) otpIn.select();
      }
      else if (r.reason === 'expired') setError('otp', MSG.codeExpired, 'say', again);
      else if (r.reason === 'too-many') setError('otp', MSG.tooManyTries, 'say', again);
      else setError('otp', r.reason === 'busy' ? MSG.signInBusy : r.reason === 'not-set-up' ? MSG.signInOff : MSG.signInFailed, 'say', to);
    }, function (err) {
      var to = stillHere() ? undefined : null;
      setSigning(null);
      if (keyOpen()) setError('otp', codeTrouble(err, false), 'say', to);
    });
  }
  // A code was verified: keep the pass, fold the panel away, and carry on with what waited
  function signedIn(p, here) {
    var del = pendingDelete, create = pendingCreate;
    keepPass(p);
    closeKeyBox();
    announce('Signed in as ' + p.email + '.');
    if (del && findEntry(del)) { if (here) shortenBtn.focus(); doDelete(del, true); return; }
    if (del) {
      announce(MSG.listGone);
      if (here) recentTitle.focus();
      return;
    }
    if (create && urlIn.value.trim()) { if (here) shortenBtn.focus(); submit(); return; }
    if (here) urlIn.focus();
  }
  emailIn.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.isComposing) return;
    ev.preventDefault();   // Enter here asks for a code; the form's submit would make a link
    if (codeStep()) otpIn.focus(); else sendCode(false);
  });
  emailIn.addEventListener('input', function () {
    clearError('email');
    if (sentTo && normEmail(emailIn.value) !== sentTo) resetCode();
  });
  otpIn.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.isComposing) return;
    ev.preventDefault();
    verifyCode();
  });
  // digits only, six at most: a pasted "123 456" becomes 123456
  otpIn.addEventListener('input', function () {
    clearError('otp');
    var d = otpIn.value.replace(/\D/g, '').slice(0, 6);
    if (d !== otpIn.value) otpIn.value = d;
  });
  sendBtn.addEventListener('click', function () { sendCode(false); });
  resendBtn.addEventListener('click', function () { sendCode(true); });
  verifyBtn.addEventListener('click', function () { verifyCode(); });

  /* ---- the maker's device, sent with each new link for the log (no permission prompts) ---- */
  // as assets/js/app.js reads it
  function uaParse(ua) {
    var os = 'Unknown', br = 'Unknown', m;
    if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT/.test(ua)) os = 'Windows';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Android/.test(ua)) { m = ua.match(/Android (\d+(\.\d+)?)/); os = m ? 'Android ' + m[1] : 'Android'; }
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    if ((m = ua.match(/Edg\/(\d+(\.\d+)?)/))) br = 'Edge ' + m[1];
    else if ((m = ua.match(/OPR\/(\d+(\.\d+)?)/))) br = 'Opera ' + m[1];
    else if ((m = ua.match(/Chrome\/(\d+(\.\d+)?)/))) br = 'Chrome ' + m[1];
    else if ((m = ua.match(/Firefox\/(\d+(\.\d+)?)/))) br = 'Firefox ' + m[1];
    else if (/Safari/.test(ua) && (m = ua.match(/Version\/(\d+(\.\d+)?)/))) br = 'Safari ' + m[1];
    return { browser: br, platform: os };
  }
  // User-Agent Client Hints (Chromium only): the exact OS version, the device model and the
  // browser's full version. Asked once, early, so a new link never waits for them.
  var hints = null;
  try {
    var uad = navigator.userAgentData;
    if (uad && typeof uad.getHighEntropyValues === 'function') {
      uad.getHighEntropyValues(['platformVersion', 'model', 'uaFullVersion', 'fullVersionList'])
        .then(function (h) { hints = h && typeof h === 'object' ? h : null; }, function () { /* not shared */ });
    }
  } catch (e) { /* no hints */ }
  function clientInfo() {
    var c = {}, nav = navigator, w = window;
    function put(k, v) {
      if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return;
      c[k] = typeof v === 'number' || typeof v === 'boolean' ? v : String(v).slice(0, 300);
    }
    function tryPut(k, f) { try { put(k, f()); } catch (e) { /* skipped */ } }
    var ua = String(nav.userAgent || ''), d = uaParse(ua), h = hints;
    var browser = d.browser, browserVersion = '', platform = d.platform, osVersion = '', model = '';
    try {
      if (h) {
        var ov = typeof h.platformVersion === 'string' ? h.platformVersion : '';
        if (/Windows/i.test(platform) && ov) {
          // platformVersion's major number: 0 is Windows 7/8/8.1, 1–10 is 10, 13 and up is 11
          var major = parseInt(ov.split('.')[0], 10);
          osVersion = major >= 13 ? '11' : major >= 1 ? '10' : '7/8/8.1';
          platform = 'Windows ' + osVersion;
        } else osVersion = ov;
        if (typeof h.model === 'string') model = h.model;
        var brands = Array.isArray(h.fullVersionList) ? h.fullVersionList : [], b = null;
        for (var i = 0; i < brands.length; i++) {
          var one = brands[i];
          if (!one || typeof one.brand !== 'string' || typeof one.version !== 'string' || /Not.?A.?Brand/i.test(one.brand)) continue;
          if (!b || b.brand === 'Chromium') b = one;   // the browser's own name over its engine's
        }
        if (b) { browser = b.brand + ' ' + b.version.split('.').slice(0, 2).join('.'); browserVersion = b.version; }
        else if (typeof h.uaFullVersion === 'string') browserVersion = h.uaFullVersion;
      }
    } catch (e) { /* the hints were odd: the User-Agent's reading stands */ }
    put('browser', browser);
    put('browserVersion', browserVersion);
    put('platform', platform);
    put('osVersion', osVersion);
    tryPut('deviceType', function () {
      return nav.userAgentData ? (nav.userAgentData.mobile ? 'Mobile' : 'Desktop') : (/Mobi|Android|iPhone|iPad|iPod/.test(ua) ? 'Mobile' : 'Desktop');
    });
    put('deviceModel', model);
    tryPut('screen', function () { var s = w.screen; return s && s.width ? s.width + 'x' + s.height : ''; });
    tryPut('viewport', function () { return w.innerWidth + 'x' + w.innerHeight; });
    tryPut('pixelRatio', function () { return w.devicePixelRatio || ''; });
    tryPut('colorScheme', function () { return w.matchMedia ? (w.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light') : ''; });
    tryPut('timezone', function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; });
    tryPut('timezoneOffset', function () {
      var o = -new Date().getTimezoneOffset(), sign = o < 0 ? '-' : '+';
      o = Math.abs(o);
      return 'UTC' + sign + Math.floor(o / 60) + ':' + ('0' + (o % 60)).slice(-2);
    });
    tryPut('language', function () { return nav.language || ''; });
    tryPut('languages', function () { return nav.languages && nav.languages.join ? nav.languages.join(', ') : ''; });
    tryPut('touchPoints', function () { return nav.maxTouchPoints != null ? nav.maxTouchPoints : ''; });
    tryPut('cpuCores', function () { return nav.hardwareConcurrency || ''; });
    // browsers round memory to a power of two and cap it, so it is labelled as the guess it is
    tryPut('deviceMemory', function () {
      var gb = nav.deviceMemory;
      return gb ? gb + ' GB (approx.' + (gb >= 8 ? '; browsers cap this, so it may be more' : '') + ')' : '';
    });
    tryPut('network', function () { var n = nav.connection || nav.mozConnection || nav.webkitConnection; return n ? n.effectiveType || '' : ''; });
    return c;
  }

  /* ---- the API ---- */
  function request(method, url, k, body) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : 0;
    var headers = { Authorization: k.pass ? 'Pass ' + k.pass.token : 'Bearer ' + k.key, Accept: 'application/json' };
    var opts = { method: method, headers: headers, cache: 'no-store', credentials: 'same-origin' };
    if (ctrl) opts.signal = ctrl.signal;
    if (body) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    var p;
    try { p = fetch(url, opts); } catch (e) { p = Promise.reject(e); }
    return p.then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = JSON.parse(text); } catch (e) { data = null; }
        return { status: res.status, data: data && typeof data === 'object' ? data : null };
      });
    }).catch(function () {
      return { status: 0, data: null };
    }).then(function (r) {
      clearTimeout(timer);
      return r;
    });
  }

  /* ---- shorten ---- */
  var busy = false;
  // the keepsake must show what was sent, so nothing typed changes while a request is out
  function syncLocks() {
    urlIn.readOnly = slugIn.readOnly = keyIn.readOnly = ttlNum.readOnly = busy;
    emailIn.readOnly = otpIn.readOnly = busy || signing;
  }
  function setBusy(on, label) {
    busy = on;
    form.setAttribute('aria-busy', on ? 'true' : 'false');
    shortenBtn.setAttribute('aria-disabled', on ? 'true' : 'false');
    shortenBtn.classList.toggle('is-busy', on);
    btnLabel.textContent = on ? label || 'Shortening…' : 'Shorten link';
    syncLocks();
    againBtn.setAttribute('aria-disabled', on ? 'true' : 'false');
  }
  // this site's own names, as the server lists them: a short link to one of its
  // short links would only bounce around (or loop)
  function ownHost(h) {
    h = h.toLowerCase().replace(/\.$/, '');
    return h === 'karan98.in' || h === 'www.karan98.in' || h === window.location.hostname.toLowerCase() ||
      h === 'sudo-karan-github-io.pages.dev' || /\.sudo-karan-github-io\.pages\.dev$/.test(h);
  }
  function checkUrl(s) {
    if (!s) return MSG.emptyUrl;
    if (s.length > 4096) return MSG.tooLong;
    // mailto:, javascript:, ftp: … are refused here; a dotted "scheme" is really host:port,
    // so that is left for the server to judge
    var scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s);
    var hasScheme = !!scheme && scheme[1].indexOf('.') < 0;
    if (hasScheme && !/^https?$/i.test(scheme[1])) return MSG.scheme;
    // name@host.tld and nothing more; example.com?to=me@mail.com is a link
    if (!hasScheme && /^[^\s/?#@]+@[^\s/?#@]+\.[^\s/?#@]+$/.test(s)) return MSG.email;
    var u;
    try { u = new URL(hasScheme ? s : 'https://' + s); } catch (e) { return MSG.badUrl; }
    if (!u.hostname) return MSG.badUrl;
    if (u.username || u.password) return MSG.creds;
    if (ownHost(u.hostname) && /^\/s\//i.test(u.pathname)) return MSG.selfLink;
    // é, ж and the like take several characters each once encoded, as the server stores them
    if (u.href.length > 4096) return MSG.tooLong;
    return '';
  }
  function readSlug() { return slugIn.value.trim().replace(/^\/+/, '').toLowerCase(); }
  // one message per cause, so the fix is obvious
  function slugProblem(s) {
    var bad = /[^a-z0-9-]/.exec(s);
    if (bad) return bad[0] === ' ' ? 'Use hyphens instead of spaces in an ending.' : 'An ending can only use letters a–z, digits and hyphens.';
    if (s.length < 3) return 'An ending needs at least 3 characters.';
    if (s.length > 40) return 'An ending can be at most 40 characters.';
    if (/^-|-$/.test(s)) return 'An ending can’t start or end with a hyphen.';
    return SLUG_RE.test(s) ? '' : MSG.badSlug;
  }

  // A create whose answer never arrived may still have been saved. Until the link, ending
  // or length changes, Try again sends the same request id, and the server answers with
  // that link instead of making a second one (or calling the maker's own ending taken).
  var pending = null;   // { sig, rid }
  function newRid() {
    var c = window.crypto;
    try { if (c && typeof c.randomUUID === 'function') return c.randomUUID(); } catch (e) { /* below */ }
    try {
      var b = c.getRandomValues(new Uint8Array(16)), s = '';
      for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
      return s;
    } catch (e) { return ''; }
  }

  // Shorten pressed while the panel waits for a sign-in: take the panel's next step. The
  // link waits, and is made once signed in.
  function panelStep() {
    if (mode === 'key') setError('key', MSG.needKey);
    else if (!codeStep()) sendCode(false);
    else if (otpIn.value) verifyCode();
    else setError('otp', MSG.needCode);
  }
  // Asked for a sign-in to delete a link: Enter in the key field (or Shorten with no link
  // typed) finishes that delete. The request stays pending until the delete succeeds,
  // so a second Enter while it is out does nothing and one after a failure retries.
  function finishDelete() {
    var code = pendingDelete;
    if (!findEntry(code)) {
      // gone meanwhile (deleted in another tab, say): nothing is left to sign in for
      closeKeyBox();
      recentTitle.focus();
      announce(MSG.listGone);
      return;
    }
    // with no sign-in yet, the email code comes first; the delete carries on after it
    if (keyOpen() && mode === 'email' && !haveCred()) { panelStep(); return; }
    doDelete(code);
  }
  // typing a link means making one: a delete still waiting for a sign-in is dropped, with
  // its prompt, so Enter in the panel can't finish it unseen
  function dropDelete() {
    if (!pendingDelete) return;
    pendingDelete = '';
    if (fields.key.err.lastElementChild.textContent === MSG.keyToDelete) clearError('key');
    if (fields.email.err.lastElementChild.textContent === MSG.signToDelete) clearError('email');
    if (fields.otp.err.lastElementChild.textContent === MSG.signToDelete) clearError('otp');
  }
  keyIn.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.isComposing || !pendingDelete || busy) return;
    ev.preventDefault();
    finishDelete();
  });

  // (A code request being out holds nothing up here: the panel's own steps wait for it,
  // and a key typed meanwhile is ready to use.)
  function submit() {
    if (busy) return;
    if (pendingDelete && !urlIn.value.trim()) { finishDelete(); return; }
    dropDelete();
    hideNote();
    clearError('url');
    clearError('slug');
    clearError('ttl');
    var raw = urlIn.value.trim();
    var bad = checkUrl(raw);
    if (bad) { setError('url', bad); return; }
    var slug = readSlug();
    var slugBad = slug ? slugProblem(slug) : '';
    if (slugBad) { setError('slug', slugBad); return; }
    var ttl = readTtl();
    if (typeof ttl === 'string') { ttlProblem(ttl); return; }
    var k = pickKey();
    // "Never" shows with the panel open for the owner key; a pass in use can't keep a link for good
    if (k && ttl === 0 && k.pass) k = null;
    if (!k) {
      pendingCreate = true;
      if (keyOpen()) { panelStep(); return; }
      openKeyBox();
      panelField().focus();
      announce(mode === 'key' ? 'Making links needs the owner key. ' + MSG.needKey : 'Making links needs a sign-in. ' + MSG.needEmail);
      return;
    }
    clearError('key');
    if (k.key && !KEY_RE.test(k.key)) { setError('key', keyProblem(k.key)); return; }

    var sig = raw + '\n' + slug + '\n' + ttl;
    if (!pending || pending.sig !== sig) pending = { sig: sig, rid: newRid() };
    var body = { url: raw, ttl: ttl, client: clientInfo() };
    if (slug) body.slug = slug;
    if (pending.rid) body.rid = pending.rid;
    setBusy(true);
    request('POST', API, k, body).then(function (r) {
      setBusy(false);
      var d = r.data || {};
      if (r.status >= 200 && r.status < 300 && d.ok === true) {
        var code = typeof d.code === 'string' ? d.code.toLowerCase() : '';
        if (CODE_RE.test(code)) {
          pending = null;
          acceptKey(k);
          created({ code: code, short: shortFor(d.short, code), url: httpUrl(d.url), t: Date.now(), x: expiry(d.expires) });
          return;
        }
        showNote(MSG.server, true);
        return;
      }
      var err = typeof d.error === 'string' ? d.error : (r.status === 401 ? 'unauthorized' : '');
      if (err === 'bad-url') setError('url', MSG.badUrl);
      else if (err === 'too-long') setError('url', MSG.tooLong);
      else if (err === 'credentials') setError('url', MSG.creds);
      else if (err === 'self-link') setError('url', MSG.selfLink);
      else if (err === 'bad-slug') setError('slug', slugProblem(slug) || MSG.badSlug);
      else if (err === 'slug-taken') setError('slug', slug ? 'karan98.in/s/' + slug + ' is already taken. Try another, or leave it blank.' : MSG.slugTaken);
      else if (err === 'bad-ttl') ttlProblem(MSG.badTtl);
      else if (err === 'unauthorized' || err === 'pass-expired') {
        pendingCreate = true;   // made once signed in again
        if (k.pass) rejectPass(k, err); else rejectKey(k);
      }
      else if (err === 'not-set-up') showNote(MSG.notSetUp, false, true);
      else if (err === 'wrong-host') showNote(MSG.wrongHost, false, true);
      else showNote(r.status === 0 ? MSG.offline : MSG.server, true);
    });
  }
  form.addEventListener('submit', function (ev) { ev.preventDefault(); submit(); });
  // the notice (and this button) hides on resubmit, so keep focus somewhere stable
  retryBtn.addEventListener('click', function () { shortenBtn.focus(); submit(); });
  urlIn.addEventListener('input', function () { clearError('url'); hideNote(); syncPaste(); dropDelete(); });
  slugIn.addEventListener('input', function () { clearError('slug'); });
  keyIn.addEventListener('input', function () { clearError('key'); });

  /* ---- pasting: a Paste button on touch screens, and paste anywhere on the page ---- */
  var canReadClip = !!(navigator.clipboard && typeof navigator.clipboard.readText === 'function');
  // hidden while the sign-in panel is open, when the clipboard most likely holds a key or code
  function syncPaste() { pasteBtn.hidden = !(canReadClip && touch()) || !!urlIn.value || keyOpen(); }
  if (coarse && typeof coarse.addEventListener === 'function') coarse.addEventListener('change', syncPaste);
  function putUrl(text) {
    urlIn.value = text;
    clearError('url');
    hideNote();
    syncPaste();
    urlIn.focus();
    try { urlIn.setSelectionRange(text.length, text.length); } catch (e) { /* not a text field */ }
  }
  // A failure is shown under the field, calmly (the field itself is fine), not only
  // announced: on a phone there is otherwise nothing to see (Safari and Firefox refuse
  // when their Paste bubble is dismissed, and an image on the clipboard reads as empty).
  function pasteFailed(msg) {
    var f = fields.url;
    f.err.lastElementChild.textContent = msg;
    f.err.classList.add('calm');
    f.err.hidden = false;
    urlIn.focus();
    bringIntoView(f.err);
    announce(msg);
  }
  pasteBtn.addEventListener('click', function () {
    if (busy || keyOpen()) return;
    navigator.clipboard.readText().then(function (t) {
      t = String(t || '').trim();
      if (!t) { pasteFailed(MSG.clipEmpty); return; }
      putUrl(t);
      announce('Pasted. Shorten it when you’re ready.');
    }, function () {
      pasteFailed(MSG.clipDenied);
    });
  });
  function isTextField(t) {
    if (!t || t.nodeType !== 1) return false;
    if (t.isContentEditable || t.tagName === 'TEXTAREA') return true;
    return t.tagName === 'INPUT' && /^(text|search|url|tel|email|password|number)$/i.test(t.type);
  }
  // While the sign-in panel is open a stray paste is most likely the key or a code (focus
  // on the Remember box, say), which must never land in the plain-text Long URL field.
  document.addEventListener('paste', function (e) {
    if (busy || keyOpen() || isTextField(e.target)) return;
    var t = e.clipboardData ? String(e.clipboardData.getData('text') || '').trim() : '';
    if (!t) return;
    e.preventDefault();
    putUrl(t);
    announce('Pasted into Long URL. Press Enter to shorten it.');
  });

  function created(entry) {
    var items = readRecent().filter(function (x) { return x.code !== entry.code; });
    items.unshift(entry);
    var full = writeRecent(items);
    renderRecent(entry.code);
    showResult(entry, true, full);
    urlIn.value = '';
    slugIn.value = '';
    syncPaste();
    announce('Short link ready: ' + bare(entry.short) + '.' + (full ? ' ' + full : ''));
  }

  /* ---- the result ---- */
  var current = null;
  // `listNote`: a word about the list (storage full), set inside the card before it is
  // scrolled to, so it shows next to the Copy button instead of pushing it off screen
  function showResult(e, fresh, listNote) {
    current = e;
    fillShort(shortA, e.short);
    shortA.setAttribute('href', e.short);
    // upright figures run wider than the italic did: past 7 characters, set the code smaller
    shortA.classList.toggle('is-long', splitShort(e.short)[1].length > 7);
    openA.setAttribute('href', e.short);
    // when it stops working, as the server set it (a repeat keeps the link's own end);
    // the date and time stay on one line
    resultExp.hidden = e.x === undefined;
    resultExpText.textContent = e.x === 0 ? 'Never expires' : e.x ? 'Works until ' : '';
    if (e.x) {
      // the line may break between the date and the time, never inside either (narrow phones)
      var w = fmtWhen(e.x), cut = w.lastIndexOf(', ') + 1;
      resultExpText.appendChild(el('span', 'when', cut ? w.slice(0, cut) : w));
      if (cut) { resultExpText.appendChild(document.createTextNode(' ')); resultExpText.appendChild(el('span', 'when', w.slice(cut + 1))); }
    }
    fillOrig(origEl, e.url, true);
    origEl.parentNode.hidden = !e.url;
    dateEl.textContent = fmtDate(e.t);
    dateEl.setAttribute('datetime', new Date(e.t).toISOString());
    drawQr(e);
    clearTimeout(copyTimer);
    copyBtn.classList.remove('is-done');
    shortA.classList.remove('is-copied');
    copyMsg.hidden = true;
    ksNote.textContent = listNote || '';
    ksNote.hidden = !listNote;
    result.hidden = false;
    result.classList.remove('enter');
    void result.offsetWidth;   // restart the entrance for a second link
    result.classList.add('enter');
    if (fresh) {
      copyBtn.focus({ preventScroll: true });
      bringIntoView(result);
    }
  }
  function hideResult() { result.hidden = true; current = null; }
  function bringIntoView(node) {
    var r = node.getBoundingClientRect(), vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top >= 0 && r.bottom <= vh) return;
    node.scrollIntoView({ block: r.height > vh ? 'start' : 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }

  /* QR: drawn from the module matrix so the colours are ours, with a 4-module quiet zone */
  var QUIET = 4;
  function qrFor(text) {
    if (typeof window.qrcode !== 'function') return null;
    try { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q; } catch (e) { return null; }
  }
  // one path for all the dark modules, a run of them per row segment
  function qrPathData(q) {
    var n = q.getModuleCount(), d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!q.isDark(r, c)) continue;
        var start = c;
        while (c + 1 < n && q.isDark(r, c + 1)) c++;
        d += 'M' + (start + QUIET) + ' ' + (r + QUIET) + 'h' + (c - start + 1) + 'v1H' + (start + QUIET) + 'z';
      }
    }
    return d;
  }
  // on screen the colours come from CSS; a saved file (px given) carries its own fills
  function qrSvg(q, px) {
    var size = q.getModuleCount() + QUIET * 2;
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('shape-rendering', 'crispEdges');
    var bg = document.createElementNS(SVGNS, 'rect');
    bg.setAttribute('width', String(size));
    bg.setAttribute('height', String(size));
    var fg = document.createElementNS(SVGNS, 'path');
    fg.setAttribute('d', qrPathData(q));
    if (px) {
      svg.setAttribute('width', String(px));
      svg.setAttribute('height', String(px));
      bg.setAttribute('fill', '#ffffff');
      fg.setAttribute('fill', '#1d1a15');
    } else {
      bg.setAttribute('class', 'qr-bg');
      fg.setAttribute('class', 'qr-fg');
    }
    svg.appendChild(bg);
    svg.appendChild(fg);
    return svg;
  }
  function drawQr(e) {
    qrBox.textContent = '';
    var q = qrFor(e.short);
    qrFigure.hidden = !q;
    if (!q) return;
    var svg = qrSvg(q, 0);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'QR code for ' + bare(e.short));
    qrBox.appendChild(svg);
  }
  qrSvgBtn.addEventListener('click', function () {
    if (!current) return;
    var q = qrFor(current.short);
    if (!q || typeof XMLSerializer !== 'function' || typeof Blob !== 'function') return;
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(qrSvg(q, 512)) + '\n';
    download(URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' })), 'karan98.in-s-' + current.code + '.svg', true);
  });
  qrSave.addEventListener('click', function () {
    if (!current) return;
    var q = qrFor(current.short);
    if (!q) return;
    var n = q.getModuleCount(), scale = 16, size = (n + QUIET * 2) * scale;
    var cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#1d1a15';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect((c + QUIET) * scale, (r + QUIET) * scale, scale, scale);
    }
    var name = 'karan98.in-s-' + current.code + '.png';
    if (cv.toBlob) {
      cv.toBlob(function (blob) { if (blob) download(URL.createObjectURL(blob), name, true); }, 'image/png');
    } else {
      download(cv.toDataURL('image/png'), name, false);
    }
  });
  function download(href, name, revoke) {
    var a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (revoke) setTimeout(function () { URL.revokeObjectURL(href); }, 5000);
    announce('Saving the QR code as ' + name + '.');
  }

  /* copy, with a fallback for browsers or contexts without the async clipboard */
  function legacyCopy(text) {
    var active = document.activeElement;
    var ta = el('textarea', 'clip');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    ta.tabIndex = -1;
    document.body.appendChild(ta);
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) { /* older engines */ }
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (active && typeof active.focus === 'function') active.focus({ preventScroll: true });
    return ok;
  }
  function copyText(text) {
    var fallback = function () { return legacyCopy(text) ? undefined : Promise.reject(new Error('copy failed')); };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext !== false) {
      return navigator.clipboard.writeText(text).catch(fallback);
    }
    return Promise.resolve().then(fallback);
  }
  function selectText(node) {
    try {
      var range = document.createRange();
      range.selectNodeContents(node);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) { /* nothing more to try */ }
  }
  function copyFallbackMsg() { return touch() ? MSG.copyTouch : MSG.copyKeys; }
  var copyTimer = 0;
  copyBtn.addEventListener('click', function () {
    if (!current) return;
    copyText(current.short).then(function () {
      copyMsg.hidden = true;
      copyBtn.classList.add('is-done');
      shortA.classList.add('is-copied');   // a highlighter sweeps under the link
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function () {
        copyBtn.classList.remove('is-done');
        shortA.classList.remove('is-copied');
      }, 1800);
      announce('Copied');
    }, function () {
      selectText(shortA);
      var m = copyFallbackMsg();
      copyMsg.textContent = m;
      copyMsg.hidden = false;
      bringIntoView(copyMsg);   // the card was just scrolled to end at the fold
      announce(m);
    });
  });
  // The keepsake sets the link on two lines, so copying a selection of it would give
  // "karan98.in/s/", a line break and the code. Copied whole, it gives the link itself.
  document.addEventListener('copy', function (e) {
    var sel = window.getSelection ? window.getSelection() : null;
    if (!current || !e.clipboardData || !sel || sel.isCollapsed) return;
    if (!shortA.contains(sel.anchorNode) || !shortA.contains(sel.focusNode)) return;
    if (sel.toString().replace(/\s+/g, '') !== shortA.textContent.replace(/\s+/g, '')) return;
    e.clipboardData.setData('text/plain', current.short);
    e.preventDefault();
  });

  if (typeof navigator.share === 'function') shareBtn.hidden = false;
  shareBtn.addEventListener('click', function () {
    if (!current) return;
    try {
      var p = navigator.share({ title: 'Short link', url: current.short });
      if (p && typeof p.catch === 'function') p.catch(function () { /* dismissed */ });
    } catch (e) { /* not shareable here */ }
  });

  againBtn.addEventListener('click', function () {
    if (busy) return;   // the fields hold what was just sent; an error may still point at them
    urlIn.value = '';
    slugIn.value = '';
    clearError('url');
    clearError('slug');
    clearError('ttl');
    hideNote();
    syncPaste();
    if (form.getBoundingClientRect().top < 0) form.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    urlIn.focus({ preventScroll: true });
  });

  /* ---- recent links on this device ---- */
  function iconBtn(action, name, label, extra) {
    var b = el('button', 'icon-btn' + (extra ? ' ' + extra : ''));
    b.type = 'button';
    b.setAttribute('data-action', action);
    b.setAttribute('aria-label', label);
    b.setAttribute('title', label);
    b.appendChild(icon(name));
    return b;
  }
  // a row's word on its link's end, with the code faded back once it has passed
  function paintExpiry(span, li) {
    var x = Number(span.getAttribute('data-x')), gone = x > 0 && x <= Date.now();
    span.textContent = expiresIn(x);
    span.classList.toggle('is-expired', gone);
    if (x > 0) span.setAttribute('title', (gone ? 'Stopped working ' : 'Works until ') + fmtWhen(x));
    if (li) li.classList.toggle('is-expired', gone);
  }
  function itemNode(e, fresh) {
    var label = bare(e.short);
    var li = el('li', 'r-item' + (fresh ? ' is-new' : ''));
    li.setAttribute('data-code', e.code);
    var main = el('div', 'r-main');
    var a = el('a', 'r-short');
    a.setAttribute('href', e.short);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    fillShort(a, e.short);
    main.appendChild(a);
    var meta = el('p', 'r-meta');
    if (e.t) {
      var tm = el('time', 'r-time', ago(e.t));
      tm.setAttribute('datetime', new Date(e.t).toISOString());
      tm.setAttribute('data-t', String(e.t));
      meta.appendChild(tm);
    }
    // links made before links could expire say nothing about it
    if (e.x !== undefined) {
      var xs = el('span', 'r-exp');
      xs.setAttribute('data-x', String(e.x));
      paintExpiry(xs, li);
      meta.appendChild(xs);
    }
    if (e.url) {
      var o = el('span', 'r-orig');
      fillOrig(o, e.url);
      meta.appendChild(o);
    }
    if (meta.firstChild) main.appendChild(meta);
    var acts = el('div', 'r-actions');
    acts.appendChild(iconBtn('copy', 'copy', 'Copy ' + label));
    acts.appendChild(iconBtn('delete', 'trash', 'Delete ' + label, 'danger'));
    li.appendChild(main);
    li.appendChild(acts);
    return li;
  }
  // A rebuild (a new link, a change in another tab) keeps what each row is doing: an
  // open "Delete this link?", a delete still in flight, its message, and the focus.
  var deleting = Object.create(null);   // code → true while its DELETE is out
  var rowMsg = Object.create(null);     // code → { text, calm }
  var showAll = false;
  function rowFor(code) { return list.querySelector('li[data-code="' + code + '"]'); }
  function renderRecent(freshCode) {
    var items = readRecent(), i;
    var asking = Object.create(null), focus = null;
    var open = list.querySelectorAll('li.confirming');
    for (i = 0; i < open.length; i++) asking[open[i].getAttribute('data-code')] = true;
    var act = document.activeElement;
    var actRow = act && act !== list && list.contains(act) ? act.closest('li[data-code]') : null;
    if (actRow) focus = { code: actRow.getAttribute('data-code'), action: act.getAttribute('data-action') || '' };
    var shown = showAll ? items.length : Math.min(items.length, SHOWN_RECENT);
    list.textContent = '';
    for (i = 0; i < shown; i++) {
      var e = items[i], li = itemNode(e, e.code === freshCode);
      if (asking[e.code] || deleting[e.code]) showConfirm(li, false);
      if (deleting[e.code]) markDeleting(li);
      paintRowMsg(li, rowMsg[e.code]);
      list.appendChild(li);
    }
    list.hidden = !items.length;
    emptyBox.hidden = !!items.length;
    countEl.textContent = items.length ? items.length + (items.length === 1 ? ' link' : ' links') : '';
    // the toggle goes once 20 or fewer are left (another tab deleted some): keep focus nearby
    if (items.length <= SHOWN_RECENT && document.activeElement === moreBtn) {
      var last = list.lastElementChild;
      ((last && last.querySelector('.r-short')) || recentTitle).focus({ preventScroll: true });
    }
    moreBox.hidden = items.length <= SHOWN_RECENT;
    moreBtn.textContent = showAll ? 'Show only the latest ' + SHOWN_RECENT : 'Show all ' + items.length + ' links';
    moreBtn.setAttribute('aria-expanded', showAll ? 'true' : 'false');
    if (focus) {
      var row = rowFor(focus.code);
      var to = row && (focus.action ? row.querySelector('[data-action="' + focus.action + '"]') : row.querySelector('.r-short'));
      if (to) to.focus({ preventScroll: true });
    }
  }
  function findEntry(code) {
    var items = readRecent();
    for (var i = 0; i < items.length; i++) if (items[i].code === code) return items[i];
    return null;
  }
  moreBtn.addEventListener('click', function () {
    showAll = !showAll;
    renderRecent();
    // Showing all puts this button after every row, so go to the first link it revealed
    // instead (focus scrolls to it) and Tab walks on through the rest. Showing fewer
    // keeps focus here, now just after row 20.
    var first = showAll ? list.children[SHOWN_RECENT] : null;
    var a = first && first.querySelector('.r-short');
    if (a) a.focus(); else bringIntoView(moreBtn);
    announce(showAll ? 'Showing all ' + readRecent().length + ' links.' : 'Showing the latest ' + SHOWN_RECENT + ' links.');
  });

  // `forget`: the row can't be deleted from here (someone else's link), so offer to take it
  // off this device's list instead, which leaves the link itself alone
  function paintRowMsg(li, m) {
    var old = li.querySelector('.r-msg');
    if (old) old.remove();
    if (!m) return;
    var p = el('p', 'r-msg' + (m.calm ? ' calm' : ''), m.text);
    if (m.forget) {
      var b = el('button', 'text-btn', 'Remove from this list');
      b.type = 'button';
      b.setAttribute('data-action', 'forget');
      p.appendChild(document.createTextNode(' '));
      p.appendChild(b);
    }
    li.appendChild(p);
  }
  function setRowMsg(code, text, calm, forget) {
    if (text) rowMsg[code] = { text: text, calm: !!calm, forget: !!forget };
    else delete rowMsg[code];
    var li = rowFor(code);
    if (li) paintRowMsg(li, rowMsg[code]);
  }
  function clearItemMsg(li) { setRowMsg(li.getAttribute('data-code'), ''); }

  function copyFromList(btn, code) {
    var e = findEntry(code);
    if (!e) return;
    copyText(e.short).then(function () {
      setRowMsg(code, '');
      var use = btn.querySelector('use');
      if (use) use.setAttribute('href', '#i-check');
      btn.classList.add('is-done');
      setTimeout(function () {
        if (use) use.setAttribute('href', '#i-copy');
        btn.classList.remove('is-done');
      }, 1600);
      announce('Copied');
    }, function () {
      var li = rowFor(code), a = li ? li.querySelector('.r-short') : null;
      if (a) selectText(a);
      var m = copyFallbackMsg();
      setRowMsg(code, m, true);
      var shown = li && li.querySelector('.r-msg');   // a row low on the screen puts it below the fold
      if (shown) bringIntoView(shown);
      announce(m);
    });
  }

  function askDelete(li) {
    var open = list.querySelectorAll('li.confirming');
    for (var i = 0; i < open.length; i++) {
      if (open[i] !== li && !open[i].classList.contains('is-busy')) endConfirm(open[i], false);
    }
    if (li.classList.contains('confirming')) return;
    clearItemMsg(li);
    showConfirm(li, true);
  }
  function showConfirm(li, focusKeep) {
    if (li.classList.contains('confirming')) return;
    li.classList.add('confirming');
    var box = el('div', 'r-confirm');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Confirm delete');
    box.appendChild(el('p', 'r-ask', 'Delete this link? It stops working for everyone.'));
    var btns = el('div', 'r-btns');
    var keep = el('button', 'btn sm', 'Keep');
    keep.type = 'button';
    keep.setAttribute('data-action', 'cancel-delete');
    var del = el('button', 'btn sm danger', 'Delete');
    del.type = 'button';
    del.setAttribute('data-action', 'confirm-delete');
    btns.appendChild(keep);
    btns.appendChild(del);
    box.appendChild(btns);
    li.appendChild(box);
    if (focusKeep) keep.focus();
  }
  function endConfirm(li, refocus) {
    li.classList.remove('confirming');
    var box = li.querySelector('.r-confirm');
    if (box) box.remove();
    if (refocus) {
      var d = li.querySelector('[data-action="delete"]');
      if (d) d.focus();
    }
  }
  function markDeleting(li) {
    li.classList.add('is-busy');
    li.setAttribute('aria-busy', 'true');
    var yes = li.querySelector('[data-action="confirm-delete"]');
    if (yes) { yes.textContent = 'Deleting…'; yes.setAttribute('aria-disabled', 'true'); }
  }

  // From the row's Delete, from the panel once it was asked for a sign-in, or (fromPanel)
  // just after a code was verified for it. The row is looked up afresh each time: the
  // list may be rebuilt while the request is out.
  function doDelete(code, fromPanel) {
    if (deleting[code]) return;
    var li = rowFor(code);
    var k = pickKey();
    if (!k || (k.key && !KEY_RE.test(k.key))) {
      if (li) endConfirm(li, false);
      pendingDelete = code;
      pendingCreate = false;   // the panel now waits for this delete
      openKeyBox();
      if (k) setError('key', keyProblem(k.key));
      else askToDelete(true);
      return;
    }
    deleting[code] = true;
    if (li) { clearItemMsg(li); showConfirm(li, false); markDeleting(li); }
    // Finished from the panel, the row may be off screen: the Shorten button under the
    // panel shows it working (and holds off another submit), and it is announced.
    var fromKey = !busy && (fromPanel || (pendingDelete === code && keyOpen()));
    if (fromKey) setBusy(true, 'Deleting…');
    announce('Deleting ' + bare((findEntry(code) || { short: shortFor('', code) }).short) + '…');
    request('DELETE', API + '?code=' + encodeURIComponent(code), k).then(function (r) {
      if (fromKey) setBusy(false);
      delete deleting[code];
      var cur = rowFor(code);
      if (cur) { cur.classList.remove('is-busy'); cur.removeAttribute('aria-busy'); }
      var d = r.data || {};
      var err = typeof d.error === 'string' ? d.error : (r.status === 401 ? 'unauthorized' : '');
      if ((r.status >= 200 && r.status < 300 && d.ok === true) || err === 'not-found') {
        acceptKey(k);   // a not-found has passed the key check too
        if (pendingDelete === code) closeKeyBox();   // the panel was asking for this delete
        removeEntry(code, err === 'not-found', fromKey);
        return;
      }
      if (cur) endConfirm(cur, false);
      if (err === 'unauthorized' || err === 'pass-expired') {
        if (k.pass) rejectPass(k, err); else rejectKey(k);
        pendingDelete = code;
        pendingCreate = false;
        return;
      }
      var msg = err === 'not-yours' ? MSG.notYours : err === 'not-set-up' ? MSG.notSetUp :
        err === 'wrong-host' ? MSG.wrongHost : r.status === 0 ? MSG.offline : MSG.deleteFailed;
      setRowMsg(code, msg, false, err === 'not-yours');
      announce(msg);
      var again = cur && cur.querySelector(err === 'not-yours' ? '[data-action="forget"]' : '[data-action="delete"]');
      if (again) again.focus();
    });
  }
  // viaPanel: finished from the sign-in panel, whose Shorten button showed it working.
  // gone: true when the server said the link was already gone; 'kept' when it is only
  // taken off this list (Remove from this list) and still works.
  function removeEntry(code, gone, viaPanel) {
    var li = rowFor(code);
    var label = bare((findEntry(code) || { short: shortFor('', code) }).short);
    var next = li ? li.nextElementSibling || li.previousElementSibling : null;
    var nextCode = next ? next.getAttribute('data-code') : '';
    writeRecent(readRecent().filter(function (x) { return x.code !== code; }));
    delete rowMsg[code];
    if (current && current.code === code) hideResult();
    if (li) li.classList.add('leaving');
    setTimeout(function () {
      renderRecent();
      // Move focus only if it went with the row (or with the panel the delete was
      // finished from, or waits on the button that showed it): by now the user may be
      // typing a new link, or on its Copy button.
      var a = document.activeElement;
      if (a && a !== document.body && a.getClientRects().length && !(viaPanel && a === shortenBtn)) return;
      var target = nextCode ? list.querySelector('li[data-code="' + nextCode + '"] .r-short') : null;
      (target || recentTitle).focus();
    }, reduced() ? 0 : 220);
    announce(gone === 'kept' ? 'Taken off this list. The link itself still works.' :
      gone ? 'That link was already gone, so it’s off the list now.' : 'Deleted ' + label + '.');
  }

  list.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-action]') : null;
    if (!btn || !list.contains(btn)) return;
    var li = btn.closest('li[data-code]');
    if (!li || btn.getAttribute('aria-disabled') === 'true') return;
    if (li.classList.contains('leaving') || li.classList.contains('is-busy')) return;
    var code = li.getAttribute('data-code');
    var action = btn.getAttribute('data-action');
    if (action === 'copy') copyFromList(btn, code);
    else if (action === 'delete') askDelete(li);
    else if (action === 'cancel-delete') endConfirm(li, true);
    else if (action === 'confirm-delete') doDelete(code);
    else if (action === 'forget') removeEntry(code, 'kept', false);
  });
  list.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    var li = ev.target && ev.target.closest ? ev.target.closest('li.confirming') : null;
    if (li && !li.classList.contains('is-busy')) { ev.preventDefault(); endConfirm(li, true); }
  });

  // keep the list and the sign-in in step with other tabs
  window.addEventListener('storage', function (ev) {
    if (ev.key === null || ev.key === RECENT_STORE) {
      renderRecent();
      // the link on the card was deleted in another tab: stop offering to copy it
      if (current && !findEntry(current.code)) hideResult();
    }
    if (ev.key === null || ev.key === KEY_STORE || ev.key === PASS_STORE) {
      // The newest credential saved, by any tab, wins. One this tab keeps to itself stays
      // until another is saved; one it shares with storage goes when storage drops it.
      var v = cleanKey(lsGet(KEY_STORE)), p = v ? null : readPass(lsGet(PASS_STORE));
      if (v) { memKey = v; remembered = true; memPass = null; passSaved = false; }
      else if (p) { memPass = p; passSaved = true; memKey = ''; remembered = false; }
      else {
        if (remembered) { memKey = ''; remembered = false; }
        if (passSaved) { memPass = null; passSaved = false; }
      }
      syncKeyUi();
    }
  });
  setInterval(function () {
    var times = list.querySelectorAll('time[data-t]');
    for (var i = 0; i < times.length; i++) times[i].textContent = ago(Number(times[i].getAttribute('data-t')));
    var ends = list.querySelectorAll('.r-exp[data-x]');
    for (var j = 0; j < ends.length; j++) paintExpiry(ends[j], ends[j].closest('li'));
  }, 60000);

  syncNever(true);
  syncKeyUi();
  syncCustom();
  syncPaste();
  renderRecent();
  var year = $('year');
  if (year) year.textContent = String(new Date().getFullYear());
}());
