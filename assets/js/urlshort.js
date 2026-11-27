/* karan98.in/urlshort: the owner's link shortener.
   Plain JS in one IIFE with no globals (the vendored QR library defines `qrcode`).
   Strings from the user, the server or storage only ever reach the page through
   textContent and setAttribute, and every localStorage access is guarded. */
(function () {
  'use strict';

  var API = '/api/urlshort';
  var KEY_STORE = 'urlshort:key';
  var RECENT_STORE = 'urlshort:recent';
  var MAX_RECENT = 200;      // the list is the only place a link can be deleted, so keep plenty
  var SHOWN_RECENT = 20;     // … and show the newest of them until "Show all" is pressed
  var SVGNS = 'http://www.w3.org/2000/svg';
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
  var CODE_RE = /^[a-z0-9-]{1,64}$/;
  var KEY_RE = /^[\x20-\x7e]{1,1024}$/;     // what an HTTP header can carry (keys are trimmed first)
  var BIDI_RE = /[‎‏‪-‮⁦-⁩]/g;

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
    notSetUp: 'The shortener isn’t switched on yet.',
    wrongHost: 'Links can only be made and deleted at karan98.in/urlshort.',
    clipEmpty: 'The clipboard is empty. Copy a link first, then tap Paste.',
    clipDenied: 'Couldn’t read the clipboard. Press and hold the field to paste instead.',
    copyKeys: 'Couldn’t copy automatically. Select the link and copy it with Ctrl+C or ⌘C.',
    copyTouch: 'Couldn’t copy automatically. Press and hold the link to copy it.',
    listTabOnly: 'This browser’s storage is full, so this list is kept for this tab only.',
    listGone: 'That link is already off the list.',
    offline: 'Couldn’t reach the shortener. Check your connection and try again.',
    server: 'Something went wrong on the server. Please try again.',
    deleteFailed: 'Couldn’t delete that link. Please try again.'
  };

  function $(id) { return document.getElementById(id); }
  var form = $('shortenForm');
  if (!form) return;
  // Never work inside a frame: the page around it could steer the owner's clicks into
  // making or deleting links. _headers forbids framing /urlshort; this covers any
  // address that slips past (an odd spelling of it, a copy served elsewhere).
  if (window.top !== window.self) {
    var framed = document.querySelectorAll('.tool, .recent');
    for (var fi = 0; fi < framed.length; fi++) framed[fi].hidden = true;
    return;
  }

  var urlIn = $('url'), slugIn = $('slug'), keyIn = $('ownerKey'), rememberIn = $('rememberKey');
  var keyBox = $('keyBox'), shortenBtn = $('shorten'), btnLabel = shortenBtn.querySelector('.btn-label');
  var note = $('formNote'), noteText = $('formNoteText'), retryBtn = $('retry'), forgetBtn = $('forgetKey');
  var keyState = $('keyState'), keyStateText = $('keyStateText'), pasteBtn = $('paste');
  var statusEl = $('status'), result = $('result'), shortA = $('short'), openA = $('open');
  var copyBtn = $('copy'), shareBtn = $('share'), againBtn = $('again'), copyMsg = $('copyMsg');
  var qrBox = $('qr'), qrFigure = $('qrFigure'), qrSave = $('qrSave'), qrSvgBtn = $('qrSvg');
  var origEl = $('orig'), dateEl = $('resultDate');
  var list = $('recent'), emptyBox = $('recentEmpty'), countEl = $('recentCount'), recentTitle = $('recentTitle');
  var moreBox = $('recentMoreBox'), moreBtn = $('recentMore');

  var fields = {
    url: { input: urlIn, box: $('urlField'), err: $('urlErr') },
    slug: { input: slugIn, box: $('slugField'), err: $('slugErr') },
    key: { input: keyIn, box: $('keyField'), err: $('keyErr') }
  };

  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(motion && motion.matches); }
  var coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  function touch() { return !!(coarse && coarse.matches); }

  /* ---- storage: always guarded; the page keeps working in memory without it ---- */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  var lsOk = (function () {
    try { window.localStorage.setItem('urlshort:probe', '1'); window.localStorage.removeItem('urlshort:probe'); return true; }
    catch (e) { return false; }
  }());

  function cleanKey(v) {
    v = typeof v === 'string' ? v.trim() : '';
    return KEY_RE.test(v) ? v : '';
  }
  var memKey = cleanKey(lsGet(KEY_STORE));   // the key in use, remembered or for this tab only
  var remembered = !!memKey;
  var memRecent = [];
  var pendingDelete = '';   // the code of a delete that is waiting for the owner key

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
  function cleanEntry(x) {
    if (!x || typeof x !== 'object') return null;
    var code = typeof x.code === 'string' ? x.code.toLowerCase() : '';
    if (!CODE_RE.test(code)) return null;
    var t = typeof x.t === 'number' && x.t > 0 && x.t < 8.64e15 ? x.t : 0;
    return { code: code, short: shortFor(x.short, code), url: httpUrl(x.url), t: t };
  }
  function readRecent() {
    var raw = memRecent;
    if (lsOk) {
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
  // Saves the list, newest first. Returns '' or, when not all of it fits, what to tell
  // the owner. Storage is shared with every page on karan98.in and can fill up: then as
  // many of the newest are saved as fit (fewer always fit in less room), and if not even
  // the newest fits, the list stays in this tab's memory.
  function saveRecent(items) { return lsSet(RECENT_STORE, JSON.stringify(items)); }
  function writeRecent(items) {
    memRecent = items.slice(0, MAX_RECENT);
    var n = memRecent.length;
    if (!lsOk || saveRecent(memRecent)) return '';
    var lo = 0, hi = n;   // the newest lo fit; the newest hi don't
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (saveRecent(memRecent.slice(0, mid))) lo = mid; else hi = mid;
    }
    // each write that worked was bigger than the one before, so the last is the newest lo
    if (!lo) { lsOk = false; return MSG.listTabOnly; }
    var gone = n - lo;
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

  /* ---- announcements and field errors ---- */
  var announceTimer = 0;
  function announce(msg) {
    statusEl.textContent = '';
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { statusEl.textContent = msg; }, 50);
  }
  function setError(name, msg) {
    var f = fields[name];
    f.err.lastElementChild.textContent = msg;
    f.err.hidden = false;
    f.box.classList.add('invalid');
    f.input.setAttribute('aria-invalid', 'true');
    f.input.focus();
    announce(msg);
  }
  function clearError(name) {
    var f = fields[name];
    if (f.err.hidden) return;
    f.err.hidden = true;
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

  /* ---- the owner key ---- */
  function keyOpen() { return !keyBox.hidden; }
  function pickKey() {
    var typed = keyOpen() ? keyIn.value.trim() : '';
    if (typed) return { key: typed, typed: true };
    return memKey ? { key: memKey, typed: false, saved: remembered } : null;
  }
  function openKeyBox() {
    if (keyOpen()) return;
    keyBox.hidden = false;
    keyBox.classList.remove('opening');
    void keyBox.offsetWidth;   // restart the unfold
    keyBox.classList.add('opening');
    syncPaste();
  }
  function closeKeyBox() {
    keyBox.hidden = true;
    keyBox.classList.remove('opening');
    keyIn.value = '';
    clearError('key');
    pendingDelete = '';
    syncPaste();
  }
  function keyProblem(key) { return key.length > 1024 ? MSG.keyLong : MSG.keyChars; }
  // says where the key in use lives, so a key kept for this tab is never invisible
  function syncKeyUi() {
    keyState.hidden = !memKey;
    keyStateText.textContent = remembered ? 'Key remembered on this device.' : 'Key kept for this tab only.';
  }
  // a request with this key just succeeded: keep it, and remember it if asked
  function acceptKey(k) {
    if (!k.typed) {
      // the key came from storage (another tab saved it, say): a box still asking is moot
      if (keyOpen()) closeKeyBox();
      return;
    }
    memKey = k.key;
    if (rememberIn.checked) remembered = lsSet(KEY_STORE, k.key);
    else { lsDel(KEY_STORE); remembered = false; }
    closeKeyBox();
    syncKeyUi();
  }
  // the server refused this key: drop it, and say whether it was the one typed just now.
  // A different key remembered meanwhile (by another tab) is left alone.
  function rejectKey(k) {
    if (!k || memKey === k.key) { memKey = ''; remembered = false; }
    if (!k || cleanKey(lsGet(KEY_STORE)) === k.key) lsDel(KEY_STORE);
    syncKeyUi();
    openKeyBox();
    setError('key', k && !k.typed ? (k.saved ? MSG.staleKey : MSG.staleTabKey) : MSG.badKey);
    keyIn.select();
  }
  forgetBtn.addEventListener('click', function () {
    lsDel(KEY_STORE);
    memKey = '';
    remembered = false;
    syncKeyUi();
    shortenBtn.focus();
    announce('Key forgotten. Making a link will ask for it again.');
  });

  /* ---- the API ---- */
  function request(method, url, key, body) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : 0;
    var headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };
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
  function setBusy(on) {
    busy = on;
    form.setAttribute('aria-busy', on ? 'true' : 'false');
    shortenBtn.setAttribute('aria-disabled', on ? 'true' : 'false');
    shortenBtn.classList.toggle('is-busy', on);
    btnLabel.textContent = on ? 'Shortening…' : 'Shorten link';
    // the keepsake must show what was sent, so nothing changes while a request is out
    urlIn.readOnly = slugIn.readOnly = keyIn.readOnly = on;
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

  // A create whose answer never arrived may still have been saved. Until the link or
  // ending changes, Try again sends the same request id, and the server answers with
  // that link instead of making a second one (or calling the owner's own ending taken).
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

  // Asked for the key to delete a link: Enter in the key field (or Shorten with no link
  // typed) finishes that delete. The request stays pending until the delete succeeds,
  // so a second Enter while it is out does nothing and one after a failure retries.
  function finishDelete() {
    var code = pendingDelete;
    if (findEntry(code)) { doDelete(code); return; }
    // gone meanwhile (deleted in another tab, say): nothing is left to ask the key for
    closeKeyBox();
    recentTitle.focus();
    announce(MSG.listGone);
  }
  // typing a link means making one: a delete still waiting for the key is dropped,
  // with its prompt, so Enter in the key field can't finish it unseen
  function dropDelete() {
    if (!pendingDelete) return;
    pendingDelete = '';
    if (fields.key.err.lastElementChild.textContent === MSG.keyToDelete) clearError('key');
  }
  keyIn.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.isComposing || !pendingDelete || busy) return;
    ev.preventDefault();
    finishDelete();
  });

  function submit() {
    if (busy) return;
    if (pendingDelete && !urlIn.value.trim()) { finishDelete(); return; }
    dropDelete();
    hideNote();
    clearError('url');
    clearError('slug');
    var raw = urlIn.value.trim();
    var bad = checkUrl(raw);
    if (bad) { setError('url', bad); return; }
    var slug = readSlug();
    var slugBad = slug ? slugProblem(slug) : '';
    if (slugBad) { setError('slug', slugBad); return; }
    var k = pickKey();
    if (!k) {
      if (keyOpen()) { setError('key', MSG.needKey); return; }
      openKeyBox();
      keyIn.focus();
      announce('Making links needs the owner key. ' + MSG.needKey);
      return;
    }
    clearError('key');
    if (!KEY_RE.test(k.key)) { setError('key', keyProblem(k.key)); return; }

    var sig = raw + '\n' + slug;
    if (!pending || pending.sig !== sig) pending = { sig: sig, rid: newRid() };
    var body = { url: raw };
    if (slug) body.slug = slug;
    if (pending.rid) body.rid = pending.rid;
    setBusy(true);
    request('POST', API, k.key, body).then(function (r) {
      setBusy(false);
      var d = r.data || {};
      if (r.status >= 200 && r.status < 300 && d.ok === true) {
        var code = typeof d.code === 'string' ? d.code.toLowerCase() : '';
        if (CODE_RE.test(code)) {
          pending = null;
          acceptKey(k);
          created({ code: code, short: shortFor(d.short, code), url: httpUrl(d.url), t: Date.now() });
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
      else if (err === 'unauthorized') rejectKey(k);
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
  // hidden while the key box is open, when the clipboard most likely holds the key
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
  // A failure is shown in the form's calm note, not only announced: on a phone there
  // is otherwise nothing to see (Safari and Firefox refuse when their Paste bubble is
  // dismissed, and an image on the clipboard reads as empty). The note sits below the
  // Shorten button, off a small phone's screen, so it is scrolled to.
  function pasteFailed(msg) {
    urlIn.focus();
    showNote(msg, false, true);
    bringIntoView(note);
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
  // While the key box is open a stray paste is most likely the key (focus on the
  // Remember box, say), which must never land in the plain-text Long URL field.
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
    showResult(entry, true);
    urlIn.value = '';
    slugIn.value = '';
    syncPaste();
    if (full) showNote(full, false, true);
    // after the note's own announcement, so one message carries both
    announce('Short link ready: ' + bare(entry.short) + '.' + (full ? ' ' + full : ''));
  }

  /* ---- the result ---- */
  var current = null;
  function showResult(e, fresh) {
    current = e;
    fillShort(shortA, e.short);
    shortA.setAttribute('href', e.short);
    // upright figures run wider than the italic did: past 7 characters, set the code smaller
    shortA.classList.toggle('is-long', splitShort(e.short)[1].length > 7);
    openA.setAttribute('href', e.short);
    fillOrig(origEl, e.url, true);
    origEl.parentNode.hidden = !e.url;
    dateEl.textContent = fmtDate(e.t);
    dateEl.setAttribute('datetime', new Date(e.t).toISOString());
    drawQr(e);
    clearTimeout(copyTimer);
    copyBtn.classList.remove('is-done');
    shortA.classList.remove('is-copied');
    copyMsg.hidden = true;
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

  function paintRowMsg(li, m) {
    var old = li.querySelector('.r-msg');
    if (old) old.remove();
    if (m) li.appendChild(el('p', 'r-msg' + (m.calm ? ' calm' : ''), m.text));
  }
  function setRowMsg(code, text, calm) {
    if (text) rowMsg[code] = { text: text, calm: !!calm };
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

  // From the row's Delete, or from the key field once the key was asked for. The row is
  // looked up afresh each time: the list may be rebuilt while the request is out.
  function doDelete(code) {
    if (deleting[code]) return;
    var li = rowFor(code);
    var k = pickKey();
    if (!k || !KEY_RE.test(k.key)) {
      if (li) endConfirm(li, false);
      pendingDelete = code;
      openKeyBox();
      setError('key', k ? keyProblem(k.key) : MSG.keyToDelete);
      return;
    }
    deleting[code] = true;
    if (li) { clearItemMsg(li); showConfirm(li, false); markDeleting(li); }
    // from the key field, the row may be off screen: say something is happening
    announce('Deleting ' + bare((findEntry(code) || { short: shortFor('', code) }).short) + '…');
    request('DELETE', API + '?code=' + encodeURIComponent(code), k.key).then(function (r) {
      delete deleting[code];
      var cur = rowFor(code);
      if (cur) { cur.classList.remove('is-busy'); cur.removeAttribute('aria-busy'); }
      var d = r.data || {};
      var err = typeof d.error === 'string' ? d.error : (r.status === 401 ? 'unauthorized' : '');
      if ((r.status >= 200 && r.status < 300 && d.ok === true) || err === 'not-found') {
        acceptKey(k);   // a not-found has passed the key check too
        removeEntry(code, err === 'not-found');
        return;
      }
      if (cur) endConfirm(cur, false);
      if (err === 'unauthorized') { rejectKey(k); pendingDelete = code; return; }
      var msg = err === 'not-set-up' ? MSG.notSetUp : err === 'wrong-host' ? MSG.wrongHost :
        r.status === 0 ? MSG.offline : MSG.deleteFailed;
      setRowMsg(code, msg, false);
      announce(msg);
      var again = cur && cur.querySelector('[data-action="delete"]');
      if (again) again.focus();
    });
  }
  function removeEntry(code, gone) {
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
      // Move focus only if it went with the row (or with the key box the delete was
      // finished from): by now the owner may be typing a new link, or on its Copy button.
      var a = document.activeElement;
      if (a && a !== document.body && a.getClientRects().length) return;
      var target = nextCode ? list.querySelector('li[data-code="' + nextCode + '"] .r-short') : null;
      (target || recentTitle).focus();
    }, reduced() ? 0 : 220);
    announce(gone ? 'That link was already gone, so it’s off the list now.' : 'Deleted ' + label + '.');
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
  });
  list.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    var li = ev.target && ev.target.closest ? ev.target.closest('li.confirming') : null;
    if (li && !li.classList.contains('is-busy')) { ev.preventDefault(); endConfirm(li, true); }
  });

  // keep the list and the key in step with other tabs
  window.addEventListener('storage', function (ev) {
    if (ev.key === null || ev.key === RECENT_STORE) {
      renderRecent();
      // the link on the card was deleted in another tab: stop offering to copy it
      if (current && !findEntry(current.code)) hideResult();
    }
    if (ev.key === null || ev.key === KEY_STORE) {
      var v = cleanKey(lsGet(KEY_STORE));
      if (v) { memKey = v; remembered = true; }
      else if (remembered) { memKey = ''; remembered = false; }
      syncKeyUi();
    }
  });
  setInterval(function () {
    var times = list.querySelectorAll('time[data-t]');
    for (var i = 0; i < times.length; i++) times[i].textContent = ago(Number(times[i].getAttribute('data-t')));
  }, 60000);

  syncKeyUi();
  syncPaste();
  renderRecent();
  var year = $('year');
  if (year) year.textContent = String(new Date().getFullYear());
}());
