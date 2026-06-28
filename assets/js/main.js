/* ============================================================================
   main.js — renders every section from window.SITE and wires interactions.
   No framework, no build step. Pure DOM.
   ========================================================================== */
(function () {
  "use strict";
  const S = window.SITE;
  const $ = (sel, el = document) => el.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---- inline SVG icons ------------------------------------------------- */
  const ICON = {
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7L22 6"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8z" fill="currentColor"/></svg>',
  };

  /* ---- hero ------------------------------------------------------------- */
  function renderHero() {
    const p = S.profile, c = S.contact;
    $("#heroLocation").textContent = p.location;
    $("#heroName").textContent = p.name;
    $("#heroRole").innerHTML = `<b>${esc(p.role)}</b> · ${esc(p.org)}`;
    $("#heroAvatar").src = p.avatar;
    $("#navResume").href = c.resume;

    const cta = $("#heroCta");
    cta.appendChild(linkBtn("#work", "btn btn-primary", "View my work"));
    cta.appendChild(linkBtn(c.resume, "btn", `${ICON.download} Résumé`, true));
    cta.appendChild(linkBtn(c.github, "btn", `${ICON.github} GitHub`, true));
    cta.appendChild(linkBtn(c.linkedin, "btn", `${ICON.linkedin} LinkedIn`, true));

    const stats = $("#heroStats");
    S.stats.forEach((s) => {
      stats.appendChild(el("div", "stat",
        `<div class="v grad-text">${esc(s.value)}</div><div class="l">${esc(s.label)}</div>`));
    });
  }

  function linkBtn(href, cls, html, external) {
    const a = el("a", cls, html);
    a.href = href;
    if (external) { a.target = "_blank"; a.rel = "noopener"; }
    return a;
  }

  /* ---- typing effect ---------------------------------------------------- */
  function typeLoop() {
    const node = $("#typed");
    if (!node) return;
    const lines = S.profile.taglines;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { node.textContent = lines[0]; return; }
    let li = 0, ci = 0, deleting = false;
    function tick() {
      const full = lines[li];
      node.textContent = full.slice(0, ci);
      if (!deleting && ci < full.length) { ci++; setTimeout(tick, 38); }
      else if (!deleting && ci === full.length) { deleting = true; setTimeout(tick, 1700); }
      else if (deleting && ci > 0) { ci--; setTimeout(tick, 18); }
      else { deleting = false; li = (li + 1) % lines.length; setTimeout(tick, 260); }
    }
    tick();
  }

  /* ---- about ------------------------------------------------------------ */
  function renderAbout() {
    const p = S.profile;
    $("#aboutSummary").innerHTML = esc(p.summary);
    const chips = $("#aboutChips");
    p.highlights.forEach((h) => chips.appendChild(el("span", "chip", esc(h))));

    const facts = [
      ["Role", p.role],
      ["Organisation", "NIC · MeitY"],
      ["Based in", p.location],
      ["Focus", "AI/ML · Open Data"],
      ["Previously", "McKinsey & Co."],
    ];
    const box = $("#aboutFacts");
    facts.forEach(([k, v]) => box.appendChild(el("div", "row", `<span>${esc(k)}</span><span>${esc(v)}</span>`)));
  }

  /* ---- experience ------------------------------------------------------- */
  function renderExperience() {
    const tl = $("#timeline");
    S.experience.forEach((x) => {
      const item = el("div", "tl-item reveal" + (x.current ? " cur" : ""));
      const bullets = x.bullets.map((b) => `<li>${esc(b)}</li>`).join("");
      const tags = (x.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
      item.innerHTML = `
        <div class="tl-card card">
          <div class="tl-top">
            <h3>${esc(x.title)} ${x.current ? '<span class="now-badge">NOW</span>' : ""}</h3>
            <span class="tl-meta">${esc(x.period)}</span>
          </div>
          <div class="tl-company">${esc(x.company)}</div>
          <div class="tl-loc">${esc(x.location)}</div>
          <ul>${bullets}</ul>
          <div class="tag-row">${tags}</div>
        </div>`;
      tl.appendChild(item);
    });
  }

  /* ---- projects + filtering -------------------------------------------- */
  function renderProjects() {
    const filtersBox = $("#filters");
    const grid = $("#projects");

    S.projectCategories.forEach((cat, i) => {
      const b = el("button", "filter" + (i === 0 ? " active" : ""), esc(cat));
      b.dataset.cat = cat;
      b.addEventListener("click", () => {
        filtersBox.querySelectorAll(".filter").forEach((f) => f.classList.remove("active"));
        b.classList.add("active");
        applyFilter(cat);
      });
      filtersBox.appendChild(b);
    });

    // featured first, keep stable order otherwise
    const ordered = [...S.projects].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    ordered.forEach((pr) => grid.appendChild(projectCard(pr)));

    function applyFilter(cat) {
      grid.querySelectorAll(".proj").forEach((card) => {
        const show = cat === "All" || card.dataset.cat === cat || (cat === "Live" && card.dataset.live === "1");
        card.style.display = show ? "" : "none";
      });
    }
  }

  function projectCard(pr) {
    const card = el("article", "proj card reveal" + (pr.featured ? " feat" : ""));
    card.dataset.cat = pr.category;
    card.dataset.live = pr.live ? "1" : "0";

    const tags = (pr.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    const badge = pr.badge ? `<div class="proj-badge">${esc(pr.badge)}</div>` : "";

    let links = "";
    if (pr.live) links += `<a class="live" href="${esc(pr.live)}" target="_blank" rel="noopener">${ICON.play} Live demo</a>`;
    if (pr.code) links += `<a href="${esc(pr.code)}" target="_blank" rel="noopener">${ICON.github} Code</a>`;

    card.innerHTML = `
      <div class="proj-top">
        <h3>${esc(pr.name)}</h3>
        <span class="cat-pill">${esc(pr.category)}</span>
      </div>
      ${badge}
      <p class="blurb">${esc(pr.blurb)}</p>
      <div class="tags">${tags}</div>
      <div class="links">${links}</div>`;
    return card;
  }

  /* ---- skills ----------------------------------------------------------- */
  function renderSkills() {
    const grid = $("#skills-grid");
    S.skills.forEach((g) => {
      const tags = g.items.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
      grid.appendChild(el("div", "skill-card card reveal", `<h3>${esc(g.group)}</h3><div class="tags">${tags}</div>`));
    });
  }

  /* ---- education + certs ----------------------------------------------- */
  function renderCredentials() {
    const edu = $("#education");
    S.education.forEach((e) => {
      edu.appendChild(el("div", "edu-item",
        `<div class="deg">${esc(e.degree)}</div><div class="sch">${esc(e.school)}</div><div class="per">${esc(e.period)}</div>`));
    });
    const certs = $("#certs");
    S.certifications.forEach((c) => certs.appendChild(el("li", "", esc(c))));
  }

  /* ---- contact + footer ------------------------------------------------- */
  function renderContact() {
    const c = S.contact;
    const actions = $("#contactActions");
    actions.appendChild(linkBtn("mailto:" + c.email, "btn btn-primary", `${ICON.mail} ${esc(c.email)}`));
    actions.appendChild(linkBtn(c.linkedin, "btn", `${ICON.linkedin} LinkedIn`, true));
    actions.appendChild(linkBtn(c.github, "btn", `${ICON.github} GitHub`, true));
    actions.appendChild(linkBtn(c.resume, "btn", `${ICON.download} Résumé`, true));

    const fs = $("#footerSocials");
    [["github", c.github], ["linkedin", c.linkedin], ["mail", "mailto:" + c.email]].forEach(([k, href]) => {
      const a = linkBtn(href, "icon-btn", ICON[k], k !== "mail");
      a.setAttribute("aria-label", k);
      fs.appendChild(a);
    });
    $("#year").textContent = "2026";
  }

  /* ---- interactions: theme, nav, reveal -------------------------------- */
  function wireTheme() {
    const root = document.documentElement;
    const saved = localStorage.getItem("theme");
    if (saved) root.setAttribute("data-theme", saved);
    $("#themeToggle").addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = next === "light" ? "#f7f8fb" : "#0a0b0f";
    });
  }

  function wireNav() {
    const nav = $("#nav");
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const links = $("#navLinks"), burger = $("#navBurger");
    burger.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => links.classList.remove("open")));
  }

  function wireReveal() {
    let pending = [...document.querySelectorAll(".reveal")];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { pending.forEach((i) => i.classList.add("in")); return; }

    // Position-based reveal: anything at or above the viewport's lower 92% is
    // shown. Unlike a bare IntersectionObserver this never "skips" a section on
    // a fast flick-scroll — elements scrolled past always end up revealed.
    function check() {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      pending = pending.filter((node) => {
        if (node.getBoundingClientRect().top < vh * 0.92) { node.classList.add("in"); return false; }
        return true;
      });
      if (!pending.length) { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); }
    }
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { check(); ticking = false; });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    check(); // reveal above-the-fold content immediately
  }

  /* ---- boot ------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    if (!S) return;
    renderHero();
    renderAbout();
    renderExperience();
    renderProjects();
    renderSkills();
    renderCredentials();
    renderContact();
    wireTheme();
    wireNav();
    wireReveal();
    typeLoop();
  });
})();
