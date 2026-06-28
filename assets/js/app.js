/* ============================================================================
   app.js — renders the warm-editorial portfolio from window.SITE.
   Vanilla JS. Content is always visible; motion is a light enhancement.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.SITE;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function el(t, c, h) { var n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function a(href, cls, html, ext) { var n = el("a", cls, html); n.href = href; if (ext) { n.target = "_blank"; n.rel = "noopener"; } return n; }

  var ICON = {
    gh: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>',
    li: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7L22 6"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>'
  };

  function renderNav() {
    var nl = $("#navLinks");
    S.nav.forEach(function (n) { nl.appendChild(a("#" + n.id, "", esc(n.label))); });
    nl.appendChild(a(S.contact.resume, "btn primary", "Résumé", true));
    $("#year").textContent = "2026";
    var fs = $("#footerSocials");
    [["gh", S.contact.github], ["li", S.contact.linkedin], ["mail", "mailto:" + S.contact.email]].forEach(function (p) {
      var lnk = a(p[1], "", ICON[p[0]], p[0] !== "mail"); lnk.style.width = "18px"; lnk.setAttribute("aria-label", p[0]); fs.appendChild(lnk);
    });
  }

  function renderHero() {
    var p = S.profile;
    $("#heroEyebrow").textContent = p.eyebrow;
    $("#heroName").textContent = p.name;
    $("#heroRole").textContent = p.tagline;
    $("#heroLede").textContent = p.lede;
    $("#heroPhoto").src = p.photo;
    var cta = $("#heroCta");
    cta.appendChild(a("#work", "btn primary", "View my work"));
    cta.appendChild(a(S.contact.resume, "btn", ICON.dl + " Résumé", true));
    cta.appendChild(a(S.contact.linkedin, "btn", ICON.li + " LinkedIn", true));
    cta.appendChild(a(S.contact.github, "btn", ICON.gh + " GitHub", true));
    var meta = $("#heroMeta");
    [p.role, "NIC · MeitY", p.location].forEach(function (m) {
      meta.appendChild(el("span", "", '<span class="pin"></span>' + esc(m)));
    });
    var pil = $("#pillars");
    S.pillars.forEach(function (x) { pil.appendChild(el("span", "", esc(x))); });
  }

  function renderAbout() {
    $("#aboutLede").textContent = S.profile.lede;
    $("#aboutBody").textContent = S.profile.lede2;
    var box = $("#aboutStats");
    S.stats.forEach(function (s) {
      box.appendChild(el("div", "stat-card", '<div class="v">' + esc(s.value) + '</div><div class="l">' + esc(s.label) + "</div>"));
    });
  }

  function projectCard(pr) {
    var card = el("article", "card reveal" + (pr.featured ? " feat" : ""));
    card.setAttribute("data-cat", pr.category);
    var tech = (pr.tech || []).map(function (t) { return '<span class="t">' + esc(t) + "</span>"; }).join("");
    var links = "";
    if (pr.live) links += '<a class="live" href="' + esc(pr.live) + '" target="_blank" rel="noopener">' + ICON.ext + " Live demo</a>";
    if (pr.code) links += '<a href="' + esc(pr.code) + '" target="_blank" rel="noopener">' + ICON.gh + " Source</a>";
    card.innerHTML =
      '<div class="card-top"><h3>' + esc(pr.name) + '</h3>' + (pr.badge ? '<span class="badge">' + esc(pr.badge) + "</span>" : "") + "</div>" +
      '<p class="blurb">' + esc(pr.blurb) + "</p>" +
      '<div class="tech">' + tech + "</div>" +
      '<div class="links">' + links + "</div>";
    return card;
  }

  function renderWork() {
    var grid = $("#workGrid"), filters = $("#filters");
    S.categories.forEach(function (cat, i) {
      var b = el("button", "filter" + (i === 0 ? " active" : ""), esc(cat));
      b.addEventListener("click", function () {
        filters.querySelectorAll(".filter").forEach(function (f) { f.classList.remove("active"); });
        b.classList.add("active");
        grid.querySelectorAll(".card").forEach(function (c) {
          c.style.display = (cat === "All" || c.getAttribute("data-cat") === cat) ? "" : "none";
        });
      });
      filters.appendChild(b);
    });
    var ordered = S.projects.slice().sort(function (x, y) { return (y.featured ? 1 : 0) - (x.featured ? 1 : 0); });
    ordered.forEach(function (pr) { grid.appendChild(projectCard(pr)); });
    $("#allRepos").href = S.contact.github + "?tab=repositories";
  }

  function renderExperience() {
    var box = $("#exp");
    S.experience.forEach(function (x) {
      var bullets = x.bullets.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("");
      var tags = (x.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      var item = el("div", "exp-item reveal");
      item.innerHTML =
        '<div class="exp-when"><div class="period">' + esc(x.period) + '</div><div class="loc">' + esc(x.location) + "</div>" +
        (x.current ? '<div class="now">CURRENT</div>' : "") + "</div>" +
        '<div class="exp-body"><h3>' + esc(x.role) + '</h3><div class="org">' + esc(x.org) + "</div>" +
        '<p class="esum">' + esc(x.summary) + "</p><ul>" + bullets + "</ul>" +
        '<div class="exp-tags">' + tags + "</div></div>";
      box.appendChild(item);
    });
  }

  function renderSkills() {
    var grid = $("#skillsGrid");
    S.skills.forEach(function (g) {
      var items = g.items.map(function (i) { return '<span class="it">' + esc(i) + "</span>"; }).join("");
      grid.appendChild(el("div", "skill-card reveal", "<h4>" + esc(g.group) + '</h4><div class="items">' + items + "</div>"));
    });
  }

  function renderCredentials() {
    var edu = $("#eduList");
    S.education.forEach(function (e) {
      edu.appendChild(el("div", "edu-row",
        '<div class="deg">' + esc(e.degree) + '</div><div class="sch">' + esc(e.school) +
        '</div><div class="meta"><span>' + esc(e.period) + '</span><span class="grade">' + esc(e.note) + "</span></div>"));
    });
    $("#langs").innerHTML = S.languages.map(function (l) { return esc(l); }).join("&nbsp; · &nbsp;");
    var cl = $("#certList");
    S.certifications.forEach(function (c) { cl.appendChild(el("div", "cert-row", esc(c))); });
  }

  function renderContact() {
    var box = $("#contactActions");
    box.appendChild(a("mailto:" + S.contact.email, "btn primary", ICON.mail + " " + esc(S.contact.email)));
    box.appendChild(a(S.contact.linkedin, "btn", ICON.li + " LinkedIn", true));
    box.appendChild(a(S.contact.github, "btn", ICON.gh + " GitHub", true));
    box.appendChild(a(S.contact.resume, "btn", ICON.dl + " Résumé", true));
  }

  function wireNav() {
    var nav = $("#nav"), links = $("#navLinks"), burger = $("#burger");
    function onScroll() { nav.classList.toggle("solid", window.scrollY > 16); }
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    burger.addEventListener("click", function () { links.classList.toggle("open"); });
    links.querySelectorAll("a").forEach(function (l) { l.addEventListener("click", function () { links.classList.remove("open"); }); });
  }

  function wireReveal() {
    if (reduce) return;
    var pending = [].slice.call(document.querySelectorAll(".reveal"));
    function check() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      pending = pending.filter(function (n) {
        if (n.getBoundingClientRect().top < vh * 0.92) { n.classList.add("in"); return false; }
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

  function boot() {
    if (!S) return;
    renderNav(); renderHero(); renderAbout(); renderWork();
    renderExperience(); renderSkills(); renderCredentials(); renderContact();
    wireNav(); wireReveal();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
