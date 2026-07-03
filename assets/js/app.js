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
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
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
    var creds = $("#heroCreds");
    (p.creds || []).forEach(function (c) { creds.appendChild(el("span", "cred", '<span class="cdot"></span>' + esc(c))); });
    var meta = $("#heroMeta");
    [p.role, "NIC · MeitY", p.location].forEach(function (m) {
      meta.appendChild(el("span", "", '<span class="pin"></span>' + esc(m)));
    });
    var pil = $("#pillars");
    S.pillars.forEach(function (x) { pil.appendChild(el("span", "", esc(x))); });
  }

  function renderBuilding() {
    var b = S.building; if (!b) return;
    $("#buildKicker").textContent = b.kicker;
    $("#buildName").textContent = b.name;
    $("#buildBlurb").textContent = b.blurb;
    $("#buildBadge").textContent = b.badge;
    var hl = $("#buildHighlights"); b.highlights.forEach(function (h) { hl.appendChild(el("li", "", esc(h))); });
    var tech = $("#buildTech"); b.tech.forEach(function (t) { tech.appendChild(el("span", "t", esc(t))); });
    $("#buildActions").appendChild(a(b.code, "btn primary", ICON.gh + " View the code", true));
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

  /* ---- contact form ---- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function wireContactForm() {
    var form = $("#contactForm");
    if (!form) return;
    var statusEl = $("#formStatus");
    var submitBtn = $("#cfSubmit");
    submitBtn.innerHTML = ICON.send + " Send message";
    var tEl = $("#cfTurnstile"), widgetId = null;

    // Render the Turnstile widget once its script is ready (poll up to ~8s).
    var key = (S.contact && S.contact.turnstileSiteKey) || "";
    var tries = 0;
    (function renderTurnstile() {
      if (window.turnstile && tEl && widgetId == null && key) {
        try { widgetId = window.turnstile.render(tEl, { sitekey: key, theme: "light" }); } catch (e) {}
      }
      if (widgetId == null && tries++ < 40) setTimeout(renderTurnstile, 200);
    })();

    function fieldOf(name) { return form.querySelector('[name="' + name + '"]'); }
    function setErr(name, msg) {
      var inp = fieldOf(name); if (!inp) return;
      var wrap = inp.closest(".field"), err = form.querySelector('.err[data-for="' + name + '"]');
      if (wrap) wrap.classList.toggle("invalid", !!msg);
      if (err) err.textContent = msg || "";
    }
    function clearErrs() { ["name", "email", "subject", "message", "org"].forEach(function (n) { setErr(n, ""); }); }

    function validate(v) {
      clearErrs();
      var first = null;
      function bad(n, m) { setErr(n, m); if (!first) first = fieldOf(n); }
      if (!v.name) bad("name", "Please enter your name.");
      if (!v.email) bad("email", "Please enter your email.");
      else if (!EMAIL_RE.test(v.email)) bad("email", "Please enter a valid email address.");
      if (!v.subject) bad("subject", "Please add a subject.");
      if (!v.message) bad("message", "Please write a message.");
      else if (v.message.length < 10) bad("message", "A little more detail, please (10+ characters).");
      if (first) first.focus();
      return !first;
    }

    function setStatus(msg, kind) { statusEl.className = "form-status" + (kind ? " " + kind : ""); statusEl.innerHTML = msg || ""; }

    function mailtoFallback(v) {
      var body = "From: " + v.name + (v.org ? " (" + v.org + ")" : "") + "\nEmail: " + v.email + "\n\n" + v.message;
      return "mailto:" + S.contact.email + "?subject=" + encodeURIComponent(v.subject || "Hello") + "&body=" + encodeURIComponent(body);
    }

    // Success view that doesn't jump the layout: freeze the card at its current
    // height, swap the form for a centred confirmation, and offer a reset.
    var card = form.closest(".form-card") || form.parentNode;
    var heading = card.querySelector("h3");
    function showSent(v) {
      card.style.minHeight = card.getBoundingClientRect().height + "px";
      card.classList.add("sent");
      if (heading) heading.hidden = true;
      form.hidden = true;
      var done = el("div", "form-done");
      done.innerHTML =
        '<div class="done-badge">' + ICON.check + "</div>" +
        '<div class="big">Message sent</div>' +
        "<p>Thanks, " + esc(v.name.split(" ")[0] || "there") +
        " — I’ll get back to you at <strong>" + esc(v.email) + "</strong> soon.</p>" +
        '<button type="button" class="btn again">Send another message</button>';
      card.appendChild(done);
      done.querySelector(".again").addEventListener("click", function () {
        card.removeChild(done);
        card.classList.remove("sent");
        card.style.minHeight = "";
        if (heading) heading.hidden = false;
        form.reset();
        clearErrs();
        setStatus("", "");
        submitBtn.disabled = false;
        if (window.turnstile && widgetId != null) { try { window.turnstile.reset(widgetId); } catch (e) {} }
        form.hidden = false;
        fieldOf("name").focus();
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = {
        name: fieldOf("name").value.trim(),
        email: fieldOf("email").value.trim(),
        subject: fieldOf("subject").value.trim(),
        org: fieldOf("org").value.trim(),
        message: fieldOf("message").value.trim(),
        website: fieldOf("website").value.trim() // honeypot
      };
      if (!validate(v)) { setStatus("", ""); return; }

      var token = window.turnstile && widgetId != null ? window.turnstile.getResponse(widgetId) : "";
      if (!token) { setStatus("Please complete the “I’m human” check.", "err"); return; }

      submitBtn.disabled = true;
      setStatus("Sending…", "");

      gatherMeta().then(function (meta) {
        var payload = {
          token: token,
          fields: { name: v.name, email: v.email, subject: v.subject, org: v.org, message: v.message },
          meta: meta
        };
        // Apps Script can't return CORS headers, so we POST as a "simple request"
        // (text/plain → no preflight) in no-cors mode: the request reaches the
        // script (which records + emails); the response is opaque to us, so we
        // confirm optimistically once it's sent.
        return fetch(S.contact.formEndpoint, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });
      }).then(function () {
        showSent(v);
      }).catch(function () {
        submitBtn.disabled = false;
        if (window.turnstile && widgetId != null) window.turnstile.reset(widgetId);
        setStatus('Couldn’t send right now. Please <a href="' + mailtoFallback(v) + '">email me directly</a>.', "err");
      });
    });
  }

  // Best-effort, silent metadata (no permission prompt): browser/OS from UA,
  // locale/referrer/timezone, and IP-based geo/ISP from a free lookup.
  function uaParse(ua) {
    ua = ua || "";
    var os = "Unknown";
    if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
    else if (/Windows NT/.test(ua)) os = "Windows";
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
    else if (/Android/.test(ua)) { var am = ua.match(/Android (\d+(\.\d+)?)/); os = am ? "Android " + am[1] : "Android"; }
    else if (/Mac OS X/.test(ua)) os = "macOS";
    else if (/Linux/.test(ua)) os = "Linux";
    var br = "Unknown", m;
    if ((m = ua.match(/Edg\/(\d+(\.\d+)?)/))) br = "Edge " + m[1];
    else if ((m = ua.match(/OPR\/(\d+(\.\d+)?)/))) br = "Opera " + m[1];
    else if (/Chrome\//.test(ua) && (m = ua.match(/Chrome\/(\d+(\.\d+)?)/))) br = "Chrome " + m[1];
    else if (/Firefox\//.test(ua) && (m = ua.match(/Firefox\/(\d+(\.\d+)?)/))) br = "Firefox " + m[1];
    else if (/Safari/.test(ua) && (m = ua.match(/Version\/(\d+(\.\d+)?)/))) br = "Safari " + m[1];
    return { browser: br, platform: os };
  }
  function gatherMeta() {
    var nav = navigator, scr = window.screen || {}, d = uaParse(nav.userAgent);
    function yn(b) { return b ? "Yes" : "No"; }
    function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ""; } }
    function tzOffset() {
      try {
        var o = -new Date().getTimezoneOffset(), s = o < 0 ? "-" : "+"; o = Math.abs(o);
        return "UTC" + s + Math.floor(o / 60) + ":" + ("0" + (o % 60)).slice(-2);
      } catch (e) { return ""; }
    }
    function gpu() {
      try {
        var gl = document.createElement("canvas").getContext("webgl") || document.createElement("canvas").getContext("experimental-webgl");
        if (!gl) return "";
        var dbg = gl.getExtension("WEBGL_debug_renderer_info");
        return (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || "";
      } catch (e) { return ""; }
    }
    var conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
    var meta = {
      submittedAt: new Date().toISOString(),
      // browser / device — from the UA now, refined by Client Hints below where supported
      browser: d.browser,
      browserVersion: "",
      platform: d.platform,
      osVersion: "",
      deviceType: (nav.userAgentData ? (nav.userAgentData.mobile ? "Mobile" : "Desktop")
        : (/Mobi|Android|iPhone|iPad|iPod/.test(nav.userAgent) ? "Mobile" : "Desktop")),
      deviceModel: "",
      architecture: "",
      bitness: "",
      deviceMemory: (nav.deviceMemory ? nav.deviceMemory + " GB" : ""),
      cpuCores: (nav.hardwareConcurrency || ""),
      touchPoints: (nav.maxTouchPoints != null ? nav.maxTouchPoints : ""),
      gpu: gpu(),
      network: (conn.effectiveType || ""),
      // display
      screen: (scr.width ? scr.width + "x" + scr.height : ""),
      viewport: (window.innerWidth + "x" + window.innerHeight),
      pixelRatio: (window.devicePixelRatio || ""),
      colorDepth: (scr.colorDepth ? scr.colorDepth + "-bit" : ""),
      orientation: (scr.orientation && scr.orientation.type) || "",
      colorScheme: (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light"),
      reducedMotion: yn(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches),
      // locale / misc
      language: nav.language || "",
      languages: (nav.languages && nav.languages.join(", ")) || "",
      timezone: tz(),
      timezoneOffset: tzOffset(),
      cookiesEnabled: yn(nav.cookieEnabled),
      doNotTrack: (nav.doNotTrack === "1" || window.doNotTrack === "1" ? "Yes" : (nav.doNotTrack === "0" ? "No" : "Unset")),
      referer: document.referrer || "",
      pageUrl: location.href,
      userAgent: nav.userAgent,
      accuracy: "ip"
    };
    // Fill only the fields we don't already have (first source to answer wins).
    function fill(o) {
      if (!o) return;
      for (var k in o) { if (o[k] != null && o[k] !== "" && (meta[k] == null || meta[k] === "")) meta[k] = o[k]; }
    }

    // Rich IP → geo/ISP lookups. Any one can be down, rate-limited, or blocked by
    // an adblocker/network filter, so we try several and stop at the first that
    // returns real data. Each maps its own JSON shape onto our columns.
    var providers = [
      ["https://ipwho.is/", function (g) {
        return (g && g.success !== false) ? {
          ip: g.ip, city: g.city, state: g.region, country: g.country, postal: g.postal,
          latitude: g.latitude, longitude: g.longitude,
          isp: g.connection && (g.connection.isp || g.connection.org),
          asn: g.connection && g.connection.asn,
          timezone: g.timezone && g.timezone.id
        } : null;
      }],
      ["https://get.geojs.io/v1/ip/geo.json", function (g) {
        return (g && g.ip) ? {
          ip: g.ip, city: g.city, state: g.region, country: g.country,
          latitude: g.latitude, longitude: g.longitude,
          isp: g.organization_name || g.organization, asn: g.asn, timezone: g.timezone
        } : null;
      }],
      ["https://ipapi.co/json/", function (g) {
        return (g && g.ip && !g.error) ? {
          ip: g.ip, city: g.city, state: g.region, country: g.country_name, postal: g.postal,
          latitude: g.latitude, longitude: g.longitude, isp: g.org, asn: g.asn, timezone: g.timezone
        } : null;
      }]
    ];
    function tryProviders(i) {
      if (i >= providers.length) return Promise.resolve();
      return fetch(providers[i][0], { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (g) {
          var o = providers[i][1](g);
          if (o && (o.city || o.isp || o.latitude != null)) { fill(o); return; }
          return tryProviders(i + 1);
        })
        .catch(function () { return tryProviders(i + 1); });
    }

    // First-party Cloudflare edge trace: same-origin on karan98.in, so it survives
    // adblockers and locked-down networks that kill the third-party lookups above.
    // Guarantees IP + country (code) even when every geo provider is blocked.
    function fromTrace() {
      return fetch("/cdn-cgi/trace", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (t) {
          var o = {};
          String(t).split("\n").forEach(function (ln) { var i = ln.indexOf("="); if (i > 0) o[ln.slice(0, i)] = ln.slice(i + 1); });
          fill({ ip: o.ip, country: o.loc });
        })
        .catch(function () { });
    }

    // User-Agent Client Hints (Chromium only): exact OS version, device model
    // (Android exposes e.g. "Pixel 8"; Apple deliberately hides the iPhone model),
    // CPU architecture/bitness, and the full browser version.
    function fromClientHints() {
      var uad = nav.userAgentData;
      if (!uad || !uad.getHighEntropyValues) return Promise.resolve();
      return uad.getHighEntropyValues(["platformVersion", "model", "architecture", "bitness", "uaFullVersion", "fullVersionList"])
        .then(function (h) {
          var ov = h.platformVersion || "";
          if (/Windows/i.test(meta.platform) && ov) {
            var major = parseInt(ov.split(".")[0], 10);
            meta.osVersion = major >= 13 ? "11" : (major >= 1 ? "10" : ov);
            meta.platform = "Windows " + meta.osVersion;
          } else if (ov) { meta.osVersion = ov; }
          if (h.model) meta.deviceModel = h.model;
          if (h.architecture) meta.architecture = h.architecture;
          if (h.bitness) meta.bitness = h.bitness;
          var brand = (h.fullVersionList || []).filter(function (b) { return !/Not.?A.?Brand/i.test(b.brand); }).pop();
          if (brand) { meta.browser = brand.brand + " " + brand.version.split(".").slice(0, 2).join("."); meta.browserVersion = brand.version; }
          else if (h.uaFullVersion) { meta.browserVersion = h.uaFullVersion; }
        })
        .catch(function () { });
    }

    // Never let metadata gathering hold the send hostage — cap the whole thing.
    var work = Promise.all([fromClientHints(), tryProviders(0).then(fromTrace)])
      .then(function () { return meta; }).catch(function () { return meta; });
    var cap = new Promise(function (res) { setTimeout(function () { res(meta); }, 4500); });
    return Promise.race([work, cap]);
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
    renderNav(); renderHero(); renderBuilding(); renderAbout(); renderWork();
    renderExperience(); renderSkills(); renderCredentials(); renderContact();
    wireNav(); wireReveal(); wireContactForm();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
