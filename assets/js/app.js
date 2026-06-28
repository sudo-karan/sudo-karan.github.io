/* ============================================================================
   THE SUBSTRATE — app.js
   Renders every section from window.SITE and drives all interactions with
   vanilla JS + modern CSS (canvas, sticky scrub, clip, IO, rAF). No libraries.
   Progressive enhancement: content is always visible; motion is added only when
   it is safe (not reduced-motion). reduced-motion / JS-light = static & complete.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SITE;
  var docEl = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isDesktop = window.matchMedia("(min-width: 901px)").matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var ICON = {
    gh: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>',
    li: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7L22 6"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>'
  };

  /* ====================== RENDER ======================================== */
  function aTag(href, cls, html, ext) {
    var a = el("a", cls, html); a.href = href; if (ext) { a.target = "_blank"; a.rel = "noopener"; } return a;
  }

  function renderNav() {
    var nav = $("#navlinks");
    S.nav.forEach(function (n) { nav.appendChild(aTag("#" + n.id, "", esc(n.label))); });
    var fl = $("#footerLinks");
    [aTag(S.contact.github, "", "GitHub", true), aTag(S.contact.linkedin, "", "LinkedIn", true), aTag("mailto:" + S.contact.email, "", "Email")]
      .forEach(function (a, i) { if (i) fl.appendChild(document.createTextNode("  ·  ")); fl.appendChild(a); });
    $("#year").textContent = "2026";
  }

  function renderHero() {
    var p = S.profile;
    $("#heroStatus").textContent = p.statusLine;
    var lines = p.headline.split(" / ");
    $("#heroHeadline").innerHTML = lines.map(function (l) {
      return '<span class="ln"><span>' + esc(l).replace(/data infrastructure\./, '<em>data infrastructure.</em>') + "</span></span>";
    }).join("");
    $("#heroSub").textContent = p.subline;
    var ro = $("#heroReadouts");
    p.readouts.forEach(function (r) { ro.appendChild(el("div", "", esc(r))); });
    var cta = $("#heroCta");
    cta.appendChild(aTag(S.contact.resume, "btn primary", ICON.dl + " Résumé", true));
    cta.appendChild(aTag("#systems", "btn", "View systems"));
    cta.appendChild(aTag(S.contact.github, "btn", ICON.gh + " GitHub", true));
  }

  function renderAbout() {
    var p = S.profile, sum = p.summary;
    var first = sum.charAt(0), rest = sum.slice(1);
    var cut = rest.indexOf(". ") + 1;
    var lede = rest.slice(0, cut), tail = rest.slice(cut).trim();
    $("#aboutLede").innerHTML = '<span class="dropcap">' + esc(first) + "</span>" + esc(lede);
    $("#aboutTail").textContent = tail;
    var rows = [
      ["Role", p.role], ["Organisation", "NIC · MeitY"], ["Mandate", "Open Government Data"],
      ["Based", p.location], ["Since", p.since], ["Previously", "McKinsey & Co."], ["M.Tech", "9.60 CGPA · PEC"]
    ];
    var box = $("#glanceRows");
    rows.forEach(function (r) { box.appendChild(el("div", "row", "<span>" + esc(r[0]) + "</span><span>" + esc(r[1]) + "</span>")); });
    $("#bylineImg").src = p.avatar;
  }

  function renderNumbers() {
    var g = $("#numbersGrid");
    S.numbers.forEach(function (n, i) {
      var fig = n.type === "num"
        ? '<span class="fig" data-num="' + esc(n.figure) + '" data-suffix="' + esc(n.suffix || "") + '">' + esc(n.figure) + (n.suffix ? '<span class="unit">' + esc(n.suffix) + "</span>" : "") + "</span>"
        : '<span class="fig">' + esc(n.figure) + "</span>";
      g.appendChild(el("div", "numfig reveal t-" + i, fig + '<div class="cap">' + esc(n.caption) + '</div><div class="sub">' + esc(n.sub) + "</div>"));
    });
  }

  function renderCareer() {
    var c = $("#career");
    S.experience.forEach(function (x) {
      var bullets = x.bullets.map(function (b) {
        return "<li>" + (b.runin ? "<b>" + esc(b.runin) + "</b> " : "") + esc(b.text) + "</li>";
      }).join("");
      var tags = (x.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("");
      var entry = el("div", "role-entry reveal");
      entry.innerHTML =
        '<div><div class="role-year">' + esc(x.year) + (x.current ? '<span class="now">NOW</span>' : "") +
        '</div><div class="role-meta">' + esc(x.period) + "<br>" + esc(x.location) + "</div></div>" +
        '<div class="role-body"><h3>' + esc(x.role) + '</h3><div class="org">' + esc(x.org) + "</div>" +
        '<p class="standfirst">' + esc(x.standfirst) + "</p><ul>" + bullets + "</ul>" +
        '<div class="role-tags">' + tags + "</div></div>";
      c.appendChild(entry);
    });
  }

  /* ---- systems registry ---- */
  var regActive = 0;
  function renderSystems() {
    var order = [];
    S.systems.forEach(function (s) { if (order.indexOf(s.category) < 0) order.push(s.category); });
    var index = $("#regIndex"), chips = $("#regChips");
    order.forEach(function (cat) {
      var grp = el("div", "reg-group", "<h4>" + esc(cat) + "</h4>");
      S.systems.forEach(function (s, i) {
        if (s.category !== cat) return;
        var st = S.statusMeta[s.status];
        var b = el("button", "reg-item", '<span class="dot ' + st.tone + '"></span><span class="nm">' + esc(s.name) + '</span><span class="ar">→</span>');
        b.setAttribute("data-i", i);
        b.addEventListener("click", function () { setSystem(i, true); });
        grp.appendChild(b);
      });
      index.appendChild(grp);
    });
    S.systems.forEach(function (s, i) {
      var st = S.statusMeta[s.status];
      var ch = el("button", "reg-chip", '<span class="dot ' + st.tone + '"></span>' + esc(s.name));
      ch.setAttribute("data-i", i);
      ch.addEventListener("click", function () { setSystem(i, true); });
      chips.appendChild(ch);
    });
    $("#regCount").textContent = S.systems.length + " systems in registry — " +
      S.systems.filter(function (s) { return s.live; }).length + " with live demos";
    setSystem(0, false);
  }

  function setSystem(i, scrollChip) {
    regActive = i;
    var s = S.systems[i], st = S.statusMeta[s.status];
    var items = document.querySelectorAll(".reg-item");
    for (var k = 0; k < items.length; k++) items[k].classList.toggle("active", +items[k].getAttribute("data-i") === i);
    var chips = document.querySelectorAll(".reg-chip"), activeChip = null;
    for (var j = 0; j < chips.length; j++) { var on = +chips[j].getAttribute("data-i") === i; chips[j].classList.toggle("active", on); if (on) activeChip = chips[j]; }
    if (scrollChip && activeChip && activeChip.scrollIntoView) activeChip.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });

    var badges = (s.badges || []).map(function (b) { return '<span class="bdg">' + esc(b) + "</span>"; }).join("");
    var tech = (s.tech || []).map(function (t) { return '<span class="t">' + esc(t) + "</span>"; }).join("");
    var actions = "";
    if (s.live) actions += '<a class="go" href="' + esc(s.live) + '" target="_blank" rel="noopener">' + ICON.ext + " Live demo</a>";
    if (s.code) actions += '<a href="' + esc(s.code) + '" target="_blank" rel="noopener">' + ICON.gh + " Source</a>";
    var panel = el("div", "reg-panel" + (s.flagship ? " flag" : ""));
    panel.innerHTML =
      '<div class="pcat">' + esc(s.category) + "</div><h3>" + esc(s.name) + "</h3>" +
      '<div class="pstatus"><span class="dot ' + st.tone + '"></span>' + esc(st.label) + "</div>" +
      '<p class="pblurb">' + esc(s.blurb) + "</p>" +
      '<div class="reg-badges">' + badges + "</div>" +
      '<div class="reg-tech">' + tech + "</div>" +
      '<div class="reg-actions">' + actions + "</div>";
    var wrap = $("#regPanel");
    wrap.innerHTML = "";
    if (!reduce) { panel.style.opacity = "0"; panel.style.transform = "translateY(8px)"; }
    wrap.appendChild(panel);
    if (!reduce) requestAnimationFrame(function () { panel.style.transition = "opacity .35s ease, transform .35s ease"; panel.style.opacity = "1"; panel.style.transform = "none"; });
  }

  function renderResearch() {
    var r = S.research;
    $("#resKicker").textContent = r.kicker;
    $("#resTitle").innerHTML = r.title.split(" / ").map(function (l) { return esc(l); }).join("<br>");
    $("#resBody").textContent = r.body;
    $("#fusionCountLabel").textContent = r.counterLabel;
    $("#resCode").href = r.code;
    var pipe = $("#pipeline");
    r.pipeline.forEach(function (st, i) {
      if (i) pipe.appendChild(el("span", "arr", "→"));
      pipe.appendChild(el("span", "st", esc(st)));
    });
    // author abstract forest-stand boundary paths
    var paths = [
      "M60,120 L185,92 L243,172 L168,250 L82,232 Z",
      "M243,172 L360,120 L432,205 L352,292 L250,282 L168,250 Z",
      "M360,120 L505,82 L560,165 L470,232 L432,205 Z",
      "M250,282 L352,292 L424,362 L322,412 L210,382 Z",
      "M470,232 L560,165 L652,235 L610,345 L500,332 L432,280 Z"
    ];
    $("#fusionSvg").innerHTML = paths.map(function (d) { return '<path d="' + d + '" />'; }).join("");
  }

  function renderToolkit() {
    var g = $("#toolkitGrid");
    S.toolkit.forEach(function (t) {
      var items = t.items.map(function (i) { return '<span class="it">' + esc(i) + "</span>"; }).join("");
      g.appendChild(el("div", "tk-group", "<h4>" + esc(t.group) + '</h4><div class="items">' + items + "</div>"));
    });
  }

  function renderCredentials() {
    var edu = $("#eduList");
    S.education.forEach(function (e) {
      edu.appendChild(el("div", "led-row",
        '<div class="d1">' + esc(e.degree) + '</div><div class="d2">' + esc(e.school) +
        '</div><div class="d3"><span>' + esc(e.period) + '</span><span class="grade">' + esc(e.note) + "</span></div>"));
    });
    $("#langs").innerHTML = S.languages.map(function (l) { return esc(l); }).join("&nbsp; · &nbsp;");
    var cl = $("#certList");
    S.certifications.forEach(function (c) { cl.appendChild(el("div", "cert-row", esc(c))); });
  }

  function renderContact() {
    var a = $("#contactActions");
    a.appendChild(aTag("mailto:" + S.contact.email, "btn primary", ICON.mail + " " + esc(S.contact.email)));
    a.appendChild(aTag(S.contact.linkedin, "btn", ICON.li + " LinkedIn", true));
    a.appendChild(aTag(S.contact.github, "btn", ICON.gh + " GitHub", true));
    a.appendChild(aTag(S.contact.resume, "btn", ICON.dl + " Résumé", true));
  }

  /* ====================== INTERACTIONS ================================== */
  function wireTheme() {
    var saved = localStorage.getItem("theme");
    if (saved) docEl.setAttribute("data-theme", saved);
    $("#themeBtn").addEventListener("click", function () {
      var next = docEl.getAttribute("data-theme") === "light" ? "dark" : "light";
      docEl.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      var m = $('meta[name="theme-color"]'); if (m) m.content = next === "light" ? "#f4f1ea" : "#06080d";
      substrate.recolor();
    });
  }

  function wireTopbar() {
    var bar = $("#topbar");
    function onScroll() { bar.classList.toggle("solid", window.scrollY > 20); }
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* bulletproof position-based reveal (never leaves a section hidden) */
  function wireReveal() {
    if (reduce) return; // CSS shows everything; nothing to do
    var pending = [].slice.call(document.querySelectorAll(".reveal"));
    function check() {
      var vh = window.innerHeight || docEl.clientHeight;
      pending = pending.filter(function (n) {
        if (n.getBoundingClientRect().top < vh * 0.9) { n.classList.add("in"); return false; }
        return true;
      });
      if (!pending.length) { window.removeEventListener("scroll", onS); window.removeEventListener("resize", onS); }
    }
    var t = false;
    function onS() { if (t) return; t = true; requestAnimationFrame(function () { check(); t = false; }); }
    window.addEventListener("scroll", onS, { passive: true });
    window.addEventListener("resize", onS, { passive: true });
    check();
  }

  function wireCounters() {
    var figs = [].slice.call(document.querySelectorAll(".fig[data-num]"));
    function run(node) {
      var raw = node.getAttribute("data-num"), suf = node.getAttribute("data-suffix") || "";
      var m = raw.match(/^([\d.]+)(.*)$/); if (!m) return;
      var target = parseFloat(m[1]), tail = m[2] || "", dec = (m[1].split(".")[1] || "").length;
      if (reduce) return; // keep static final value
      var start = null, dur = 1300;
      function frame(ts) {
        if (start == null) start = ts;
        var p = clamp((ts - start) / dur, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        node.innerHTML = (e * target).toFixed(dec) + tail + (suf ? '<span class="unit">' + esc(suf) + "</span>" : "");
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    figs.forEach(function (f) { io.observe(f); });
  }

  /* ---- Sentinel fusion scrub ---- */
  function wireFusion() {
    var fusion = $("#fusion"), s1 = $("#flS1"), s2 = $("#flS2");
    var paths = [].slice.call(document.querySelectorAll("#fusionSvg path"));
    var lens = paths.map(function (p) { var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; return L; });
    var countEl = $("#fusionCount"), stages = [].slice.call(document.querySelectorAll("#pipeline .st"));
    var target = S.research.counterTo;

    function apply(p) {
      // 0 -> .45 : layers register (slide to center).  .45 -> 1 : fuse + draw boundaries
      var reg = clamp(p / 0.45, 0, 1);
      var fuse = clamp((p - 0.45) / 0.55, 0, 1);
      var off1 = (1 - reg) * -9, off2 = (1 - reg) * 9;
      s1.style.transform = "translateX(" + off1 + "%)";
      s2.style.transform = "translateX(" + off2 + "%)";
      s2.style.opacity = (0.35 + 0.65 * reg).toFixed(2);
      paths.forEach(function (pt, i) { pt.style.strokeDashoffset = lens[i] * (1 - fuse); });
      var val = Math.round(fuse * target);
      countEl.textContent = val;
      var stageCount = Math.round(p * stages.length);
      stages.forEach(function (st, i) { st.classList.toggle("on", i < stageCount); });
    }

    if (reduce || !isDesktop) { apply(1); return; } // static fused state on mobile / reduced
    function onScroll() {
      var r = fusion.getBoundingClientRect();
      var total = fusion.offsetHeight - window.innerHeight;
      if (total <= 0) { apply(1); return; }
      apply(clamp(-r.top / total, 0, 1));
    }
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  /* ---- substrate canvas lattice ---- */
  var substrate = (function () {
    var cv = $("#substrate"), ctx = cv.getContext("2d");
    var w = 0, h = 0, dpr = 1, nodes = [], raf = null, t0 = 0;
    var pointer = { x: -9999, y: -9999, on: false };
    var col = { node: "rgba(94,234,212,", edge: "rgba(129,140,248," };

    function recolor() {
      var light = docEl.getAttribute("data-theme") === "light";
      col = light ? { node: "rgba(13,148,136,", edge: "rgba(79,70,229," } : { node: "rgba(94,234,212,", edge: "rgba(129,140,248," };
    }
    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, isDesktop ? 2 : 1.5);
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var area = w * h, base = isDesktop ? 19000 : 30000;
      var n = clamp(Math.round(area / base), 18, isDesktop ? 88 : 42);
      nodes = [];
      for (var i = 0; i < n; i++) nodes.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .12, vy: (Math.random() - .5) * .12, r: Math.random() * 1.4 + .6 });
    }
    var RAD = 150, RAD2 = RAD * RAD;
    function draw(now) {
      ctx.clearRect(0, 0, w, h);
      var dt = now ? Math.min((now - t0) / 16.67, 3) : 1; t0 = now || 0;
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        a.x += a.vx * dt; a.y += a.vy * dt;
        if (a.x < -20) a.x = w + 20; if (a.x > w + 20) a.x = -20;
        if (a.y < -20) a.y = h + 20; if (a.y > h + 20) a.y = -20;
      }
      for (var p = 0; p < nodes.length; p++) {
        for (var q = p + 1; q < nodes.length; q++) {
          var dx = nodes[p].x - nodes[q].x, dy = nodes[p].y - nodes[q].y, d2 = dx * dx + dy * dy;
          if (d2 < RAD2) {
            var al = (1 - d2 / RAD2) * 0.5;
            ctx.strokeStyle = col.edge + al.toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(nodes[p].x, nodes[p].y); ctx.lineTo(nodes[q].x, nodes[q].y); ctx.stroke();
          }
        }
      }
      for (var k = 0; k < nodes.length; k++) {
        var nd = nodes[k], glow = 1;
        if (pointer.on) { var pdx = nd.x - pointer.x, pdy = nd.y - pointer.y, pd = pdx * pdx + pdy * pdy; if (pd < 26000) glow = 1 + (1 - pd / 26000) * 2.4; }
        ctx.fillStyle = col.node + (0.55 * Math.min(glow, 1.6)).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r * glow, 0, 6.2832); ctx.fill();
      }
    }
    function loop(now) { draw(now); raf = requestAnimationFrame(loop); }
    function start() {
      recolor(); resize();
      if (reduce) { draw(0); return; }
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      window.addEventListener("resize", function () { resize(); if (reduce) draw(0); });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
        else if (!raf && !reduce) raf = requestAnimationFrame(loop);
      });
      if (isDesktop) window.addEventListener("pointermove", function (e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true; });
    }
    return { start: start, recolor: recolor };
  })();

  /* ---- command palette ---- */
  function wireCmdk() {
    var box = $("#cmdk"), input = $("#cmdkInput"), list = $("#cmdkList");
    var cmds = [], sel = 0, lastFocus = null;

    S.nav.forEach(function (n) { cmds.push({ name: "Go to " + n.label, hint: "section", run: function () { jump("#" + n.id); } }); });
    S.systems.forEach(function (s) {
      if (s.live) cmds.push({ name: "Launch " + s.name, hint: "live demo", tone: S.statusMeta[s.status].tone, run: function () { window.open(s.live, "_blank", "noopener"); } });
      if (s.code) cmds.push({ name: "Source · " + s.name, hint: "github", tone: "source", run: function () { window.open(s.code, "_blank", "noopener"); } });
    });
    cmds.push({ name: "Download résumé (PDF)", hint: "action", run: function () { window.open(S.contact.resume, "_blank", "noopener"); } });
    cmds.push({ name: "Email Jaskaran", hint: "action", run: function () { location.href = "mailto:" + S.contact.email; } });
    cmds.push({ name: "Open GitHub", hint: "@" + S.contact.githubUser, run: function () { window.open(S.contact.github, "_blank", "noopener"); } });
    cmds.push({ name: "Open LinkedIn", hint: "action", run: function () { window.open(S.contact.linkedin, "_blank", "noopener"); } });
    cmds.push({ name: "Toggle light / dark theme", hint: "action", run: function () { $("#themeBtn").click(); } });

    function jump(sel) { var t = $(sel); if (t) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }

    function render(q) {
      q = (q || "").toLowerCase().trim();
      var filtered = cmds.filter(function (c) { return !q || (c.name + " " + c.hint).toLowerCase().indexOf(q) >= 0; });
      list.dataset.n = filtered.length; list._filtered = filtered; sel = 0;
      if (!filtered.length) { list.innerHTML = '<div class="cmdk-empty">No matches</div>'; return; }
      list.innerHTML = filtered.map(function (c, i) {
        var dot = c.tone ? '<span class="dot ' + c.tone + '"></span>' : '<span class="ci-k">↵</span>';
        return '<div class="cmdk-item' + (i === 0 ? " sel" : "") + '" data-i="' + i + '">' + dot +
          '<span class="ci-name">' + esc(c.name) + '</span><span class="ci-hint">' + esc(c.hint) + "</span></div>";
      }).join("");
      [].slice.call(list.children).forEach(function (it) {
        it.addEventListener("click", function () { exec(+it.getAttribute("data-i")); });
        it.addEventListener("mousemove", function () { setSel(+it.getAttribute("data-i")); });
      });
    }
    function setSel(i) {
      var items = list.querySelectorAll(".cmdk-item"); if (!items.length) return;
      sel = (i + items.length) % items.length;
      for (var k = 0; k < items.length; k++) items[k].classList.toggle("sel", k === sel);
      items[sel].scrollIntoView({ block: "nearest" });
    }
    function exec(i) { var f = list._filtered; if (f && f[i]) { close(); f[i].run(); } }

    function open() { lastFocus = document.activeElement; box.classList.add("open"); input.value = ""; render(""); setTimeout(function () { input.focus(); }, 20); }
    function close() { box.classList.remove("open"); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel(sel + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel(sel - 1); }
      else if (e.key === "Enter") { e.preventDefault(); exec(sel); }
      else if (e.key === "Escape") { close(); }
    });
    $("#cmdkScrim").addEventListener("click", close);
    $("#cmdkBtn").addEventListener("click", open);
    $("#menuBtn").addEventListener("click", open);
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); box.classList.contains("open") ? close() : open(); }
      else if (e.key === "/" && !box.classList.contains("open") && !/input|textarea/i.test((document.activeElement || {}).tagName || "")) { e.preventDefault(); open(); }
    });
  }

  /* ====================== BOOT ========================================= */
  function boot() {
    docEl.classList.remove("no-js");
    if (!reduce) docEl.classList.add("motion");
    renderNav(); renderHero(); renderAbout(); renderNumbers(); renderCareer();
    renderSystems(); renderResearch(); renderToolkit(); renderCredentials(); renderContact();
    wireTheme(); wireTopbar(); wireReveal(); wireCounters(); wireFusion(); wireCmdk();
    substrate.start();
    // kick off hero reveals
    requestAnimationFrame(function () {
      $("#heroEyebrow").classList.add("in");
      $("#heroHeadline").classList.add("in");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
