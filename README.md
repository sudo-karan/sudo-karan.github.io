# sudo-karan.github.io

Personal portfolio / résumé site for **Jaskaran Singh** — Deputy Director,
National Informatics Centre (NIC · MeitY), Government of India.

Live at **https://karan98.in**

A single-page, dark-first (with light toggle) portfolio. No framework, no build
step — just HTML, CSS and vanilla JS, served straight off GitHub Pages.

## Editing the content

**Everything you'd want to change lives in one file:**
[`assets/js/data.js`](assets/js/data.js). It holds your profile, summary, stats,
experience, projects, skills, certifications, education and contact links. Edit
the values there and the page re-renders itself — you rarely need to touch the
HTML, CSS or JS.

### Common edits
- **Add a project** → add an object to the `projects` array in `data.js`. Set
  `category` to one of the `projectCategories`, add a `live` URL for a demo
  button and/or a `code` URL, and `featured: true` to float it to the top.
- **Update your résumé** → replace `assets/Jaskaran_Singh_Resume.pdf`.
- **Swap your photo** → replace `assets/img/avatar.png`.
- **Change colours** → edit the CSS custom properties at the top of
  [`assets/css/styles.css`](assets/css/styles.css) (`--accent`, `--accent-2`, …).

## Structure

```
index.html              # markup + mount points (mostly static skeleton)
assets/css/styles.css   # theme tokens + all styling (dark + light)
assets/js/data.js       # ← all site content (edit this)
assets/js/main.js       # renders sections from data.js + interactions
assets/img/avatar.png   # profile photo
assets/Jaskaran_Singh_Resume.pdf
.nojekyll               # serve files as-is (skip Jekyll)
```

## Link shortener

**karan98.in/urlshort** makes `karan98.in/s/<code>` short links that anyone can
open until they expire (24 hours unless the maker chooses 10 minutes to 30 days, or,
with the owner key, never). Only
the owner key, or an email on the owner's allow list (verified by a one-time code), can
make them, and every link made and every visit is logged to the contact form's Google
Sheet. It won't make endings with swear words, slurs or adult terms, or links to adult
sites. It runs on Cloudflare Pages Functions with a KV namespace and a D1 database; see
[`URLSHORT_SETUP.md`](URLSHORT_SETUP.md) for the one-time setup.

## Tests

```bash
node --test "tests/*.test.mjs"
```

Node 22 or later, nothing to install. They run the real Functions and the real
Apps Script code (`functions/apps-script/Code.gs`) against stand-ins for Cloudflare
and Google.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
